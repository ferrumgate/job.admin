
//docker run --net=host --name redis --rm -d redis


import chai, { util } from 'chai';
import chaiHttp from 'chai-http';
import { Util } from '../src/util';
import { RedisOptions, RedisService } from '../src/service/redisService';
import { WhenClientAuthenticated } from '../src/task/whenClientAuthenticated';
import { basename } from 'path';
import { utils } from 'mocha';
import fspromise from 'fs/promises';
import fs from 'fs';
import { CheckNotAuthenticatedClients } from '../src/task/checkNotAuthenticatedClient';
import { Tunnel } from '../src/model/tunnel';
import { ConfigService } from '../src/service/configService';
import { CheckIptablesCommonTask } from '../src/task/checkIptablesCommonTask';



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

        class MockConfigService extends ConfigService {
            override async getServiceNetwork(): Promise<string> {
                return '172.16.0.1';
            }
        }

        class Mock extends CheckIptablesCommonTask {
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
        fs.writeFileSync('/tmp/x.conf', 'host=123');
        const config = new MockConfigService('/tmp/x.conf', 'localhost:6379') as unknown as ConfigService;
        const task = new Mock({ host: 'localhost:6379' }, config);
        await task.start();
        expect(task.isCheckCalled).to.be.true;
        task.isCheckCalled = false;
        await Util.sleep(40000);
        expect(task.isCheckCalled).to.be.true;



    }).timeout(100000)



})