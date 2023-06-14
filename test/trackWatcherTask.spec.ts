
//docker run --net=host --name redis --rm -d redis


import chai from 'chai';
import chaiHttp from 'chai-http';

import fs, { watch } from 'fs';
import { IAmAlive } from '../src/task/iAmAlive';

import { ESService, Gateway, Group, InputService, IpIntelligenceListService, IpIntelligenceService, Network, PolicyService, RedisConfigService, RedisConfigWatchCachedService, RedisConfigWatchService, RedisService, Service, SystemLogService, Tunnel, TunnelService, User, Util } from 'rest.portal';
import { RedisOptions } from '../src/model/redisOptions';
import { LmdbService } from '../src/service/lmdbService';
import { SystemWatcherTask } from '../src/task/systemWatcherTask';
import { PolicyWatcherTask } from '../src/task/policyWatcherTask';
import { AuthorizationRule } from 'rest.portal/model/authorizationPolicy';
import { DhcpService } from 'rest.portal/service/dhcpService';
import { BroadcastService } from 'rest.portal/service/broadcastService';
import { TrackWatcherTask } from '../src/task/trackWatcherTask';
import toml from 'toml';

chai.use(chaiHttp);
const expect = chai.expect;

const tmpfolder = '/tmp/ferrumtest';
const encKey = 'unvjukt3i62bxkr0d6f0lpvlho5fvqb1'
describe('trackWatcherTask', () => {
    const redis = new RedisService();


    beforeEach(async () => {
        await redis.flushAll();
        if (fs.existsSync(tmpfolder))
            await fs.rmSync(tmpfolder, { recursive: true, force: true });
        fs.mkdirSync(tmpfolder);
    })
    afterEach(async () => {
        await LmdbService.close();
    })

    class MockConfig extends RedisConfigWatchCachedService {
        /**
         *
         */
        constructor(systemlog?: SystemLogService) {
            super(new RedisService(), new RedisService(),
                systemlog || new SystemLogService(new RedisService(), new RedisService(), encKey), true, encKey)

        }
    }


    function createSampleData() {
        let network: Network = {
            id: 'network1',
            clientNetwork: '10.0.0.1/24',
            serviceNetwork: '10.0.0.0/24',
            labels: [],
            name: 'network',
            isEnabled: true,
            insertDate: new Date().toISOString(),
            updateDate: new Date().toISOString()

        }
        const gateway: Gateway = {
            id: 'gateway1',
            name: 'aserver',
            labels: [],
            networkId: network.id,
            isEnabled: true,
            insertDate: new Date().toISOString(),
            updateDate: new Date().toISOString(),

        }
        let service1: Service = {
            id: Util.randomNumberString(),
            name: 'service1',
            isEnabled: true,
            labels: [],
            hosts: [{ host: '1.2.3.4' }],
            networkId: 'network1',
            ports: [{ port: 3306, isTcp: true }],
            protocol: 'raw',
            assignedIp: '10.0.0.1',
            insertDate: new Date().toISOString(),
            updateDate: new Date().toISOString(),
            count: 1


        }
        let service2: Service = {
            id: Util.randomNumberString(),
            name: 'service2',
            isEnabled: true,
            labels: ['test'],
            hosts: [{ host: '192.168.10.10' }],
            networkId: 'network1',
            ports: [{ port: 3306, isTcp: true }],
            protocol: 'raw',
            assignedIp: '10.0.0.1',
            insertDate: new Date().toISOString(),
            updateDate: new Date().toISOString(),
            count: 1

        }
        let group1: Group = {
            id: "grp1",
            name: 'grp1',
            insertDate: new Date().toISOString(),
            updateDate: new Date().toISOString(),
            isEnabled: true, labels: []
        }
        let group2: Group = {
            id: "grp2",
            name: 'grp2',
            insertDate: new Date().toISOString(),
            updateDate: new Date().toISOString(),
            isEnabled: true, labels: []
        }
        const user1: User = {
            username: 'hamza@ferrumgate.com',
            id: 'user1',
            name: 'hamza',
            source: 'local',
            roleIds: ['Admin'],
            isLocked: false, isVerified: true,
            password: Util.bcryptHash('somepass'),
            insertDate: new Date().toISOString(),
            updateDate: new Date().toISOString(),
            groupIds: [group1.id, group2.id]

        }
        const user2: User = {
            username: 'hamza2@ferrumgate.com',
            id: 'user2',
            name: 'hamza2',
            source: 'local',
            roleIds: ['Admin'],
            isLocked: false, isVerified: true,
            password: Util.bcryptHash('somepass'),
            insertDate: new Date().toISOString(),
            updateDate: new Date().toISOString(),
            groupIds: [group2.id]

        }
        let rule1: AuthorizationRule = {
            id: 'rule1',
            name: "zero trust",
            networkId: network.id,
            userOrgroupIds: [user1.id],
            serviceId: service1.id,
            profile: { is2FA: true, },
            isEnabled: true,
            updateDate: new Date().toISOString(),
            insertDate: new Date().toISOString()

        }

        const tunnel1: Tunnel = {
            id: 'm7ecteC9pZ6ZXgTw', tun: 'ferrum2', assignedClientIp: '1.2.3.4',
            authenticatedTime: new Date().toISOString(), clientIp: '3.4.5.6',
            gatewayId: gateway.id, serviceNetwork: '172.10.0.0/16', userId: user1.id, trackId: 5
        }
        const tunnel2: Tunnel = {
            id: 'MjpmzVKnXlLbGyaG', tun: 'ferrum3', assignedClientIp: '1.2.3.4',
            authenticatedTime: new Date().toISOString(), clientIp: '3.4.5.6',
            gatewayId: gateway.id, serviceNetwork: '172.10.0.0/16', userId: user2.id, trackId: 6
        }
        return { network, gateway, service1, service2, user1, user2, group1, group2, rule1, tunnel1, tunnel2 };
    }

    it('tunnelConfirmed', async () => {
        const filename = `/tmp/${Util.randomNumberString(16)}.yaml`;
        const systemLog = new SystemLogService(new RedisService(), new RedisService(), encKey);
        const redisConfig = new RedisConfigService(new RedisService(), new RedisService(),
            systemLog, encKey, filename);
        await redisConfig.start();
        const redisConfigService = new RedisConfigWatchCachedService(new RedisService(),
            new RedisService(), systemLog, true, encKey);
        await redisConfigService.start();


        const bcastService = new BroadcastService();

        const {
            network, gateway, service1,
            service2, user1, user2,
            group1, group2, rule1,
            tunnel1, tunnel2
        } = await createSampleData();

        const watcher = new TrackWatcherTask(tmpfolder,
            redisConfigService, bcastService);
        watcher.setGatewayId(gateway.id);
        await watcher.start();
        const lmdb = await LmdbService.open('ferrumgate', tmpfolder, 'string', 16);


        await Util.sleep(5000);
        await redisConfig.saveNetwork(network);
        await redisConfig.saveGateway(gateway);
        await redisConfig.saveService(service1);
        await redisConfig.saveService(service2);
        await redisConfig.saveGroup(group1);
        await redisConfig.saveGroup(group2);
        await redisConfig.saveUser(user1);
        await redisConfig.saveUser(user2);
        await redisConfig.saveAuthorizationPolicyRule(rule1);
        await Util.sleep(2000);
        bcastService.emit('tunnelConfirm', tunnel1);

        await Util.sleep(2000);

        const keys = (await watcher.lmdbGetRange('/')).asArray;

        expect(keys.length).to.equal(2);
        await watcher.stop();
        await redisConfig.stop();
        await redisConfigService.stop();

    }).timeout(120000);



    it('tunnelConfirmed multi/tunnel expired', async () => {
        const filename = `/tmp/${Util.randomNumberString(16)}.yaml`;
        const systemLog = new SystemLogService(new RedisService(), new RedisService(), encKey);
        const redisConfig = new RedisConfigService(new RedisService(), new RedisService(),
            systemLog, encKey, filename);
        await redisConfig.start();
        const redisConfigService = new RedisConfigWatchCachedService(new RedisService(),
            new RedisService(), systemLog, true, encKey);
        await redisConfigService.start();

        const bcastService = new BroadcastService();

        const {
            network, gateway, service1,
            service2, user1, user2,
            group1, group2, rule1,
            tunnel1, tunnel2
        } = await createSampleData();

        const watcher = new TrackWatcherTask(tmpfolder,
            redisConfigService, bcastService);
        watcher.setGatewayId(gateway.id);
        await watcher.start();
        const lmdb = await LmdbService.open('ferrumgate', tmpfolder, 'string', 16);


        await Util.sleep(5000);
        await redisConfig.saveNetwork(network);
        await redisConfig.saveGateway(gateway);
        await redisConfig.saveService(service1);
        await redisConfig.saveService(service2);
        await redisConfig.saveGroup(group1);
        await redisConfig.saveGroup(group2);
        await redisConfig.saveUser(user1);
        await redisConfig.saveUser(user2);
        await redisConfig.saveAuthorizationPolicyRule(rule1);
        await Util.sleep(2000);

        //tunnel confirm
        bcastService.emit('tunnelConfirm', tunnel1);

        await Util.sleep(2000);
        const keys = (await watcher.lmdbGetRange('/')).asArray;
        expect(keys.length).to.equal(2);

        //
        //tunnel confirm
        bcastService.emit('tunnelConfirm', tunnel1);

        await Util.sleep(2000);
        const keys2 = (await watcher.lmdbGetRange('/')).asArray;
        expect(keys2.length).to.equal(2);


        bcastService.emit('tunnelExpired', tunnel1);
        await Util.sleep(2000);
        const keys3 = (await watcher.lmdbGetRange('/')).asArray;
        expect(keys3.length).to.equal(0);


        await watcher.stop();
        await redisConfig.stop();
        await redisConfigService.stop();

    }).timeout(120000);



    it('tunnelConfirmed multi/tunnel expired 2', async () => {
        const filename = `/tmp/${Util.randomNumberString(16)}.yaml`;
        const systemLog = new SystemLogService(new RedisService(), new RedisService(), encKey);
        const redisConfig = new RedisConfigService(new RedisService(), new RedisService(),
            systemLog, encKey, filename);
        await redisConfig.start();
        const redisConfigService = new RedisConfigWatchCachedService(new RedisService(),
            new RedisService(), systemLog, true, encKey);
        await redisConfigService.start();

        const bcastService = new BroadcastService();

        const {
            network, gateway, service1,
            service2, user1, user2,
            group1, group2, rule1,
            tunnel1, tunnel2
        } = await createSampleData();

        const watcher = new TrackWatcherTask(tmpfolder,
            redisConfigService, bcastService);
        watcher.setGatewayId(gateway.id);
        await watcher.start();
        const lmdb = await LmdbService.open('ferrumgate', tmpfolder, 'string', 16);


        await Util.sleep(5000);
        await redisConfig.saveNetwork(network);
        await redisConfig.saveGateway(gateway);
        await redisConfig.saveService(service1);
        await redisConfig.saveService(service2);
        await redisConfig.saveGroup(group1);
        await redisConfig.saveGroup(group2);
        await redisConfig.saveUser(user1);
        await redisConfig.saveUser(user2);
        await redisConfig.saveAuthorizationPolicyRule(rule1);
        await Util.sleep(2000);
        //tunnel confirm
        bcastService.emit('tunnelConfirm', tunnel1);
        bcastService.emit('tunnelConfirm', tunnel2);

        await Util.sleep(2000);
        const keys = (await watcher.lmdbGetRange('/')).asArray;
        expect(keys.length).to.equal(4);

        //
        //tunnel confirm
        bcastService.emit('tunnelConfirm', tunnel1);

        await Util.sleep(2000);
        const keys2 = (await watcher.lmdbGetRange('/')).asArray;
        expect(keys2.length).to.equal(4);


        bcastService.emit('tunnelExpired', tunnel1);
        await Util.sleep(2000);
        const keys3 = (await watcher.lmdbGetRange('/')).asArray;
        expect(keys3.length).to.equal(2);


        await watcher.stop();
        await redisConfig.stop();
        await redisConfigService.stop();

    }).timeout(120000);


    it('configChanged', async () => {
        const filename = `/tmp/${Util.randomNumberString(16)}.yaml`;
        const systemLog = new SystemLogService(new RedisService(), new RedisService(), encKey);
        const redisConfig = new RedisConfigService(new RedisService(), new RedisService(),
            systemLog, encKey, filename);
        const redisConfigService = new RedisConfigWatchCachedService(new RedisService(),
            new RedisService(), systemLog, true, encKey);
        const watcher = new TrackWatcherTask(tmpfolder,
            redisConfigService, new BroadcastService());

        const {
            network, gateway, service1,
            service2, user1, user2,
            group1, group2, rule1,
            tunnel1, tunnel2
        } = await createSampleData();

        const ml = await watcher.toML(user1);
        expect(ml).to.equal(`
userId = "user1"
groupIds = ["grp1","grp2"]
`)
        const obj = toml.parse(ml);
        expect(obj.userId).exist;

    })


    it('configChanged', async () => {
        const filename = `/tmp/${Util.randomNumberString(16)}.yaml`;
        const systemLog = new SystemLogService(new RedisService(), new RedisService(), encKey);
        const redisConfig = new RedisConfigService(new RedisService(), new RedisService(),
            systemLog, encKey, filename);
        await redisConfig.start();
        await Util.sleep(5000);
        const { network, gateway, service1,
            service2, user1, user2, group1, group2, rule1,
            tunnel1, tunnel2 } = await createSampleData();
        await redisConfig.saveNetwork(network);
        await redisConfig.saveGateway(gateway);
        await redisConfig.saveService(service1);
        await redisConfig.saveService(service2);
        await redisConfig.saveUser(user1);
        await redisConfig.saveUser(user2);
        await redisConfig.saveGroup(group1);
        await redisConfig.saveGroup(group2);

        await redisConfig.saveAuthorizationPolicyRule(rule1);
        await Util.sleep(2000);
        const redisConfigService = new RedisConfigWatchCachedService(new RedisService(),
            new RedisService(), systemLog, true, encKey);
        //await redisConfigService.start();

        const bcastService = new BroadcastService();
        const systemWatcher = new SystemWatcherTask(new RedisService(), redisConfigService, new TunnelService(redisConfigService, new RedisService(), new DhcpService(redisConfigService, new RedisService())), bcastService);
        await systemWatcher.start();


        const watcher = new TrackWatcherTask(tmpfolder,
            redisConfigService, bcastService);
        watcher.setGatewayId(gateway.id);
        await watcher.start();

        await Util.sleep(5000);

        //tunnel confirm
        bcastService.emit('tunnelConfirm', tunnel1);
        bcastService.emit('tunnelConfirm', tunnel2);

        await Util.sleep(10000);
        const keys = (await watcher.lmdbGetRange('/')).asArray;
        expect(keys.length).to.equal(4);

        await redisConfig.deleteGroup(group1.id);
        await Util.sleep(5000);
        const keys2 = (await watcher.lmdbGetRange('/')).asArray;
        expect(keys2.length).to.equal(4);

        await redisConfig.deleteUser(user1.id);
        await Util.sleep(5000);
        const keys3 = (await watcher.lmdbGetRange('/')).asArray;
        expect(keys3.length).to.equal(2);

        await systemWatcher.stop();
        await watcher.stop();
        await redisConfig.stop();
        await redisConfigService.stop();

    }).timeout(120000);



})