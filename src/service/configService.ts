import { RedisService } from "./redisService";

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
    protected redis: RedisService | null = null;
    constructor(protected redisHost?: string,) {
        this.createRedisClient();

    }
    protected createRedisClient() {
        return new RedisService(this.redisHost);
    }


    getServiceNetwork() {
        return '172.16.0.0/16'
    }

}