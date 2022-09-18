interface ConfigItem {
    value?: any;
    lastGetTime?: number;
    name?: string;
}

/**
 * get config from portal over redis
 */
export class ConfigService {
    serviceNetwork?: string;
    constructor(protected redisHost?: string,) {


    }


    getServiceNetwork() {

    }

}