import { logger } from "../common";
import { Util } from "../util";


export class NetworkService {
    static async linkUp(tun: string) {

        logger.info(`link ${tun} will up`)

        const cmd = `ip link set dev ${tun} up`;
        const log = await Util.exec(cmd);
        if (log)
            logger.info(log);


    }
    static async linkDown(tun: string) {

        logger.info(`link ${tun} will down`)
        const log = await Util.exec(`ip link set dev ${tun} down`);
        if (log)
            logger.info(log);

    }

    static async addRoute(tun: string, destination: string) {
        //ip route add destination dev tun
        logger.info(`adding route to ${destination} dev ${tun} `)
        const log = await Util.exec(`ip route add ${destination} dev ${tun}`);
        if (log)
            logger.info(log);

    }
    static async addIptables(tun: string, destination: string) {

    }


}