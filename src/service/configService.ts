import { Util } from "../util";
import { RedisService } from "./redisService";
import fsp from 'fs/promises';
import { timeStamp } from "console";
import { logger } from "../common";
import { EventEmitter } from "stream";
import { Gateway } from "../model/network";
import { Network } from "../model/network";
import { Service } from "../model/service";
import { ConfigEvent } from "../model/configEvent";

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
    protected redisListen: RedisService | null = null;
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
                await Util.sleep(1000);
            }
        }
    }
    async start() {
        setImmediate(async () => {

            this.isWorking = true;
            await this.listenConfig();
            await this.listenStream();

        })

    }
    public async onConfigChanged(chan: string, msg: string) {
        try {
            let encoded = Buffer.from(msg, 'base64').toString();
            logger.info(`config changed ${encoded}`);
            const event: ConfigEvent = JSON.parse(encoded) as ConfigEvent;

            await this.eventEmitter.emit('configChanged', event);


        } catch (err) {
            logger.error(err);
        }
    }
    public async listenConfig(): Promise<void> {
        try {
            this.redisListen = this.createRedisClient();
            await this.redisListen.subscribe('/config/changed');
            await this.redisListen.onMessage(async (channel: string, msg: string) => {
                await this.onConfigChanged(channel, msg);
            });

        } catch (err) {
            logger.error(err);
            setTimeout(async () => {
                await this.stop();
                await this.start();
            }, 5000);//try again 5 seconds
        }
    }
    async stop() {
        this.isWorking = false;
        await this.redisListen?.disconnect();
        this.redisListen = null;
        await this.redisStream?.disconnect();
        this.redisStream = null;
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
                resolve({ id: msg.id, isError: true, error: `timeout occured ${msg.id}: ${msg.func}` });
            }, timeout);
            this.eventEmitter.on('data', onData)
        })
        let item: RequestItem = {
            id: msg.id, insertDate: new Date().getTime(), promise: pr
        };
        this.requestList.set(msg.id, item)
        return item;
    }

    async execute<T>(msg: ConfigRequest) {
        await this.readHostId();
        if (!this.hostId)
            throw new Error(`hostId not found`);

        const request = await this.createRequest(msg);
        await this.redis?.publish(this.redisPublish, Buffer.from(JSON.stringify(msg)).toString('base64'));
        const response = await request.promise;
        if (response.isError) {
            throw new Error(response.error);
        }
        return response.result as T;
    }


    /// this func name comes from rest.portal configPublicListener
    async getGatewayById() {
        let msg: ConfigRequest = {
            id: Util.randomNumberString(),
            hostId: this.hostId,
            func: 'getGatewayById',
            params: [this.hostId]
        }
        return await this.execute<Gateway | null>(msg);

    }
    async getNetworkByGatewayId() {
        let msg: ConfigRequest = {
            id: Util.randomNumberString(),
            hostId: this.hostId,
            func: 'getNetworkByGatewayId',
            params: [this.hostId]
        }
        return await this.execute<Network | null>(msg);

    }


    async getServicesByGatewayId() {
        let msg: ConfigRequest = {
            id: Util.randomNumberString(),
            hostId: this.hostId,
            func: 'getServicesByGatewayId',
            params: [this.hostId]
        }
        return await this.execute<Service[]>(msg);

    }

    async getService(id: string) {
        let msg: ConfigRequest = {
            id: Util.randomNumberString(),
            hostId: this.hostId,
            func: 'getService',
            params: [id]
        }
        return await this.execute<Service[]>(msg);
    }

}
