

import { GatewayBasedTask } from "./gatewayBasedTask";
import { NetworkService } from "../service/networkService";
import { DockerService, Pod } from "../service/dockerService";
import { ConfigEvent, logger, RedisService, Service } from "rest.portal";
import { RedisOptions } from "../model/redisOptions";
import { BroadcastService } from "../service/broadcastService";
import { RedisConfigWatchService } from "rest.portal";
import { ConfigWatch } from "rest.portal/service/redisConfigService";
const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');
/***
 *@summary we need to check device tun devices againt to redis
 * if tun not exits then there is a problem
 * delete tun device
 */
export interface ServiceEx extends Service {

}

export class CheckServices extends GatewayBasedTask {


    protected timerCheck: any | null = null;


    constructor(private configService: RedisConfigWatchService,
        protected bcastService: BroadcastService,
        protected dockerService: DockerService) {
        super();
        this.bcastService.on('configChanged', (evt: ConfigWatch<any>) => {
            this.onConfigChanged(evt);
        })
    }

    public async closeAllServices() {
        const services = await this.dockerService.getAllRunning();
        for (const svc of services) {
            if (svc.name.startsWith('ferrumgate-svc'))
                await this.dockerService.stop(svc)
        }
    }
    public async closeService(pod: Pod) {
        await this.dockerService.stop(pod);
    }


    public async checkServices() {

        try {

            logger.info(`checking all services`);
            await this.readGatewayId();

            const currentGateway = await this.configService.getGateway(this.gatewayId);
            if (!currentGateway) {
                logger.error(`current gateway not found ${this.gatewayId}`);
                await this.closeAllServices();
                return;
            }
            if (!currentGateway.isEnabled) {
                logger.error(`current gateway disabled ${this.gatewayId}`);
                await this.closeAllServices();
                return;
            }
            const network = await this.configService.getNetworkByGateway(this.gatewayId);
            if (!network) {
                logger.error(`current network not found for gateway ${this.gatewayId}`);
                await this.closeAllServices();
                return;
            }
            if (!network.isEnabled) {
                logger.error(`current network disabled for gateway ${this.gatewayId}`);
                await this.closeAllServices();
                return;
            }
            if (!network.serviceNetwork) {
                logger.error(`service network is not valid for gateway ${this.gatewayId}`);
                await this.closeAllServices();
                return;
            }

            const services = await this.configService.getServicesByNetworkId(network.id);
            const running = await this.dockerService.getAllRunning();
            await this.compare(running, services);

        } catch (err) {
            logger.error(err);
        }
    }
    async compare(running: Pod[], services: Service[]) {
        await this.readGatewayId();
        let restartList = [];
        for (const run of running.filter(x => x.name.startsWith('ferrumgate-svc'))) {//check running services that must stop

            const serviceId = run.name.replace('ferrumgate-svc', '').split('-')[2];
            if (serviceId) {
                const service = services.find(x => x.id == serviceId)
                const lastUpdate = run.details?.Config?.Labels.Ferrum_Svc_LastUpdate;
                if (!service || !service.isEnabled) {
                    logger.warn(`closing pod ${run.name} status: ${service?.isEnabled} update:${service?.updateDate}`);
                    try { await this.dockerService.stop(run); } catch (ignore) { logger.error(ignore) }

                } else
                    if (service.updateDate != lastUpdate) {
                        logger.warn(`closing pod ${run.name} restart needs, status: ${service?.isEnabled} update:${service?.updateDate}!=${lastUpdate}`);
                        try { await this.dockerService.stop(run); } catch (ignore) { logger.error(ignore) }
                        restartList.push(service);

                    }
            }

        }
        const secureserver = running.find(x => x.image.includes('secure.server') || x.name.includes('secure.server'));
        if (!secureserver) {
            throw new Error(`secure server pod not running`);
        }
        for (const svc of services.filter(x => x.isEnabled)) {
            const run = running.find(x => x.name.startsWith('ferrumgate-svc') && x.name.includes(`-${svc.id}-`))
            if (!run) {//not running 
                logger.info(`not running service found ${svc.name}`);
                try {
                    await this.dockerService.run(svc, this.gatewayId, `container:${secureserver.id}`);
                } catch (ignore: any) {
                    logger.error(ignore);
                }
            }
        }
        for (const svc of restartList) {
            logger.info(`restart service found ${svc.name}`);
            try {
                await this.dockerService.run(svc, this.gatewayId, `container:${secureserver.id}`);
            } catch (ignore: any) {
                logger.error(ignore);
            }

        }


    }

    public async onConfigChanged(event: ConfigWatch<any>) {
        try {

            if (event.path.startsWith('/config/services') || event.path.startsWith('/config/gateways') || event.path.startsWith('/config/networks')) {
                logger.info(`check immediately services`);
                await this.checkServices();
            }

        } catch (err) {
            logger.error(err);
        }
    }


    public override async start(): Promise<void> {
        try {
            await this.closeAllServices();
        } catch (err) {
            logger.error(err);
        }
        try {

            await this.checkServices();
            this.timerCheck = setIntervalAsync(async () => {
                await this.checkServices();
            }, 30 * 1000);
        } catch (err) {
            logger.error(err);
        }
    }
    public override async stop(): Promise<void> {
        try {
            if (this.timerCheck)
                clearIntervalAsync(this.timerCheck);
            this.timerCheck = null;


        } catch (err) {
            logger.error(err);
        }
    }

}
