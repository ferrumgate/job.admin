import { BaseTask } from "./baseTask";
import fspromise from 'fs/promises';

/**
 * a base class that reads gatewayId from configfile
 */
export abstract class GatewayBasedTask extends BaseTask {

    protected gatewayId = process.env.GATEWAY_ID || '';
    /**
     *
     */
    constructor() {
        super();
    }

    protected async readGatewayId() {
        if (!this.gatewayId)
            throw new Error('gateway id is empty');
    }
}