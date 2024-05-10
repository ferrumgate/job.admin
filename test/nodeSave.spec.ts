import chai from 'chai';
import chaiHttp from 'chai-http';
import fs from 'fs';
import { RedisConfigService, RedisService, SystemLogService, Util } from 'rest.portal';
import { NodeSave } from '../src/task/node/nodeSave';

chai.use(chaiHttp);
const expect = chai.expect;

const tmpfolder = '/tmp/ferrumtest';
describe('NodeSave', () => {
    const simpleRedis = new RedisService('localhost:6379,localhost:6390');
    const simpleRedisStream = new RedisService('localhost:6379,localhost:6390');

    beforeEach(async () => {

        await simpleRedis.flushAll();
        if (fs.existsSync(tmpfolder))
            await fs.rmSync(tmpfolder, { recursive: true, force: true });
    })

    it('check', async () => {
        const log = new SystemLogService(simpleRedis, simpleRedisStream);
        const encryptKey = Util.randomNumberString(32);
        const nodeId = Util.randomNumberString(16);
        class Mock extends NodeSave {
            protected encryptKey: string = encryptKey;
            constructor(protected redis: RedisService, protected redisStream: RedisService, protected log: SystemLogService) {
                super(redis, redisStream, log, encryptKey);
                this.nodeId = nodeId;
                this.encryptKey = encryptKey;
            }
        }

        const save = new Mock(simpleRedis, simpleRedisStream, log);
        await save.start();
        await Util.sleep(5000);
        const redisConfig = new RedisConfigService(simpleRedis, simpleRedisStream, log, encryptKey);
        await redisConfig.start();
        await Util.sleep(5000);
        const host = await redisConfig.getNode(nodeId);
        await redisConfig.stop();
        await save.stop();
        expect(host).exist;
        if (host)
            expect(host.name).exist;


    }).timeout(100000)

})