/// when client connected execute this task
import { NetworkService } from "../service/networkService";
import { GatewayBasedTask } from "./gatewayBasedTask";

import { HelperService, logger, RedisService, Tunnel } from "rest.portal";
import { RedisOptions } from "../model/redisOptions";
import { BroadcastService } from "rest.portal/service/broadcastService";



/**
 * @summary when a client authenticated, a new interface created, and system informs that, this interface created with some parameters
 * and this task executes interface up, and routing
 */
export class WhenClientAuthenticated extends GatewayBasedTask {

    constructor(private bcastService: BroadcastService) {
        super();
    }




    async onMessage(tunnel: Tunnel) {

        try {
            logger.info(`whenClientAuthenticated configure tunnel on gateway ${this.gatewayId}`)
            await this.readGatewayId();
            if (tunnel.gatewayId != this.gatewayId) return;//this is important only tunnels in current machine
            if (tunnel.tun && tunnel.assignedClientIp && tunnel.serviceNetwork && tunnel.trackId) {
                // interface up and add routing
                // this code is also in checkNotAuthenticatedClientTask.ts
                await NetworkService.linkUp(tunnel.tun);
                await NetworkService.addRoute(tunnel.tun, `${tunnel.assignedClientIp}/32`);
                await NetworkService.addToIptablesClient(tunnel.tun, tunnel.assignedClientIp);
                await NetworkService.addToConntrackClient(tunnel.tun, tunnel.trackId);
                this.bcastService.emit('tunnelConfirm', tunnel);
            }


        } catch (err) {
            logger.error(err);
        } finally {

        }


    }
    async start(): Promise<void> {
        try {

            this.bcastService.on('tunnelConfigure', async (data: Tunnel) => {
                await this.onMessage(data);
            })

        } catch (err) {
            logger.error(err);

        }
    }


    async stop(): Promise<void> {


    }

}