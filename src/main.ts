
import { logger } from "rest.portal";
import { RedisOptions } from "./model/redisOptions";
import { ConfigService } from "./service/configService";
import { DockerService } from "./service/dockerService";
import { NetworkService } from "./service/networkService";
import { CheckIptablesCommon } from "./task/checkIptablesCommon";
import { CheckNotAuthenticatedClients } from "./task/checkNotAuthenticatedClient";
import { CheckServices } from "./task/checkServices";
import { CheckTunDevicesVSIptables } from "./task/checkTunDevicesVSIptables";
import { CheckTunDevicesVSRedis } from "./task/checkTunDevicesVSRedis";
import { IAmAlive } from "./task/iAmAlive";
import { WhenClientAuthenticated } from "./task/whenClientAuthenticated";
import { WhenTunnelClosed } from "./task/whenTunnelClosed";


async function main() {


    const redisHost = process.env.REDIS_HOST || 'localhost:6379';
    const redisPassword = process.env.REDIS_PASS;
    const redisOptions: RedisOptions = { host: redisHost, password: redisPassword };
    const configService = new ConfigService(redisHost, redisPassword);
    await configService.start();

    const dockerService = new DockerService();

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

    //follow services
    const checkServices = new CheckServices(redisOptions, configService, dockerService);
    await checkServices.start();

    async function stopEverything() {
        await whenClientAuthenticated.stop();
        await checkNotAuthenticatedClient.stop();
        await commonIptables.stop();
        await iptablesInput.stop();
        await tunnelClosed.stop();
        await iAmAlive.stop();
        await checkServices.stop();
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