

import { GatewayBasedTask } from "./gatewayBasedTask";
import { NetworkService } from "../service/networkService";
import { DockerService, Pod } from "../service/dockerService";
import { InputService, logger, RedisService, Service, } from "rest.portal";
import { RedisOptions } from "../model/redisOptions";
import { RedisConfigWatchService } from "rest.portal";
import { ConfigWatch } from "rest.portal/model/config";
import { LmdbService } from "../service/lmdbService";
import { BroadcastService } from "rest.portal/service/broadcastService";


const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');
/***
 *@summary add dns records according to services
 */


export class CheckLocalDns {


    protected timerCheck: any | null = null;

    protected lastCheckTime = new Date(1).getTime();
    confChangedTimes: number[] = [];
    protected lmdbService!: LmdbService;
    constructor(private dbFolder: string, private configService: RedisConfigWatchService,
        protected bcastService: BroadcastService,
        protected inputService: InputService) {
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


            const dnsRecords = services.map(x => {
                const network = networks.find(y => y.id == x.networkId);
                if (network) {
                    const fqdn = `${x.name}.${network.name}.${domain}`;
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

            await this.lmdbService.batch(async () => {
                await this.lmdbService.clear();
                for (const dns of dnsRecords) {
                    if (dns && dns.fqdn && dns.ipv4) {
                        const key = `/local/dns/${dns.fqdn}/a`;
                        const val = dns.ipv4;
                        await this.lmdbService.put(key, val);
                        logger.debug(`write local dns ${key} -> ${val}`);
                        //await this.lmdbService.put(`/local/dns/${dns.fqdnReverse}/a`, dns.ipv4);
                    }
                }
            })
            // write more log
            for (const dns of dnsRecords) {
                if (dns && dns.fqdn) {
                    const key = `/local/dns/${dns.fqdn}/a`;
                    const val = dns.ipv4;
                    const result = await this.lmdbService.get(key);//check again
                    logger.info(`read local dns ${key} -> ${result}`);

                }
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

        } catch (err) {
            logger.error(err);
        }
    }
    async init() {
        if (!this.lmdbService) {
            this.lmdbService = await LmdbService.open('dns', this.dbFolder, 'string', 16);
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

            await this.checkServices();
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
