import { logger } from "./common"
import { ConfigService } from "./service/configService";
import { NetworkService } from "./service/networkService";
import { RedisOptions } from "./service/redisService";
import { CheckIptablesCommonTask } from "./task/checkIptablesCommonTask";
import { CheckNotAuthenticatedClients } from "./task/checkNotAuthenticatedClientTask";
import { WhenClientAuthenticatedTask } from "./task/whenClientAuthenticatedTask";

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

    process.on('SIGINT', async () => {

        await whenClientAuthenticatedTask.stop();
        await checkNotAuthenticatedClient.stop();
        process.exit(0);

    });
    process.on('SIGTERM', async () => {

        await whenClientAuthenticatedTask.stop();
        await checkNotAuthenticatedClient.stop();
        process.exit(0);

    });

}

// start process
main()
    .catch(err => {
        logger.error(err);
        process.exit(1);
    })