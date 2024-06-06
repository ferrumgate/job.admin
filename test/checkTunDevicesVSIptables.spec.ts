import chai from 'chai';
import chaiHttp from 'chai-http';
import fs from 'fs';
import { RedisService, Util } from 'rest.portal';
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

        const checker = new CheckTunDevicesVSIptables();
        await checker.check();
        Util.exec = functionBackup;
        const result = await Util.exec('ls');
        expect(deleteExecuted).to.be.true;

    }).timeout(100000)

})