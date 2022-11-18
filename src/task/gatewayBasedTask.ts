import { BaseTask } from "./baseTask";
import fspromise from 'fs/promises';
import { ConfigService } from "../service/configService";

/**
 * a base class that reads gatewayId from configfile
 */
export abstract class GatewayBasedTask extends BaseTask {
    protected gatewayId = '';

    /**
     *
     */
    constructor(protected configService: ConfigService) {
        super();
    }

    protected async readGatewayId() {
        this.gatewayId = await this.configService.readGatewayId();
    }
}