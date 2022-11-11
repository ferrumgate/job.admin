
//docker run --net=host --name redis --rm -d redis


import chai from 'chai';
import chaiHttp from 'chai-http';
import { Util } from '../src/util';

import fs from 'fs';
import { RedisOptions } from "../src/service/redisService";
import { ConfigService } from '../src/service/configService';
import { DockerService } from '../src/service/dockerService';
import { Service } from '../src/model/service';
import { Network } from '../src/model/network';
import { Gateway } from '../src/model/network';
import { CheckServices } from '../src/task/checkServices';
import { checkPrime } from 'crypto';



chai.use(chaiHttp);
const expect = chai.expect;

const tmpfolder = '/tmp/ferrumtest';
describe('checkServices', () => {
    const configFilePath = '/tmp/abc';
    beforeEach(async () => {
        const docker = new DockerService();
        const pods = await docker.getAllRunning();
        for (const pod of pods) {
            if (pod.name.startsWith('ferrumsvc'))
                await docker.stop(pod);
        }
        if (fs.existsSync(configFilePath))
            fs.rmSync(configFilePath)
        fs.writeFileSync(configFilePath, 'host=231a0932');
    })




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
            tcp: 3306, assignedIp: '1.3',
            insertDate: new Date().toISOString(),
            updateDate: new Date().toISOString(),

        }

        return { gateway, network, service };
    }
    const redisoption: RedisOptions = {
        host: 'localhost:6379'
    };
    it('closeAllServices', async () => {
        const { gateway, network, service } = await createSampleData();
        const docker = new DockerService();
        const configService = new ConfigService(configFilePath, redisoption.host);
        const checkservices = new CheckServices(redisoption, configService, docker);

        await docker.run(service);
        await checkservices.closeAllServices();
        const pods = await docker.getAllRunning();
        expect(pods.find(x => x.name.includes('ferrumsvc'))).to.be.undefined;

    }).timeout(30000)

    it('checkServices', async () => {
        const { gateway, network, service } = await createSampleData();
        const docker = new DockerService();
        class MockConfig extends ConfigService {

        }
        const configService = new ConfigService(configFilePath, redisoption.host);
        const checkservices = new CheckServices(redisoption, configService, docker);
        let closeAllCalled = false;
        const realcloseAllServices = checkservices.closeAllServices;

        checkservices.closeAllServices = async () => {

            closeAllCalled = true;
            await realcloseAllServices.bind(checkservices)()

        }
        //no gateway
        closeAllCalled = false;
        const realGetGatewayId = configService.getGatewayById;
        configService.getGatewayById = async () => {
            return null;
        }
        checkservices.resetLastCheck();
        await checkservices.checkServices();
        expect(closeAllCalled).to.be.true;

        // gateway is disabled
        closeAllCalled = false;
        gateway.isEnabled = false;
        configService.getGatewayById = async () => {
            return gateway;
        }
        checkservices.resetLastCheck();
        await checkservices.checkServices();
        expect(closeAllCalled).to.be.true;

        gateway.isEnabled = true;

        //no network
        closeAllCalled = false;
        const realgetNetworkByGatewayId = configService.getNetworkByGatewayId;
        configService.getNetworkByGatewayId = async () => {
            return null;
        }

        checkservices.resetLastCheck();
        await checkservices.checkServices();
        expect(closeAllCalled).to.be.true;


        //network disabled
        closeAllCalled = false;
        network.isEnabled = false;
        configService.getNetworkByGatewayId = async () => {
            return network;
        }

        checkservices.resetLastCheck();
        await checkservices.checkServices();
        expect(closeAllCalled).to.be.true;

        network.isEnabled = true;
        //network service network problem
        closeAllCalled = false;
        network.serviceNetwork = '';

        checkservices.resetLastCheck();
        await checkservices.checkServices();
        expect(closeAllCalled).to.be.true;


        //evertytin normal check if compare called
        network.serviceNetwork = '1.2.3.4'
        closeAllCalled = false;
        configService.getServicesByGatewayId = async () => {
            return [service];
        }

        let compareCalled = false;

        checkservices.compare = async () => {
            compareCalled = true;
        }
        checkservices.resetLastCheck();
        await checkservices.checkServices();
        expect(closeAllCalled).to.be.false;



    }).timeout(30000)


    it('compare', async () => {
        const { gateway, network, service } = await createSampleData();
        const docker = new DockerService();

        const configService = new ConfigService(configFilePath, redisoption.host);
        const checkservices = new CheckServices(redisoption, configService, docker);
        const isWorking = await Util.exec(`docker ps|grep secure.server|wc -l`) as string;
        console.log(isWorking);
        if (isWorking.replace('\n', '') !== '0') {
            await Util.exec(`docker stop secure.server`);
        }
        await Util.exec("docker run -d --rm --name secure.server nginx");
        //start 1 services
        await docker.run(service);

        const runnings = await docker.getAllRunning();
        await checkservices.compare(runnings, [service]);

        const runnings2 = await docker.getAllRunning();
        expect(runnings2.filter(x => x.name.includes('ferrumsvc')).length).to.equal(1);

        await checkservices.closeAllServices();
        // start 2 services, 1 of them will be stoped
        const service2 = JSON.parse(JSON.stringify(service));
        service2.id = '15';
        await docker.run(service);
        await docker.run(service2);

        const runnings3 = await docker.getAllRunning();
        await checkservices.compare(runnings3, [service]);

        const runnings4 = await docker.getAllRunning();
        expect(runnings4.filter(x => x.name.includes('ferrumsvc')).length).to.equal(1);

        await checkservices.closeAllServices();

        //
        const runnings5 = await docker.getAllRunning();
        await checkservices.compare(runnings5, [service]);

        const runnings6 = await docker.getAllRunning();
        expect(runnings6.filter(x => x.name.includes('ferrumsvc')).length).to.equal(1);

        await checkservices.closeAllServices();

    }).timeout(30000);

})