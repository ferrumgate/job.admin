import { logger } from "../common";
import { Util } from "../util";


export class NetworkService {

    static async ipAddr(int: string, ip: string) {
        logger.info(`setting ip ${ip} to interface ${int}`);
        const exitsStr = await Util.exec(`ip a|grep ${ip}|wc -l`);
        const exits = Number(exitsStr);
        if (!exits) {
            logger.info(`ip ${ip} not found on interface ${int}`);
            if (!ip.includes(`/`))
                ip += '/32';
            const log = await Util.exec(`ip addr add ${ip} dev ${int}`)
            if (log)
                logger.info(log);
        }
    }
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
 * only allow packets from a tun device from a source ip
 * this protects client changing ip
 * @param tun 
 * @param clientIp 
 */
    static async addToConntrackClient(tun: string, trackId: string | number) {
        logger.info(`adding iptables client  ${trackId} dev ${tun}`);
        //iptables -t mangle -A OUTPUT -o ferrumuRUK3GkP -j CONNMARK --set-mark 2
        const log = await Util.exec(`iptables -t mangle -A OUTPUT -o ${tun} -j CONNMARK --set-mark ${trackId}`)
        if (log)
            logger.info(log)

        const log2 = await Util.exec(`iptables -t mangle -A POSTROUTING -o ${tun} -j MARK --set-mark ${trackId}`)
        if (log2)
            logger.info(log2)

    }

    /**
     * only only packets to  destination network
     * this protects our network from suspicious traffic
     * only destination network over tun device
     * @param destinationNetwork 
     */
    static async addToIptablesCommon(destinationNetwork: string) {

        //-A INPUT -i ferrum+ -j DROP
        //check if drop all exits
        logger.info(`check iptables ferrum+ rules in INPUT all DROP`);
        let tunAllCountStr = await Util.exec(`iptables -S INPUT|grep 'ferrum+'|grep -v '\\-d'|wc -l`);
        let tunAllCount = Number(tunAllCountStr);

        if (tunAllCount) {
            logger.info(`no rule for ferrum+ INPUT all DROP`);
            let log = await Util.exec(`iptables -D INPUT -i ferrum+ -j DROP`);
            if (log)
                logger.info(log)
        }
        // check input and forward tables
        logger.info(`check iptables ferrum+ rules in INPUT and FORWARD`);
        let tunCountStr = await Util.exec(`iptables -S INPUT|grep ferrum+|wc -l`);
        let tunCount = Number(tunCountStr);

        let networkCountStr = await Util.exec(`iptables -S INPUT|grep ferrum+|grep '${destinationNetwork}'|wc -l`);
        let networkCount = Number(networkCountStr);

        if (!networkCount && tunCount) {//network changed, delete first
            logger.info("service network changed to " + destinationNetwork);
            let rule = await Util.exec(`iptables -S INPUT|grep ferrum+`) as string;
            rule = rule.replace('-A', '-D')
            await Util.exec(`iptables ${rule}`);
            tunCount = 0;
        }
        if (tunCount == 0) {
            logger.info(`no rule for ferrum+ INPUT`);
            let log = await Util.exec(`iptables -A INPUT -i ferrum+  ! -d ${destinationNetwork} -j DROP`);
            if (log)
                logger.info(log)
        }

        /*  tunCountStr = await Util.exec(`iptables -S FORWARD|grep ferrum+|wc -l`);
         tunCount = Number(tunCountStr);
 
         networkCountStr = await Util.exec(`iptables -S FORWARD|grep ferrum+|grep '${destinationNetwork}'|wc -l`);
         networkCount = Number(networkCountStr);
         if (!networkCount && tunCount) {//network changed, delete first
             logger.info("service network changed to " + destinationNetwork);
             let rule = await Util.exec(`iptables -S FORWARD|grep ferrum+`) as string;
             rule = rule.replace('-A', '-D')
             await Util.exec(`iptables ${rule}`);
             tunCount = 0;
         }
 
         if (tunCount == 0) {
             logger.info(`no rule for ferrum+ FORWARD`);
             let log = await Util.exec(`iptables -A FORWARD -i ferrum+  ! -d ${destinationNetwork} -j DROP`);
             if (log)
                 logger.info(log)
         } */


    }
    static async blockToIptablesCommon() {
        //-A INPUT -i ferrum+ -j DROP
        logger.info(`check iptables ferrum+ rules in INPUT all DROP`);
        let tunCountStr = await Util.exec(`iptables -S INPUT|grep 'ferrum+'|grep -v '\\-d'|wc -l`);
        let tunCount = Number(tunCountStr);

        if (tunCount == 0) {
            logger.info(`no rule for ferrum+ INPUT all DROP`);
            let log = await Util.exec(`iptables -A INPUT -i ferrum+ -j DROP`);
            if (log)
                logger.info(log)
        }
        logger.info(`check iptables FORWARD all DROP`);
        //set policy drop
        tunCountStr = await Util.exec(`iptables -S FORWARD|grep '\\-P FORWARD DROP'|wc -l`);
        tunCount = Number(tunCountStr);

        if (tunCount == 0) {
            logger.info(`no rule for ferrum+ FORWARD`);
            let log = await Util.exec(`iptables -P FORWARD DROP`);
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
    static async getMangleOutputTableDeviceRules() {
        logger.info(`getting iptables OUTPUT chain`);
        //iptables -S INPUT
        let output = await Util.exec(`iptables -t mangle -S OUTPUT`);
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
    static async getManglePostroutingTableDeviceRules() {
        logger.info(`getting iptables POSTROUTING chain`);
        //iptables -S INPUT
        let output = await Util.exec(`iptables -t mangle -S POSTROUTING`);
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


    static async deleteTableIptables(rule: string) {
        logger.info(`deleting input table iptables ${rule}`);
        let output = await Util.exec(`iptables ${rule}`);
        if (output)
            logger.info(output);
    }
    static async deleteMangleTableIptables(rule: string) {
        logger.info(`deleting input table iptables ${rule}`);
        let output = await Util.exec(`iptables -t mangle ${rule}`);
        if (output)
            logger.info(output);
    }



}