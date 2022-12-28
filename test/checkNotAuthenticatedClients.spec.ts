
//docker run --net=host --name redis --rm -d redis


import chai, { util } from 'chai';
import chaiHttp from 'chai-http';


import { WhenClientAuthenticated } from '../src/task/whenClientAuthenticated';
import { basename } from 'path';
import { utils } from 'mocha';
import fspromise from 'fs/promises';
import fs from 'fs';
import { CheckNotAuthenticatedClients } from '../src/task/checkNotAuthenticatedClient';

import { ConfigService } from '../src/service/configService';
import { RedisOptions } from '../src/model/redisOptions';
import { RedisService, Tunnel } from 'rest.portal';



chai.use(chaiHttp);
const expect = chai.expect;

const tmpfolder = '/tmp/ferrumtest';
describe('checkNotAuthenticatedClients', () => {
    beforeEach(async () => {
        const simpleRedis = new RedisService('localhost:6379,localhost:6390');
        await simpleRedis.flushAll();
        if (fs.existsSync(tmpfolder))
            await fs.rmSync(tmpfolder, { recursive: true, force: true });

    })

    it('configure', async () => {

        const configService = new ConfigService();
        await configService.setGatewayId('123');
        class Mock extends CheckNotAuthenticatedClients {

            isConfiguredNetwork = false;
            constructor(protected redisOptions: RedisOptions, configFilePath: string) {
                super(redisOptions, configService);
                this.redis = this.createRedisClient();
                this.gatewayId = 'agatewayid'
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
            gatewayId: 'agatewayid', serviceNetwork: '172.10.0.0/16', userId: '12', trackId: 3
        }
        await redis.hset(`/tunnel/id/${key}`, tunnel);
        await redis.sadd(`/tunnel/configure/${tunnel.gatewayId}`, key);


        //execute
        const mock = new Mock({ host: 'localhost:6379' }, '/tmp/ferrumgate/config');
        await mock.testRemoveFromList(key);//remove from list
        let isExists = await redis.sismember(`/tunnel/configure/${tunnel.gatewayId}`, key);
        expect(isExists > 0).to.be.false;


        //change time to 4 minutes before
        tunnel.authenticatedTime = new Date(new Date().getTime() - 4 * 60 * 1000).toISOString();
        await redis.hset(`/tunnel/id/${key}`, tunnel);
        //add again
        await redis.sadd(`/tunnel/configure/${tunnel.gatewayId}`, key);
        await mock.testConfigure(key);
        isExists = await redis.sismember(`/tunnel/configure/${tunnel.gatewayId}`, key);
        expect(isExists > 0).to.be.false;
        expect(mock.isConfiguredNetwork).to.be.false;//because there must be error


        //everything is normal

        //change time to 2 minutes before
        tunnel.authenticatedTime = new Date(new Date().getTime() - 2 * 60 * 1000).toISOString();
        await redis.hset(`/tunnel/id/${key}`, tunnel);
        //add again
        await redis.sadd(`/tunnel/configure/${tunnel.gatewayId}`, key);
        await mock.testConfigure(key);
        isExists = await redis.sismember(`/tunnel/configure/${tunnel.gatewayId}`, key);
        expect(isExists > 0).to.be.false;
        expect(mock.isConfiguredNetwork).to.be.true;//because there is no error, network configured successfuly





    }).timeout(100000)



})