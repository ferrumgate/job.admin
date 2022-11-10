import { logger } from "./common"
import { ConfigService } from "./service/configService";
import { NetworkService } from "./service/networkService";
import { RedisOptions } from "./service/redisService";
import { CheckIptablesCommon } from "./task/checkIptablesCommonTask";
import { CheckNotAuthenticatedClients } from "./task/checkNotAuthenticatedClient";
import { CheckTunDevicesVSIptables } from "./task/checkTunDevicesVSIptables";
import { CheckTunDevicesVSRedis } from "./task/checkTunDevicesVSRedis";
import { IAmAlive } from "./task/iAmAlive";
import { WhenClientAuthenticated } from "./task/whenClientAuthenticated";
import { WhenTunnelClosed } from "./task/whenTunnelClosed";

async function main() {

    const redisHost = process.env.REDIS_HOST || 'localhost:6379';
    const redisPassword = process.env.REDIS_PASS;
    const redisOptions: RedisOptions = { host: redisHost, password: redisPassword };
    const configPath = '/etc/ferrumgate/config';
    const configService = new ConfigService(configPath, redisHost, redisPassword);
    await configService.start();
    // i am alive
    const iAmAlive = new IAmAlive(redisOptions, configService);
    iAmAlive.start();

    // client authenticated task
    const whenClientAuthenticated = new WhenClientAuthenticated(redisOptions, configService);
    await whenClientAuthenticated.start();

    // check if any authenticated authenticated task
    const checkNotAuthenticatedClient = new CheckNotAuthenticatedClients(redisOptions, configService);
    await checkNotAuthenticatedClient.start();

    // check common iptables rules
    const commonIptables = new CheckIptablesCommon(redisOptions, configService);
    await commonIptables.start();

    // check tun device to iptables
    const iptablesInput = new CheckTunDevicesVSIptables(redisOptions, configService);
    await iptablesInput.start();

    //check tun devices to redis
    const redisInput = new CheckTunDevicesVSRedis(redisOptions, configService);
    await redisInput.start();

    //follow tunnel closed events
    const tunnelClosed = new WhenTunnelClosed(redisOptions, configService);
    await tunnelClosed.start();

    async function stopEverything() {
        await whenClientAuthenticated.stop();
        await checkNotAuthenticatedClient.stop();
        await commonIptables.stop();
        await iptablesInput.stop();
        await tunnelClosed.stop();
        await iAmAlive.stop();
        await configService.stop();
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