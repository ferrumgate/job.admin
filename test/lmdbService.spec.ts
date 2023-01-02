
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

        const lmdb = await LmdbService.open('ferrum', tmpfolder);
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
        await lmdb.close();


    }).timeout(10000)







})