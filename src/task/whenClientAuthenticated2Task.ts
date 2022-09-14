/// when client connected execute this task

import { RedisService } from "../../src/service/redisService";
import { BaseTask } from "./baseTask";
import fspromise from 'fs/promises';
import { logger } from "../common";
import { Tunnel } from "../model/tunnel";
import { HelperService } from "../service/helperService";
import { NetworkService } from "../service/networkService";
import { HostBasedTask } from "./hostBasedTask";
import { setInterval } from "timers";

/**
 * when a client authenticated, system pushes info for managing, and also adds to a list
 * if something goes wrong
 */
export class WhenClientAuthenticated2Task extends HostBasedTask {


    private timer: NodeJS.Timer | null = null;
    private redis: RedisService | null = null;
    constructor(private redisHost: string, configFilePath: string) {
        super(configFilePath);
    }

    private createRedisClient() {
        return new RedisService(this.redisHost);
    }

    private async removeFromList(tunnelId: string) {
        try {
            //remove from configure list
            await this.redis?.sremove(`/tunnel/configure/${this.hostId}`, tunnelId);
        } catch (ignored) {
            logger.error(ignored);
        }
    }
    private async configure(tunnelkey: string) {
        let tunnelId = undefined;
        try {
            logger.info(`configure tunnel: ${tunnelkey} on host: ${this.hostId}`)
            const tunnel = await this.redis?.hgetAll(`/tunnel/${tunnelkey}`) as Tunnel;
            HelperService.isValidTunnel(tunnel);
            tunnelId = tunnel.id;
            if (tunnel.hostId != this.hostId) return;//this is important only tunnels in current machine
            if (tunnel.tun) {// interface up and add routing
                await NetworkService.linkUp(tunnel.tun);
                await NetworkService.addRoute(tunnel.tun, `${tunnel.assignedClientIp}/32`);
            }
        } catch (ignored) {
            if (tunnelId)
                await this.removeFromList(tunnelId)
        }

    }
    public async check() {

        try {
            logger.info("get all tunnels on this needs to configure");
            await this.readHostId();
            const tunnels = await this.redis?.smembers(`/tunnel/configure/${this.hostId}`);
            for (const tunnel of tunnels || []) {
                await this.configure(tunnel);
            }

        } catch (err) {
            logger.error(err);
        }
    }

    public override  async start() {
        this.timer = setInterval(async () => {
            await this.check();
        }, 60 * 1000);
    }
    public override async stop() {
        if (this.timer)
            clearInterval(this.timer);
    }
}