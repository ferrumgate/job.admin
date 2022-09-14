import { BaseTask } from "./baseTask";
import fspromise from 'fs/promises';

/**
 * class that reads hostId from configfile
 */
export abstract class HostBasedTask extends BaseTask {
    protected hostId = '';
    /**
     *
     */
    constructor(protected configFilePath: string) {
        super();
    }

    protected async readHostId() {
        const file = (await fspromise.readFile(this.configFilePath)).toString();
        const hostline = file.split('\n').find(x => x.startsWith('host='));
        if (!hostline) throw new Error(`no host id found in config ${this.configFilePath}`);
        const parts = hostline.split('=');
        if (parts.length != 2) throw new Error(`no host id found in config ${this.configFilePath}`);
        this.hostId = parts[1];
        if (!this.hostId)
            throw new Error(`no host id found in config ${this.configFilePath}`);


    }
}