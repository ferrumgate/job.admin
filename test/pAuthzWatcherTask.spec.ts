
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
import { PAuthzWatcherTask } from '../src/task/pAuthzWatcherTask';

chai.use(chaiHttp);
const expect = chai.expect;

const tmpfolder = '/tmp/ferrumtest';
const encKey = 'unvjukt3i62bxkr0d6f0lpvlho5fvqb1'
describe('pAuthzWatcherTask', () => {
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
            profile: {
                is2FA: true,
                fqdnIntelligence: {
                    ignoreFqdns: [{ fqdn: 'abc.com' }, { fqdn: 'deneme.com' }],
                    ignoreLists: ["12a", "b12b"],
                    whiteFqdns: [{ fqdn: '22.com' }, { fqdn: '33.com' }],
                    whiteLists: ["d12a", "e12b"],
                    blackFqdns: [{ fqdn: '44.com' }, { fqdn: '55.com' }],
                    blackLists: ["g12a", "z12b"],
                }
            },
            isEnabled: true,
            updateDate: new Date().toISOString(),
            insertDate: new Date().toISOString(),


        }
        let rule2: AuthorizationRule = {
            id: 'rule2',
            name: "zero trust",
            networkId: network.id,
            userOrgroupIds: [user1.id],
            serviceId: service1.id,
            profile: {
                is2FA: true,
                fqdnIntelligence: {
                    ignoreFqdns: [{ fqdn: '2abc.com' }, { fqdn: '2deneme.com' }],
                    ignoreLists: ["12a", "b12b"],
                    whiteFqdns: [{ fqdn: '22.com' }, { fqdn: '33.com' }],
                    whiteLists: ["d12a", "e12b"],
                    blackFqdns: [{ fqdn: '44.com' }, { fqdn: '55.com' }],
                    blackLists: ["g12a", "z12b"],
                }
            },
            isEnabled: true,
            updateDate: new Date().toISOString(),
            insertDate: new Date().toISOString(),


        }
        let rule3: AuthorizationRule = {
            id: 'rule3',
            name: "zero trust",
            networkId: network.id,
            userOrgroupIds: [user1.id],
            serviceId: service2.id,
            profile: {
                is2FA: true,
                fqdnIntelligence: {
                    ignoreFqdns: [{ fqdn: '3abc.com' }, { fqdn: '3deneme.com' }],
                    ignoreLists: ["12a", "b12b"],
                    whiteFqdns: [{ fqdn: '22.com' }, { fqdn: '33.com' }],
                    whiteLists: ["d12a", "e12b"],
                    blackFqdns: [{ fqdn: '44.com' }, { fqdn: '55.com' }],
                    blackLists: ["g12a", "z12b"],
                }
            },
            isEnabled: true,
            updateDate: new Date().toISOString(),
            insertDate: new Date().toISOString(),


        }


        return {
            network, gateway, service1, service2,
            user1, user2, group1, group2,
            rule1, rule2, rule3
        };
    }

    it('toML', async () => {
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
            rule2, rule3
        } = await createSampleData();

        const watcher = new PAuthzWatcherTask(tmpfolder,
            redisConfigService, bcastService);
        watcher.setGatewayId(gateway.id);


        {

            const ml = watcher.createAuthzValue(rule1);
            console.log(ml);
            expect(ml.includes('ignoreFqdns')).to.be.true
            const data = toml.parse(ml);
            console.log(data);
            expect(data.fqdnIntelligence.ignoreFqdns).to.equal(',abc.com,deneme.com,');
            expect(data.fqdnIntelligence.ignoreLists).to.equal(',12a,b12b,');
            expect(data.fqdnIntelligence.whiteFqdns).to.equal(',22.com,33.com,');
            expect(data.fqdnIntelligence.whiteLists).to.equal(',d12a,e12b,');
            expect(data.fqdnIntelligence.blackFqdns).to.equal(',44.com,55.com,');
            expect(data.fqdnIntelligence.blackLists).to.equal(',g12a,z12b,');
        }

        {

            const ml = watcher.createServiceValue([rule1, rule2, rule3]);
            console.log(ml);
            expect(ml.includes('rules')).to.be.true
            const data = toml.parse(ml);
            expect(data.rules.length).to.equal(3)
            console.log(data);
            expect(data.rules[0].userOrgroupIds).to.equal("," + rule1.userOrgroupIds.join(',') + ",");

        }




    }).timeout(120000);


    it('configChanged', async () => {
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
            rule2, rule3
        } = await createSampleData();

        const watcher = new PAuthzWatcherTask(tmpfolder,
            redisConfigService, bcastService);
        watcher.setGatewayId(gateway.id);
        await watcher.start();



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
        await redisConfig.saveAuthorizationPolicyRule(rule2);
        await redisConfig.saveAuthorizationPolicyRule(rule3);
        await Util.sleep(2000);
        bcastService.emit('configChanged', `/config/users`);

        await Util.sleep(2000);

        const keys = (await watcher.lmdbGetRange('/')).asArray;

        expect(keys.length).to.equal(10);
        await watcher.stop();
        await redisConfig.stop();
        await redisConfigService.stop();

    }).timeout(120000);




})