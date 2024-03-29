import chai from 'chai';
import chaiHttp from 'chai-http';
import fs from 'fs';
import { IAmAlive } from '../src/task/iAmAlive';
import { RedisService } from 'rest.portal';
import { RedisOptions } from '../src/model/redisOptions';

chai.use(chaiHttp);
const expect = chai.expect;

const tmpfolder = '/tmp/ferrumtest';
describe('iAmAlive', () => {
    const simpleRedis = new RedisService('localhost:6379,localhost:6390');
    beforeEach(async () => {

        await simpleRedis.flushAll();
        if (fs.existsSync(tmpfolder))
            await fs.rmSync(tmpfolder, { recursive: true, force: true });
    })

    it('check', async () => {

        class Mock extends IAmAlive {

            protected override async readGatewayId(): Promise<void> {
                this.gatewayId = 'myhost123';
            }

        }

        const alive = new Mock(simpleRedis);
        await alive.check();

        const host = await simpleRedis.hgetAll('/alive/gateway/id/myhost123');
        expect(host).exist;
        expect(host.lastSeen).exist;

    }).timeout(100000)

})