import { GatewayBasedTask } from "./gatewayBasedTask";
import { NetworkService } from "../service/networkService";
import { logger, Network, RedisService } from "rest.portal";
import { RedisOptions } from "../model/redisOptions";
import { RedisConfigWatchService } from "rest.portal";
import { BroadcastService } from "../service/broadcastService";

import { Gateway } from "rest.portal";
import { ConfigWatch } from "rest.portal/model/config";

const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');
/***
 * @summary check common rules in iptables
 */

export class CheckIptablesCommon extends GatewayBasedTask {

    protected timer: any | null = null;

    constructor(protected configService: RedisConfigWatchService, protected bcastService: BroadcastService) {
        super();
        this.bcastService.on('configChanged', async (evt: ConfigWatch<any>) => {
            await this.onConfigChanged(evt);
        })
    }

    public async onConfigChanged(event: ConfigWatch<any>) {
        try {
            if (event.path.startsWith('/config/flush')) {
                logger.info(`config flushed check everything`);
                await this.check();
            }
            //TODO analyze what changed 
            if (event.path.startsWith('/config/gateways')) {
                logger.info(`check immediately common iptable rules for gateways`);
                if (event.val.id == this.gatewayId)
                    await this.check();
            }
            if (event.path.startsWith('/config/networks')) {
                logger.info(`check immediately common iptable rules for networks`);
                //TODO analyze what changed
                const network = await this.configService.getNetworkByGateway(this.gatewayId);
                if (!network || network.id == event.val.id)
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
            await this.readGatewayId();
            const currentGateway = await this.configService.getGateway(this.gatewayId);
            if (!currentGateway) {
                logger.error(`current gateway not found ${this.gatewayId}`);
                await NetworkService.blockToIptablesCommon();
                return;
            }
            if (!currentGateway.isEnabled) {
                logger.error(`current gateway disabled ${this.gatewayId}`);
                await NetworkService.blockToIptablesCommon();
                return;
            }
            const network = await this.configService.getNetworkByGateway(this.gatewayId);
            if (!network) {
                logger.error(`current network not found for gateway ${this.gatewayId}`);
                await NetworkService.blockToIptablesCommon();
                return;
            }
            if (!network.isEnabled) {
                logger.error(`current network disabled for gateway ${this.gatewayId}`);
                await NetworkService.blockToIptablesCommon();
                return;
            }
            if (!network.serviceNetwork) {
                logger.error(`service network is not valid for gateway ${this.gatewayId}`);
                await NetworkService.blockToIptablesCommon();
                return;
            }
            await NetworkService.addToIptablesCommon(network.serviceNetwork);

        } catch (err) {
            logger.error(err);
        }
    }


    public override async start(): Promise<void> {

        await this.check();
        this.timer = setIntervalAsync(async () => {
            await this.check();
        }, 30 * 1000);
    }
    public override async stop(): Promise<void> {
        try {
            if (this.timer)
                clearIntervalAsync(this.timer);
            this.timer = null;


        } catch (err) {
            logger.error(err);
        } finally {


        }
    }

}
