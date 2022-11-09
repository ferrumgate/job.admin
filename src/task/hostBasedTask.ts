import { BaseTask } from "./baseTask";
import fspromise from 'fs/promises';
import { ConfigService } from "../service/configService";

/**
 * a base class that reads hostId from configfile
 */
export abstract class HostBasedTask extends BaseTask {
    protected hostId = '';

    /**
     *
     */
    constructor(protected configService: ConfigService) {
        super();
    }

    protected async readHostId() {
        this.hostId = await this.configService.readHostId();
    }
}