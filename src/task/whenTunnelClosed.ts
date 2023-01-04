/// when client connected execute this task

import { NetworkService } from "../service/networkService";
import { GatewayBasedTask } from "./gatewayBasedTask";

import { HelperService, logger, RedisService, Tunnel } from "rest.portal";
import { RedisOptions } from "../model/redisOptions";
import { BroadcastService } from "../service/broadcastService";


/**
 * @summary when a client disconnects, publish its tunnel key
 * follow and delete all related data
 */
export class WhenTunnelClosed extends GatewayBasedTask {

    constructor(private bcastService: BroadcastService) {
        super();
    }


    async onMessage(tunnel: Tunnel) {


        try {
            await this.readGatewayId();
            logger.info(`tunnel closed trackId: ${tunnel.trackId}`)

            if (tunnel.gatewayId != this.gatewayId) return;//this is important only tunnels in current machine
            if (tunnel.tun) {
                // delete tunnel data from redis
                const rulesInput = await NetworkService.getInputTableDeviceRules();
                logger.info(`deleting iptables INPUT rule for device ${tunnel.tun}`);
                for (const rule of rulesInput.filter(x => x.name == tunnel.tun)) {
                    try {
                        logger.info(`deleting iptables INPUT rule ${rule.rule}`)
                        await NetworkService.deleteTableIptables(rule.rule);
                    } catch (ignore) { }

                }
                const rulesOutput = await NetworkService.getMangleOutputTableDeviceRules();
                logger.info(`deleting iptables MANGLE OUTPUT rule for device ${tunnel.tun}`);
                for (const rule of rulesOutput.filter(x => x.name == tunnel.tun)) {
                    try {
                        logger.info(`deleting iptables MANGLE OUTPUT rule ${rule.rule}`)
                        await NetworkService.deleteMangleTableIptables(rule.rule);
                    } catch (ignore) { }

                }

                const rulesPostrouting = await NetworkService.getManglePostroutingTableDeviceRules();
                logger.info(`deleting iptables MANGLE POSTROUTING rule for device ${tunnel.tun}`);
                for (const rule of rulesPostrouting.filter(x => x.name == tunnel.tun)) {
                    try {
                        logger.info(`deleting iptables MANGLE POSTROUTING rule ${rule.rule}`)
                        await NetworkService.deleteMangleTableIptables(rule.rule);
                    } catch (ignore) { }

                }
            }

        } catch (err) {
            logger.error(err);
        } finally {

        }


    }
    async start(): Promise<void> {
        try {

            this.bcastService.on('tunnelExpired', async (data: Tunnel) => {
                await this.onMessage(data);
            })

        } catch (err) {
            logger.error(err);

        }
    }


    async stop(): Promise<void> {


    }

}