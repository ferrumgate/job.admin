import { RedisOptions, RedisService } from "../service/redisService";
import { logger } from "../common";
import { GatewayBasedTask } from "./gatewayBasedTask";
import { NetworkService } from "../service/networkService";
import { ConfigService } from "../service/configService";
import { Service } from "../model/service";
import { ConfigEvent } from "../model/configEvent";
import { DockerService, Pod } from "../service/dockerService";
const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');
/***
 * we need to check device tun devices againt to redis
 * if tun not exits then there is a problem
 * delete tun device
 */
export interface ServiceEx extends Service {

}

export class CheckServices extends GatewayBasedTask {


    protected timerCheck: any | null = null;


    constructor(protected redisOptions: RedisOptions, configService: ConfigService,
        protected dockerService: DockerService) {
        super(configService);
        this.configService.eventEmitter.on('configChanged', (evt: ConfigEvent) => {
            this.onConfigChanged(evt);
        })
    }
    protected createRedisClient() {
        return new RedisService(this.redisOptions.host, this.redisOptions.password);
    }
    public async closeAllServices() {
        const services = await this.dockerService.getAllRunning();
        for (const svc of services) {
            if (svc.name.startsWith('ferrumsvc'))
                await this.dockerService.stop(svc)
        }
    }
    public async closeService(pod: Pod) {
        await this.dockerService.stop(pod);
    }


    public async checkServices(immediately = false) {

        try {

            logger.info(`checking all services`);
            await this.readGatewayId();

            const currentGateway = await this.configService.getGatewayById();
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
            const network = await this.configService.getNetworkByGatewayId();
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

            const services = await this.configService.getServicesByGatewayId();
            const running = await this.dockerService.getAllRunning();
            await this.compare(running, services);

        } catch (err) {
            logger.error(err);
        }
    }
    async compare(running: Pod[], services: Service[]) {
        await this.readGatewayId();
        for (const run of running.filter(x => x.name.startsWith('ferrumsvc'))) {//check running services that must stop

            const serviceId = run.name.replace('ferrumsvc', '').split('-')[2];
            if (serviceId) {
                const service = services.find(x => x.id == serviceId)
                if (!service || !service.isEnabled) {
                    logger.warn(`closing pod ${run.name}`);
                    try { await this.dockerService.stop(run); } catch (ignore) { logger.error(ignore) }
                }
            }
        }
        const secureserver = running.find(x => x.image.includes('secure.server') || x.name.includes('secure.server'));
        if (!secureserver) {
            throw new Error(`secure server pod not running`);
        }
        for (const svc of services.filter(x => x.isEnabled)) {
            const run = running.find(x => x.name.startsWith('ferrumsvc') && x.name.includes(`-${svc.id}-`))
            if (!run) {//not running 
                logger.info(`not running service found ${svc.name}`);
                try {
                    await this.dockerService.run(svc, this.gatewayId, `container:${secureserver.id}`);
                } catch (ignore: any) {
                    logger.error(ignore);
                }
            }
        }


    }

    public async onConfigChanged(event: ConfigEvent) {
        try {

            if (event.path.startsWith('/services') || event.path.startsWith('/gateways') || event.path.startsWith('/networks')) {
                logger.info(`check immediately services`);
                await this.checkServices();
            }

        } catch (err) {
            logger.error(err);
        }
    }


    public override async start(): Promise<void> {
        try {

            await this.checkServices();
            this.timerCheck = setIntervalAsync(async () => {
                await this.checkServices();
            }, 30 * 1000);
        } catch (err) {
            logger.error(err);
            setTimeout(async () => {
                await this.stop();
                await this.start();
            }, 5000);//try again 5 seconds
        }
    }
    public override async stop(): Promise<void> {
        try {
            if (this.timerCheck)
                await clearIntervalAsync(this.timerCheck);
            this.timerCheck = null;


        } catch (err) {
            logger.error(err);
        } finally {

        }
    }

}
