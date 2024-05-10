import chai from 'chai';
import chaiHttp from 'chai-http';
import { Util } from 'rest.portal';
import fsp from 'fs/promises';
import { NodeBasedTask } from '../src/task/node/nodeBasedTask';

chai.use(chaiHttp);
const expect = chai.expect;

describe('nodeBasedTask', () => {
    beforeEach(async () => {
    })
    class MockTask extends NodeBasedTask {
        /**
         *
         */
        constructor(configFile: string) {
            super(configFile);

        }
        public async start(): Promise<void> {

        }
        public async stop(): Promise<void> {

        }

    }

})