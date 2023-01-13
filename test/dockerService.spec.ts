
//docker run --net=host --name redis --rm -d redis


import chai from 'chai';
import chaiHttp from 'chai-http';

import fs from 'fs';
import { Service, Util } from 'rest.portal';
import { DockerService } from '../src/service/dockerService';



chai.use(chaiHttp);
const expect = chai.expect;

const tmpfolder = '/tmp/ferrumtest';
describe('dockerService', () => {
    beforeEach(async () => {

    })
    async function stopAllContaineers() {
        const docker = new DockerService();
        const pods = await docker.getAllRunning();
        for (const pod of pods) {
            if (pod.name.startsWith('ferrumgate-svc'))
                await docker.stop(pod);
        }
    }



    it('normalize', async () => {
        await stopAllContaineers();
        const docker = new DockerService();
        const result = docker.normalizeName('ad0-?As@@df!oiw02');
        expect(result).to.equal('ad0Asdfoiw02');

    }).timeout(30000)
    function createSampleData() {
        let service: Service = {
            id: Util.randomNumberString(),
            name: 'mysql-dev',
            isEnabled: true,
            labels: [],
            host: '1.2.3.4',
            networkId: 'abcd',
            tcp: 3306, assignedIp: '127.0.0.1',
            insertDate: new Date().toISOString(),
            updateDate: new Date().toISOString(),
            count: 1

        }
        return service;
    }
    it('getEnv', async () => {
        await stopAllContaineers();
        let svc = createSampleData();
        const docker = new DockerService();
        const result = docker.getEnv(svc);
        expect(result.trim()).to.equal('-e LOG_LEVEL=info -e SYSLOG_HOST=localhost:9292 -e REDIS_HOST=localhost:6379   -e RAW_DESTINATION_HOST=1.2.3.4 -e RAW_DESTINATION_TCP_PORT=3306  -e RAW_LISTEN_IP=127.0.0.1 -e RAW_LISTEN_TCP_PORT=3306');

    }).timeout(1000)

    it('getLabels', async () => {
        await stopAllContaineers();
        let svc = createSampleData();
        const docker = new DockerService();
        const result = docker.getLabels(svc);
        expect(result.trim()).to.includes('--label Ferrum_Svc_LastUpdate');

    }).timeout(1000)

    it('run', async () => {
        await stopAllContaineers();
        let svc = createSampleData();
        class Mock33 extends DockerService {
            constructor() {
                super();

            }
            cmd = '';
            ip = '';
            override async ipAddr(svc: Service): Promise<void> {
                this.ip = 'an ip';
            }
            override async execute(cmd: string): Promise<void> {
                this.cmd = cmd;
            }
        }
        const docker = new Mock33();
        const result = await docker.run(svc, '231a0932', 'host');
        expect(docker.ip).to.equal('an ip');
        expect(docker.cmd.trim().includes('docker run --cap-add=NET_ADMIN --rm --restart=no --net=host --volume ferrumgate_shared:/var/run/ferrumgate --volume ferrumgate_lmdb:/var/lib/ferrumgate --name  ferrumgate-svc-mysqld-Bpy2qwyzFgI7ldei-GN58V8 --label Ferrum_Svc_LastUpdate=2022-11-20T12:13:19.260Z --label Ferrum_Svc_Id=Bpy2qwyzFgI7ldei  -d  -e LOG_LEVEL=info -e REDIS_HOST=localhost:6379   -e RAW_DESTINATION_HOST=1.2.3.4 -e RAW_DESTINATION_TCP_PORT=3306  -e RAW_LISTEN_IP=127.0.0.1 -e RAW_LISTEN_TCP_PORT=3306    -e GATEWAY_ID=231a0932 -e SERVICE_ID=Bpy2qwyzFgI7ldei -e INSTANCE_ID=aepm5Qp8Losvf8sg ferrum.io'))


    }).timeout(10000)

    it('getAllRunning', async () => {
        await stopAllContaineers();
        class Mock22 extends DockerService {
            constructor() {
                super();

            }
            counter = 0;

            override async execute(cmd: string) {
                if (!this.counter) {
                    this.counter++;
                    return `
fa366965bd90a1f004592286785b870016510e9e4ca7cfd82b7ea426a37e4c1a registry.ferrumgate.local/ferrumgate/ferrum.io:latest test-blabla
2657ea83a55d85485abb4df94c59c2d128ce9355831b70cfa3d8a4fa4984327d registry.ferrumgate.local/ferrumgate/job.admin:1.0.0 ferrumgate-admin-1
cc95b3305d802f0058e52d7ce6e9f4e0f47cf1da0a2b12f108ef5ee16cba8acb nginx:1.23-alpine ferrumgate-nginx-1
71c151c386fb86a0b3b5fd59c3a7240bf3d7ceaef38b97c9c41771ac2194ef1b registry.ferrumgate.local/ferrumgate/rest.portal:1.0.0 ferrumgate-rest-1
d9263760e68d99b77f526f2a109ec0f3e6bd5218648eb64adcefdc05e42bcaa1 registry.ferrumgate.local/ferrumgate/secure.server:1.0.0 ferrumgate-server-1
55a2b5a467d6c406867705bbeb5b5a8c5219c647ef184dfa97c2d9c916c82c0f redis:7-bullseye ferrumgate-redis-local-1
6ed84cb668158c387af89a1ebe373acc4f9c4e0f5266fd2aaddc30e506b40d08 redis:7-bullseye ferrumgate-redis-1
32600408756ea709398f521dc4a9021940617c5784f503e2c7396841d271f322 registry.ferrumgate.local/ferrumgate/ui.portal:1.0.0 ferrumgate-ui-1
            `
                } else {
                    if (fs.existsSync('inspect.json'))
                        return fs.readFileSync('inspect.json').toString();
                    if (fs.existsSync('data/inspect.json'))
                        return fs.readFileSync('data/inspect.json').toString();
                    if (fs.existsSync('test/data/inspect.json'))
                        return fs.readFileSync('test/data/inspect.json').toString();


                    return '';

                }
            }
        }
        const docker = new Mock22();
        const containers = await docker.getAllRunning();

        expect(containers.length).to.equal(8);
        expect(containers[0].id).to.equal(`fa366965bd90a1f004592286785b870016510e9e4ca7cfd82b7ea426a37e4c1a`);
        expect(containers[0].image).to.equal(`registry.ferrumgate.local/ferrumgate/ferrum.io:latest`);
        expect(containers[0].name).to.equal(`test-blabla`);
        expect(containers[0].details.Config.Labels.Ferrum_Svc_LastUpdate).exist;



    }).timeout(100000);

    it('inspect', async () => {
        await stopAllContaineers();
        let svc = createSampleData();
        class Mock extends DockerService {
            /**
             *
             */
            constructor() {
                super();

            }
            counter = 0;

            override async execute(cmd: string): Promise<string> {

                if (fs.existsSync('inspect.json'))
                    return fs.readFileSync('inspect.json').toString();
                if (fs.existsSync('data/inspect.json'))
                    return fs.readFileSync('data/inspect.json').toString();
                if (fs.existsSync('test/data/inspect.json'))
                    return fs.readFileSync('test/data/inspect.json').toString();


                return '';


            }
        }
        const docker = new Mock();
        const containers = await docker.inspect('2');
        expect(containers.length).to.equal(1);
        expect(containers[0].Config.Labels.Ferrum_Svc_LastUpdate).exist;



    }).timeout(1000);


    it('run/getAllRunning/stop', async () => {
        await stopAllContaineers();
        class Mock extends DockerService {
            constructor() {
                super();

            }
            cmd = '';
            ip = '';
            override async ipAddr(svc: Service): Promise<void> {
                this.ip = 'an ip';
            }
        }
        const svc = createSampleData();
        const docker = new Mock();
        process.env.FERRUM_IMAGE = 'nginx'
        await docker.run(svc, '231a0932', 'host');
        delete process.env.FERRUM_IMAGE;
        const pods = await docker.getAllRunning();
        const pod = pods.find(x => x.name.includes('ferrumgate-svc'));
        expect(pod).exist;
        if (pod)
            await docker.stop(pod);

        const pods1 = await docker.getAllRunning();
        const pod2 = pods1.find(x => x.name.includes('ferrumgate-svc'));
        expect(pod2).not.exist;


    }).timeout(30000);










})