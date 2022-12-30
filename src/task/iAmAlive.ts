

import { GatewayBasedTask } from "./gatewayBasedTask";
import { NetworkService } from "../service/networkService";
import { ConfigService } from "../service/configService";
import os from 'os';
import { logger, RedisService } from "rest.portal";
import { RedisOptions } from "../model/redisOptions";
const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');
/***
 * 
 * every 5 second, host sends I am alive
 * 
 */

export class IAmAlive extends GatewayBasedTask {

    protected timer: any | null = null;
    protected redis: RedisService | null = null;
    protected lastCheckTime2 = new Date(1).getTime();
    constructor(protected redisOptions: RedisOptions, configService: ConfigService) {
        super(configService);
    }
    protected createRedisClient() {
        return new RedisService(this.redisOptions.host, this.redisOptions.password);
    }

    public async check() {

        try {

            logger.info(`write I am alive to redis global`);
            await this.readGatewayId();
            //set to the global
            let hostkey = `/alive/gateway/id/${this.gatewayId}`;
            await this.redis?.hset(hostkey, {
                id: this.gatewayId,
                arch: os.arch(),
                cpusCount: os.cpus().length,
                cpuInfo: os.cpus().find(x => x)?.model,
                hostname: os.hostname(),
                totalMem: os.totalmem(),
                type: os.type(),
                uptime: os.uptime(),
                version: os.version(),
                platform: os.platform(),
                release: os.release(),
                freeMem: os.freemem(),
                interfaces: JSON.stringify(os.networkInterfaces()),
                lastSeen: new Date().getTime()
            })
            await this.redis?.expire(hostkey, 5 * 60 * 1000);

        } catch (err) {
            logger.error(err);
        }
    }


    public override async start(): Promise<void> {
        this.redis = this.createRedisClient();
        await this.check();
        this.timer = setIntervalAsync(async () => {
            await this.check();
        }, 5 * 1000);
    }
    public override async stop(): Promise<void> {
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
