import { GatewayBasedTask } from "./gatewayBasedTask";
import { NetworkService } from "../service/networkService";

import { logger, RedisService } from "rest.portal";
import { RedisOptions } from "../model/redisOptions";
const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');
/***
 * @summary after a tun device created, we added a new iptables rule
 * for security remove this rule if device not exits
 */

export class CheckTunDevicesVSIptables extends GatewayBasedTask {

    protected timer: any | null = null;
    protected lastCheckTime2 = new Date(1).getTime();
    constructor() {
        super();
    }


    public async check() {

        try {
            const diff = new Date().getTime() - this.lastCheckTime2;
            if (diff > 60000) { //every 60 seconds
                logger.info(`check iptables INPUT table to tun devices`);
                const devices = await NetworkService.getTunDevices();
                const rulesInput = await NetworkService.getInputTableDeviceRules();
                for (const rule of rulesInput) {
                    const device = devices.find(x => x == rule.name);
                    if (!device) {// no device is found for this rule. try to delete it
                        try {
                            logger.info(`no device found for rule ${rule.rule}`)
                            await NetworkService.deleteTableIptables(rule.rule);
                        } catch (ignore) { }
                    }
                }
                const rulesPrerouting = await NetworkService.getManglePreroutingTableDeviceRules();
                for (const rule of rulesPrerouting) {
                    const device = devices.find(x => x == rule.name);
                    if (!device) {// no device is found for this rule. try to delete it
                        try {
                            logger.info(`no device found for rule ${rule.rule}`)
                            await NetworkService.deleteMangleTableIptables(rule.rule);
                        } catch (ignore) { }
                    }
                }


                const rulesOutput = await NetworkService.getMangleOutputTableDeviceRules();
                for (const rule of rulesOutput) {
                    const device = devices.find(x => x == rule.name);
                    if (!device) {// no device is found for this rule. try to delete it
                        try {
                            logger.info(`no device found for rule ${rule.rule}`)
                            await NetworkService.deleteMangleTableIptables(rule.rule);
                        } catch (ignore) { }
                    }
                }

                const rulesPostrouting = await NetworkService.getManglePostroutingTableDeviceRules();
                for (const rule of rulesPostrouting) {
                    const device = devices.find(x => x == rule.name);
                    if (!device) {// no device is found for this rule. try to delete it
                        try {
                            logger.info(`no device found for rule ${rule.rule}`)
                            await NetworkService.deleteMangleTableIptables(rule.rule);
                        } catch (ignore) { }
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
        } catch (err) {
            logger.error(err);
        }
    }

}
