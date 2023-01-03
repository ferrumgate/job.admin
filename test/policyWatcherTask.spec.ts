
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


chai.use(chaiHttp);
const expect = chai.expect;

const tmpfolder = '/tmp/ferrumtest';
const encKey = 'unvjukt3i62bxkr0d6f0lpvlho5fvqb1'
describe('policyWatcherTask', () => {
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
    class MockSystemWatcherTask extends SystemWatcherTask {
        setGatewayId(id: string) {
            this.gatewayId = id;
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



    }).timeout(100000)



})