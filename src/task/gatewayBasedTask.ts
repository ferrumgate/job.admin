import { BaseTask } from "./baseTask";

/**
 * @summary a base class that supports gatewayId
 */
export abstract class GatewayBasedTask extends BaseTask {

    protected gatewayId = process.env.GATEWAY_ID || '';
    /**
     *
     */
    constructor() {
        super();
    }
    async setGatewayId(id: string) {
        this.gatewayId = id;
    }
    protected async readGatewayId() {
        if (!this.gatewayId)
            throw new Error('gateway id is empty');
    }
}