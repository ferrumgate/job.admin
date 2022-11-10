import { RedisOptions, RedisService } from "../service/redisService";
import { logger } from "../common";
import { HostBasedTask } from "./hostBasedTask";
import { NetworkService } from "../service/networkService";
import { ConfigService } from "../service/configService";
const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');
/***
 * we need to check device tun devices againt to redis
 * if tun not exits then there is a problem
 * delete tun device
 */

export class CheckServices extends HostBasedTask {

    protected timer: any | null = null;
    protected redis: RedisService | null = null;
    protected lastCheckTime2 = new Date(1).getTime();
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

    public async check() {

        try {
            const diff = new Date().getTime() - this.lastCheckTime2;
            if (diff > 60000) { //every 60 seconds
                logger.info(`check tun devices to redis`);
                await this.readHostId();
                const devices = await NetworkService.getTunDevices();
                for (const device of devices) {
                    if (this.hostId && device) {
                        const tunnelKey = await this.redis?.get(`/host/${this.hostId}/tun/${device}`, false) as string
                        if (!tunnelKey) {//there is a problem delete tun device
                            logger.info(`deleting device ${device} not exits on host ${this.hostId}`);
                            await NetworkService.linkDelete(device);

                        }
                    }
                }
            }
        } catch (err) {
            logger.error(err);
        }
    }


    public override async start(): Promise<void> {
        this.redis = this.createRedisClient();
        await this.check();
        this.timer = setIntervalAsync(async () => {
            await this.check();
        }, 30 * 1000);
    }
    public override async stop(): Promise<void> {
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
