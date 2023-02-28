
//docker run --net=host --name redis --rm -d redis


import chai, { util } from 'chai';
import chaiHttp from 'chai-http';

import { WhenClientAuthenticated } from '../src/task/whenClientAuthenticated';
import { basename } from 'path';
import { utils } from 'mocha';
import fspromise from 'fs/promises';
import fs from 'fs';
import { CheckIptablesCommon } from '../src/task/checkIptablesCommon';
import { Gateway, Network, RedisConfigWatchService, RedisService, SystemLogService, Util } from 'rest.portal';
import { RedisOptions } from '../src/model/redisOptions';
import { BroadcastService } from '../src/service/broadcastService';
import { NetworkService } from '../src/service/networkService';




chai.use(chaiHttp);
const expect = chai.expect;

const tmpfolder = '/tmp/ferrumtest';
describe('checkIptablesCommonTask', () => {
    const redis = new RedisService('localhost:6379,localhost:6390');
    const redisStream = new RedisService('localhost:6379,localhost:6390');
    const encKey = 'vd4kfcxcytpntio3g92majwt4y2i8h8i'
    const backupMethod = NetworkService.blockToIptablesCommon
    beforeEach(async () => {

        await redis.flushAll();
        if (fs.existsSync(tmpfolder))
            await fs.rmSync(tmpfolder, { recursive: true, force: true });

    })
    afterEach(async () => {
        NetworkService.blockToIptablesCommon = backupMethod;
    })
    class MockConfig extends RedisConfigWatchService {
        /**
         *
         */
        constructor() {
            super(redis, redisStream,
                new SystemLogService(redis, redisStream, encKey), true, encKey)

        }
    }

    it('check gateway not found', async () => {

        class MockConfig2 extends MockConfig {
            override async getGateway(id: string): Promise<Gateway | undefined> {
                return undefined;
            }
        }


        const bcast = new BroadcastService();
        const task = new CheckIptablesCommon(new MockConfig2(), bcast);
        task.setGatewayId('123');
        let methodCalled = false;
        NetworkService.blockToIptablesCommon = async () => {
            methodCalled = true;
        }
        await task.check();
        expect(methodCalled).to.be.true;


    }).timeout(100000)

    it('check gateway not enabled', async () => {

        class MockConfig2 extends MockConfig {
            override async getGateway(id: string): Promise<Gateway | undefined> {
                return { isEnabled: false } as Gateway;
            }
        }

        const bcast = new BroadcastService();
        const task = new CheckIptablesCommon(new MockConfig2(), bcast);
        task.setGatewayId('123');
        let methodCalled = false;
        NetworkService.blockToIptablesCommon = async () => {
            methodCalled = true;
        }
        await task.check();
        expect(methodCalled).to.be.true;


    }).timeout(100000)

    it('check network not found', async () => {

        class MockConfig2 extends MockConfig {
            override async getGateway(id: string): Promise<Gateway | undefined> {
                return { isEnabled: true, id: id } as Gateway;
            }
            override async getNetworkByGateway(id: string): Promise<Network | null> {
                return null;
            }
        }



        const bcast = new BroadcastService();
        const task = new CheckIptablesCommon(new MockConfig2(), bcast);
        task.setGatewayId('123');
        let methodCalled = false;
        NetworkService.blockToIptablesCommon = async () => {
            methodCalled = true;
        }
        await task.check();
        expect(methodCalled).to.be.true;


    }).timeout(100000);

    it('check network is not enabled', async () => {

        class MockConfig2 extends MockConfig {
            override async getGateway(id: string): Promise<Gateway | undefined> {
                return { isEnabled: true, id: id } as Gateway;
            }
            override async getNetworkByGateway(id: string): Promise<Network | null> {
                return { id: '1234', isEnabled: false } as Network;
            }
        }


        const bcast = new BroadcastService();
        const task = new CheckIptablesCommon(new MockConfig2(), bcast);
        task.setGatewayId('123');
        let methodCalled = false;
        NetworkService.blockToIptablesCommon = async () => {
            methodCalled = true;
        }
        await task.check();
        expect(methodCalled).to.be.true;


    }).timeout(100000)

    it('check network serviceNetwork', async () => {

        class MockConfig2 extends MockConfig {
            override async getGateway(id: string): Promise<Gateway | undefined> {
                return { isEnabled: true, id: id } as Gateway;
            }
            override async getNetworkByGateway(id: string): Promise<Network | null> {
                return { id: '1234', isEnabled: true } as Network;
            }
        }


        const bcast = new BroadcastService();
        const task = new CheckIptablesCommon(new MockConfig2(), bcast);
        task.setGatewayId('123');
        let methodCalled = false;
        NetworkService.blockToIptablesCommon = async () => {
            methodCalled = true;
        }
        await task.check();
        expect(methodCalled).to.be.true;


    }).timeout(100000)


    it('configChanged gateway', async () => {

        class MockConfig2 extends MockConfig {
            override async getGateway(id: string): Promise<Gateway | undefined> {
                return { isEnabled: true, id: id } as Gateway;
            }
            override async getNetworkByGateway(id: string): Promise<Network | null> {
                return { id: '1234', isEnabled: true } as Network;
            }
        }
        class CheckIptablesCommonMock extends CheckIptablesCommon {
            isCheckCalled = false

            public override async check(): Promise<void> {
                this.isCheckCalled = true;
            }
        }


        const bcast = new BroadcastService();
        const task = new CheckIptablesCommonMock(new MockConfig2(), bcast);
        task.setGatewayId('123');
        bcast.emit('configChanged', { path: '/config/gateways', val: { id: '123' } })

        expect(task.isCheckCalled).to.be.true;
        task.isCheckCalled = false;
        //event not related to this gateway, skip
        bcast.emit('configChanged', { path: '/config/gateways', val: { id: '1234' } });
        expect(task.isCheckCalled).to.be.false;


    }).timeout(100000)



})