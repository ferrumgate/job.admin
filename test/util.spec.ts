
//docker run --net=host --name redis --rm -d redis


import chai, { util } from 'chai';
import chaiHttp from 'chai-http';
import { Util } from 'rest.portal';


chai.use(chaiHttp);
const expect = chai.expect;


describe('util', () => {


    it('exec', async () => {
        const output = await Util.exec('ls');
        expect(output).exist;
    })

})