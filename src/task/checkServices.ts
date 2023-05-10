

import { GatewayBasedTask } from "./gatewayBasedTask";
import { NetworkService } from "../service/networkService";
import { DockerService, Pod } from "../service/dockerService";
import { logger, RedisService, Service } from "rest.portal";
import { RedisOptions } from "../model/redisOptions";
import { RedisConfigWatchService } from "rest.portal";
import { ConfigWatch } from "rest.portal/model/config";
import { BroadcastService } from "rest.portal/service/broadcastService";

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
            const rootFqdn = await this.configService.getDomain();
            const running = await this.dockerService.getAllRunning();

            await this.compare(running, services, rootFqdn);

        } catch (err) {
            logger.error(err);
        }
    }
    async compare(running: Pod[], services: Service[], rootFqdn: string) {
        await this.readGatewayId();
        //normalize service data
        services.forEach(x => {
            x.ports.forEach(y => {
                y.isTcp = y.isTcp ? true : false;
                y.isUdp = y.isUdp ? true : false;
            })
        })
        let stopedList = [];
        for (const run of running.filter(x => x.name.startsWith('ferrumgate-svc'))) {//check running services that must stop

            const serviceId = run.name.replace('ferrumgate-svc', '').split('-')[2];
            if (serviceId) {
                const service = services.find(x => x.id == serviceId)
                const svc = run.svc;
                if (!svc || !service || !service.isEnabled) {
                    logger.warn(`closing pod ${run.name} status: ${service?.isEnabled} update:${service?.updateDate} data: ${JSON.stringify(run.svc)} `);
                    try { await this.dockerService.stop(run); } catch (ignore) { logger.error(ignore) }
                    stopedList.push(run);


                } else
                    if (service.updateDate != svc.lastUpdate) {
                        logger.warn(`closing pod ${run.name} restart needs, update:${service?.updateDate}!=${svc.lastUpdate}`);
                        try { await this.dockerService.stop(run); } catch (ignore) { logger.error(ignore) }
                        stopedList.push(run);

                    }
                    else {

                        const findedPort = service.ports.find(x => x.port == svc.port && x.isTcp == svc.isTcp && x.isUdp == svc.isUdp)
                        if (!findedPort) {
                            logger.warn(`closing pod ${run.name} port not found, data: ${JSON.stringify(run.svc)}`);
                            try { await this.dockerService.stop(run); } catch (ignore) { logger.error(ignore) }
                            stopedList.push(run);
                        } else {
                            if (service.count <= svc?.replica) {
                                logger.warn(`closing pod ${run.name} replica not found, count: ${service?.count} data: ${JSON.stringify(run.svc)}`);
                                try { await this.dockerService.stop(run); } catch (ignore) { logger.error(ignore) }
                                stopedList.push(run);
                            }
                        }

                    }
            }

        }
        //remove stopedlist
        stopedList.forEach(x => {
            let index = running.findIndex(y => y == x);
            if (index >= 0)
                running.splice(index, 1);
        })
        const secureserver = running.find(x => x.image.includes('secure.server') || x.name.includes('secure.server'));
        if (!secureserver) {
            throw new Error(`secure server pod not running`);
        }
        for (const svc of services.filter(x => x.isEnabled)) {
            for (const port of svc.ports) {
                for (let replica = 0; replica < svc.count; ++replica) {
                    const run = running.filter(x => x.name.startsWith('ferrumgate-svc')).find(x => x.svc?.id == svc.id && x.svc.port == port.port && x.svc.isTcp == port.isTcp && x.svc.isUdp == port.isUdp && x.svc.replica == replica)
                    if (!run) {//not running 
                        logger.info(`not running service found ${svc.name} port:${JSON.stringify(port)} replica:${replica}`);
                        try {
                            await this.dockerService.run(svc, this.gatewayId, `container:${secureserver.id}`, rootFqdn, port.port, port.isTcp, port.isUdp);
                        } catch (ignore: any) {
                            logger.error(ignore);
                        }
                    }
                }
            }
        }



    }

    public async onConfigChanged(event: ConfigWatch<any>) {
        try {

            if (event.path.startsWith('/config/flush')) {
                await this.closeAllServices();
            }
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
