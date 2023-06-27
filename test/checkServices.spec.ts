

//docker run --net=host --name redis --rm -d redis


import chai, { util } from 'chai';
import chaiHttp from 'chai-http';
import { RedisService, SystemLogService } from 'rest.portal';
import { Gateway, Network, RedisConfigWatchService, Service, Util } from 'rest.portal';
import { RedisOptions } from '../src/model/redisOptions';
import { DockerService } from '../src/service/dockerService';
import { CheckServices } from '../src/task/checkServices';
import fs from 'fs';
import { BroadcastService } from 'rest.portal/service/broadcastService';



chai.use(chaiHttp);
const expect = chai.expect;
const gatewayId = '12345';
const tmpfolder = '/tmp/ferrumtest';
describe('checkServices', () => {
    const simpleRedis = new RedisService();
    before(async () => {
        if (!fs.existsSync('/tmp/abc'))
            fs.mkdirSync('/tmp/abc');
    })
    beforeEach(async () => {
        await simpleRedis.flushAll();



    })

    async function closeAllServices() {
        const docker = new DockerService();
        const pods = await docker.getAllRunning();
        for (const pod of pods) {
            if (pod.name.startsWith(`fg-`))
                await docker.stop(pod);
        }
    }


    async function createSampleData() {


        let network: Network = {
            id: '6hiryy8ujv3n',
            name: 'default',
            labels: [],
            clientNetwork: '10.10.0.0/16',
            serviceNetwork: '172.16.0.0/24',
            insertDate: new Date().toISOString(),
            updateDate: new Date().toISOString()
        };


        let gateway: Gateway = {
            id: gatewayId,
            name: 'myserver',
            labels: [],
            isEnabled: true,
            networkId: network.id,
            insertDate: new Date().toISOString(),
            updateDate: new Date().toISOString()
        }



        let service: Service = {
            id: Util.randomNumberString(),
            name: 'mysql-dev',
            isEnabled: true,
            labels: [],
            hosts: [{ host: '1.2.3.4' }],
            networkId: network.id,
            ports: [{ port: 3306, isTcp: true, isUdp: false }],
            assignedIp: '127.0.0.1',
            insertDate: new Date().toISOString(),
            updateDate: new Date().toISOString(),
            count: 1

        }

        return { gateway, network, service };
    }
    class MockConfig extends RedisConfigWatchService {
        /**
         *
         */
        constructor() {
            super(new RedisService(), new RedisService(),
                new SystemLogService(new RedisService(), new RedisService(),
                    '2a4lsbavreasjcgsw4pq5w7wm7ipt7vl'),
                true, '2a4lsbavreasjcgsw4pq5w7wm7ipt7vl')

        }
    }

    it('closeAllServices', async () => {
        await closeAllServices();
        const { gateway, network, service } = await createSampleData();
        const docker = new DockerService();

        const checkservices = new CheckServices(new MockConfig(), new BroadcastService(), docker);
        checkservices.setGatewayId(gatewayId);
        const port = service.ports[0];
        await docker.run(service, gatewayId, 'host', 'ferrumgate.zero', port.port, port.isTcp, port.isUdp);
        await checkservices.closeAllServices();
        const pods = await docker.getAllRunning(gatewayId);
        expect(pods.find(x => x.name.includes(`fg-${gatewayId}-svc`))).to.be.undefined;

    }).timeout(30000)

    it('checkServices', async () => {
        await closeAllServices();
        const { gateway, network, service } = await createSampleData();
        const docker = new DockerService();

        const config = new MockConfig();
        const checkservices = new CheckServices(config, new BroadcastService(), docker);
        checkservices.setGatewayId(gatewayId);
        let closeAllCalled = false;
        const realcloseAllServices = checkservices.closeAllServices;

        checkservices.closeAllServices = async () => {
            closeAllCalled = true;
            await realcloseAllServices.bind(checkservices)()
        }
        //no gateway
        closeAllCalled = false;
        config.getGateway = async () => {
            return undefined;
        }


        await checkservices.checkServices();
        expect(closeAllCalled).to.be.true;

        // gateway is disabled
        closeAllCalled = false;
        gateway.isEnabled = false;
        config.getGateway = async () => {
            return gateway;
        }

        await checkservices.checkServices();
        expect(closeAllCalled).to.be.true;

        gateway.isEnabled = true;

        //no network
        closeAllCalled = false;
        const realgetNetworkByGatewayId = config.getNetworkByGateway;
        config.getNetworkByGateway = async () => {
            return null;
        }


        await checkservices.checkServices();
        expect(closeAllCalled).to.be.true;


        //network disabled
        closeAllCalled = false;
        network.isEnabled = false;
        config.getNetworkByGateway = async () => {
            return network;
        }


        await checkservices.checkServices();
        expect(closeAllCalled).to.be.true;

        network.isEnabled = true;
        //network service network problem
        closeAllCalled = false;
        network.serviceNetwork = '';


        await checkservices.checkServices();
        expect(closeAllCalled).to.be.true;


        //evertytin normal check if compare called
        network.serviceNetwork = '1.2.3.4'
        closeAllCalled = false;
        config.getServicesByNetworkId = async () => {
            return [service];
        }

        let compareCalled = false;

        checkservices.compare = async () => {
            compareCalled = true;
        }

        await checkservices.checkServices();
        expect(closeAllCalled).to.be.false;



    }).timeout(30000)


    it('compare', async () => {
        process.env.REDIS_HOST = "127.0.0.1:6379"
        process.env.REDIS_INTEL_HOST = "127.0.0.1:6379"
        await closeAllServices();
        const { gateway, network, service } = await createSampleData();
        const docker = new DockerService();



        const config = new MockConfig();
        const checkservices = new CheckServices(config, new BroadcastService(), docker);
        //const gatewayId = gatewayId;
        checkservices.setGatewayId(gatewayId);

        const isWorkingStr = await Util.exec(`docker ps|grep fg-${gatewayId}-secure.server|wc -l`) as string;
        const isWorking = Number(isWorkingStr);
        if (isWorking) {
            await Util.exec(`docker stop fg-${gatewayId}-secure.server`);
        }
        await Util.exec(`docker run -d --rm --name fg-${gatewayId}-secure.server --label=Ferrum_Gateway_Id=${gatewayId} -p 9393:80 nginx`);
        await Util.sleep(1000);
        //start 1 services
        const port = service.ports[0];
        await docker.run(service, 'abc', 'host', 'ferrumgate.zero', port.port, port.isTcp, port.isUdp);

        const runnings = await docker.getAllRunning(gatewayId);
        await checkservices.compare(runnings, [service], 'ferrumgate.zero');

        const runnings2 = await docker.getAllRunning(gatewayId);
        expect(runnings2.filter(x => x.name.includes(`fg-${gatewayId}-svc`)).length).to.equal(1);

        await checkservices.closeAllServices();
        // start 2 services, 1 of them will be stoped
        const service2 = JSON.parse(JSON.stringify(service));
        service2.id = '15';
        await Util.sleep(1000);
        await docker.run(service, gatewayId, 'host', 'ferrumgate.zero', port.port, port.isTcp, port.isUdp);
        await docker.run(service2, gatewayId, 'host', 'ferrumgate.zero', port.port, port.isTcp, port.isUdp);

        const runnings3 = await docker.getAllRunning(gatewayId);
        await checkservices.compare(runnings3, [service], 'ferrumgate.zero');
        await Util.sleep(1000);
        const runnings4 = await docker.getAllRunning(gatewayId);
        expect(runnings4.filter(x => x.name.includes(`fg-${gatewayId}-svc`)).length).to.equal(1);

        await checkservices.closeAllServices();
        await Util.sleep(1000);

        await checkservices.closeAllServices();
        delete process.env.REDIS_HOST;
        delete process.env.REDIS_INTEL_HOST;

    }).timeout(1200000);



    it('compare', async () => {
        process.env.REDIS_HOST = "127.0.0.1:6379"
        process.env.REDIS_INTEL_HOST = "127.0.0.1:6379"
        await closeAllServices();
        const { gateway, network, service } = await createSampleData();
        const docker = new DockerService();



        const config = new MockConfig();
        const checkservices = new CheckServices(config, new BroadcastService(), docker);
        //const gatewayId = gatewayId
        checkservices.setGatewayId(gatewayId);

        const isWorkingStr = await Util.exec(`docker ps|grep fg-${gatewayId}-secure.server|wc -l`) as string;
        const isWorking = Number(isWorkingStr);
        if (isWorking) {
            await Util.exec(`docker stop fg-${gatewayId}-secure.server`);
        }
        await Util.exec(`docker run -d --rm --name fg-${gatewayId}-secure.server --label=Ferrum_Gateway_Id=${gatewayId} -p 9393:80 nginx`);
        await Util.sleep(3000);
        //start 1 service with 4 ports
        service.ports.push({ port: 4000, isTcp: true, isUdp: true });
        service.ports.push({ port: 5000, isTcp: false, isUdp: true });
        service.ports.push({ port: 5000, isTcp: true, isUdp: false });
        const port0 = service.ports[0];
        const port1 = service.ports[1];
        const port2 = service.ports[1];
        const port3 = service.ports[1];

        let runnings = await docker.getAllRunning(gatewayId);
        await checkservices.compare(runnings, [service], 'ferrumgate.zero');
        await Util.sleep(5000);
        runnings = await docker.getAllRunning(gatewayId);
        expect(runnings.filter(x => x.name.includes(`fg-${gatewayId}-svc`)).length).to.equal(4);

        await checkservices.closeAllServices();
        // start 1 port previously
        await docker.run(service, gatewayId, 'host', 'ferrumgate.zero', port0.port, port0.isTcp, port0.isUdp);

        await Util.sleep(1000);
        runnings = await docker.getAllRunning(gatewayId);
        expect(runnings.filter(x => x.name.includes(`fg-${gatewayId}-svc`)).length).to.equal(1);
        await checkservices.compare(runnings, [service], 'ferrumgate.zero');

        await Util.sleep(1000);
        runnings = await docker.getAllRunning(gatewayId);
        expect(runnings.filter(x => x.name.includes(`fg-${gatewayId}-svc`)).length).to.equal(4);
        await checkservices.closeAllServices();
        await Util.sleep(1000);


        //service disabled scenario

        runnings = await docker.getAllRunning(gatewayId);
        expect(runnings.filter(x => x.name.includes(`fg-${gatewayId}-svc`)).length).to.equal(0);
        await checkservices.compare(runnings, [service], 'ferrumgate.zero');
        await Util.sleep(1000);

        runnings = await docker.getAllRunning(gatewayId);
        expect(runnings.filter(x => x.name.includes(`fg-${gatewayId}-svc`)).length).to.equal(4);
        service.isEnabled = false;
        await checkservices.compare(runnings, [service], 'ferrumgate.zero');
        await Util.sleep(1000);
        runnings = await docker.getAllRunning(gatewayId);
        expect(runnings.filter(x => x.name.includes(`fg-${gatewayId}-svc`)).length).to.equal(0);


        // service enabled last update time changed
        service.isEnabled = true;
        await checkservices.compare(runnings, [service], 'ferrumgate.zero');
        await Util.sleep(1000);
        runnings = await docker.getAllRunning(gatewayId);
        expect(runnings.filter(x => x.name.includes(`fg-${gatewayId}-svc`)).length).to.equal(4);

        service.updateDate = new Date().toISOString();
        await checkservices.compare(runnings, [service], 'ferrumgate.zero');
        await Util.sleep(1000);
        runnings = await docker.getAllRunning(gatewayId);
        expect(runnings.filter(x => x.name.includes(`fg-${gatewayId}-svc`)).length).to.equal(4);
        await checkservices.closeAllServices();
        await Util.sleep(1000);
        ///

        // start a random port

        // start 1 port previously, then closed this one
        await docker.run(service, gatewayId, 'host', 'ferrumgate.zero', 9020, port0.isTcp, port0.isUdp);
        runnings = await docker.getAllRunning(gatewayId);
        expect(runnings.filter(x => x.name.includes(`fg-${gatewayId}-svc`)).length).to.equal(1);
        await checkservices.compare(runnings, [service], 'ferrumgate.zero');
        await Util.sleep(1000);
        runnings = await docker.getAllRunning(gatewayId);
        expect(runnings.filter(x => x.name.includes(`fg-${gatewayId}-svc`)).length).to.equal(4);
        await checkservices.closeAllServices();
        await Util.sleep(1000);



        // start 1 port previously, but there is no replica with this number 10
        await docker.run(service, gatewayId, 'host', 'ferrumgate.zero', port0.port, port0.isTcp, port0.isUdp, 10);
        runnings = await docker.getAllRunning(gatewayId);
        expect(runnings.filter(x => x.name.includes(`fg-${gatewayId}-svc`)).length).to.equal(1);
        await checkservices.compare(runnings, [service], 'ferrumgate.zero');
        await Util.sleep(1000);
        runnings = await docker.getAllRunning(gatewayId);
        expect(runnings.filter(x => x.name.includes(`fg-${gatewayId}-svc`)).length).to.equal(4);
        await checkservices.closeAllServices();
        await Util.sleep(1000);

        // replica count 3
        service.count = 3;
        runnings = await docker.getAllRunning(gatewayId);
        expect(runnings.filter(x => x.name.includes(`fg-${gatewayId}-svc`)).length).to.equal(0);
        await checkservices.compare(runnings, [service], 'ferrumgate.zero');
        await Util.sleep(1000);
        runnings = await docker.getAllRunning(gatewayId);
        expect(runnings.filter(x => x.name.includes(`fg-${gatewayId}-svc`)).length).to.equal(12);
        await checkservices.closeAllServices();
        await Util.sleep(1000);


        delete process.env.REDIS_HOST;
        delete process.env.REDIS_INTEL_HOST;


    }).timeout(1200000);


    it('open 250 service', async () => {
        process.env.REDIS_HOST = "127.0.0.1:6379"
        process.env.REDIS_INTEL_HOST = "127.0.0.1:6379"
        await closeAllServices();
        const { gateway, network, service } = await createSampleData();
        const docker = new DockerService();



        const config = new MockConfig();
        const checkservices = new CheckServices(config, new BroadcastService(), docker);
        //const gatewayId = gatewayId
        checkservices.setGatewayId(gatewayId);

        const isWorkingStr = await Util.exec(`docker ps|grep fg-${gatewayId}-secure.server|wc -l`) as string;
        const isWorking = Number(isWorkingStr);
        if (isWorking) {
            await Util.exec(`docker stop fg-${gatewayId}-secure.server`);
        }
        await Util.exec(`docker run -d --rm --name fg-${gatewayId}-secure.server --label=Ferrum_Gateway_Id=${gatewayId} -p 9393:80 nginx`);
        await Util.sleep(3000);
        //start 1 service with 4 ports
        for (let i = 0; i < 250; ++i)
            service.ports.push({ port: 4000 + i, isTcp: true, isUdp: true });

        let runnings = await docker.getAllRunning(gatewayId);
        await checkservices.compare(runnings, [service], 'ferrumgate.zero');
        await Util.sleep(5000);
        runnings = await docker.getAllRunning(gatewayId);
        expect(runnings.filter(x => x.name.includes(`fg-${gatewayId}-svc`)).length).to.equal(250);

        await checkservices.closeAllServices();
        // start 1 port previously




        delete process.env.REDIS_HOST;
        delete process.env.REDIS_INTEL_HOST;


    }).timeout(1200000);




})