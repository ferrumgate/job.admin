import { HelperService, logger, RedisConfigWatchService, RedisService, RedisServiceManuel, SystemLog, Tunnel, Util } from "rest.portal";

import { RedisOptions } from "../model/redisOptions";
import { GatewayBasedTask } from "./gatewayBasedTask";
import { EventEmitter } from "node:events";
import NodeCache from "node-cache";
import { TunnelService } from "rest.portal";
import { ConfigWatch } from "rest.portal/service/redisConfigService";
import { BroadcastService } from "../service/broadcastService";
import { WatchItem } from "rest.portal/service/watchService";
import { PolicyService } from "rest.portal";



const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');



export class SystemWatcherTask extends GatewayBasedTask {

    protected tunnels: NodeCache;
    protected isStoping = false;

    protected startTimer: any;
    protected allTunnelsLoaded = false;
    protected waitList: SystemLog[] = [];
    constructor(private redis: RedisService,
        private redisConfigService: RedisConfigWatchService,
        private tunnelService: TunnelService,
        private bcastService: BroadcastService,
    ) {
        super();

        this.tunnels = new NodeCache({
            stdTTL: 7 * 60 * 1000, useClones: false, checkperiod: 10 * 60 * 1000
        })
        this.tunnels.on('expired', async (key: string, value: Tunnel) => {
            this.bcastService.emit('tunnelExpired', value);
        })

        this.redisConfigService.watch.on('log', async (data: WatchItem<any>) => {
            //analyze all logs
            if (data.val.path.startsWith('/system/tunnel')) {
                this.waitList.push(data.val);
            }
            this.bcastService.emit('log', data.val);

        })
        this.redisConfigService.watch.on('configChanged', async (data: WatchItem<any>) => {
            this.bcastService.emit('configChanged', data.val);
        })


    }

    async start() {
        this.isStoping = false;
        await this.redisConfigService.start();

        this.startTimer = await setIntervalAsync(async () => {
            await this.loadAllTunnels();
            await this.processTunnelEvents();
        }, 1000)
    }
    async stop() {
        this.isStoping = true;
        if (this.startTimer)
            clearIntervalAsync(this.startTimer);
        this.startTimer = null;
    }

    async loadAllTunnels() {
        try {

            if (this.allTunnelsLoaded) return;
            logger.info(`system watcher getting tunnels`);
            await this.redisConfigService.isReady();

            const allTunnels = await this.tunnelService.getAllValidTunnels(() => !this.isStoping);
            logger.info(`getted all tunnels count: ${allTunnels.length}`);
            allTunnels.forEach((x: Tunnel) => {
                if (x.id && x.gatewayId == this.gatewayId)
                    this.tunnels.set(x.id, x);
            })
            clearIntervalAsync(this.startTimer);
            this.startTimer = null;
            this.allTunnelsLoaded = true;
            logger.info(`all tunnels getted count:${allTunnels.length}`);
            allTunnels.forEach((x: Tunnel) => {
                if (x.gatewayId == this.gatewayId)
                    this.bcastService.emit('tunnelConfirm', x);
            })

        } catch (err) {
            logger.error(err);
        }

    }

    async processTunnelEvents() {
        try {
            if (!this.allTunnelsLoaded) return;
            while (this.waitList.length) {
                const ev = this.waitList[0];
                if (ev.path == '/system/tunnel/confirm') {
                    logger.info(`tunnel confirm received ${JSON.stringify(ev.val)}`);
                    const data = ev.val as Tunnel;
                    if (data?.id) {
                        this.tunnels.set(data.id, data, 5 * 60 * 1000);
                        if (data.gatewayId == this.gatewayId) {
                            this.bcastService.emit('tunnelConfigure', data);
                        }
                    }
                }
                if (ev.path == '/system/tunnel/alive') {
                    logger.info(`tunnel alive received ${JSON.stringify(ev.val)}`);
                    const data = ev.val as Tunnel;
                    if (data?.id && data.gatewayId == this.gatewayId) {
                        if (this.tunnels.has(data.id))
                            this.tunnels.ttl(data.id, 5 * 60 * 1000);
                    }
                }
                this.waitList.shift();
            }

        } catch (err) {
            logger.error(err);
        }
    }





}