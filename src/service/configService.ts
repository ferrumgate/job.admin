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
    constructor(protected redisHost?: string, protected redisPass?: string) {
        this.createRedisClient();

    }
    protected createRedisClient() {
        return new RedisService(this.redisHost, this.redisPass);
    }


    getServiceNetwork() {
        return '172.16.0.0/16'
    }

}