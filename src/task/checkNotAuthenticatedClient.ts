/// when client connected execute this task


import { BaseTask } from "./baseTask";
import fspromise from 'fs/promises';
import { NetworkService } from "../service/networkService";
import { GatewayBasedTask } from "./gatewayBasedTask";
import { ConfigService } from "../service/configService";
import { HelperService, logger, RedisService, Tunnel } from "rest.portal";
import { RedisOptions } from "../model/redisOptions";

const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');

/**
 * when a client authenticated, system pushes info for managing, and also adds to a list
 * if something goes wrong, check this list
 */
export class CheckNotAuthenticatedClients extends GatewayBasedTask {


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
            await this.redis?.sremove(`/tunnel/configure/${this.gatewayId}`, tunnelId);
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
            logger.info(`configure tunnel: ${tunnelkey} on gateway: ${this.gatewayId}`)
            const tunnel = await this.redis?.hgetAll(`/tunnel/id/${tunnelkey}`) as Tunnel;
            HelperService.isValidTunnel(tunnel);
            if (tunnel.gatewayId != this.gatewayId) return;//this is important only tunnels in current machine
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
            logger.info(`get all tunnels on this machine ${this.gatewayId} needs to configure`);
            await this.readGatewayId();
            const tunnels = await this.redis?.smembers(`/tunnel/configure/${this.gatewayId}`);
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
                clearIntervalAsync(this.timer);
            this.timer = null;
            await this.redis?.disconnect();

        } catch (err) {
            logger.error(err);
        } finally {
            this.redis = null;
        }
    }
}