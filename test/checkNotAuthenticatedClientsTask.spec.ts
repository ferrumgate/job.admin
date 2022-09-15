
//docker run --net=host --name redis --rm -d redis


import chai, { util } from 'chai';
import chaiHttp from 'chai-http';
import { Util } from '../src/util';
import { RedisService } from '../src/service/redisService';
import { WhenClientAuthenticatedTask } from '../src/task/whenClientAuthenticatedTask';
import { basename } from 'path';
import { utils } from 'mocha';
import fspromise from 'fs/promises';
import fs from 'fs';
import { CheckNotAuthenticatedClients } from '../src/task/checkNotAuthenticatedClientTask';
import { Tunnel } from '../src/model/tunnel';


chai.use(chaiHttp);
const expect = chai.expect;

const tmpfolder = '/tmp/ferrumtest';
describe('CheckNotAuthenticatedClients', () => {
    beforeEach(async () => {
        const simpleRedis = new RedisService('localhost:6379,localhost:6390');
        await simpleRedis.flushAll();
        if (fs.existsSync(tmpfolder))
            await fs.rmSync(tmpfolder, { recursive: true, force: true });
    })

    it('configure', async () => {

        class Mock extends CheckNotAuthenticatedClients {
            isConfiguredNetwork = false;
            constructor(protected redisHost: string, configFilePath: string) {
                super(redisHost, configFilePath);
                this.redis = this.createRedisClient();
                this.hostId = 'ahostid'
            }

            public async testRemoveFromList(tunnelId: string) {
                await super.removeFromList(tunnelId);
            }
            protected override async configureNetwork(tunnel: Tunnel): Promise<void> {
                this.isConfiguredNetwork = true;
            }
            public async testConfigure(tunnelKey: string) {
                await super.configure(tunnelKey);
            }

        }
        // prepare some data
        const redis = new RedisService('localhost:6379');
        const key = `arandomkey`;
        const tunnel: Tunnel = {
            id: key, tun: 'tun0', assignedClientIp: '1.2.3.4',
            authenticatedTime: new Date().toISOString(), clientIp: '3.4.5.6',
            hostId: 'ahostid', serviceNetwork: '172.10.0.0/16', userId: '12'
        }
        await redis.hset(`/tunnel/${key}`, tunnel);
        await redis.sadd(`/tunnel/configure/${tunnel.hostId}`, key);


        //execute
        const mock = new Mock('localhost:6379', '/tmp/ferrumgate/config');
        await mock.testRemoveFromList(key);//remove from list
        let isExists = await redis.sismember(`/tunnel/configure/${tunnel.hostId}`, key);
        expect(isExists > 0).to.be.false;


        //change time to 4 minutes before
        tunnel.authenticatedTime = new Date(new Date().getTime() - 4 * 60 * 1000).toISOString();
        await redis.hset(`/tunnel/${key}`, tunnel);
        //add again
        await redis.sadd(`/tunnel/configure/${tunnel.hostId}`, key);
        await mock.testConfigure(key);
        isExists = await redis.sismember(`/tunnel/configure/${tunnel.hostId}`, key);
        expect(isExists > 0).to.be.false;
        expect(mock.isConfiguredNetwork).to.be.false;//because there must be error


        //everything is normal

        //change time to 2 minutes before
        tunnel.authenticatedTime = new Date(new Date().getTime() - 2 * 60 * 1000).toISOString();
        await redis.hset(`/tunnel/${key}`, tunnel);
        //add again
        await redis.sadd(`/tunnel/configure/${tunnel.hostId}`, key);
        await mock.testConfigure(key);
        isExists = await redis.sismember(`/tunnel/configure/${tunnel.hostId}`, key);
        expect(isExists > 0).to.be.false;
        expect(mock.isConfiguredNetwork).to.be.true;//because there is no error, network configured successfuly





    }).timeout(100000)



})