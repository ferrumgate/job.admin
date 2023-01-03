import { Gateway, logger, PolicyService, RedisConfigService, RedisConfigWatchService, Service, Tunnel } from "rest.portal";
import { PolicyAuthzResult } from "rest.portal/service/policyService";
import { ConfigWatch } from "rest.portal/service/redisConfigService";
import { setIntervalAsync } from "set-interval-async";
import { BroadcastService } from "../service/broadcastService";
import { LmdbService } from "../service/lmdbService";
import { GatewayBasedTask } from "./gatewayBasedTask";

export class PolicyWatcherTask extends GatewayBasedTask {

    lmdbService!: LmdbService;
    unstableSystem = false;
    tunnels = new Map();
    configChangedTimes: number[] = [];
    configChangedTimer: any;
    constructor(private dbFolder: string, private policyService: PolicyService,
        private redisConfigService: RedisConfigWatchService,
        private bcastEvents: BroadcastService) {
        super()

    }
    async start() {
        this.lmdbService = await LmdbService.open('ferrumgate', this.dbFolder, 'string', 16);
        await this.lmdbService.clear();
        this.bcastEvents.on('tunnelExpired', async (tun: Tunnel) => {
            await this.tunnelExpired(tun);
        })
        this.bcastEvents.on('tunnelConfirm', async (tun: Tunnel) => {
            await this.tunnelConfirmed(tun);
        })
        this.bcastEvents.on('configChanged', async (data: ConfigWatch<any>) => {
            await this.configChanged(data);
        })
        this.configChangedTimer = await setIntervalAsync(async () => {
            await this.executeConfigChanged();
        }, 2000);
    }

    async stop() {

        await this.lmdbService.clear();
        await this.lmdbService.close();
    }
    isStable() {
        if (this.unstableSystem) throw new Error('unstable policy watcher');
    }

    async tunnelExpired(tun: Tunnel) {
        try {
            this.tunnels.delete(tun.id);
            this.isStable();
            await this.lmdbClearTunnel(tun);
        } catch (err) {
            logger.error(err);
            this.unstableSystem = true;
        }
    }

    async getNetworkAndGateway() {
        const gateway = await this.redisConfigService.getGateway(this.gatewayId);
        if (!gateway?.isEnabled) {
            logger.warn(`policywatcher-> gateway not found or not enabled`)
            return {};
        }
        const network = await this.redisConfigService.getNetworkByGateway(gateway.id);
        if (!network?.isEnabled) {
            logger.warn(`policywatcher-> network not found or not enabled`)
            return { gateway: gateway }
        }
        return { gateway: gateway, network: network }
    }
    async tunnelConfirmed(tun: Tunnel) {
        try {
            logger.info(`policywatcher-> tunnel confirmed trackId: ${tun.trackId}`)
            this.tunnels.set(tun.id, tun);
            this.isStable();

            const { gateway, network } = await this.getNetworkAndGateway();
            if (!network || !gateway) {
                return;
            }
            const services = await this.redisConfigService.getServicesByNetworkId(network.id);
            if (!services.length) {
                logger.warn(`policywatcher-> tunnel trackId: ${tun.trackId} services not found`);
                await this.lmdbClearTunnel(tun);
                return;
            }

            for (const svc of services) {
                const presult = await this.policyService.authorize(tun, svc.id, false);
                logger.warn(`policywatcher-> writing policy svcId: ${svc.id}`);
                await this.lmdbWrite(tun, presult, svc);
            }


        } catch (err) {
            logger.error(err);
            this.unstableSystem = true;
        }
    }

    async configChanged(data: ConfigWatch<any>) {
        try {
            switch (data.path) {
                case '/config/networks':
                case '/config/gateways':
                case '/config/services':
                case '/config/groups':
                case '/config/users':
                case '/config/authorizationPolicy/rules':
                case '/config/authorizationPolicy/rulesOrder':
                    this.configChangedTimes.push(new Date().getTime());
                    break;
            }
        } catch (err) {
            logger.error(err);
            this.unstableSystem = true;
        }
    }

    async executeConfigChanged() {
        try {
            this.isStable();
            if (!this.configChangedTimes.length) return;
            if (!(new Date().getTime() - this.configChangedTimes[0] < 2000)) return;
            logger.info(`policywatcher-> config changed detected`);
            let removeLength = this.configChangedTimes.length;
            let removeKeys = new Map();
            for (const iterator of this.tunnels) {
                const range = await this.lmdbService.range({ start: this.createKey(iterator[1]) });
                for (const it of range) {
                    removeKeys.set(it.key, 1);
                }
            }
            const { gateway, network } = await this.getNetworkAndGateway();
            if (!gateway || !network) {
                logger.info(`policywatcher-> gateway or network not found`);
                await this.lmdbService.batch(async () => {
                    for (const key of removeKeys) {
                        await this.lmdbService.remove(key);
                    }
                })
                this.configChangedTimes.splice(0, removeLength);
                return;
            }

            const services = await this.redisConfigService.getServicesAll();
            const filtered = services.filter(x => x.networkId == network.id);
            let writeList: string[][] = [];
            for (const svc of filtered) {
                for (const tun of this.tunnels.values()) {
                    const result = await this.policyService.authorize(tun, svc.id, false);
                    const key = this.createKey(tun, svc);
                    const value = this.createValue(tun, result, svc);
                    writeList.push([key, value]);
                }
            }
            if (writeList.length || removeKeys.size) {
                for (const iterator of writeList) {//for performance, no need to delete if we will put again
                    removeKeys.delete(iterator[0]);
                }
                await this.lmdbService.batch(async () => {
                    for (const key of removeKeys.keys()) {
                        await this.lmdbService.remove(key);
                    }
                    for (const it of writeList) {
                        await this.lmdbService.put(it[0], it[1])
                    }
                })
            }

            this.configChangedTimes.splice(0, removeLength);

        } catch (err) {
            logger.error(err);
            this.unstableSystem = true;
        }
    }


    createKey(tun: Tunnel, svc?: Service) {
        if (tun && svc)
            return `/authorize/track/id/${tun.id}/service/id/${svc.id}`
        else
            return `/authorize/track/id/${tun.id}/service/id/`
    }
    createValue(tun: Tunnel, result: PolicyAuthzResult, svc: Service) {
        let isDrop = result.error ? 1 : 0;
        return `/${isDrop}/${result.error}/${result.rule?.id}/${tun.id}/${tun.userId}`
    }
    async lmdbWrite(tun: Tunnel, result: PolicyAuthzResult, svc: Service) {
        // /authorize/track/id/2/service/id/1  /pResult/errorNumber/ruleNumber/tunId/userId/networkId

        await this.lmdbService.put(this.createKey(tun, svc), this.createValue(tun, result, svc))
    }
    async lmdbClearTunnel(tun: Tunnel) {
        logger.info(`policywatcher-> clearing policy trackId: ${tun.trackId}`)
        const range = await this.lmdbService.range({ start: this.createKey(tun) });
        await this.lmdbService.batch(async () => {
            for (const r of range) {
                await this.lmdbService.remove(r.key);
            }
        })
    }


}