import { logger } from "./common"
import { WhenClientAuthenticatedTask } from "./task/whenClientAuthenticatedTask";

async function main() {
    // client authenticated task
    const whenClientAuthenticatedTask = new WhenClientAuthenticatedTask(process.env.REDIS_HOST || 'localhost:6379', '/etc/ferrumgate/config');
    await whenClientAuthenticatedTask.start();

    process.on('SIGINT', async () => {

        await whenClientAuthenticatedTask.stop();


    });
    process.on('SIGTERM', async () => {

        await whenClientAuthenticatedTask.stop();

    });

}

// start process
main()
    .catch(err => {
        logger.error(err);
        process.exit(1);
    })