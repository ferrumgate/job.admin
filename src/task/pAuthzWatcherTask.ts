import { AuthorizationRule, Gateway, logger, PolicyService, RedisConfigService, RedisConfigWatchService, Service, Tunnel, User } from "rest.portal";
import { ConfigWatch } from "rest.portal/model/config";
import { PolicyAuthzResult } from "rest.portal/service/policyService";
import { clearIntervalAsync, setIntervalAsync } from "set-interval-async";
import { LmdbService } from "../service/lmdbService";
import { GatewayBasedTask } from "./gatewayBasedTask";
import fs from 'fs';
import { BroadcastService } from "rest.portal/service/broadcastService";
import toml from 'toml';
import { AuthorizationProfile } from "rest.portal/model/authorizationProfile";
/**
 * @summary follows system logs, all tunnels, all config changes
 * and recalculate all tunnel data for service 
 * @see SystemWatcherTask, all events are redirect from there
 */
export class PAuthzWatcherTask extends GatewayBasedTask {

    protected lmdbService!: LmdbService;
    protected unstableSystem = false;
    protected tunnels: Map<string, Tunnel> = new Map();
    protected configChangedTimes: number[] = [];
    protected configChangedTimer: any;
    constructor(private dbFolder: string, private redisConfigService: RedisConfigWatchService,
        private bcastEvents: BroadcastService) {
        super()

    }
    async start() {

        this.lmdbService = await LmdbService.open('authz', this.dbFolder, 'string', 16);
        logger.info(`opening track lmdb folder ${this.dbFolder}`);
        await this.lmdbService.clear();
        this.bcastEvents.on('configChanged', async (data: ConfigWatch<any>) => {
            await this.configChanged(data);
        })
        this.configChangedTimer = setIntervalAsync(async () => {
            await this.executeConfigChanged();
        }, 1000);
        //start
        setTimeout(() => {
            this.configChangedTimes.push(new Date().getTime());
        }, 1000);
    }

    async stop() {
        if (this.configChangedTimer)
            clearIntervalAsync(this.configChangedTimer);
        this.configChangedTimer = null;
        await this.lmdbService.clear();
        await this.lmdbService.close();
    }
    isStable() {
        if (this.unstableSystem) throw new Error('unstable track watcher');
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
            this.unstableSystem = true;
        }
    }

    async executeConfigChanged() {
        try {
            this.isStable();
            if (!this.configChangedTimes.length) return;
            if ((new Date().getTime() - this.configChangedTimes[0] < 2000)) return;
            logger.info(`authz watcher config changed detected`);


            let keyValues: { key: string, value: string }[] = [];
            const policy = await this.redisConfigService.getAuthorizationPolicy();
            logger.info(`getting authz rules, services`)
            const order = policy.rulesOrder;
            const rules = policy.rules.sort((a, b) => {
                return order.findIndex(d => d == a.id) - order.findIndex(d => d == b.id);
            });
            const now = new Date().getTime().toString();
            for (const rule of rules) {
                keyValues.push({ key: this.createAuthzKey(rule), value: this.createAuthzValue(rule) })
                keyValues.push({ key: this.createAuthzUpdateKey(rule), value: now })
            }
            const services = await this.redisConfigService.getServicesAll();
            for (const svc of services) {
                const filtered = rules.filter(x => x.serviceId == svc.id);
                keyValues.push({ key: this.createServiceKey(svc), value: this.createServiceValue(filtered) })
                keyValues.push({ key: this.createServiceUpdateTimeKey(svc), value: now })

            }

            await this.lmdbService.batch(async () => {
                await this.lmdbService.clear();
                for (const r of keyValues) {
                    await this.lmdbService.put(r.key, r.value);
                }
            })

        } catch (err) {
            logger.error(err);
            this.unstableSystem = true;
        }
    }

    createRootKey() {
        return `/authz/`
    }
    createAuthzKey(rule: AuthorizationRule) {
        return `/authz/id/${rule.id}`
    }
    createAuthzUpdateKey(rule: AuthorizationRule) {
        return `/authz/id/${rule.id}/updateTime`
    }


    createServiceKey(svc: Service) {
        return `/authz/service/id/${svc.id}/user/list`
    }
    createServiceUpdateTimeKey(svc: Service) {
        return `/authz/service/id/${svc.id}/user/list/updateTime`
    }


    createServiceValue(rules: AuthorizationRule[]) {
        let data = ``;
        for (const rule of rules) {
            data += `
[[rules]]
userOrgroupIds = ",${rule.userOrgroupIds.filter(y => y.trim()).map(a => a).join(',')},"
id = "${rule.id}"            
`
        }

        if (data.length >= 1048576) {
            logger.warn(`authz toml is bigger than 1M`);
            return ``;
        }
        return data;
    }


    createAuthzValue(rule: AuthorizationRule) {
        let fqdnIntelStr = ''
        const fqdnIntel = rule.profile.fqdnIntelligence
        if (fqdnIntel) {
            fqdnIntelStr = `
[fqdnIntelligence]
ignoreFqdns = ",${fqdnIntel.ignoreFqdns.filter(y => y.fqdn.trim()).filter(y => y).map(x => x.fqdn).join(',')},"
ignoreLists = ",${fqdnIntel.ignoreLists.filter(y => y.trim()).filter(y => y).join(',')},"
whiteFqdns = ",${fqdnIntel.whiteFqdns.filter(y => y.fqdn.trim()).filter(y => y).map(x => x.fqdn).join(',')},"
whiteLists = ",${fqdnIntel.whiteLists.filter(y => y.trim()).filter(y => y).join(',')},"
blackFqdns = ",${fqdnIntel.blackFqdns.filter(y => y.fqdn.trim()).filter(y => y).map(x => x.fqdn).join(',')},"
blackLists = ",${fqdnIntel.blackLists.filter(y => y.trim()).filter(y => y).join(',')},"
`
        }
        let data = `        
id = "${rule.id}"
userOrgroupIds = ",${rule.userOrgroupIds.filter(y => y.trim()).filter(y => y).join(',')},"
${fqdnIntelStr || ''}
`;
        if (data.length >= 1048576) {
            logger.warn(`authz toml is bigger than 1M`);
            return ``;
        }
        return data;
    }





    async lmdbGetRange(key: string) {
        const arr = new Uint8Array(255);
        arr.fill(255, 0, 254);

        Buffer.from(key).copy(arr, 0, 0, key.length);
        const range = await this.lmdbService.range({ start: key, end: arr });
        return range;

    }
    async lmdbClearSvc() {
        logger.info(`authz watcher clearing `)
        const range = await this.lmdbGetRange(this.createRootKey());
        if (range.asArray.length)
            await this.lmdbService.batch(async () => {
                for (const r of range) {
                    await this.lmdbService.remove(r.key);
                }
            })
    }


}