
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
import { ConfigService } from '../src/service/configService';
import { CheckIptablesCommonTask } from '../src/task/checkIptablesCommonTask';


chai.use(chaiHttp);
const expect = chai.expect;

const tmpfolder = '/tmp/ferrumtest';
describe('CheckIptablesCommonTask', () => {
    beforeEach(async () => {
        const simpleRedis = new RedisService('localhost:6379,localhost:6390');
        await simpleRedis.flushAll();
        if (fs.existsSync(tmpfolder))
            await fs.rmSync(tmpfolder, { recursive: true, force: true });
    })

    it('start', async () => {

        class MockConfigService extends ConfigService {
            override getServiceNetwork(): string {
                return '172.16.0.1';
            }
        }

        class Mock extends CheckIptablesCommonTask {
            isConfiguredNetwork = false;
            public isCheckCalled = false;
            constructor(protected redisHost: string, configFilePath: string, config: ConfigService) {
                super(redisHost, configFilePath, config);

            }
            public override async check(): Promise<void> {
                this.isCheckCalled = true;
                super.check();
            }



        }
        const config = new MockConfigService('localhost:6379');
        const task = new Mock('localhost:6379', '/tmp/ferrumgate', config);
        await task.start();
        expect(task.isCheckCalled).to.be.true;
        task.isCheckCalled = false;
        await Util.sleep(10000);
        expect(task.isCheckCalled).to.be.true;



    }).timeout(100000)



})