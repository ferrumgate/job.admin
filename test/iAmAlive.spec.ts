
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
import { ConfigService } from '../src/service/configService';


chai.use(chaiHttp);
const expect = chai.expect;

const tmpfolder = '/tmp/ferrumtest';
describe('iAmAlive', () => {
    beforeEach(async () => {
        const simpleRedis = new RedisService('localhost:6379,localhost:6390');
        await simpleRedis.flushAll();
        if (fs.existsSync(tmpfolder))
            await fs.rmSync(tmpfolder, { recursive: true, force: true });
    })



    it('check', async () => {

        class Mock extends IAmAlive {

            constructor(redisOption: RedisOptions, configService: ConfigService) {
                super(redisOption, configService);

            }
            protected override async readGatewayId(): Promise<void> {
                this.gatewayId = 'myhost123';
            }
            create() {
                this.redis = super.createRedisClient();
            }

        }

        const configService = new ConfigService('/tmp/config');
        const alive = new Mock({ host: 'localhost:6379' }, configService);
        alive.create();
        await alive.check();

        const simpleRedis = new RedisService('localhost:6379');
        const host = await simpleRedis.hgetAll('/gateway/alive/id/myhost123');
        expect(host).exist;
        expect(host.lastSeen).exist;


    }).timeout(100000)


})