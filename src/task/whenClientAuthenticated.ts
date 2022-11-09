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


/**
 * when a client authenticated, a new interface created, and system informs that, this interface created with some parameters
 * and this task executes interface up, and routing
 */
export class WhenClientAuthenticated extends HostBasedTask {

    private redisSub: RedisService | null = null
    private redis: RedisService | null = null;
    constructor(protected redisOptions: RedisOptions, configService: ConfigService) {
        super(configService);
    }

    private createRedisClient() {
        return new RedisService(this.redisOptions.host, this.redisOptions.password);
    }
    private async removeFromList(tunnelId: string) {
        try {
            //remove from configure list
            await this.redis?.sremove(`/tunnel/configure/${this.hostId}`, tunnelId);
        } catch (ignored) {
            logger.error(ignored);
        }
    }

    async onMessage(channel: string, message: string) {
        const channelName = `/tunnel/configure/${this.hostId}`;
        if (channel !== channelName) return;
        let tunnelId = undefined;
        try {
            logger.info(`configure tunnel: ${message} on host: ${this.hostId}`)
            const tunnel = await this.redis?.hgetAll(`/tunnel/id/${message}`) as Tunnel;
            HelperService.isValidTunnel(tunnel);
            tunnelId = tunnel.id;
            if (tunnel.hostId != this.hostId) return;//this is important only tunnels in current machine
            if (tunnel.tun && tunnel.assignedClientIp && tunnel.serviceNetwork && tunnel.trackId) {
                // interface up and add routing
                // this code is also in checkNotAuthenticatedClientTask.ts
                await NetworkService.linkUp(tunnel.tun);
                await NetworkService.addRoute(tunnel.tun, `${tunnel.assignedClientIp}/32`);
                await NetworkService.addToIptablesClient(tunnel.tun, tunnel.assignedClientIp);
                await NetworkService.addToConntrackClient(tunnel.tun, tunnel.trackId);
            }
            //remove from configure list
            await this.redis?.sremove(`/tunnel/configure/${this.hostId}`, tunnel.id || '');

        } catch (err) {
            logger.error(err);
        } finally {
            if (tunnelId)
                await this.removeFromList(tunnelId);
        }


    }
    async start(): Promise<void> {
        try {
            await this.readHostId();
            this.redis = this.createRedisClient();
            this.redisSub = this.createRedisClient();
            await this.redisSub.subscribe(`/tunnel/configure/${this.hostId}`);
            await this.redisSub.onMessage(async (channel, message) => {
                await this.onMessage(channel, message);
            });

        } catch (err) {
            logger.error(err);
            setTimeout(async () => {
                await this.stop();
                await this.start();
            }, 5000);//try again 5seconds
        }
    }


    async stop(): Promise<void> {
        try {
            await this.redis?.disconnect();
            await this.redisSub?.disconnect();
        } catch (err) {
            logger.error(err);
        } finally {
            this.redis = null;
            this.redisSub = null;
        }

    }

}