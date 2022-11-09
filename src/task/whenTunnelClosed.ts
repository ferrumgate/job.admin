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
 * when a client disconnects, publish its tunnel key
 * follow and delete all related data
 */
export class WhenTunnelClosed extends HostBasedTask {

    protected redisSub: RedisService | null = null
    protected redis: RedisService | null = null;
    constructor(protected redisOptions: RedisOptions, configService: ConfigService) {
        super(configService);
    }

    protected createRedisClient() {
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
        const channelName = `/tunnel/closed/${this.hostId}`;
        if (channel !== channelName) return;
        let tunnelId = undefined;
        try {
            logger.info(`tunnel closed ${message}`)
            const tunnel = await this.redis?.hgetAll(`/tunnel/id/${message}`) as Tunnel;
            HelperService.isValidTunnel(tunnel);
            tunnelId = tunnel.id;
            if (tunnel.hostId != this.hostId) return;//this is important only tunnels in current machine
            if (tunnel.tun) {
                // delete tunnel data from redis
                await this.redis?.delete(`/tunnel/id/${message}`);
                const rules = await NetworkService.getInputTableDeviceRules();
                logger.info(`deleting iptables rule for device ${tunnel.tun}`);
                for (const rule of rules.filter(x => x.name == tunnel.tun)) {
                    try {
                        logger.info(`deleting iptables rule ${rule.rule}`)
                        await NetworkService.deleteInputTableIptables(rule.rule);
                    } catch (ignore) { }

                }
            }

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
            await this.redisSub.subscribe(`/tunnel/closed/${this.hostId}`);
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