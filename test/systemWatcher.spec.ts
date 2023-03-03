
//docker run --net=host --name redis --rm -d redis


import chai from 'chai';
import chaiHttp from 'chai-http';

import fs, { watch } from 'fs';
import { IAmAlive } from '../src/task/iAmAlive';

import { RedisConfigWatchService, RedisService, SystemLogService, Tunnel, TunnelService, Util } from 'rest.portal';
import { RedisOptions } from '../src/model/redisOptions';
import { LmdbService } from '../src/service/lmdbService';
import { BroadcastService } from '../src/service/broadcastService';
import { SystemWatcherTask } from '../src/task/systemWatcherTask';
import { DhcpService } from 'rest.portal/service/dhcpService';


chai.use(chaiHttp);
const expect = chai.expect;

const tmpfolder = '/tmp/ferrumtest';
const encKey = 'unvjukt3i62bxkr0d6f0lpvlho5fvqb1'
describe('systemWatcher', () => {
    const redis = new RedisService();

    beforeEach(async () => {
        await redis.flushAll();
        if (fs.existsSync(tmpfolder))
            await fs.rmSync(tmpfolder, { recursive: true, force: true });
        fs.mkdirSync(tmpfolder);
    })
    afterEach(async () => {
        LmdbService.close();
    })

    class MockConfig extends RedisConfigWatchService {
        /**
         *
         */
        constructor(systemlog?: SystemLogService) {
            super(new RedisService(), new RedisService(),
                systemlog || new SystemLogService(new RedisService(), new RedisService(), encKey), true, encKey)

        }
    }

    async function getSampleTunnel() {
        const tunnel1: Tunnel = {
            id: '123', tun: 'ferrum2', assignedClientIp: '1.2.3.4',
            authenticatedTime: new Date().toISOString(), clientIp: '3.4.5.6',
            gatewayId: '12345', serviceNetwork: '172.10.0.0/16', userId: '12', trackId: 5
        }
        const tunnel2: Tunnel = {
            id: '1234', tun: 'ferrum2', assignedClientIp: '1.2.3.4',
            authenticatedTime: new Date().toISOString(), clientIp: '3.4.5.6',
            gatewayId: '123456', serviceNetwork: '172.10.0.0/16', userId: '12', trackId: 5
        }
        return { val1: tunnel1, val2: tunnel2 };
    }
    it('loadAllTunnel', async () => {

        const { val1, val2 } = await getSampleTunnel();
        const bcast = new BroadcastService();
        let isTunnelConfigCalled = false;
        let count = 0;
        bcast.on('tunnelConfirm', (tun: Tunnel) => {
            isTunnelConfigCalled = true;
            count++;
        })
        const config = new MockConfig();
        await config.start();
        await Util.sleep(3000);
        const tunnelService = new TunnelService(config, redis, new DhcpService(config, redis));
        await redis.hset(`/tunnel/id/${val1.id}`, val1);
        await redis.hset(`/tunnel/id/${val2.id}`, val2);
        const watcher = new SystemWatcherTask(redis, config, tunnelService, bcast);
        watcher.setGatewayId('12345');
        await watcher.loadAllTunnels();
        await Util.sleep(1000);
        expect(isTunnelConfigCalled).to.be.true;
        expect(count == 1).to.be.true;

    }).timeout(100000)

    it('configChanged', async () => {


        const bcast = new BroadcastService();
        let isTunnelConfigCalled = false;

        bcast.on('configChanged', (tun: Tunnel) => {
            isTunnelConfigCalled = true;

        })
        const systemlog = new SystemLogService(new RedisService(), new RedisService(), encKey);
        const config = new MockConfig(systemlog);
        await config.start();
        await Util.sleep(3000);
        const tunnelService = new TunnelService(config, redis, new DhcpService(config, redis));
        const watcher = new SystemWatcherTask(redis, config, tunnelService, bcast);
        watcher.setGatewayId('12345');
        await watcher.start();
        await systemlog.write({ path: '/config/users', type: 'put', val: { id: '1231' } })
        await Util.sleep(5000);
        expect(isTunnelConfigCalled).to.be.true;


    }).timeout(100000)


    it('processTunnelEvents', async () => {


        const bcast = new BroadcastService();
        let isTunnelConfigCalled = false;

        bcast.on('tunnelConfigure', (tun: Tunnel) => {
            isTunnelConfigCalled = true;

        })
        const systemlog = new SystemLogService(new RedisService(), new RedisService(), encKey);
        const config = new MockConfig(systemlog);
        await config.start();
        await Util.sleep(3000);
        const tunnelService = new TunnelService(config, redis, new DhcpService(config, redis));
        const watcher = new SystemWatcherTask(redis, config, tunnelService, bcast);
        watcher.setGatewayId('12345');
        await watcher.start();
        await systemlog.write({ path: '/system/tunnels/confirm', type: 'put', val: { id: '1231', gatewayId: '12345' } })
        await Util.sleep(5000);
        expect(isTunnelConfigCalled).to.be.true;


    }).timeout(100000)



})