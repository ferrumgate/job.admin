import { RedisOptions, RedisService } from "../service/redisService";
import { logger } from "../common";
import { HostBasedTask } from "./hostBasedTask";
import { NetworkService } from "../service/networkService";
import { ConfigService } from "../service/configService";
const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');
/***
 * after a tun device created, we added a new iptables rule
 * for security remove this rule if device not exits
 */

export class CheckTunDevicesVSIptables extends HostBasedTask {

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
            const diff = new Date().getTime() - this.lastCheckTime2;
            if (diff > 60000) { //every 60 seconds
                logger.info(`check iptables INPUT table to tun devices`);
                const devices = await NetworkService.getTunDevices();
                const rules = await NetworkService.getInputTableDeviceRules();
                for (const rule of rules) {
                    const device = devices.find(x => x == rule.name);
                    if (!device) {// no device is found for this rule. try to delete it
                        try {
                            logger.info(`no device found for rule ${rule.rule}`)
                            await NetworkService.deleteInputTableIptables(rule.rule);
                        } catch (ignore) { }
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
