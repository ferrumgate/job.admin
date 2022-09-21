import { logger } from "./common"
import { ConfigService } from "./service/configService";
import { NetworkService } from "./service/networkService";
import { RedisOptions } from "./service/redisService";
import { CheckIptablesCommonTask } from "./task/checkIptablesCommonTask";
import { CheckNotAuthenticatedClients } from "./task/checkNotAuthenticatedClientTask";
import { CheckTunDevicesVSIptables } from "./task/checkTunDevicesVSIptables";
import { CheckTunDevicesVSRedis } from "./task/checkTunDevicesVSRedis";
import { WhenClientAuthenticatedTask } from "./task/whenClientAuthenticatedTask";
import { WhenTunnelClosed } from "./task/whenTunnelClosed";

async function main() {

    const redisHost = process.env.REDIS_HOST || 'localhost:6379';
    const redisPassword = process.env.REDIS_PASS;
    const redisOptions: RedisOptions = { host: redisHost, password: redisPassword };
    const configPath = '/etc/ferrumgate/config';
    const configService = new ConfigService(redisHost);
    // client authenticated task
    const whenClientAuthenticatedTask = new WhenClientAuthenticatedTask(redisOptions, configPath);
    await whenClientAuthenticatedTask.start();

    // check if any authenticated authenticated task
    const checkNotAuthenticatedClient = new CheckNotAuthenticatedClients(redisOptions, configPath);
    await checkNotAuthenticatedClient.start();

    // check common iptables rules
    const commonIptables = new CheckIptablesCommonTask(redisOptions, configPath, configService);
    await commonIptables.start();

    // check tun device to iptables
    const iptablesInput = new CheckTunDevicesVSIptables(redisOptions, configPath);
    await iptablesInput.start();

    //check tun devices to redis
    const redisInput = new CheckTunDevicesVSRedis(redisOptions, configPath);
    await redisInput.start();

    //follow tunnel closed events
    const tunnelClosed = new WhenTunnelClosed(redisOptions, configPath);
    await tunnelClosed.start();

    async function stopEverything() {
        await whenClientAuthenticatedTask.stop();
        await checkNotAuthenticatedClient.stop();
        await commonIptables.stop();
        await iptablesInput.stop();
        await tunnelClosed.stop();
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