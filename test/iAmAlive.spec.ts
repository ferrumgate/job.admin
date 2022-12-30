
//docker run --net=host --name redis --rm -d redis


import chai from 'chai';
import chaiHttp from 'chai-http';

import fs from 'fs';
import { IAmAlive } from '../src/task/iAmAlive';
import { ConfigService } from '../src/service/configService';
import { RedisService } from 'rest.portal';
import { RedisOptions } from '../src/model/redisOptions';


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

        const configService = new ConfigService();
        const alive = new Mock({ host: 'localhost:6379' }, configService);
        alive.create();
        await alive.check();

        const simpleRedis = new RedisService('localhost:6379');
        const host = await simpleRedis.hgetAll('/alive/gateway/id/myhost123');
        expect(host).exist;
        expect(host.lastSeen).exist;


    }).timeout(100000)


})