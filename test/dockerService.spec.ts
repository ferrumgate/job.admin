import chai from 'chai';
import chaiHttp from 'chai-http';
import fs from 'fs';
import { Service, Util } from 'rest.portal';
import { DockerService } from '../src/service/dockerService';

chai.use(chaiHttp);
const expect = chai.expect;
const gatewayId = '12345'
const tmpfolder = '/tmp/ferrumtest';
describe('dockerService', () => {

    beforeEach(async () => {

    })
    async function stopAllContaineers() {
        const docker = new DockerService();
        const pods = await docker.getAllRunning();
        for (const pod of pods) {
            if (pod.name.startsWith('fg-'))
                await docker.stop(pod);
        }
    }
    function createSampleData() {
        let service: Service = {
            id: Util.randomNumberString(),
            name: 'mysql-dev',
            isEnabled: true,
            labels: [],
            hosts: [{ host: '1.2.3.4' }],
            networkId: 'abcd',
            ports: [{ port: 3306, isTcp: true }],
            assignedIp: '127.0.0.1',
            insertDate: new Date().toISOString(),
            updateDate: new Date().toISOString(),
            count: 1

        }
        return service;
    }

    it('normalize', async () => {
        await stopAllContaineers();
        const docker = new DockerService();
        const result = docker.normalizeName('ad0-?As@@df!oiw02');
        expect(result).to.equal('ad0Asdfoiw02');

    }).timeout(30000)

    it('getEnv', async () => {
        await stopAllContaineers();
        let svc = createSampleData();
        const docker = new DockerService();
        const port = svc.ports[0];
        const result = docker.getEnv(svc, port.port, port.isTcp, port.isUdp, 'ferrumgate.zero');
        expect(result.trim()).to.equal('-e LOG_LEVEL=info -e SYSLOG_HOST=localhost:9292 -e REDIS_HOST=localhost:6379  -e REDIS_INTEL_HOST=localhost:6379  -e RAW_DESTINATION_HOST=1.2.3.4 -e RAW_DESTINATION_TCP_PORT=3306  -e RAW_LISTEN_IP=127.0.0.1 -e PROTOCOL_TYPE=raw -e SYSLOG_HOST=log:9292  -e POLICY_DB_FOLDER=/tmp/abc -e DNS_DB_FOLDER=/var/lib/ferrumgate/dns -e AUTHZ_DB_FOLDER=/var/lib/ferrumgate/authz -e TRACK_DB_FOLDER=/var/lib/ferrumgate/track -e ROOT_FQDN=ferrumgate.zero  -e RAW_LISTEN_TCP_PORT=3306');

    }).timeout(1000)

    it('getLabels', async () => {
        await stopAllContaineers();
        let svc = createSampleData();
        const docker = new DockerService();
        const port = svc.ports[0];
        const result = docker.getLabels(svc, port.port, port.isTcp, port.isUdp, 0);
        expect(result.trim()).to.includes('--label FerrumSvcLastUpdate');
        expect(result.trim()).to.includes('--label FerrumSvcIsTcp');
        expect(result.trim()).to.includes('--label FerrumSvcIsUdp');
        expect(result.trim()).to.includes('--label FerrumSvcReplica');
        expect(result.trim()).to.includes('--label FerrumGatewayId');

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
        const port = svc.ports[0];
        const result = await docker.run(svc, gatewayId, 'host', 'ferrumgate.zero', port.port, port.isTcp, port.isUdp);
        expect(docker.ip).to.equal('an ip');
        expect(docker.cmd.trim().includes('docker run --cap-add=NET_ADMIN --rm --restart=no --net=host --volume ferrumgate_shared:/var/run/ferrumgate --volume ferrumgate_lmdb:/var/lib/ferrumgate --name  fg-12345-svc-mysqld-Bpy2qwyzFgI7ldei-GN58V8 --label FerrumSvcLastUpdate=2022-11-20T12:13:19.260Z --label FerrumSvcId=Bpy2qwyzFgI7ldei  -d  -e LOG_LEVEL=info -e REDIS_HOST=localhost:6379   -e RAW_DESTINATION_HOST=1.2.3.4 -e RAW_DESTINATION_TCP_PORT=3306  -e RAW_LISTEN_IP=127.0.0.1 -e RAW_LISTEN_TCP_PORT=3306    -e GATEWAY_ID=12345 -e SERVICE_ID=Bpy2qwyzFgI7ldei -e INSTANCE_ID=aepm5Qp8Losvf8sg ferrum.io'))
        //console.log(docker);

    }).timeout(20000)

    it('getAllRunning', async () => {
        await stopAllContaineers();
        class Mock22 extends DockerService {
            constructor() {
                super();

            }
            counter = 0;

            override async executeSpawn(cmd: string) {
                if (!this.counter) {
                    this.counter++;
                    return `
    fa366965bd90a1f004592286785b870016510e9e4ca7cfd82b7ea426a37e4c1a registry.ferrumgate.zero/ferrumgate/ferrum.io:latest test-blabla
    2657ea83a55d85485abb4df94c59c2d128ce9355831b70cfa3d8a4fa4984327d registry.ferrumgate.zero/ferrumgate/job.admin:1.0.0 ferrumgate-admin-1
    cc95b3305d802f0058e52d7ce6e9f4e0f47cf1da0a2b12f108ef5ee16cba8acb nginx:1.23-alpine ferrumgate-nginx-1
    71c151c386fb86a0b3b5fd59c3a7240bf3d7ceaef38b97c9c41771ac2194ef1b registry.ferrumgate.zero/ferrumgate/rest.portal:1.0.0 ferrumgate-rest-1
    d9263760e68d99b77f526f2a109ec0f3e6bd5218648eb64adcefdc05e42bcaa1 registry.ferrumgate.zero/ferrumgate/secure.server:1.0.0 ferrumgate-server-1
    55a2b5a467d6c406867705bbeb5b5a8c5219c647ef184dfa97c2d9c916c82c0f redis:7-bullseye ferrumgate-redis-local-1
    6ed84cb668158c387af89a1ebe373acc4f9c4e0f5266fd2aaddc30e506b40d08 redis:7-bullseye ferrumgate-redis-1
    32600408756ea709398f521dc4a9021940617c5784f503e2c7396841d271f322 registry.ferrumgate.zero/ferrumgate/ui.portal:1.0.0 ferrumgate-ui-1
                `
                } else {
                    if (fs.existsSync('inspect.json.txt'))
                        return fs.readFileSync('inspect.json.txt').toString();
                    if (fs.existsSync('data/inspect.json.txt'))
                        return fs.readFileSync('data/inspect.json.txt').toString();
                    if (fs.existsSync('test/data/inspect.json.txt'))
                        return fs.readFileSync('test/data/inspect.json.txt').toString();

                    return '';

                }
            }
        }
        const docker = new Mock22();
        const containers = await docker.getAllRunning(gatewayId);

        expect(containers.length).to.equal(8);
        expect(containers[0].id).to.equal(`fa366965bd90a1f004592286785b870016510e9e4ca7cfd82b7ea426a37e4c1a`);
        expect(containers[0].image).to.equal(`registry.ferrumgate.zero/ferrumgate/ferrum.io:latest`);
        expect(containers[0].name).to.equal(`test-blabla`);
        expect(containers[0].details.FerrumSvcLastUpdate).exist;

    }).timeout(100000);

    it('inspect', async () => {
        await stopAllContaineers();
        let svc = createSampleData();
        class Mock extends DockerService {

            constructor() {
                super();

            }
            counter = 0;

            override async executeSpawn(cmd: string): Promise<string> {

                if (fs.existsSync('inspect.json.txt'))
                    return fs.readFileSync('inspect.json.txt').toString();
                if (fs.existsSync('data/inspect.json.txt'))
                    return fs.readFileSync('data/inspect.json.txt').toString();
                if (fs.existsSync('test/data/inspect.json.txt'))
                    return fs.readFileSync('test/data/inspect.json.txt').toString();

                return '';

            }
        }
        const docker = new Mock();
        const containers = await docker.inspect('2');
        expect(containers.length).to.equal(3);
        expect(containers[0].FerrumSvcLastUpdate).exist;

    }).timeout(10000);

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
        process.env.FERRUM_IMAGE = 'nginx';
        const port = svc.ports[0];
        await docker.run(svc, gatewayId, 'host', 'ferrumgate.zero', port.port, port.isTcp, port.isUdp);
        delete process.env.FERRUM_IMAGE;
        const pods = await docker.getAllRunning(gatewayId);
        const pod = pods.find(x => x.name.includes('fg-12345-svc'));
        expect(pod).exist;
        if (pod)
            await docker.stop(pod);

        const pods1 = await docker.getAllRunning(gatewayId);
        const pod2 = pods1.find(x => x.name.includes('fg-12345-svc'));
        expect(pod2).not.exist;

    }).timeout(30000);

    it('run/getAllRunning/stop 250 count', async () => {
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
        const docker = new Mock();
        for (let i = 0; i < 250; ++i) {
            const svc = createSampleData();
            svc.id += i;
            svc.ports[0].port + i;
            process.env.FERRUM_IMAGE = 'nginx';
            const port = svc.ports[0];
            await docker.run(svc, gatewayId, 'host', 'ferrumgate.zero', port.port, port.isTcp, port.isUdp);

        }
        const pods = await docker.getAllRunning(gatewayId);
        expect(pods.length).to.equal(250);

        await stopAllContaineers();

    }).timeout(300000);

})