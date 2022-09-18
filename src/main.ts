import { logger } from "./common"
import { CheckNotAuthenticatedClients } from "./task/checkNotAuthenticatedClientTask";
import { WhenClientAuthenticatedTask } from "./task/whenClientAuthenticatedTask";

async function main() {
    // client authenticated task
    const whenClientAuthenticatedTask = new WhenClientAuthenticatedTask(process.env.REDIS_HOST || 'localhost:6379', '/etc/ferrumgate/config');
    await whenClientAuthenticatedTask.start();

    // check if any authenticated authenticated task
    const checkNotAuthenticatedClient = new CheckNotAuthenticatedClients(process.env.REDIS_HOST || 'localhost:6379', '/etc/ferrumgate/config');
    await checkNotAuthenticatedClient.start();

    process.on('SIGINT', async () => {

        await whenClientAuthenticatedTask.stop();
        await checkNotAuthenticatedClient.stop();


    });
    process.on('SIGTERM', async () => {

        await whenClientAuthenticatedTask.stop();
        await checkNotAuthenticatedClient.stop();

    });

}

// start process
main()
    .catch(err => {
        logger.error(err);
        process.exit(1);
    })