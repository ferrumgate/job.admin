import { logger } from "rest.portal";
import { NetworkService } from "./networkService";

export class TunService {
    static async delete(tun: string) {
        try {
            logger.warn(`deleting device ${tun}`);
            await NetworkService.linkDelete(tun);
        } catch (ignore) {
            logger.error(ignore);
        }
    }
    static async deleteIptableRules(tun: string) {
        const rulesInput = await NetworkService.getInputTableDeviceRules();
        logger.info(`deleting iptables INPUT rule for device ${tun}`);
        for (const rule of rulesInput.filter(x => x.name == tun)) {
            try {
                logger.warn(`deleting iptables INPUT rule ${rule.rule}`)
                await NetworkService.deleteTableIptables(rule.rule);
            } catch (ignore) {
                logger.error(ignore);
            }

        }

        const rulesPrerouting = await NetworkService.getManglePreroutingTableDeviceRules();
        logger.info(`deleting iptables MANGLE PREROUTING rule for device ${tun}`);
        for (const rule of rulesPrerouting.filter(x => x.name == tun)) {
            try {
                logger.warn(`deleting iptables MANGLE PREROUTING rule ${rule.rule}`)
                await NetworkService.deleteMangleTableIptables(rule.rule);
            } catch (ignore) {
                logger.error(ignore);
            }

        }

        const rulesOutput = await NetworkService.getMangleOutputTableDeviceRules();
        logger.info(`deleting iptables MANGLE OUTPUT rule for device ${tun}`);
        for (const rule of rulesOutput.filter(x => x.name == tun)) {
            try {
                logger.warn(`deleting iptables MANGLE OUTPUT rule ${rule.rule}`)
                await NetworkService.deleteMangleTableIptables(rule.rule);
            } catch (ignore) {
                logger.error(ignore);
            }

        }

        const rulesPostrouting = await NetworkService.getManglePostroutingTableDeviceRules();
        logger.info(`deleting iptables MANGLE POSTROUTING rule for device ${tun}`);
        for (const rule of rulesPostrouting.filter(x => x.name == tun)) {
            try {
                logger.info(`deleting iptables MANGLE POSTROUTING rule ${rule.rule}`)
                await NetworkService.deleteMangleTableIptables(rule.rule);
            } catch (ignore) {
                logger.error(ignore);
            }

        }
    }
}