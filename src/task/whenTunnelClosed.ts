import { logger, Tunnel } from "rest.portal";
import { BroadcastService } from "rest.portal/service/broadcastService";
import { TunService } from "../service/tunService";
import { GatewayBasedTask } from "./gatewayBasedTask";

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
            logger.info(`whenTunnelClosed tunnel closed trackId: ${tunnel.trackId}`)

            if (tunnel.gatewayId != this.gatewayId) return;//this is important only tunnels in current machine
            if (tunnel.tun) {
                // delete tunnel data from redis
                TunService.deleteIptableRules(tunnel.tun);
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