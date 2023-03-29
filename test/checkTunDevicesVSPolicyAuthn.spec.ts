
//docker run --net=host --name redis --rm -d redis


import chai, { util } from 'chai';
import chaiHttp from 'chai-http';
import chaiSpy from 'chai-spies';
import { utils } from 'mocha';
import fspromise from 'fs/promises';
import fs from 'fs';

import { CheckIptablesCommon } from '../src/task/checkIptablesCommon';
import { NetworkService } from '../src/service/networkService';
import { CheckTunDevicesVSIptables } from '../src/task/checkTunDevicesVSIptables';
import { ESService, Gateway, InputService, IpIntelligenceService, Network, PolicyService, RedisConfigService, RedisConfigWatchCachedService, RedisService, SessionService, SystemLogService, TunnelService, User, Util } from 'rest.portal';
import { CheckTunDevicesPolicyAuthn } from '../src/task/checkTunDevicesVSPolicyAuthn';
import { DhcpService } from 'rest.portal/service/dhcpService';
import { exec } from 'child_process';
import { AuthSession } from 'rest.portal/model/authSession';
import { TunService } from '../src/service/tunService';
import { BroadcastService } from 'rest.portal/service/broadcastService';



chai.use(chaiHttp);
chai.use(chaiSpy);
const expect = chai.expect;

