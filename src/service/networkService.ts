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

    static async linkDelete(tun: string) {
        logger.info(`link ${tun} will be delete`);
        const log = await Util.exec(`ip link delete dev ${tun}`);
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


    static async getTunDevices() {
        logger.info(`getting tun devices`);
        //ip link show type tun|grep ferrum|tr -d ' '|cut -d ':' -f2
        let output = await Util.exec(`ip link show type tun|grep ferrum|tr -d ' '|cut -d ':' -f2`);
        if (!output) return [];
        let devices = (output as String).split('\n').map(x => x.trim());
        return devices;
    }

    static async getInputTableDeviceRules() {
        logger.info(`getting iptables INPUT chain`);
        //iptables -S INPUT
        let output = await Util.exec(`iptables -S INPUT`);
        if (!output) return [];
        let lines = (output as String).split('\n').map(x => x.trim());
        let filtered = lines.filter(x => x.startsWith('-A')).filter(x => x.indexOf('ferrum') >= 0).filter(x => x.indexOf('ferrum+') < 0);
        return filtered.map(x => {
            let deviceName = x.split(' ').filter(y => y).filter(x => x.startsWith('ferrum')).find(y => y);
            return {
                name: deviceName, rule: x.replace('-A', '-D')
            }
        })
    }

    static async deleteInputTableIptables(rule: string) {
        logger.info(`deleting input table iptables ${rule}`);
        let output = await Util.exec(`iptables ${rule}`);
        if (output)
            logger.info(output);
    }


}