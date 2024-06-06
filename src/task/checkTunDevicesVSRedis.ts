
import { GatewayBasedTask } from "./gatewayBasedTask";
import { NetworkService } from "../service/networkService";
import { logger, RedisService } from "rest.portal";
import { RedisOptions } from "../model/redisOptions";
import { TunService } from "../service/tunService";
import NodeCache from "node-cache";
const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');
/***
 * @summary we need to check device tun devices againt to redis
 * if tun not exits then there is a problem
 * delete tun device
 */

export class CheckTunDevicesVSRedis extends GatewayBasedTask {

    protected timer: any | null = null;

    protected lastCheckTime2 = new Date(1).getTime();

    protected tunnelKeysForTryAgain = new NodeCache({
        stdTTL: 5 * 60, useClones: false, checkperiod: 10 * 60
    })
    constructor(protected redis: RedisService) {
        super();
    }

    public async check() {

        try {
            const diff = new Date().getTime() - this.lastCheckTime2;
            if (diff > 60000) { //every 60 seconds
                logger.info(`check tun devices to redis`);
                await this.readGatewayId();
                const devices = await NetworkService.getTunDevices();
                for (const device of devices) {
                    if (this.gatewayId && device) {
                        const tunnelKey = await this.redis?.get(`/gateway/${this.gatewayId}/tun/${device}`, false) as string
                        if (!tunnelKey) {//there is a problem delete tun device
                            if (!this.tunnelKeysForTryAgain.has(device))//there can be a sync problem, wait for tunnel confirm 60 seconds
                            {
                                logger.warn(`device ${device} not found on /gateway path, we will try later`);
                                this.tunnelKeysForTryAgain.set(device, new Date().getTime() + 1 * 60 * 1000);//
                                continue;
                            }
                            if (this.tunnelKeysForTryAgain.get(device) as number > new Date().getTime()) {
                                logger.warn(`device ${device} not found on /gateway path, we will try later`);
                                continue;
                            }
                            logger.warn(`deleting device ${device} not exits on gateway ${this.gatewayId}`);
                            await TunService.delete(device);
                        }
                    }
                }
            }
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
            await this.redis?.disconnect();

        } catch (err) {
            logger.error(err);
        } finally {


        }
    }

}
