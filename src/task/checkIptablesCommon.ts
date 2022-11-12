import { RedisOptions, RedisService } from "../service/redisService";
import { logger } from "../common";
import { HostBasedTask } from "./hostBasedTask";
import { NetworkService } from "../service/networkService";
import { ConfigService } from "../service/configService";
import { ConfigEvent } from "../model/configEvent";
const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');
/***
 * check common rules in iptables
 */

export class CheckIptablesCommon extends HostBasedTask {

    protected timer: any | null = null;
    protected redis: RedisService | null = null;
    private lastCheckTime2 = new Date(1).getTime();
    constructor(protected redisOptions: RedisOptions, protected configService: ConfigService) {
        super(configService);
        this.configService.eventEmitter.on('configChanged', (evt: ConfigEvent) => {
            this.onConfigChanged(evt);
        })
    }
    protected createRedisClient() {
        return new RedisService(this.redisOptions.host, this.redisOptions.password);
    }
    public async onConfigChanged(event: ConfigEvent) {
        try {

            if (event.path.startsWith('/gateways') || event.path.startsWith('/networks')) {
                logger.info(`check immediately common iptable rules`);
                await this.check();
            }

        } catch (err) {
            logger.error(err);
        }
    }

    public async check() {

        try {
            //every 30 seconds
            logger.info(`check common ip rules`);
            await this.readHostId();
            const currentGateway = await this.configService.getGatewayById();
            if (!currentGateway) {
                logger.error(`current gateway not found ${this.hostId}`);
                await NetworkService.blockToIptablesCommon();
                return;
            }
            if (!currentGateway.isEnabled) {
                logger.error(`current gateway disabled ${this.hostId}`);
                await NetworkService.blockToIptablesCommon();
                return;
            }
            const network = await this.configService.getNetworkByGatewayId();
            if (!network) {
                logger.error(`current network not found for gateway ${this.hostId}`);
                await NetworkService.blockToIptablesCommon();
                return;
            }
            if (!network.isEnabled) {
                logger.error(`current network disabled for gateway ${this.hostId}`);
                await NetworkService.blockToIptablesCommon();
                return;
            }
            if (!network.serviceNetwork) {
                logger.error(`service network is not valid for gateway ${this.hostId}`);
                await NetworkService.blockToIptablesCommon();
                return;
            }
            await NetworkService.addToIptablesCommon(network.serviceNetwork);
            this.lastCheckTime2 = new Date().getTime();

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
