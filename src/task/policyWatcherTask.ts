import { logger, PolicyService, RedisConfigService, RedisConfigWatchService, Tunnel } from "rest.portal";
import { ConfigWatch } from "rest.portal/service/redisConfigService";
import { BroadcastService } from "../service/broadcastService";
import { LmdbService } from "../service/lmdbService";

export class PolicyWatcherTask {

    lmdbService!: LmdbService;
    unstableSystem = false;
    constructor(private dbFolder: string, private policyService: PolicyService,
        private redisConfigService: RedisConfigWatchService,
        private bcastEvents: BroadcastService) {



    }
    async start() {
        this.lmdbService = await LmdbService.open('ferrumgate', this.dbFolder, 'string', 16);
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
    }

    async stop() {

        await this.lmdbService.clear();
        await this.lmdbService.close();
    }
    isStable() {
        if (this.unstableSystem) throw new Error('unstable policy watcher');
    }

    async tunnelExpired(tun: Tunnel) {
        try {
            this.isStable();

        } catch (err) {
            logger.error(err);
            this.unstableSystem = true;
        }
    }
    async tunnelConfirmed(tun: Tunnel) {
        try {
            this.isStable();

        } catch (err) {
            logger.error(err);
            this.unstableSystem = true;
        }
    }

    async configChanged(data: ConfigWatch<any>) {
        throw new Error("Method not implemented.");
    }


}