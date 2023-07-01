import { Gateway, logger, PolicyService, RedisConfigService, RedisConfigWatchService, Service, Tunnel, User } from "rest.portal";
import { ConfigWatch } from "rest.portal/model/config";
import { PolicyAuthzResult } from "rest.portal/service/policyService";
import { clearIntervalAsync, setIntervalAsync } from "set-interval-async";
import { LmdbService } from "../service/lmdbService";
import { GatewayBasedTask } from "./gatewayBasedTask";
import fs from 'fs';
import { BroadcastService } from "rest.portal/service/broadcastService";
import toml from 'toml';
/**
 * @summary follows system logs, all tunnels, all config changes
 * and recalculate all tunnel data for service 
 * @see SystemWatcherTask, all events are redirect from there
 */
export class TrackWatcherTask extends GatewayBasedTask {

    protected lmdbService!: LmdbService;
    protected tunnels: Map<string, Tunnel> = new Map();
    protected configChangedTimes: number[] = [];
    protected configChangedTimer: any;
    protected errorCount = 0;
    protected errorLastTime = 0;
    constructor(private dbFolder: string, private redisConfigService: RedisConfigWatchService,
        private bcastEvents: BroadcastService) {
        super()

    }
    async start() {

        this.lmdbService = await LmdbService.open('track', this.dbFolder, 'string', 24);
        logger.info(`opening track lmdb folder ${this.dbFolder}`);
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
            logger.info(`track watcher tunnel expired tunId:${tun.id}`)
            this.tunnels.delete(tun.id || '');
            await this.lmdbClearTunnel(tun);
        } catch (err) {
            logger.error(err);
            this.configChangedTimes.push(new Date().getTime());
        }
    }


    async getUser(id: string) {
        const user = await this.redisConfigService.getUserById(id);
        if (!user) {
            logger.warn(`user not found id: ${id}`)
            return null;
        }
        if (user.isLocked) {
            logger.warn(`user locked id: ${user.id} username: ${user.username}`)
            return null;
        }
        if (!user.isVerified) {
            logger.warn(`user not verified id: ${user.id} username: ${user.username}`)
        }
        return user;


    }
    async tunnelConfirmed(tun: Tunnel) {
        try {
            logger.info(`track watcher tunnel confirmed trackId: ${tun.trackId}`)
            this.tunnels.set(tun.id || '', tun);
            const user = await this.getUser(tun.userId || '');
            if (!user) {
                logger.warn(`track watcher tunnel trackId: ${tun.trackId} network not found`);
                await this.lmdbClearTunnel(tun);
                return;
            }
            await this.lmdbWrite(tun, user);


        } catch (err) {
            logger.error(err);
            this.configChangedTimes.push(new Date().getTime());
        }
    }

    async configChanged(data: ConfigWatch<any>) {
        try {
            switch (data.path) {
                case '/config/flush':
                case '/config/groups':
                case '/config/users':
                    this.configChangedTimes.push(new Date().getTime());
                    break;
            }
        } catch (err) {
            logger.error(err);
        }
    }
    //makes full sync
    async executeConfigChanged() {
        try {

            if (!this.configChangedTimes.length) return;
            if ((new Date().getTime() - this.configChangedTimes[0] < 2000)) return;
            logger.info(`track watcher config changed detected`);
            let removeLength = this.configChangedTimes.length;

            let keyValues: { key: string, value: string }[] = [];
            for (const tun of this.tunnels.values()) {
                const user = await this.getUser(tun.userId || '');
                if (!user) {
                    continue;
                }
                keyValues.push({ key: this.createDataKey(tun), value: this.toML(user) });
                keyValues.push({ key: this.createLastUpdateKey(tun), value: new Date().getTime().toString() });

            }

            await this.lmdbService.transaction(async () => {
                await this.lmdbService.clear();
                for (const r of keyValues) {
                    await this.lmdbService.put(r.key, r.value);
                }
            })
            this.configChangedTimes.splice(0, removeLength);
            this.errorCount = 0;
            this.errorLastTime = 0;

        } catch (err) {
            logger.error(err);
            this.errorCount++;
            this.errorLastTime = new Date().getTime();
        }
    }

    createRootKey() {
        return `/track/id/`
    }

    createBaseKey(tun: Tunnel) {
        return `/track/id/${tun.trackId}/`
    }
    createDataKey(tun: Tunnel) {

        return `/track/id/${tun.trackId}/data`

    }
    createLastUpdateKey(tun: Tunnel) {

        return `/track/id/${tun.trackId}/updateTime`

    }
    toML(user: User) {
        return `
userId = ",${user.id},"
groupIds = ",${user.groupIds.filter(x => x.trim()).filter(y => y).join(',')},"
`
    }

    async lmdbWrite(tun: Tunnel, user: User) {
        const toml = this.toML(user);
        if (toml.length >= 1048576) {
            logger.warn(`value length is bigger than 1M`);
            return;
        }

        await this.lmdbService.put(this.createDataKey(tun), toml);
        await this.lmdbService.put(this.createLastUpdateKey(tun), new Date().getTime().toString())
    }


    async lmdbGetRange(key: string) {
        const arr = new Uint8Array(255);
        arr.fill(255, 0, 254);

        Buffer.from(key).copy(arr, 0, 0, key.length);
        const range = await this.lmdbService.range({ start: key, end: arr });
        return range;

    }
    async lmdbClearTunnel(tun: Tunnel) {
        logger.info(`track watcher clearing tunnel trackId: ${tun.trackId}`)
        const range = await this.lmdbGetRange(this.createBaseKey(tun));
        if (range.asArray.length)
            await this.lmdbService.transaction(async () => {
                for (const r of range) {
                    await this.lmdbService.remove(r.key);
                }
            })
    }


}