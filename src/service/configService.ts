import { Util } from "../util";
import { RedisService } from "./redisService";
import fsp from 'fs/promises';
import { timeStamp } from "console";
import { logger } from "../common";
import { EventEmitter } from "stream";

/**
 * @summary config query over messages
 * @remark this code comes from rest.portal
 */
interface ConfigRequest {
    id: string;
    hostId: string;
    func: string,
    params: string[]
}
/**
 * @summary config response over messages
 */
export interface ConfigResponse {
    id: string;
    isError: boolean;
    error?: string;
    result?: any;
}

interface RequestItem {
    id: string,
    promise: Promise<ConfigResponse>;
    insertDate: number;

}

/**
 * get config from portal over redis
 */
export class ConfigService {
    eventEmitter = new EventEmitter;

    private redisPublish = `/query/config`;
    protected redis: RedisService | null = null;
    protected redisStream: RedisService | null = null;
    private hostId = '';
    private isWorking = false;
    private streamPos = '$';
    public requestList = new Map<string, RequestItem>();
    constructor(protected configFilePath: string, protected redisHost?: string, protected redisPass?: string) {
        this.redis = this.createRedisClient();
        this.redisStream = this.createRedisClient();

    }
    protected createRedisClient() {
        return new RedisService(this.redisHost, this.redisPass);
    }




    async readHostId() {


        if (this.hostId) return this.hostId;

        const file = (await fsp.readFile(this.configFilePath)).toString();
        const hostline = file.split('\n').find(x => x.startsWith('host='));
        if (!hostline) throw new Error(`no host id found in config ${this.configFilePath}`);
        const parts = hostline.split('=');
        if (parts.length != 2) throw new Error(`no host id found in config ${this.configFilePath}`);
        this.hostId = parts[1];
        if (!this.hostId)
            throw new Error(`no host id found in config ${this.configFilePath}`);
        return this.hostId;
    }

    async listenStream() {
        while (this.isWorking) {

            try {
                await this.readHostId();
                const items = await this.redisStream?.xread(`/query/host/${this.hostId}`, 10000, this.streamPos, 2000);
                if (items) {
                    for (const item of items) {
                        this.streamPos = item.xreadPos;
                        const data = item as { data: string };
                        const response = JSON.parse(Buffer.from(data.data, 'base64').toString());

                        const request = this.requestList.get(response.id);
                        if (request) {
                            this.eventEmitter.emit('data', response);
                        }

                    }
                }
            } catch (err) {
                logger.error(err);
            }
        }
    }
    async start() {
        setImmediate(async () => {

            this.isWorking = true;
            await this.listenStream();

        })

    }
    async stop() {
        this.isWorking = false;

    }

    async createRequest(msg: ConfigRequest, timeout = 5000) {

        let pr = new Promise<ConfigResponse>((resolve, reject) => {
            const onData = async (data: ConfigResponse) => {
                if (data.id == msg.id) {
                    this.requestList.delete(data.id);
                    clearTimeout(timer);
                    this.eventEmitter.removeListener('data', onData);
                    resolve(data);
                }
            }
            let timer = setTimeout(() => {
                this.requestList.delete(msg.id);
                resolve({ id: msg.id, isError: true, error: 'timeout occured' });
            }, timeout);
            this.eventEmitter.on('data', onData)
        })
        let item: RequestItem = {
            id: msg.id, insertDate: new Date().getTime(), promise: pr
        };
        this.requestList.set(msg.id, item)
        return item;
    }
    async getServiceNetwork(hostId: string) {
        await this.readHostId();
        if (!this.hostId)
            throw new Error(`hostId not found`);
        let msg: ConfigRequest = {
            id: Util.randomNumberString(),
            hostId: this.hostId,
            func: 'getServiceNetworkByGatewayId',
            params: [hostId]
        }
        const request = await this.createRequest(msg);
        await this.redis?.publish(this.redisPublish, Buffer.from(JSON.stringify(msg).toString(), 'base64').toString());
        const response = await request.promise;
        if (response.isError) {
            throw new Error(response.error);
        }
        return response.result as string;

    }

}
