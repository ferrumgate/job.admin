
//docker run --net=host --name redis --rm -d redis


import chai, { util } from 'chai';
import chaiHttp from 'chai-http';
import { Util } from '../src/util';

import { WhenClientAuthenticated } from '../src/task/whenClientAuthenticated';
import { basename } from 'path';
import { utils } from 'mocha';
import fspromise from 'fs/promises';
import fs from 'fs';
import { Tunnel } from '../src/model/tunnel';
import { WhenTunnelClosed } from '../src/task/whenTunnelClosed';
import { IAmAlive } from '../src/task/iAmAlive';
import { RedisOptions, RedisService } from "../src/service/redisService";
import { ConfigResponse, ConfigService } from '../src/service/configService';


chai.use(chaiHttp);
const expect = chai.expect;


describe('configService', () => {
    beforeEach(async () => {
        const simpleRedis = new RedisService('localhost:6379');
        await simpleRedis.flushAll();

    })



    it('createRequest', async () => {
        const config = new ConfigService('/tmp/abc', 'localhost:6379');
        const request = await config.createRequest({ id: '1', func: 'getServiceId', hostId: '123', params: [] }, 1000)
        const result = await request.promise;
        expect(result.id).to.equal('1');
        expect(result.isError).to.be.true;

        //
        const request2 = await config.createRequest({ id: '2', func: 'getServiceId', hostId: '123', params: [] }, 5000)
        setTimeout(() => {
            config.eventEmitter.emit('data', { id: '2', result: 12 })
        }, 1000);
        const result2 = await request2.promise;
        expect(result2.id).to.equal('2');
        expect(result2.isError).to.be.undefined;
        expect(result2.result).to.be.equal(12);
        await config.stop();

    }).timeout(100000)

    it('listenStream', async () => {
        const simpleRedis = new RedisService('localhost:6379');
        fs.writeFileSync('/tmp/abc', 'host=123');

        const config = new ConfigService('/tmp/abc', 'localhost:6379');
        await config.start();
        let isDataReceived = false;
        config.eventEmitter.on('data', () => {
            isDataReceived = true;
        })
        let resp: ConfigResponse = { id: '1', result: 12, isError: false, };
        config.requestList.set('1', {} as any);
        await Util.sleep(100);
        for (let i = 0; i < 10; ++i) {
            await simpleRedis.xadd('/query/host/123', { data: Buffer.from(JSON.stringify(resp)).toString('base64') });
            await Util.sleep(100);
        }
        await Util.sleep(2000);
        await config.stop();
        expect(isDataReceived).to.be.true;



    }).timeout(150000)


})