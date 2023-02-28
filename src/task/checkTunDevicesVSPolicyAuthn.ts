
import { GatewayBasedTask } from "./gatewayBasedTask";
import { NetworkService } from "../service/networkService";
import { ConfigService, logger, PolicyService, RedisService, SessionService, TunnelService } from "rest.portal";
import { RedisOptions } from "../model/redisOptions";
import { TunService } from "../service/tunService";
import { BroadcastService } from "../service/broadcastService";
import { ConfigWatch } from "rest.portal/model/config";
const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');
/***
 * @summary we need to check tun devices to authentication rules
 * sometimes ip intelligence adds new blacklist item
 */

export class CheckTunDevicesPolicyAuthn extends GatewayBasedTask {

    protected timer: any | null = null;
    protected configChangedTimes: number[] = [];
    protected configChangedTimer: any;
    protected lastCheckTime2 = new Date(1).getTime();
    constructor(protected redis: RedisService, protected bcastEvents: BroadcastService, protected configService: ConfigService, protected tunnelService: TunnelService,
        protected sessionService: SessionService, protected policyService: PolicyService) {
        super();
    }

    public async check() {

        try {
            const diff = new Date().getTime() - this.lastCheckTime2;
            if (diff > 60000) { //every 60 seconds
                logger.info(`check tun devices to policy authentication`);
                await this.readGatewayId();
                const devices = await NetworkService.getTunDevices();
                for (const device of devices) {
                    if (this.gatewayId && device) {
                        const tunnelKey = await this.redis?.get(`/gateway/${this.gatewayId}/tun/${device}`, false) as string
                        if (!tunnelKey) {//there is a problem delete tun device
                            logger.warn(`deleting device ${device} not exits on gateway ${this.gatewayId}`);
                            await TunService.delete(device);
                            continue;
                        }
                        const tunnel = await this.tunnelService.getTunnel(tunnelKey);
                        if (!tunnel) {
                            logger.warn(`deleting device ${device} tunnel ${tunnelKey} not exits on gateway ${this.gatewayId}`);
                            await TunService.delete(device);
                            continue;
                        }
                        if (!tunnel.sessionId) {
                            logger.warn(`deleting device ${device} session id exits on gateway ${this.gatewayId}`);
                            await TunService.delete(device);
                            continue;
                        }

                        const session = await this.sessionService.getSession(tunnel.sessionId);
                        if (!session) {
                            logger.warn(`deleting device ${device} session ${tunnel.sessionId} not exits on gateway ${this.gatewayId}`);
                            await TunService.delete(device);
                            continue;
                        }
                        const user = await this.configService.getUserById(session.userId);
                        if (!user || user.isLocked) {
                            logger.warn(`deleting device ${device} user ${session.userId} not found or locked not exits on gateway ${this.gatewayId}`);
                            await TunService.delete(device);
                            continue;
                        }


                        try {
                            const result = await this.policyService.authenticate(user, session, tunnel);
                            logger.info(`device ${device} policy authentication is ok on gateway ${this.gatewayId}`)
                        } catch (ignore) {
                            if (this.policyService.errorNumber) {
                                logger.warn(`deleting device ${device} policy not valid on gateway ${this.gatewayId}`);
                                await TunService.delete(device);
                                await this.sessionService.deleteSession(session.id);
                                continue;
                            }
                        }


                    }
                }
            }
        } catch (err) {
            logger.error(err);
        }
    }


    public override async start(): Promise<void> {

        this.bcastEvents.on('configChanged', async (data: ConfigWatch<any>) => {
            await this.configChanged(data);
        })
        this.configChangedTimer = setIntervalAsync(async () => {
            await this.executeConfigChanged();
        }, 2000);

        await this.check();

        this.timer = setIntervalAsync(async () => {
            await this.check();
        }, 30 * 1000);
    }
    public override async stop(): Promise<void> {
        try {
            if (this.timer)
                clearIntervalAsync(this.timer);
            this.timer = null;
            if (this.configChangedTimer)
                clearIntervalAsync(this.configChangedTimer);
            this.configChangedTimer = null;


        } catch (err) {
            logger.error(err);
        } finally {


        }
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
                case '/config/authenticationPolicy/rules':
                case '/config/authenticationPolicy/rulesOrder':
                case '/config/ipIntelligence/blackList':
                    this.configChangedTimes.push(new Date().getTime());
                    break;
            }
        } catch (err) {
            logger.error(err);
        }
    }

    async executeConfigChanged() {
        try {
            if (!this.configChangedTimes.length) return;
            if ((new Date().getTime() - this.configChangedTimes[0] < 5000)) return;
            logger.info(`policy watcher config changed detected`);
            let removeLength = this.configChangedTimes.length;
            this.lastCheckTime2 = 0;
            await this.check();
            this.configChangedTimes.splice(0, removeLength);

        } catch (err) {
            logger.error(err);

        }
    }



}
