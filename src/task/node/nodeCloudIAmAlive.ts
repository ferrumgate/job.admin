import os from 'os';
import { logger, RedisService } from "rest.portal";
import { NodeBasedTask } from "./nodeBasedTask";
import Axios, { AxiosRequestConfig } from "axios";
const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');

/***
 * 
 * @summary every 5 second, host sends to cloud if it is registered
 */
export class NodeCloudIAmAlive extends NodeBasedTask {

    protected timer: any | null = null;

    protected lastCheckTime2 = new Date(1).getTime();
    constructor() {
        super();
    }
    lastCheck = 0;
    public async check() {

        try {
            if (new Date().getTime() - this.lastCheck < 1 * 60 * 1000) return;//check every 5 minutes

            let options: AxiosRequestConfig = {
                timeout: 15 * 1000,
                headers: {
                    ApiKey: this.cloudToken
                }
            };
            let host = {
                id: this.nodeId,
                cloudId: this.cloudId,
                arch: os.arch(),
                cpusCount: os.cpus().length,
                cpuInfo: os.cpus().find(x => x)?.model,
                hostname: os.hostname(),
                totalMem: os.totalmem(),
                type: os.type(),
                uptime: os.uptime(),
                osVersion: os.version(),
                platform: os.platform(),
                release: os.release(),
                freeMem: os.freemem(),
                lastSeen: new Date().getTime(),
                version: this.version,
                roles: this.roles
            }
            await Axios.post(this.cloudUrl + '/node/alive', host, options);
            this.lastCheck = new Date().getTime();


        } catch (err) {
            logger.error(err);
        }
    }

    public override async start(): Promise<void> {
        if (!this.cloudId) {
            logger.warn('FERRUM_CLOUD_ID is empty');
            return;
        }
        if (!this.cloudUrl) {
            logger.warn('FERRUM_CLOUD_URL is empty');
            return;
        }
        if (!this.cloudToken) {
            logger.warn('FERRUM_CLOUD_TOKEN is empty');
            return;
        }
        await this.check();
        this.timer = setIntervalAsync(async () => {
            await this.check();
        }, 5 * 1000);
    }
    public override async stop(): Promise<void> {
        try {
            if (this.timer)
                clearIntervalAsync(this.timer);
            this.timer = null;

        } catch (err) {
            logger.error(err);
        } finally {

        }
    }

}
