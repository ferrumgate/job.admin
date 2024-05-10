import os from 'os';
import { logger, RedisConfigService, RedisService, SystemLog, SystemLogService } from "rest.portal";
import { NodeBasedTask } from "./nodeBasedTask";
const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');

/***
 * 
 * @summary save this node
 */
export class NodeSave extends NodeBasedTask {

    protected timer: any | null = null;

    protected lastCheckTime2 = new Date(1).getTime();
    configService: RedisConfigService;
    constructor(protected redis: RedisService, protected redisStream: RedisService, protected log: SystemLogService, encryptKey = '') {
        super();
        this.configService = new RedisConfigService(this.redis, this.redisStream, this.log, encryptKey || this.encryptKey);
    }
    lastCheck = 0;

    public async check() {

        try {
            if (new Date().getTime() - this.lastCheck < 1 * 60 * 1000) return;//check every minutes

            logger.info(`check if this node saved`);
            const node = await this.configService.getNode(this.nodeId);
            if (!node) {
                //save this node
                await this.configService.saveNode({
                    id: this.nodeId, insertDate: new Date().toISOString(),
                    labels: [], name: this.hostname || os.hostname(),
                    updateDate: new Date().toISOString()
                })
            }
            this.lastCheck = new Date().getTime();

        } catch (err) {
            logger.error(err);
        }
    }

    public override async start(): Promise<void> {
        await this.configService.start();
        await this.check();
        this.timer = setIntervalAsync(async () => {
            await this.check();
        }, 5 * 1000);
    }
    public override async stop(): Promise<void> {
        await this.configService.stop();
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
