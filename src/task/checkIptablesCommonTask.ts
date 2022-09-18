import { RedisOptions, RedisService } from "../service/redisService";
import { logger } from "../common";
import { HostBasedTask } from "./hostBasedTask";
import { NetworkService } from "../service/networkService";
import { ConfigService } from "../service/configService";

/***
 * check common rules in iptables
 */

export class CheckIptablesCommonTask extends HostBasedTask {

    protected timer: NodeJS.Timer | null = null;
    protected redis: RedisService | null = null;
    private lastCheckTime2 = new Date(1).getTime();
    constructor(protected redisOptions: RedisOptions, configFilePath: string, protected configService: ConfigService) {
        super(configFilePath);
    }
    protected createRedisClient() {
        return new RedisService(this.redisOptions.host, this.redisOptions.password);
    }

    public async check() {

        try {
            const diff = new Date().getTime() - this.lastCheckTime2;
            if (diff > 30000) { //every 30 seconds
                logger.info(`check common ip rules`);
                await this.readHostId();
                const serviceNet = await this.configService.getServiceNetwork();
                await NetworkService.addToIptablesCommon(serviceNet);
                this.lastCheckTime2 = new Date().getTime();
            }
        } catch (err) {
            logger.error(err);
        }
    }


    public override async start(): Promise<void> {
        this.redis = this.createRedisClient();
        await this.check();
        this.timer = setInterval(async () => {
            await this.check();
        }, 5 * 1000);
    }
    public override async stop(): Promise<void> {
        try {
            if (this.timer)
                clearInterval(this.timer);
            await this.redis?.disconnect();

        } catch (err) {
            logger.error(err);
        } finally {
            this.redis = null;

        }
    }

}
