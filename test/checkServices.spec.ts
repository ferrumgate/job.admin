
//docker run --net=host --name redis --rm -d redis


import chai from 'chai';
import chaiHttp from 'chai-http';
import { RedisService, SystemLogService } from 'rest.portal';
import { Gateway, Network, RedisConfigWatchService, Service, Util } from 'rest.portal';
import { BroadcastService } from '../src/service/broadcastService';
import { RedisOptions } from '../src/model/redisOptions';
import { DockerService } from '../src/service/dockerService';
import { CheckServices } from '../src/task/checkServices';
import fs from 'fs';



chai.use(chaiHttp);
const expect = chai.expect;

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
            if (pod.name.startsWith('ferrumgate-svc'))
                await docker.stop(pod);
        }
    }


    async function createSampleData(): Promise<any> {


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
            id: '231a0932',
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
            host: '1.2.3.4',
            networkId: network.id,
            tcp: 3306, assignedIp: '127.0.0.1',
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
    class CheckServicesMock extends CheckServices {
        setGatewayId(id: string) {
            this.gatewayId = id;
        }
    }
    it('closeAllServices', async () => {
        await closeAllServices();
        const { gateway, network, service } = await createSampleData();
        const docker = new DockerService();

        const checkservices = new CheckServicesMock(new MockConfig(), new BroadcastService(), docker);
        checkservices.setGatewayId('231a0932');

        await docker.run(service, '231a0932', 'host');
        await checkservices.closeAllServices();
        const pods = await docker.getAllRunning();
        expect(pods.find(x => x.name.includes('ferrumgate-svc'))).to.be.undefined;

    }).timeout(30000)

    it('checkServices', async () => {
        await closeAllServices();
        const { gateway, network, service } = await createSampleData();
        const docker = new DockerService();

        const config = new MockConfig();
        const checkservices = new CheckServicesMock(config, new BroadcastService(), docker);
        checkservices.setGatewayId('231a0932');
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
        await closeAllServices();
        const { gateway, network, service } = await createSampleData();
        const docker = new DockerService();



        const config = new MockConfig();
        const checkservices = new CheckServicesMock(config, new BroadcastService(), docker);
        checkservices.setGatewayId('231a0932');

        const isWorkingStr = await Util.exec(`docker ps|grep secure.server|wc -l`) as string;
        const isWorking = Number(isWorkingStr);
        if (isWorking) {
            await Util.exec(`docker stop secure.server`);
        }
        await Util.exec(`docker run -d --rm --name secure.server -p 9393:80 nginx`);
        //start 1 services
        await docker.run(service, 'abc', 'host');

        const runnings = await docker.getAllRunning();
        await checkservices.compare(runnings, [service]);

        const runnings2 = await docker.getAllRunning();
        expect(runnings2.filter(x => x.name.includes('ferrumgate-svc')).length).to.equal(1);

        await checkservices.closeAllServices();
        // start 2 services, 1 of them will be stoped
        const service2 = JSON.parse(JSON.stringify(service));
        service2.id = '15';
        await Util.sleep(1000);
        await docker.run(service, '231a0932', 'host');
        await docker.run(service2, '231a0932', 'host');

        const runnings3 = await docker.getAllRunning();
        await checkservices.compare(runnings3, [service]);
        await Util.sleep(1000);
        const runnings4 = await docker.getAllRunning();
        expect(runnings4.filter(x => x.name.includes('ferrumgate-svc')).length).to.equal(1);

        await checkservices.closeAllServices();
        await Util.sleep(1000);

        await checkservices.closeAllServices();

    }).timeout(1200000);

})