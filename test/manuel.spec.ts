import chai from 'chai';
import chaiHttp from 'chai-http';
import { Util } from 'rest.portal';

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