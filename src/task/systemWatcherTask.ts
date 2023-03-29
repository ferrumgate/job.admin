import { HelperService, logger, RedisConfigWatchService, RedisService, RedisServiceManuel, SystemLog, Tunnel, Util } from "rest.portal";

import { RedisOptions } from "../model/redisOptions";
import { GatewayBasedTask } from "./gatewayBasedTask";
import { EventEmitter } from "node:events";
import NodeCache from "node-cache";
import { TunnelService } from "rest.portal";
import { WatchItem } from "rest.portal/service/watchService";
import { PolicyService } from "rest.portal";
import { ConfigWatch } from "rest.portal/model/config";
import { BroadcastService } from "rest.portal/service/broadcastService";



const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');


/**
 * @summary follow all system status, tunnels, configs and emit related events to system
 */
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
            stdTTL: 7 * 60, useClones: false, checkperiod: 10 * 60
        })
        this.tunnels.on('expired', async (key: string, value: Tunnel) => {

            this.bcastService.emit('tunnelExpired', value);
            logger.info(`system watcher tunnel expired id:${value.id} trackId:${value.trackId}`);
        })

        this.redisConfigService.events.on('log', async (data: WatchItem<any>) => {
            //analyze all logs
            logger.info(`log received ${data?.val?.path}`)
            if (data.val.path.startsWith('/system/tunnels')) {
                this.waitList.push(data.val);
            }
            this.bcastService.emit('log', data.val);

        })
        this.redisConfigService.events.on('configChanged', async (data: ConfigWatch<any>) => {

            this.bcastService.emit('configChanged', data);
            logger.info(`system watcher config changed ${data.path}`);
        })


    }

    async start() {
        this.isStoping = false;
        await this.redisConfigService.start();

        this.startTimer = setIntervalAsync(async () => {
            await this.loadAllTunnels();
            await this.processTunnelEvents();
        }, 500)
    }
    async stop() {
        this.isStoping = true;
        if (this.startTimer)
            clearIntervalAsync(this.startTimer);
        this.startTimer = null;
        await this.redisConfigService.stop();
    }

    async loadAllTunnels() {
        try {

            if (this.allTunnelsLoaded) return;
            logger.info(`system watcher getting tunnels`);
            await this.redisConfigService.isReady();

            const allTunnels = await this.tunnelService.getAllValidTunnels(() => !this.isStoping);
            logger.info(`system watcher getted all tunnels count: ${allTunnels.length}`);
            allTunnels.forEach((x: Tunnel) => {
                if (x.id && x.gatewayId == this.gatewayId)
                    this.tunnels.set(x.id, x);
            })

            this.allTunnelsLoaded = true;
            logger.info(`system watcher all tunnels getted count:${allTunnels.length}`);
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
                if (ev.path == '/system/tunnels/confirm') {
                    const data = ev.val as Tunnel;
                    if (data?.id) {
                        this.tunnels.set(data.id, data, 5 * 60);
                        if (data.gatewayId == this.gatewayId) {

                            this.bcastService.emit('tunnelConfigure', data);
                            logger.info(`system watcher tunnel configure id:${data.id} trackId:${data.trackId}`)
                        }
                    }
                }
                if (ev.path == '/system/tunnels/alive') {
                    const data = ev.val as Tunnel;
                    if (data?.id && data.gatewayId == this.gatewayId) {
                        if (this.tunnels.has(data.id)) {

                            this.tunnels.ttl(data.id, 5 * 60);
                            logger.info(`system watcher tunnel alive id:${data.id} trackId:${data.trackId}`)
                        }
                    }
                }
                this.waitList.shift();
            }

        } catch (err) {
            logger.error(err);
        }
    }





}