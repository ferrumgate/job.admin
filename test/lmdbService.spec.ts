
//docker run --net=host --name redis --rm -d redis


import chai from 'chai';
import chaiHttp from 'chai-http';

import fs from 'fs';
import { IAmAlive } from '../src/task/iAmAlive';

import { RedisService } from 'rest.portal';
import { RedisOptions } from '../src/model/redisOptions';
import { LmdbService } from '../src/service/lmdbService';


chai.use(chaiHttp);
const expect = chai.expect;

const tmpfolder = '/tmp/ferrumtest';
describe('lmdbService', () => {
    beforeEach(async () => {

        if (fs.existsSync(tmpfolder))
            await fs.rmSync(tmpfolder, { recursive: true, force: true });
        fs.mkdirSync(tmpfolder);
    })
    afterEach(async () => {
        LmdbService.close();
    })



    it('open', async () => {

        const lmdb = await LmdbService.open('ferrum', tmpfolder, 'string');
        await lmdb.close();


    }).timeout(100000)

    it('multio open', async () => {

        const lmdb1 = await LmdbService.open('ferrum1', tmpfolder);
        const lmdb2 = await LmdbService.open('ferrum2', tmpfolder);
        const lmdb3 = await LmdbService.open('ferrum3', tmpfolder);
        let isError = false;
        try {
            const lmdb4 = await LmdbService.open('ferrum4', tmpfolder);
        } catch (err) {
            isError = true;
        }
        expect(isError).to.be.true;



    }).timeout(10000)


    it('multio open read/clear', async () => {

        const lmdb1 = await LmdbService.open('ferrum1', tmpfolder);
        await lmdb1.put('/test', '1');
        const lmdb2 = await LmdbService.open('ferrum2', tmpfolder);
        await lmdb2.put('/test', '1');

        const data1 = await lmdb1.get('/test')
        expect(data1).to.equal('1');

        const data2 = await lmdb2.get('/test')
        expect(data2).to.equal('1');

        await lmdb2.clear();


        const data11 = await lmdb1.get('/test')
        expect(data11).to.equal('1');

        const data22 = await lmdb2.get('/test')
        expect(data22).not.exist;







    }).timeout(10000)


    it('get/put', async () => {

        const lmdb = await LmdbService.open('ferrum', tmpfolder);
        const item = await lmdb.get('/test/1');
        expect(item).not.exist;
        await lmdb.put('/test/1', 'hamza');

        let item2 = await lmdb.get('/test/1');
        expect(item2).to.equal('hamza');

        await lmdb.close();

        //open again
        const lmdb2 = await LmdbService.open('ferrum', tmpfolder);
        const item3 = await lmdb2.get('/test/1');
        expect(item3).to.equal('hamza')


    }).timeout(10000)

    it('get/put multiple', async () => {

        const lmdb = await LmdbService.open('ferrum', tmpfolder);
        await lmdb.put('/test/1', 'hamza');

        let item2 = await lmdb.get('/test/1');
        expect(item2).to.equal('hamza');

        await lmdb.put('/test/1', 'hamza2');
        let item3 = await lmdb.get('/test/1');
        expect(item3).to.equal('hamza2');

        await lmdb.close();


    }).timeout(10000)

    it('get/put/delete ', async () => {

        const lmdb = await LmdbService.open('ferrum', tmpfolder);
        await lmdb.put('/test/1', 'hamza');

        let item2 = await lmdb.get('/test/1');
        expect(item2).to.equal('hamza');

        await lmdb.remove('/test/1');
        let item3 = await lmdb.get('/test/1');
        expect(item3).not.exist;

        await lmdb.close();


    }).timeout(10000)

    it('range', async () => {

        const lmdb = await LmdbService.open('ferrum', tmpfolder);
        await lmdb.put('/test/ad/13', 'hamza4');
        await lmdb.put('/test/username/13', 'hamza4');
        await lmdb.put('/test/id/20', 'hamza');
        await lmdb.put('/test/id/10', 'hamza2');
        await lmdb.put('/test/id/13', 'hamza4');
        await lmdb.put('/test/username/12', 'hamza4');

        const arr = new Uint8Array(255);
        arr.fill(255, 0, 254);

        const buf = Buffer.from('/test/id/').copy(arr, 0, 0, 9);
        let item2 = await lmdb.range({

            start: '/test/id/', end: arr
        });

        for (const iterator of item2) {
            console.log(iterator.key);
        }

        let item3 = await lmdb.range({

        });
        const arr3 = item3.asArray;

        const lmdb2 = await LmdbService.open('ferrum', tmpfolder);

        let item4 = await lmdb2.range({

        });
        const arr4 = item4.asArray;
        await lmdb.close();


    }).timeout(10000);

    it('range2', async () => {

        const lmdb = await LmdbService.open('ferrum', tmpfolder);
        await lmdb.put('/dns/local/abc.service.com', '1.2.3');
        await lmdb.put('/authorize/track/id/1/service/id/ad', 'hamza4');
        await lmdb.put('/authorize/track/id/1/service/id/ae', 'hamza4');
        await lmdb.put('/authorize/track/id/2/service/id/ef', 'hamza4');
        await lmdb.put('/authorize/track/id/2/service/id/def', 'hamza4');
        await lmdb.put('/authorize/abtrack/id/2/service/id/ef', 'hamza4');
        await lmdb.put('/authorize/atrack/id/2/service/id/def', 'hamza4');
        await lmdb.put('/authorize/track/id/3/service/id/ae', 'hamza4');
        await lmdb.put('/authorize/track/id/10/service/id/aw', 'hamza4');
        await lmdb.put('/authorize/track/id/10/service/id/ac', 'hamza4');
        await lmdb.put('/authorize/track/id/11/service/id/bd', 'hamza4');
        await lmdb.put('/authorize/track/id/100/service/id/bd', 'hamza4');
        await lmdb.put('/authorize/track/id/101/service/id/bd', 'hamza4');
        await lmdb.put('/authorize/track/id/101/service/id/be', 'hamza4');
        await lmdb.put('/authorize/track/id/1000000/service/id/be', 'hamza4');
        await lmdb.put('/auth/track/id/1000000/service/id/be', 'hamza4');
        await lmdb.put('/auth/track/id/1000001/service/id/be', 'hamza4');
        await lmdb.put('/auth/track/id/1000002/service/id/be', 'hamza4');
        async function ran(i: number) {
            const arr = new Uint8Array(255);
            arr.fill(255, 0, 254);
            const key = `/authorize/track/id/${i}/service/id/`;
            Buffer.from(key).copy(arr, 0, 0, key.length);
            const range = await lmdb.range({ start: key, end: arr });
            return range;
        }

        const range1 = await (await ran(1)).asArray
        expect(range1.length).to.equal(2);
        expect(range1[0].key).to.equal('/authorize/track/id/1/service/id/ad')
        expect(range1[1].key).to.equal('/authorize/track/id/1/service/id/ae')

        const range10 = (await ran(10)).asArray;
        expect(range10.length).to.equal(2);
        expect(range10[0].key).to.equal('/authorize/track/id/10/service/id/ac')
        expect(range10[1].key).to.equal('/authorize/track/id/10/service/id/aw')


        const range100 = (await ran(100)).asArray;
        expect(range100.length).to.equal(1);


        async function ran2(i: number) {
            const arr = new Uint8Array(255);
            arr.fill(255, 0, 254);
            const key = `/authorize/abtrack/id/${i}/service/id/`;
            Buffer.from(key).copy(arr, 0, 0, key.length);
            const range = await lmdb.range({ start: key, end: arr });
            return range;
        }

        const range101 = (await ran2(2)).asArray;
        expect(range101.length).to.equal(1);
        expect(range101[0].key).to.equal('/authorize/abtrack/id/2/service/id/ef')

        async function ran3(i: number) {
            const arr = new Uint8Array(255);
            arr.fill(255, 0, 254);
            const key = `/authorize/`;
            Buffer.from(key).copy(arr, 0, 0, key.length);
            const range = await lmdb.range({ start: key, end: arr });
            return range;
        }
        const range102 = (await ran3(2)).asArray;
        expect(range102.length).to.equal(14);


        async function ran4(i: number) {
            const arr = new Uint8Array(1024);
            arr.fill(255, 0, 1024);
            const key = `/authorize/`;
            Buffer.from(key).copy(arr, 0, 0, key.length);
            const range = await lmdb.range({ start: key, end: arr });
            return range;
        }
        const range103 = (await ran4(2)).asArray;
        expect(range103.length).to.equal(14);


        await lmdb.close();



    }).timeout(10000);




    it('get/put integration', async () => {

        const lmdb = await LmdbService.open('ferrumgate', __dirname + '/data', 'string');

        //await lmdb.put('/test/1', 'hamza');

        let item2 = await lmdb.get('/test/1');
        expect(item2).to.equal('hamza');

        await lmdb.close();


    }).timeout(10000)


    it('get/put', async () => {

        const lmdb = await LmdbService.open('dns', '/tmp/dns', 'string');
        let item2 = await lmdb.get('/local/dns/test.ferrumgate.zero/a');
        await lmdb.put('/local/dns/test.ferrumgate.zero/a', '192.168.100.100');

        await lmdb.close();


    }).timeout(10000)







})