const tmpfolder = '/tmp/ferrumtest';
describe('checkTunDevicesVSPolicyAuthn', () => {

    function createRedis() {

        return new RedisService();
    }
    const enckey = 'ynq3kl8gsanlq0a3776dzj3vr3p383pj'
    const redis = createRedis();
    const systemLog = new SystemLogService(redis, createRedis(), enckey, 'job.admin');
    const configService = new RedisConfigService(redis, createRedis(), systemLog, enckey);
    const redisConfig = new RedisConfigWatchCachedService(redis, createRedis(), systemLog, true, enckey, 'job.admin');
    const tunnelService = new TunnelService(redisConfig, redis, new DhcpService(redisConfig, redis));
    const sessionService = new SessionService(redisConfig, redis);
    const ipIntelligenceService = new IpIntelligenceService(redisConfig, redis, new InputService(), new ESService(redisConfig));
    const policyService = new PolicyService(redisConfig, ipIntelligenceService);
    const bcastService = new BroadcastService();
    before(async () => {
        await configService.start();
        await redisConfig.start();
    })
    beforeEach(async () => {

        await redis.flushAll();
        if (fs.existsSync(tmpfolder))
            await fs.rmSync(tmpfolder, { recursive: true, force: true });
    })

    afterEach(async () => {

    })
    afterEach(async () => {
        chai.spy.restore();
    })



    it('check without tun devices', async () => {


        const spy = chai.spy.on(NetworkService, 'getTunDevices', async () => {
            return [];
        })

        const spyTun = chai.spy.on(TunService, 'delete', async () => {

        })

        const checker = new CheckTunDevicesPolicyAuthn(redis, bcastService, redisConfig,
            tunnelService, sessionService, policyService);
        checker.setGatewayId('test');
        await checker.check();
        expect(spy).to.have.been.called;
        expect(spyTun).not.have.been.called;



    }).timeout(100000)

    it('check with tun device', async () => {


        const spyTun = chai.spy.on(TunService, 'delete', async () => {

        })

        const spy1 = chai.spy.on(NetworkService, 'getTunDevices', async () => {
            return ['ferrum'];
        })
        const spy2 = chai.spy.on(redis, 'get', async (x: any) => {
            return undefined;
        })
        const checker = new CheckTunDevicesPolicyAuthn(redis, bcastService, redisConfig,
            tunnelService, sessionService, policyService);
        checker.setGatewayId('test');
        await checker.check();
        expect(spy1).to.have.been.called;
        expect(spyTun).to.have.been.called;
        expect(spy2).to.have.been.called;



    }).timeout(100000)

    it('check with tun device no tunnel', async () => {

        const spyTun = chai.spy.on(TunService, 'delete', async () => {

        })

        const spy1 = chai.spy.on(NetworkService, 'getTunDevices', async () => {
            return ['ferrum'];
        })
        const spy2 = chai.spy.on(redis, 'get', async (x: any) => {
            return 'abc';
        })

        const spy3 = chai.spy.on(tunnelService, 'getTunnel', async (x: any) => {
            return undefined;
        })



        const checker = new CheckTunDevicesPolicyAuthn(redis, bcastService, redisConfig,
            tunnelService, sessionService, policyService);
        checker.setGatewayId('test');

        await redis.set('/gateway/test/tun/ferrumtun', 'atunnelkey');
        await checker.check();

        expect(spyTun).to.have.been.called;
        expect(spy1).to.have.been.called;
        expect(spy2).to.have.been.called;
        expect(spy3).to.have.been.called;




    }).timeout(100000)



    it('check with tun device with tunnel without sessionid', async () => {
        const spyTun = chai.spy.on(TunService, 'delete', async () => {

        })

        const spy1 = chai.spy.on(NetworkService, 'getTunDevices', async () => {
            return ['ferrum'];
        })
        const spy2 = chai.spy.on(redis, 'get', async (x: any) => {
            return 'abc';
        })

        const spy3 = chai.spy.on(tunnelService, 'getTunnel', async (x: any) => {
            return { sessionId: 'abc' };
        })

        const spy4 = chai.spy.on(sessionService, 'getSession', async (x: any) => {
            return undefined;
        })


        const checker = new CheckTunDevicesPolicyAuthn(redis, bcastService, redisConfig,
            tunnelService, sessionService, policyService);
        checker.setGatewayId('test');

        await redis.set('/gateway/test/tun/ferrumtun', 'atunnelkey');
        await checker.check();

        expect(spyTun).to.have.been.called;
        expect(spy1).to.have.been.called;
        expect(spy2).to.have.been.called;
        expect(spy3).to.have.been.called;
        expect(spy4).to.have.been.called;

    }).timeout(100000)

    it('check with tun device with tunnel with session and user locked', async () => {
        const spyTun = chai.spy.on(TunService, 'delete', async () => {

        })

        const spy1 = chai.spy.on(NetworkService, 'getTunDevices', async () => {
            return ['ferrum'];
        })
        const spy2 = chai.spy.on(redis, 'get', async (x: any) => {
            return 'abc';
        })

        const spy3 = chai.spy.on(tunnelService, 'getTunnel', async (x: any) => {
            return { sessionId: 'abc' };
        })

        const spy4 = chai.spy.on(sessionService, 'getSession', async (x: any) => {
            return {};
        })

        const spy5 = chai.spy.on(redisConfig, 'getUserById', async (x: any) => {
            return { isLocked: true };
        })



        const checker = new CheckTunDevicesPolicyAuthn(redis, bcastService, redisConfig,
            tunnelService, sessionService, policyService);
        checker.setGatewayId('test');

        await redis.set('/gateway/test/tun/ferrumtun', 'atunnelkey');
        await checker.check();

        expect(spyTun).to.have.been.called;
        expect(spy1).to.have.been.called;
        expect(spy2).to.have.been.called;
        expect(spy3).to.have.been.called;
        expect(spy4).to.have.been.called;
        expect(spy5).to.have.been.called;

    }).timeout(100000)


    it('check with tun device with tunnel with session with user and authenticate', async () => {
        const spyTun = chai.spy.on(TunService, 'delete', async () => {

        })

        const spy1 = chai.spy.on(NetworkService, 'getTunDevices', async () => {
            return ['ferrum'];
        })
        const spy2 = chai.spy.on(redis, 'get', async (x: any) => {
            return 'abc';
        })

        const spy3 = chai.spy.on(tunnelService, 'getTunnel', async (x: any) => {
            return { sessionId: 'abc' };
        })

        const spy4 = chai.spy.on(sessionService, 'getSession', async (x: any) => {
            return {};
        })

        const spy5 = chai.spy.on(redisConfig, 'getUserById', async (x: any) => {
            return { isLocked: true };
        })

        const spy6 = chai.spy.on(policyService, 'authenticate', async (x: any) => {
            return {};
        })



        const checker = new CheckTunDevicesPolicyAuthn(redis, bcastService, redisConfig,
            tunnelService, sessionService, policyService);
        checker.setGatewayId('test');

        await redis.set('/gateway/test/tun/ferrumtun', 'atunnelkey');
        await checker.check();

        expect(spyTun).not.to.have.been.called;
        expect(spy1).to.have.been.called;
        expect(spy2).to.have.been.called;
        expect(spy3).to.have.been.called;
        expect(spy4).to.have.been.called;
        expect(spy5).to.have.been.called;
        expect(spy6).to.have.been.called;

    }).timeout(100000)



    it('check with tun device with tunnel with session with user and will not authenticate', async () => {
        const spyTun = chai.spy.on(TunService, 'delete', async () => {

        })

        const spy1 = chai.spy.on(NetworkService, 'getTunDevices', async () => {
            return ['ferrum'];
        })
        const spy2 = chai.spy.on(redis, 'get', async (x: any) => {
            return 'abc';
        })

        const spy3 = chai.spy.on(tunnelService, 'getTunnel', async (x: any) => {
            return { sessionId: 'abc' };
        })

        const spy4 = chai.spy.on(sessionService, 'getSession', async (x: any) => {
            return {};
        })

        const spy5 = chai.spy.on(redisConfig, 'getUserById', async (x: any) => {
            return { isLocked: true };
        })

        const spy6 = chai.spy.on(policyService, 'authenticate', async (x: any) => {
            throw new Error('');
        })


        const spy7 = chai.spy.on(sessionService, 'deleteSession', async (x: any) => {
            return {};
        })



        const checker = new CheckTunDevicesPolicyAuthn(redis, bcastService, redisConfig,
            tunnelService, sessionService, policyService);
        checker.setGatewayId('test');

        await redis.set('/gateway/test/tun/ferrumtun', 'atunnelkey');
        await checker.check();

        expect(spyTun).to.have.been.called;
        expect(spy1).to.have.been.called;
        expect(spy2).to.have.been.called;
        expect(spy3).to.have.been.called;
        expect(spy4).to.have.been.called;
        expect(spy5).to.have.been.called;
        expect(spy6).to.have.been.called;
        expect(spy7).to.have.been.called;

    }).timeout(100000);

    it('check with tun device with tunnel with session with user and will not authenticate', async () => {

        const checker = new CheckTunDevicesPolicyAuthn(redis, bcastService, redisConfig,
            tunnelService, sessionService, policyService);
        checker.setGatewayId('test');

        const spy1 = chai.spy.on(checker, 'check', async () => {

        })
        expect(spy1).to.have.been.called;

    })


})