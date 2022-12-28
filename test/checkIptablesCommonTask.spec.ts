
//docker run --net=host --name redis --rm -d redis


import chai, { util } from 'chai';
import chaiHttp from 'chai-http';

import { WhenClientAuthenticated } from '../src/task/whenClientAuthenticated';
import { basename } from 'path';
import { utils } from 'mocha';
import fspromise from 'fs/promises';
import fs from 'fs';
import { ConfigService } from '../src/service/configService';
import { CheckIptablesCommon } from '../src/task/checkIptablesCommon';
import { RedisService, Util } from 'rest.portal';
import { RedisOptions } from '../src/model/redisOptions';



chai.use(chaiHttp);
const expect = chai.expect;

const tmpfolder = '/tmp/ferrumtest';
describe('checkIptablesCommonTask', () => {
    beforeEach(async () => {
        const simpleRedis = new RedisService('localhost:6379,localhost:6390');
        await simpleRedis.flushAll();
        if (fs.existsSync(tmpfolder))
            await fs.rmSync(tmpfolder, { recursive: true, force: true });

    })

    it('start', async () => {

        class MockConfigService45 extends ConfigService {
            constructor(redisHost?: string) {
                super(redisHost, undefined);

            }
        }

        class Mock55 extends CheckIptablesCommon {
            isConfiguredNetwork = false;
            public isCheckCalled = false;
            constructor(protected redisOptions: RedisOptions, config: ConfigService) {
                super(redisOptions, config);

            }

            public override async check(): Promise<void> {
                this.isCheckCalled = true;
                super.check();
            }



        }

        const config = new MockConfigService45('localhost:6379') as unknown as ConfigService;
        config.setGatewayId('123');
        const task = new Mock55({ host: 'localhost:6379' }, config);
        await task.start();
        expect(task.isCheckCalled).to.be.true;
        task.isCheckCalled = false;
        await Util.sleep(40000);
        expect(task.isCheckCalled).to.be.true;



    }).timeout(100000)



})