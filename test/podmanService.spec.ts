
//docker run --net=host --name redis --rm -d redis


import chai, { util } from 'chai';
import chaiHttp from 'chai-http';
import { Util } from '../src/util';

import { WhenClientAuthenticated } from '../src/task/whenClientAuthenticated';
import { basename } from 'path';
import { utils } from 'mocha';
import fspromise from 'fs/promises';
import fs from 'fs';
import { Tunnel } from '../src/model/tunnel';
import { WhenTunnelClosed } from '../src/task/whenTunnelClosed';
import { IAmAlive } from '../src/task/iAmAlive';
import { RedisOptions, RedisService } from "../src/service/redisService";
import { ConfigService } from '../src/service/configService';
import { PodmanService } from '../src/service/podmanService';
import { Service } from '../src/model/service';


chai.use(chaiHttp);
const expect = chai.expect;

const tmpfolder = '/tmp/ferrumtest';
describe('podmanService', () => {
    beforeEach(async () => {

    })



    it('normalize', async () => {

        const podman = new PodmanService();
        const result = podman.normalizeName('ad0-?As@@df!oiw02');
        expect(result).to.equal('ad0Asdfoiw02');

    }).timeout(1000)
    function createSampleData() {
        let service: Service = {
            id: Util.randomNumberString(),
            name: 'mysql-dev',
            isEnabled: true,
            labels: [],
            host: '1.2.3.4',
            networkId: 'abcd',
            tcp: 3306, assignedIp: '1.3',
            insertDate: new Date().toISOString(),
            updateDate: new Date().toISOString(),

        }
        return service;
    }
    it('getEnv', async () => {
        let svc = createSampleData();
        const podman = new PodmanService();
        const result = podman.getEnv(svc);
        expect(result.trim()).to.equal('-e LOG_LEVEL=INFO -e REDIS_HOST=localhost:6379   -e REDIS_LOCAL_HOST=localhost:6379   -e RAW_DESTINATION_HOST=1.2.3.4 -e RAW_DESTINATION_TCP_PORT=3306  -e RAW_LISTEN_IP=1.3 -e RAW_LISTEN_TCP_PORT=3306');

    }).timeout(1000)

    it('run', async () => {
        let svc = createSampleData();
        class Mock extends PodmanService {
            cmd = '';
            ip = '';
            override async ipAddr(svc: Service): Promise<void> {
                this.ip = 'an ip';
            }
            override async exec(cmd: string): Promise<void> {
                this.cmd = cmd;
            }
        }
        const podman = new Mock();
        const result = await podman.run(svc);
        expect(podman.ip).to.equal('an ip');
        expect(podman.cmd.trim().includes('podman run --cap-add=NET_ADMIN --rm --restart=no --net=host --name mysql-dev-3KoOOLwzfUeX5FCu  -d  -e LOG_LEVEL=INFO -e REDIS_HOST=localhost:6379   -e REDIS_LOCAL_HOST=localhost:6379   -e RAW_DESTINATION_HOST=1.2.3.4 -e RAW_DESTINATION_TCP_PORT=3306  -e RAW_LISTEN_IP=1.3 -e RAW_LISTEN_TCP_PORT=3306    -e HOST_ID=hostId -e SERVICE_ID=serviceId -e'))


    }).timeout(1000)



})