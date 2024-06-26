import chai from 'chai';
import chaiHttp from 'chai-http';
import fs from 'fs';
import { RedisService, Tunnel, Util } from 'rest.portal';
import { BroadcastService } from 'rest.portal/service/broadcastService';
import { WhenTunnelClosed } from '../src/task/whenTunnelClosed';

chai.use(chaiHttp);
const expect = chai.expect;

const tmpfolder = '/tmp/ferrumtest';
describe('whenTunnelClosed', () => {
    beforeEach(async () => {
        const simpleRedis = new RedisService('localhost:6379,localhost:6390');
        await simpleRedis.flushAll();
        if (fs.existsSync(tmpfolder))
            await fs.rmSync(tmpfolder, { recursive: true, force: true });
    })

    it('onMessageExecuted', async () => {
        const key = 'tunnelkey';
        const tunnel: Tunnel = {
            id: key, tun: 'ferrum2', assignedClientIp: '1.2.3.4',
            authenticatedTime: new Date().toISOString(), clientIp: '3.4.5.6',
            gatewayId: 'agatewayid', serviceNetwork: '172.10.0.0/16', userId: '12', trackId: 5
        }
        const redis = new RedisService('localhost:6379', undefined);
        await redis.hset(`/tunnel/id/${key}`, tunnel);
        await redis.sadd(`/tunnel/configure/${tunnel.gatewayId}`, key);

        const tmpFunction = Util.exec;
        let deleteExecuted = false;
        Util.exec = async (cmd) => {

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

        class Mock extends WhenTunnelClosed {

            protected override async readGatewayId(): Promise<void> {
                this.gatewayId = 'agatewayid';
            }

        }

        const bcast = new BroadcastService();
        const task = new Mock(bcast);
        await task.start();
        task.setGatewayId(tunnel.gatewayId || '');
        bcast.emit('tunnelExpired', tunnel);
        await Util.sleep(3000);
        expect(deleteExecuted).to.be.true;
        Util.exec = tmpFunction;//set back it again

    }).timeout(100000)

})