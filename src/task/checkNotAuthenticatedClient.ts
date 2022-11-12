/// when client connected execute this task

import { RedisOptions, RedisService } from "../service/redisService";
import { BaseTask } from "./baseTask";
import fspromise from 'fs/promises';
import { logger } from "../common";
import { Tunnel } from "../model/tunnel";
import { HelperService } from "../service/helperService";
import { NetworkService } from "../service/networkService";
import { HostBasedTask } from "./hostBasedTask";
import { ConfigService } from "../service/configService";

const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');

/**
 * when a client authenticated, system pushes info for managing, and also adds to a list
 * if something goes wrong, check this list
 */
export class CheckNotAuthenticatedClients extends HostBasedTask {


    private timer: any | null = null;
    protected redis: RedisService | null = null;
    constructor(protected redisOptions: RedisOptions, configService: ConfigService) {
        super(configService);
    }

    protected createRedisClient() {
        return new RedisService(this.redisOptions.host, this.redisOptions.password);
    }

    protected async removeFromList(tunnelId: string) {
        try {
            //remove from configure list
            await this.redis?.sremove(`/tunnel/configure/${this.hostId}`, tunnelId);
        } catch (ignored) {
            logger.error(ignored);
        }
    }
    protected async configureNetwork(tunnel: Tunnel) {
        // interface up and add routing
        // this code is also in WhenClientAuthenticated.ts
        if (tunnel.tun && tunnel.assignedClientIp && tunnel.serviceNetwork && tunnel.trackId) {
            await NetworkService.linkUp(tunnel.tun);
            await NetworkService.addRoute(tunnel.tun, `${tunnel.assignedClientIp}/32`);
            await NetworkService.addToIptablesClient(tunnel.tun, tunnel.assignedClientIp);
            await NetworkService.addToConntrackClient(tunnel.tun, tunnel.trackId)
        }
    }
    protected async configure(tunnelkey: string) {

        try {
            logger.info(`configure tunnel: ${tunnelkey} on host: ${this.hostId}`)
            const tunnel = await this.redis?.hgetAll(`/tunnel/id/${tunnelkey}`) as Tunnel;
            HelperService.isValidTunnel(tunnel);
            if (tunnel.hostId != this.hostId) return;//this is important only tunnels in current machine
            if (tunnel.tun && tunnel.authenticatedTime && tunnel.assignedClientIp && tunnel.serviceNetwork && tunnel.trackId) {
                const now = new Date().getTime();
                const authenticatedTime = Date.parse(tunnel.authenticatedTime);
                if (now - authenticatedTime >= 3 * 60 * 1000) {
                    // security check, too late to configure tunnel
                    throw new Error(`too late for configuring tunnel: ${tunnel.id}`)
                }
                await this.configureNetwork(tunnel);
            }
        } catch (ignored) {
            logger.error(ignored);
        } finally {
            await this.removeFromList(tunnelkey)
        }

    }

    public async check() {

        try {
            logger.info(`get all tunnels on this machine ${this.hostId} needs to configure`);
            await this.readHostId();
            const tunnels = await this.redis?.smembers(`/tunnel/configure/${this.hostId}`);
            logger.info(`check not authenticated client list length: ${tunnels?.length}`);
            for (const tunnel of tunnels || []) {
                await this.configure(tunnel);
            }

        } catch (err) {
            logger.error(err);
        }
    }

    public override  async start() {
        this.redis = this.createRedisClient();
        this.timer = setIntervalAsync(async () => {
            await this.check();
        }, 60 * 1000);
    }
    public override async stop() {
        try {
            if (this.timer)
                await clearIntervalAsync(this.timer);
            this.timer = null;
            await this.redis?.disconnect();

        } catch (err) {
            logger.error(err);
        } finally {
            this.redis = null;
        }
    }
}