import { BaseTask } from "../baseTask";
import fsp from 'fs/promises';

/**
 * @summary a base class that supports gatewayId
 */
export abstract class NodeBasedTask extends BaseTask {

    protected nodeId = process.env.NODE_ID || '';
    protected version = process.env.VERSION || '';
    protected roles = process.env.ROLES || '';
    protected encryptKey = process.env.ENCRYPT_KEY || '';
    protected hostname = process.env.CLUSTER_NODE_HOST || '';
    protected cloudId = process.env.FERRUM_CLOUD_ID || '';
    protected cloudUrl = process.env.FERRUM_CLOUD_URL || '';
    protected cloudToken = process.env.FERRUM_CLOUD_TOKEN || '';

    configFileName = '/etc/ferrumgate/env'
    /**
     *
     */
    constructor(configFile = '') {
        super();
        if (configFile)
            this.configFileName = configFile;
    }

    protected async readConfigAll() {
        return (await fsp.readFile(this.configFileName)).toString().split('\n').map(x => {
            let val = x.split('=');
            return {
                key: val[0], value: val[1]
            }
        })
    }
    protected async readConfig(key: string) {
        const keyValues = await this.readConfigAll();
        return keyValues.find(x => x.key == key)?.value;
    }

}