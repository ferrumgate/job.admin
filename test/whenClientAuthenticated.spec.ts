
//docker run --net=host --name redis --rm -d redis


import chai from 'chai';
import chaiHttp from 'chai-http';

import { WhenClientAuthenticated } from '../src/task/whenClientAuthenticated';
import fs from 'fs';

import { RedisService, Tunnel, Util } from 'rest.portal';
import { RedisOptions } from '../src/model/redisOptions';
import { BroadcastService } from 'rest.portal/service/broadcastService';




chai.use(chaiHttp);
const expect = chai.expect;

const tmpfolder = '/tmp/ferrumtest';
describe('WhenClientAuthenticated', () => {
    beforeEach(async () => {
        const simpleRedis = new RedisService('localhost:6379,localhost:6390');
        await simpleRedis.flushAll();
        if (fs.existsSync(tmpfolder))
            await fs.rmSync(tmpfolder, { recursive: true, force: true });
    })




    it('onMessageExecuted', async () => {

        class Mock extends WhenClientAuthenticated {
            isCalled = false;
            override async onMessage(data: Tunnel): Promise<void> {
                this.isCalled = true;
                await super.onMessage(data);
            }
        }
        const bcast = new BroadcastService();
        const task = new Mock(bcast);
        await task.start();

        bcast.emit(`tunnelConfigure`, 'something');
        await Util.sleep(3000);
        expect(task.isCalled).to.be.true;


    }).timeout(100000)


})