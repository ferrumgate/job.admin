
//docker run --net=host --name redis --rm -d redis


import chai from 'chai';
import chaiHttp from 'chai-http';
import { ConfigService } from '../src/service/configService';
import { CheckTunDevicesVSRedis } from '../src/task/checkTunDevicesVSRedis';
import { RedisService, Util } from 'rest.portal';
import { RedisOptions } from '../src/model/redisOptions';



chai.use(chaiHttp);
const expect = chai.expect;


describe('checkTunDevicesVSRedis', () => {
    beforeEach(async () => {
        const simpleRedis = new RedisService('localhost:6379,localhost:6390');
        await simpleRedis.flushAll();

    })

    it('check', async () => {

        class Mock extends CheckTunDevicesVSRedis {

            /**
             *
             */
            constructor(redisOption: RedisOptions, configService: ConfigService) {
                super(redisOption, configService);

            }
            protected override async readGatewayId(): Promise<void> {
                this.gatewayId = 'myhost123';
            }

        }
        const functionBackup = Util.exec;
        let deleteExecuted = false;
        Util.exec = async (cmd) => {
            if (cmd.startsWith('ip link show type'))
                return `ferrum1
                ferrum2`;

            if (cmd.startsWith(`ip link delete`)) {
                deleteExecuted = true;
                return ''
            }
        }
        // insert some data to redis
        const simpleRedis = new RedisService('localhost:6379,localhost:6390');
        await simpleRedis.set(`/gateway/myhost123/tun/ferrum1`, 1);

        const configService = new ConfigService();
        const checker = new Mock({ host: 'localhost:6379' }, configService);
        await checker.check();
        Util.exec = functionBackup;
        expect(deleteExecuted).to.be.true;


    }).timeout(100000)



})