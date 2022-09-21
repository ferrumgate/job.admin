
//docker run --net=host --name redis --rm -d redis


import chai, { util } from 'chai';
import chaiHttp from 'chai-http';
import { Util } from '../src/util';
import { RedisOptions, RedisService } from '../src/service/redisService';
import { WhenClientAuthenticatedTask } from '../src/task/whenClientAuthenticatedTask';
import { basename } from 'path';
import { utils } from 'mocha';
import fspromise from 'fs/promises';
import fs from 'fs';
import { CheckNotAuthenticatedClients } from '../src/task/checkNotAuthenticatedClientTask';
import { Tunnel } from '../src/model/tunnel';
import { ConfigService } from '../src/service/configService';
import { CheckIptablesCommonTask } from '../src/task/checkIptablesCommonTask';
import { NetworkService } from '../src/service/networkService';
import { CheckTunDevicesVSIptables } from '../src/task/checkTunDevicesVSIptables';
import { CheckTunDevicesVSRedis } from '../src/task/checkTunDevicesVSRedis';



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
            constructor(redisOption: RedisOptions, configFilePath: string) {
                super(redisOption, configFilePath);

            }
            protected override async readHostId(): Promise<void> {
                this.hostId = 'myhost123';
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
        await simpleRedis.set(`/host/myhost123/tun/ferrum1`, 1);


        const checker = new Mock({ host: 'localhost:6379' }, '/tmp/ferrum.conf');
        await checker.check();
        Util.exec = functionBackup;
        expect(deleteExecuted).to.be.true;


    }).timeout(100000)



})