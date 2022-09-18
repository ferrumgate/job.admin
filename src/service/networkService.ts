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

    /**
     * only allow packets from a tun device from a source ip
     * this protects client changing ip
     * @param tun 
     * @param clientIp 
     */
    static async addToIptablesClient(tun: string, clientIp: string) {
        logger.info(`adding iptables client  ${clientIp} dev ${tun}`);
        //iptables -A INPUT -s clientIp -i tun -d destinationNetwork -j ACCEPT otherwise drop
        const log = await Util.exec(`iptables -A INPUT ! -s ${clientIp} -i ${tun} -j DROP`)
        if (log)
            logger.info(log)

    }
    /**
     * only only packets to  destination network
     * this protects our network from suspicious traffic
     * only destination network over tun device
     * @param destinationNetwork 
     */
    static async addToIptablesCommon(destinationNetwork: string) {
        logger.info(`check iptables ferrum+ rules in INPUT and FORWARD`);
        let count = await Util.exec(`iptables -nvL INPUT|grep ferrum+|wc -l`);
        if (Number(count) == 0) {
            logger.info(`no rule for ferrum+ INPUT`);
            let log = await Util.exec(`iptables -A INPUT -i ferrum+  ! -d ${destinationNetwork} -j DROP`);
            if (log)
                logger.info(log)
        }

        count = await Util.exec(`iptables -nvL FORWARD|grep ferrum+|wc -l`);
        if (Number(count) == 0) {
            logger.info(`no rule for ferrum+ FORWARD`);
            let log = await Util.exec(`iptables -A FORWARD -i ferrum+  ! -d ${destinationNetwork} -j DROP`);
            if (log)
                logger.info(log)
        }

    }


}