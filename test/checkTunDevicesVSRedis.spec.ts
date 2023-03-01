
//docker run --net=host --name redis --rm -d redis


import chai from 'chai';
import chaiHttp from 'chai-http';

import { CheckTunDevicesVSRedis } from '../src/task/checkTunDevicesVSRedis';
import { RedisService, Util } from 'rest.portal';
import { RedisOptions } from '../src/model/redisOptions';
import chaiSpy from 'chai-spies';
import { NetworkService } from '../src/service/networkService';
import { TunService } from '../src/service/tunService';


chai.use(chaiHttp);
chai.use(chaiSpy);
const expect = chai.expect;


describe('checkTunDevicesVSRedis', () => {
    beforeEach(async () => {
        const simpleRedis = new RedisService('localhost:6379,localhost:6390');
        await simpleRedis.flushAll();

    })
    afterEach(async () => {
        chai.spy.restore();
    })

    it('check', async () => {

        class Mock extends CheckTunDevicesVSRedis {

            protected override async readGatewayId(): Promise<void> {
                this.gatewayId = 'myhost123';
            }

            getCache() {
                return this.tunnelKeysForTryAgain;
            }


        }

        let deleteExecuted = false;
        const spy = chai.spy.on(NetworkService, 'getTunDevices', async () => {
            return [`ferrum1`,
                `ferrum2`];
        })
        const spyTun = chai.spy.on(TunService, 'delete', async () => {

        })


        // insert some data to redis
        const simpleRedis = new RedisService('localhost:6379,localhost:6390');
        await simpleRedis.set(`/gateway/myhost123/tun/ferrum1`, 1);


        const checker = new Mock(simpleRedis);
        const spyCache = chai.spy.on(checker.getCache(), 'has', () => true);
        const spyCache2 = chai.spy.on(checker.getCache(), 'get', () => new Date().getTime() + 1000000);

        await checker.check();
        expect(spy).to.have.been.called;
        expect(spyTun).not.have.been.called;
        expect(spyCache).to.have.been.called;
        expect(spyCache2).to.have.been.called;


    }).timeout(100000)



})