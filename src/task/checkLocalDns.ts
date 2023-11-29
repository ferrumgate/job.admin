

import { GatewayBasedTask } from "./gatewayBasedTask";
import { NetworkService } from "../service/networkService";
import { DockerService, Pod } from "../service/dockerService";
import { InputService, logger, RedisService, Service, } from "rest.portal";
import { RedisOptions } from "../model/redisOptions";
import { RedisConfigWatchService } from "rest.portal";
import { ConfigWatch } from "rest.portal/model/config";
import { LmdbService } from "../service/lmdbService";
import { BroadcastService } from "rest.portal/service/broadcastService";
import { isIPv4 } from "net";


const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');
/***
 *@summary add dns records according to services
 */


export class CheckLocalDns extends GatewayBasedTask {


    protected timerCheck: any | null = null;

    protected lastCheckTime = new Date(1).getTime();
    confChangedTimes: number[] = [];
    protected lmdbService!: LmdbService;
    constructor(private dbFolder: string, private configService: RedisConfigWatchService,
        protected bcastService: BroadcastService,
        protected inputService: InputService) {
        super();
        this.bcastService.on('configChanged', (evt: ConfigWatch<any>) => {
            this.onConfigChanged(evt);
        })
        this.confChangedTimes.push(1);
    }

    public async clearAllDns() {
        await this.init();
        await this.lmdbService.clear();
    }


    public async checkServices() {

        try {


            await this.init();
            if (!this.confChangedTimes.length) return;
            if (new Date().getTime() - this.confChangedTimes[0] < 1000) return;// wait at least 1 second
            logger.info(`checking all dns records`);
            const services = await this.configService.getServicesAll();
            const networks = await this.configService.getNetworksAll();
            const domain = await this.configService.getDomain();
            const defaultDnsRecords = await this.configService.getDnsRecords();
            const gateway = await this.configService.getGateway(this.gatewayId);
            const currentNetwork = networks.find(x => x.id == gateway?.networkId);


            //this works like this, when connected to multiple networks
            // we need to resolve it
            const dnsRecords = services.map(x => {
                const network = networks.find(y => y.id == x.networkId);
                if (network) {
                    const fqdn = `${x.name}.${network.name}.${domain}`.toLowerCase();
                    if (!this.inputService.checkDomain(fqdn, false)) {
                        logger.warn(`dns fqdn is not valid: ${fqdn}`)
                        return null;
                    }
                    return {
                        fqdn: fqdn,
                        fqdnReverse: fqdn.split('.').reverse().join('.'),
                        ipv4: x.assignedIp
                    };
                }
                else {
                    logger.warn(`network not found for service: ${x.name}`);
                    return null;
                }
            }).filter(x => x);



            const serviceAliasRecords = services
                .filter(x => x.networkId == currentNetwork?.id)
                .filter(y => y.aliases)
                .flatMap(k => {
                    return k.aliases?.map(t => {
                        let host = t.host;
                        if (!host.includes('.')) {
                            host = `${host}.${currentNetwork?.name}.${domain}`.toLowerCase();
                        }
                        return {
                            host: host, ip: k.assignedIp
                        }
                    })
                }).map(y => {
                    if (!y) return null;
                    const fqdn = y.host.toLowerCase();
                    if (!this.inputService.checkDomain(fqdn, false)) {
                        logger.warn(`dns fqdn is not valid: ${fqdn}`)
                        return null;
                    }
                    return {
                        fqdn: fqdn,
                        fqdnReverse: fqdn.split('.').reverse().join('.'),
                        ipv4: y.ip
                    };

                })





            const dnsAliases = defaultDnsRecords.filter(x => x.isEnabled).map(alias => {

                if (alias && alias.fqdn && alias.ip && isIPv4(alias.ip)) {

                    const fqdn = alias.fqdn.toLowerCase();
                    return {
                        fqdn: fqdn,
                        fqdnReverse: fqdn.split('.').reverse().join('.'),
                        ipv4: alias.ip

                    };

                } else return null;

            }
            ).filter(x => x);

            let checkList: string[] = [];
            await this.lmdbService.transaction(async () => {
                await this.lmdbService.clear();
                for (const dns of dnsRecords) {
                    if (dns && dns.fqdn && dns.ipv4) {
                        const key = `/local/dns/${dns.fqdn}/a`;
                        const val = dns.ipv4;
                        await this.lmdbService.put(key, val);
                        logger.debug(`write local dns ${key} -> ${val}`);
                        checkList.push(dns.fqdn);
                        //await this.lmdbService.put(`/local/dns/${dns.fqdnReverse}/a`, dns.ipv4);
                    }
                }
                for (const dns of serviceAliasRecords) {
                    if (dns && dns.fqdn && dns.ipv4) {
                        const key = `/local/dns/${dns.fqdn}/a`;
                        const val = dns.ipv4;
                        await this.lmdbService.put(key, val);
                        logger.debug(`write local dns ${key} -> ${val}`);
                        checkList.push(dns.fqdn);
                        //await this.lmdbService.put(`/local/dns/${dns.fqdnReverse}/a`, dns.ipv4);
                    }
                }

                for (const dns of dnsAliases) {
                    if (dns && dns.fqdn && dns.ipv4) {
                        const key = `/local/dns/${dns.fqdn}/a`;
                        const val = dns.ipv4;
                        await this.lmdbService.put(key, val);
                        logger.debug(`write local dns ${key} -> ${val}`);
                        checkList.push(dns.fqdn);
                        //await this.lmdbService.put(`/local/dns/${dns.fqdnReverse}/a`, dns.ipv4);
                    }
                }
            })
            // write more log
            for (const fqdn of checkList) {

                const key = `/local/dns/${fqdn}/a`;
                const result = await this.lmdbService.get(key);//check again
                logger.info(`read local dns ${key} -> ${result}`);
            }
            this.confChangedTimes = [];

        } catch (err) {
            logger.error(err);
        }
    }

    public async onConfigChanged(event: ConfigWatch<any>) {
        try {

            if (event.path.startsWith('/config/flush')) {
                await this.clearAllDns();
            }
            if (event.path.startsWith('/config/domain')) {
                this.confChangedTimes.push(new Date().getTime());
            }
            if (event.path.startsWith('/config/services') || event.path.startsWith('/config/networks')) {

                this.confChangedTimes.push(new Date().getTime());
            }
            if (event.path.startsWith('/config/dns/records')) {
                this.confChangedTimes.push(new Date().getTime());
            }

        } catch (err) {
            logger.error(err);
        }
    }
    async init() {
        if (!this.lmdbService) {
            this.lmdbService = await LmdbService.open('dns', this.dbFolder, 'string', 24);
            logger.info(`opening dns lmdb folder ${this.dbFolder}`);

        }
    }

    public async start(): Promise<void> {

        try {

            await this.clearAllDns();
        } catch (err) {
            logger.error(err);
        }
        try {

            this.timerCheck = setIntervalAsync(async () => {
                await this.checkServices();
            }, 3 * 1000);
        } catch (err) {
            logger.error(err);
        }
    }
    public async stop(): Promise<void> {
        try {
            if (this.timerCheck)
                clearIntervalAsync(this.timerCheck);
            this.timerCheck = null;

        } catch (err) {
            logger.error(err);
        }
    }

}
