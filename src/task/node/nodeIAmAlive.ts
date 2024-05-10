import os from 'os';
import { logger, RedisService } from "rest.portal";
import { NodeBasedTask } from "./nodeBasedTask";
const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');

/***
 * 
 * @summary every 5 second, host sends I am alive, with os related data
 */
export class NodeIAmAlive extends NodeBasedTask {

    protected timer: any | null = null;

    protected lastCheckTime2 = new Date(1).getTime();
    constructor(protected redis: RedisService) {
        super();
    }

    public async check() {

        try {
            if (new Date().getTime() % 5 == 0)//write some times
                logger.info(`write I am alive(node) to redis`);

            //set to the global
            let nodeKey = `/alive/node/id/${this.nodeId}`;
            const trx = await this.redis.multi();
            await trx.hset(nodeKey, {
                id: this.nodeId,
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
                interfaces: JSON.stringify(os.networkInterfaces()),
                lastSeen: new Date().getTime(),
                version: this.version,
                roles: this.roles,

            })
            await trx.expire(nodeKey, 5 * 60 * 1000);
            await trx.exec();

        } catch (err) {
            logger.error(err);
        }
    }

    public override async start(): Promise<void> {

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
