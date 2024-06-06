import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiSpy from 'chai-spies';
import fs from 'fs';
import { Gateway, InputService, Network, RedisConfigWatchService, RedisService, Service, SystemLogService, Util } from 'rest.portal';
import { ConfigWatch } from 'rest.portal/model/config';
import { BroadcastService } from 'rest.portal/service/broadcastService';
import { LmdbService } from '../src/service/lmdbService';
import { CheckLocalDns } from '../src/task/checkLocalDns';

chai.use(chaiHttp);
chai.use(chaiSpy);
const expect = chai.expect;

const tmpfolder = '/tmp/ferrumtest';
describe('checkLocalDns', () => {
    const simpleRedis = new RedisService();
    before(async () => {
        if (!fs.existsSync(tmpfolder))
            fs.mkdirSync(tmpfolder);
    })
    async function clearAllDns() {
        const lmdb = await LmdbService.open('dns', tmpfolder, 'string');
        await lmdb.clear();
    }
    beforeEach(async () => {
        await simpleRedis.flushAll();
        await clearAllDns();
    })
    afterEach(async () => {
        chai.spy.restore();
    })

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
            hosts: [{ host: '1.2.3.4' }],
            networkId: network.id,
            ports: [{ port: 3306, isTcp: true }],
            assignedIp: '192.168.0.1',
            insertDate: new Date().toISOString(),
            updateDate: new Date().toISOString(),
            count: 1

        }

        let service2: Service = {
            id: Util.randomNumberString(),
            name: 'dns-dev',
            isEnabled: true,
            labels: [],
            protocol: 'dns',
            hosts: [{ host: '1.2.3.4' }],
            networkId: network.id,
            ports: [{ port: 3306, isTcp: true }],
            assignedIp: '192.168.0.1',
            insertDate: new Date().toISOString(),
            updateDate: new Date().toISOString(),
            count: 1,
            aliases: [{ host: 'www.ferrumgate.com' }, { host: 'www.ferrumgate2.com' }]

        }

        return { gateway, network, service, service2 };
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

    it('clearAllDns', async () => {

        const { gateway, network, service } = await createSampleData();

        const lmdb = await LmdbService.open('dns', tmpfolder, 'string');
        await lmdb.put('test', 'value');

        const result1 = await lmdb.get('test');
        expect(result1).exist;

        const localDns = new CheckLocalDns(tmpfolder, new MockConfig(), new BroadcastService(), new InputService());
        await localDns.clearAllDns();

        const result = await lmdb.get('test');
        expect(result).not.exist;

        await lmdb.close();
    }).timeout(30000)

    it('checkServices', async () => {

        const { gateway, network, service } = await createSampleData();
        const lmdb = await LmdbService.open('dns', tmpfolder, 'string', 3);

        const config = new MockConfig();
        const bcast = new BroadcastService();

        const localDns = new CheckLocalDns(tmpfolder, config, bcast, new InputService());

        const spyServices = chai.spy.on(config, 'getServicesAll', () => [service]);
        const networks = chai.spy.on(config, 'getNetworksAll', () => [network]);
        const domain = chai.spy.on(config, 'getDomain', () => 'test.zero');
        const dnsRecords = chai.spy.on(config, 'getDnsRecords', () => [{
            id: Util.randomNumberString(),
            fqdn: 'test.ferrumote.com',
            ip: '1.2.3.4',
            isEnabled: true
        }]);
        const gateway2 = chai.spy.on(config, 'getGateway', () => gateway);

        await localDns.checkServices();
        const key = `/local/dns/${service.name}.${network.name}.test.zero/a`;
        const value = await lmdb.get(key);
        expect(value).to.equal(service.assignedIp);
        //global
        const key2 = `/local/dns/test.ferrumote.com/a`;
        const value2 = await lmdb.get(key2);
        expect(value2).to.equal(`1.2.3.4`);

        await lmdb.close();
    }).timeout(60000)

    it('checkServices dns alias', async () => {

        const { gateway, network, service, service2 } = await createSampleData();
        const lmdb = await LmdbService.open('dns', tmpfolder, 'string', 3);

        const config = new MockConfig();
        const bcast = new BroadcastService();

        const localDns = new CheckLocalDns(tmpfolder, config, bcast, new InputService());

        const spyServices = chai.spy.on(config, 'getServicesAll', () => [service2]);
        const networks = chai.spy.on(config, 'getNetworksAll', () => [network]);
        const domain = chai.spy.on(config, 'getDomain', () => 'test.zero');
        const dnsRecords = chai.spy.on(config, 'getDnsRecords', () => []);
        const gateway2 = chai.spy.on(config, 'getGateway', () => gateway);

        await localDns.checkServices();
        const key = `/local/dns/${service2.name}.${network.name}.test.zero/a`;
        const value = await lmdb.get(key);
        expect(value).to.equal(service2.assignedIp);
        if (service2.aliases) {
            const key2 = `/local/dns/${service2.aliases[0].host}/a`;
            const value2 = await lmdb.get(key2);
            expect(value2).to.equal(service2.assignedIp);

            const key3 = `/local/dns/${service2.aliases[1].host}/a`;
            const value3 = await lmdb.get(key3);
            expect(value3).exist;
        }

        await lmdb.close();
    }).timeout(60000)

    it('onConfigChanged', async () => {

        const { gateway, network, service } = await createSampleData();
        const lmdb = await LmdbService.open('dns', tmpfolder, 'string');

        const config = new MockConfig();
        const bcast = new BroadcastService();

        const localDns = new CheckLocalDns(tmpfolder, config, bcast, new InputService());

        const clearAll = chai.spy.on(localDns, 'clearAllDns', () => { });
        const spyServices = chai.spy.on(config, 'getServicesAll', () => [service]);
        const networks = chai.spy.on(config, 'getNetworksAll', () => [network]);
        const domain = chai.spy.on(config, 'getDomain', () => 'test.zero');
        const dnsRecords = chai.spy.on(config, 'getDnsRecords', () => []);
        const gateway2 = chai.spy.on(config, 'getGateway', () => gateway);

        await localDns.checkServices();

        const key = `/local/dns/${service.name}.${network.name}.test.zero/a`;
        const value = await lmdb.get(key);
        expect(value).to.equal(service.assignedIp);

        await localDns.onConfigChanged({ path: '/config/flush' } as ConfigWatch<any>);
        expect(clearAll).have.been.called;

        await lmdb.close();
    }).timeout(60000)

})