
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



chai.use(chaiHttp);
const expect = chai.expect;

const tmpfolder = '/tmp/ferrumtest';
describe('checkTunDevicesVSIptables', () => {
    beforeEach(async () => {
        const simpleRedis = new RedisService('localhost:6379,localhost:6390');
        await simpleRedis.flushAll();
        if (fs.existsSync(tmpfolder))
            await fs.rmSync(tmpfolder, { recursive: true, force: true });
    })

    it('check', async () => {
        const functionBackup = Util.exec;
        let deleteExecuted = false;
        Util.exec = async (cmd) => {
            if (cmd.startsWith('ip link show type'))
                return `ferrum1
                ferrum2`;
            if (cmd.startsWith('iptables -S INPUT'))
                return `-P INPUT ACCEPT
                -A INPUT ! -s 100.64.0.3/32 -i ferrum+ -j DROP
            -A INPUT ! -s 100.64.0.3/32 -i ferrum1 -j DROP
            -A INPUT ! -s 100.64.0.3/32 -i ferrum2 -j DROP
            -A INPUT ! -s 100.64.0.3/32 -i ferrum3 -j DROP`
            if (cmd.startsWith(`iptables -D`)) {
                deleteExecuted = true;
                return ''
            }
        }

        const checker = new CheckTunDevicesVSIptables({ host: 'localhost:6379' }, '/tmp/ferrum.conf');
        await checker.check();
        Util.exec = functionBackup;
        const result = await Util.exec('ls');
        expect(deleteExecuted).to.be.true;


    }).timeout(100000)



})