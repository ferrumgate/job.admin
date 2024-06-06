import fs from 'fs';
import { DeviceService, ESServiceExtended, InputService, IpIntelligenceService, PolicyService, RedisConfigWatchCachedService, RedisService, SessionService, SystemLogService, TunnelService, Util, logger } from "rest.portal";
import { BroadcastService } from "rest.portal/service/broadcastService";
import { DhcpService } from "rest.portal/service/dhcpService";
import { DockerService } from "./service/dockerService";
import { CheckIptablesCommon } from "./task/checkIptablesCommon";
import { CheckLocalDns } from "./task/checkLocalDns";
import { CheckServices } from "./task/checkServices";
import { CheckTunDevicesVSIptables } from "./task/checkTunDevicesVSIptables";
import { CheckTunDevicesPolicyAuthn } from "./task/checkTunDevicesVSPolicyAuthn";
import { CheckTunDevicesVSRedis } from "./task/checkTunDevicesVSRedis";
import { IAmAlive } from "./task/iAmAlive";
import { PAuthzWatcherTask } from "./task/pAuthzWatcherTask";
import { PolicyWatcherTask } from "./task/policyWatcherTask";
import { SystemWatcherTask } from "./task/systemWatcherTask";
import { TrackWatcherTask } from "./task/trackWatcherTask";
import { WhenClientAuthenticated } from "./task/whenClientAuthenticated";
import { WhenTunnelClosed } from "./task/whenTunnelClosed";

function createRedis() {
    const redisHost = process.env.REDIS_HOST || 'localhost:6379';
    const redisPassword = process.env.REDIS_PASS;
    logger.info(`redis host: ${redisHost}`)
    return new RedisService(redisHost, redisPassword);
}

function createRedisLocal() {
    const redisHost = process.env.REDIS_LOCAL_HOST || 'localhost:6379';
    const redisPassword = process.env.REDIS_LOCAL_PASS;
    return new RedisService(redisHost, redisPassword);
}

function createRedisIntel() {
    const redisHost = process.env.REDIS_INTEL_HOST || 'localhost:6379';
    const redisPassword = process.env.REDIS_INTEL_PASS;
    return new RedisService(redisHost, redisPassword);
}

async function main() {

    const encryptKey = process.env.ENCRYPT_KEY || Util.randomNumberString(32);
    const gatewayId = process.env.GATEWAY_ID || Util.randomNumberString(16);

    const redis = createRedis();
    const redisLocal = createRedisLocal();
    const redisIntel = createRedisIntel();

    const systemLog = new SystemLogService(redis, createRedis(), encryptKey, 'job.admin/' + gatewayId);

    const redisConfig = new RedisConfigWatchCachedService(redis, createRedis(), systemLog, true, encryptKey, 'job.admin/' + gatewayId);
    const tunnelService = new TunnelService(redisConfig, redis, new DhcpService(redisConfig, redis));
    const sessionService = new SessionService(redisConfig, redis);
    const bcastService = new BroadcastService();
    const esService = new ESServiceExtended(redisConfig);
    const ipIntelligenceService = new IpIntelligenceService(redisConfig, redis, new InputService(), esService);
    const policyService = new PolicyService(redisConfig, ipIntelligenceService);
    const deviceService = new DeviceService(redisConfig, redis, redisLocal, esService);

    const dockerService = new DockerService();

    const inputService = new InputService();

    const dbFolder = process.env.DB_FOLDER;
    const policy_dbFolder = dbFolder || process.env.POLICY_DB_FOLDER || '/var/lib/ferrumgate/policy';
    await fs.mkdirSync(policy_dbFolder, { recursive: true });
    const policyWatcher = new PolicyWatcherTask(policy_dbFolder, policyService, redisConfig, bcastService);
    await policyWatcher.start();

    const dnsDbFolder = dbFolder || process.env.DNS_DB_FOLDER || '/var/lib/ferrumgate/dns';
    await fs.mkdirSync(dnsDbFolder, { recursive: true });
    const localDns = new CheckLocalDns(dnsDbFolder, redisConfig, bcastService, inputService);
    await localDns.start();

    const trackDbFolder = dbFolder || process.env.TRACK_DB_FOLDER || '/var/lib/ferrumgate/track';
    await fs.mkdirSync(trackDbFolder, { recursive: true });
    const trackWatcher = new TrackWatcherTask(trackDbFolder, redisConfig, bcastService);
    await trackWatcher.start();

    const authzFolder = dbFolder || process.env.AUTHZ_DB_FOLDER || '/var/lib/ferrumgate/authz';
    await fs.mkdirSync(authzFolder, { recursive: true });
    const authzWatcher = new PAuthzWatcherTask(authzFolder, redisConfig, bcastService);
    await authzWatcher.start();

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

    //check policy authentication
    const checkTunVSPolicyAuthn = new CheckTunDevicesPolicyAuthn(redis, bcastService,
        redisConfig, tunnelService, sessionService, policyService, deviceService);
    await checkTunVSPolicyAuthn.start();

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
        await localDns.stop();
        await trackWatcher.stop();
        await authzWatcher.stop();

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
