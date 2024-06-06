import { logger, PolicyService, RedisConfigWatchService, Service, Tunnel } from "rest.portal";
import { ConfigWatch } from "rest.portal/model/config";
import { BroadcastService } from "rest.portal/service/broadcastService";
import { PolicyAuthzResult } from "rest.portal/service/policyService";
import { clearIntervalAsync, setIntervalAsync } from "set-interval-async";
import { LmdbService } from "../service/lmdbService";
import { GatewayBasedTask } from "./gatewayBasedTask";
/**
 * @summary follows system logs, all tunnels, all config changes
 * and recalculates policy 
 * @see SystemWatcherTask, all events are redirect from there
 */
export class PolicyWatcherTask extends GatewayBasedTask {

    protected lmdbService!: LmdbService;

    protected tunnels = new Map();
    protected configChangedTimes: number[] = [];
    protected configChangedTimer: any;
    protected errorCount = 0;
    protected errorLastTime = 0;
    constructor(private dbFolder: string, private policyService: PolicyService,
        private redisConfigService: RedisConfigWatchService,
        private bcastEvents: BroadcastService) {
        super()

    }
    async start() {

        this.lmdbService = await LmdbService.open('policy', this.dbFolder, 'string', 24);
        logger.info(`opening policy lmdb folder ${this.dbFolder}`);
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
        this.configChangedTimer = setIntervalAsync(async () => {
            await this.executeConfigChanged();
        }, 1000);
    }

    async stop() {
        if (this.configChangedTimer)
            clearIntervalAsync(this.configChangedTimer);
        this.configChangedTimer = null;
        await this.lmdbService.clear();
        await this.lmdbService.close();
    }

    async tunnelExpired(tun: Tunnel) {
        try {
            logger.info(`policy watcher tunnel expired tunId:${tun.id}`)
            this.tunnels.delete(tun.id);
            await this.lmdbClearTunnel(tun);
        } catch (err) {
            logger.error(err);
            this.configChangedTimes.push(new Date().getTime());
        }
    }

    async getNetworkAndGateway() {
        const gateway = await this.redisConfigService.getGateway(this.gatewayId);
        if (!gateway) {
            logger.warn(`policy watcher gateway not found`)
            return {};
        }
        const network = await this.redisConfigService.getNetwork(gateway.networkId || '');
        if (!network) {
            logger.warn(`policy watcher network not found`)
            return { gateway: gateway }
        }
        return { gateway: gateway, network: network }
    }
    async tunnelConfirmed(tun: Tunnel) {
        try {
            logger.info(`policy watcher tunnel confirmed trackId: ${tun.trackId}`)
            this.tunnels.set(tun.id, tun);

            const { gateway, network } = await this.getNetworkAndGateway();
            if (!network) {
                logger.warn(`policy watcher tunnel trackId: ${tun.trackId} network not found`);
                await this.lmdbClearTunnel(tun);
                return;
            }
            const services = await this.redisConfigService.getServicesAll();
            const filtered = services.filter(x => x.networkId == network.id);
            if (!filtered.length) {
                logger.warn(`policy watcher tunnel trackId: ${tun.trackId} services not found`);
                await this.lmdbClearTunnel(tun);
                return;
            }

            for (const svc of filtered) {
                const presult = await this.policyService.authorize(tun, svc.id, false);
                logger.warn(`policy watcher writing policy svcId: ${svc.id} tunId: ${tun.id} trackId: ${tun.trackId}`);
                await this.lmdbWrite(tun, presult, svc);
            }

        } catch (err) {
            logger.error(err);
            this.configChangedTimes.push(new Date().getTime());
        }
    }

    async configChanged(data: ConfigWatch<any>) {
        try {
            switch (data.path) {
                case '/config/flush':
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

        }
    }

    async executeConfigChanged() {
        try {

            if (!this.configChangedTimes.length) return;
            if ((new Date().getTime() - this.configChangedTimes[0] < 2000)) return;
            logger.info(`policy watcher config changed detected`);
            let removeLength = this.configChangedTimes.length;
            let removeKeys = new Map();
            for (const tun of this.tunnels.values()) {
                const range = await this.lmdbGetTunnel(tun);
                for (const it of range) {
                    removeKeys.set(it.key, 1);
                }
            }
            const { gateway, network } = await this.getNetworkAndGateway();
            if (!network) {
                logger.info(`policy watcher network not found`);
                await this.lmdbService.transaction(async () => {
                    for (const key of removeKeys.keys()) {
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
                await this.lmdbService.transaction(async () => {
                    for (const key of removeKeys.keys()) {
                        await this.lmdbService.remove(key);
                    }
                    for (const it of writeList) {
                        await this.lmdbService.put(it[0], it[1])
                    }
                })
            }

            this.configChangedTimes.splice(0, removeLength);
            this.errorCount = 0;
            this.errorLastTime = 0;
        } catch (err) {
            logger.error(err);
            this.errorCount++;
            this.errorLastTime = new Date().getTime();

        }
    }

    createKey(tun: Tunnel, svc?: Service) {
        if (tun && svc)
            return `/authorize/track/id/${tun.trackId}/service/id/${svc.id}`
        else
            return `/authorize/track/id/${tun.trackId}/service/id/`
    }
    createValue(tun: Tunnel, result: PolicyAuthzResult, svc: Service) {
        let isDrop = result.error ? 1 : 0;
        return `${isDrop},${result.error},${result.rule?.id || ''},${tun.id || ''},${tun.userId || ''}`
    }
    async lmdbWrite(tun: Tunnel, result: PolicyAuthzResult, svc: Service) {
        // /authorize/track/id/2/service/id/1  /pResult/errorNumber/ruleNumber/tunId/userId/networkId
        await this.lmdbService.put(this.createKey(tun, svc), this.createValue(tun, result, svc))
    }
    async lmdbGetTunnel(tun: Tunnel) {

        const key = this.createKey(tun);
        return await this.lmdbGetRange(key);
    }
    async lmdbGetRange(key: string) {
        const arr = new Uint8Array(255);
        arr.fill(255, 0, 254);
        Buffer.from(key).copy(arr, 0, 0, key.length);
        const range = await this.lmdbService.range({ start: key, end: arr });
        return range;
    }
    async lmdbClearTunnel(tun: Tunnel) {
        logger.info(`policy watcher clearing policy trackId: ${tun.trackId}`)
        const range = await this.lmdbGetTunnel(tun);
        if (range.asArray.length)
            await this.lmdbService.transaction(async () => {
                for (const r of range) {
                    await this.lmdbService.remove(r.key);
                }
            })
    }

}