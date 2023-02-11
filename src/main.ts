
import { RedisConfigWatchCachedService, TunnelService } from "rest.portal";
import { PolicyService, SystemLogService } from "rest.portal";
import { logger, RedisConfigWatchService, RedisService, Util } from "rest.portal";
import { RedisOptions } from "./model/redisOptions";
import { BroadcastService } from "./service/broadcastService";
import { DockerService } from "./service/dockerService";
import { NetworkService } from "./service/networkService";
import { SystemWatcherTask } from "./task/systemWatcherTask";
import { CheckIptablesCommon } from "./task/checkIptablesCommon";

import { CheckServices } from "./task/checkServices";
import { CheckTunDevicesVSIptables } from "./task/checkTunDevicesVSIptables";
import { CheckTunDevicesVSRedis } from "./task/checkTunDevicesVSRedis";
import { IAmAlive } from "./task/iAmAlive";
import { WhenClientAuthenticated } from "./task/whenClientAuthenticated";
import { WhenTunnelClosed } from "./task/whenTunnelClosed";
import { PolicyWatcherTask } from "./task/policyWatcherTask";
import fs from 'fs';



function createRedis(opt: RedisOptions) {

    return new RedisService(opt.host, opt.password);
}

async function main() {



    const redisHost = process.env.REDIS_HOST || 'localhost:6379';
    const redisPassword = process.env.REDIS_PASS;
    const encryptKey = process.env.ENCRYPT_KEY || Util.randomNumberString(32);

    const redisOptions: RedisOptions = { host: redisHost, password: redisPassword };


    const redis = createRedis(redisOptions);

    const systemLog = new SystemLogService(redis, createRedis(redisOptions), encryptKey, 'job.admin');

    const redisConfig = new RedisConfigWatchCachedService(redis, createRedis(redisOptions), systemLog, true, encryptKey, 'job.admin');
    const tunnelService = new TunnelService(redisConfig, redis);
    const policyService = new PolicyService(redisConfig);
    const bcastService = new BroadcastService();
    const dockerService = new DockerService();



    const dbFolder = process.env.POLICY_DB_FOLDER || '/var/lib/ferrumgate/policy';
    await fs.mkdirSync(dbFolder, { recursive: true });
    const policyWatcher = new PolicyWatcherTask(dbFolder, policyService, redisConfig, bcastService);
    await policyWatcher.start();



    // i am alive
    const iAmAlive = new IAmAlive(redis);
    iAmAlive.start();

    // client authenticated task
    const whenClientAuthenticated = new WhenClientAuthenticated(bcastService);
    await whenClientAuthenticated.start();



    // check common iptables rules
    const commonIptables = new CheckIptablesCommon(redisConfig, bcastService);
    await commonIptables.start();

    // check tun device to iptables
    const iptablesInput = new CheckTunDevicesVSIptables();
    await iptablesInput.start();

    //check tun devices to redis
    const redisInput = new CheckTunDevicesVSRedis(redis);
    await redisInput.start();

    //follow tunnel closed events
    const tunnelClosed = new WhenTunnelClosed(bcastService);
    await tunnelClosed.start();

    //follow services
    const checkServices = new CheckServices(redisConfig, bcastService, dockerService);
    await checkServices.start();



    //follow system
    const systemWatcher = new SystemWatcherTask(redis, redisConfig, tunnelService,
        bcastService);
    await systemWatcher.start();

    async function stopEverything() {
        await systemWatcher.stop();
        await whenClientAuthenticated.stop();

        await commonIptables.stop();
        await iptablesInput.stop();
        await tunnelClosed.stop();
        await iAmAlive.stop();
        await checkServices.stop();
        await redisConfig.stop();



    }

    process.on('SIGINT', async () => {

        await stopEverything();
        process.exit(0);

    });
    process.on('SIGTERM', async () => {

        await stopEverything();
        process.exit(0);

    });

}

// start process
main()
    .catch(err => {
        logger.error(err);
        process.exit(1);
    })