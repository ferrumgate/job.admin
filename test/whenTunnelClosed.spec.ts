
//docker run --net=host --name redis --rm -d redis


import chai, { util } from 'chai';
import chaiHttp from 'chai-http';
import { Util } from '../src/util';
import { RedisService } from '../src/service/redisService';
import { WhenClientAuthenticated } from '../src/task/whenClientAuthenticated';
import { basename } from 'path';
import { utils } from 'mocha';
import fspromise from 'fs/promises';
import fs from 'fs';
import { Tunnel } from '../src/model/tunnel';
import { WhenTunnelClosed } from '../src/task/whenTunnelClosed';
import { ConfigService } from '../src/service/configService';


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
            hostId: 'ahostid', serviceNetwork: '172.10.0.0/16', userId: '12', trackId: 5
        }
        const redis = new RedisService('localhost:6379', undefined);
        await redis.hset(`/tunnel/id/${key}`, tunnel);
        await redis.sadd(`/tunnel/configure/${tunnel.hostId}`, key);

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



            protected override async readHostId(): Promise<void> {
                this.hostId = 'ahostid';
            }
            public setHostId(host: string) {
                this.hostId = host;

            }
            public connectRedis() {
                this.redis = super.createRedisClient();
            }

        }

        const configService = new ConfigService('/tmp/config');
        const task = new Mock({ host: 'localhost:6379' }, configService);
        task.connectRedis();
        task.setHostId(tunnel.hostId || '');
        await task.onMessage(`/tunnel/closed/${tunnel.hostId}`, key);
        await Util.sleep(3000);
        expect(deleteExecuted).to.be.true;
        const redisItem = await redis.hgetAll(`/tunnel/id/${key}`);
        expect(redisItem.hostId).not.exist;
        const isExits = await redis.sismember(`/tunnel/configure/${tunnel.hostId}`, tunnel.id || '');
        expect(Boolean(isExits)).to.be.false;
        Util.exec = tmpFunction;//set back it again



    }).timeout(100000)


})