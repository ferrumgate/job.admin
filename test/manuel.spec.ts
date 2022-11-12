
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


chai.use(chaiHttp);
const expect = chai.expect;

describe('rootPermissions', () => {
    beforeEach(async () => {


    })



    it('check', async () => {
        let ip = '1.2.3.4';
        const exits = await Util.exec(`ip a|grep ${ip}|wc -l`)
        expect(exits).to.equal('0\n');

    })
})