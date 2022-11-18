import { Util } from "../util";
import { Service } from "../model/service";
import { NetworkService } from "./networkService";
import { logger } from "../common";
import { util } from "chai";

export interface Pod {
    id: string, image: string, name: string;
}

export class DockerService {

    //security check, input from outer
    normalizeName(str: string) {
        return str.replace(/[^a-z0-9]/gi, '');
    }

    getEnv(svc: Service) {
        if (!svc.protocol || svc.protocol == 'raw') {

            let tcp = svc.tcp ? `-e RAW_DESTINATION_TCP_PORT=${svc.tcp}` : '';
            let udp = svc.udp ? `-e RAW_DESTINATION_UDP_PORT=${svc.udp}` : '';

            let tcp_listen = svc.tcp ? `-e RAW_LISTEN_TCP_PORT=${svc.tcp}` : '';
            let udp_listen = svc.udp ? `-e RAW_LISTEN_UDP_PORT=${svc.udp}` : '';
            let redis_pass = process.env.REDIS_PASS ? `-e REDIS_PASS=${process.env.REDIS_PASS}` : ''
            let redis_local_pass = process.env.REDIS_LOCAL_PASS ? `-e REDIS_LOCAL_PASS=${process.env.REDIS_LOCAL_PASS}` : ''

            let env = `
-e LOG_LEVEL=${process.env.LOG_LEVEL || 'INFO'}
-e REDIS_HOST=${process.env.REDIS_HOST || 'localhost:6379'} 
${redis_pass}
-e REDIS_LOCAL_HOST=${process.env.REDIS_LOCAL_HOST || 'localhost:6379'} 
${redis_local_pass}
-e RAW_DESTINATION_HOST=${svc.host}
${tcp} ${udp}
-e RAW_LISTEN_IP=${svc.assignedIp}
${tcp_listen} ${udp_listen}
`;
            return env.replace(/\n/g, ' ');

        }
        return '';
    }
    getGatewayServiceInstanceId(gatewayId: string, svc: Service) {
        let env = `
-e GATEWAY_ID=${gatewayId}
-e SERVICE_ID=${svc.id}
-e INSTANCE_ID=${Util.randomNumberString(16)}`
        return env.replace(/\n/g, ' ');
    }
    async exec(cmd: string) {
        const log = await Util.exec(cmd)
        if (log) {
            logger.info(log);
        }
    }
    async ipAddr(svc: Service) {
        if (svc.assignedIp != '127.0.0.1')
            await NetworkService.ipAddr('lo', svc.assignedIp);
    }
    async run(svc: Service, gatewayId: string, network: string) {
        logger.info(`starting ferrum service ${svc.name}`)
        let net = network ? `--net=${network}` : '';
        await this.ipAddr(svc);
        let image = process.env.FERRUM_IO_IMAGE || 'ferrum.io';
        let command = `
docker run --cap-add=NET_ADMIN --rm --restart=no ${net} --name  ferrumsvc-${this.normalizeName(svc.name).toLocaleLowerCase().substring(0, 6)}-${svc.id}-${Util.randomNumberString(6)} 
-d ${this.getEnv(svc)}
${this.getGatewayServiceInstanceId(gatewayId, svc)}
${image}`
        command = command.replace(/\n/g, ' ');

        logger.debug(command);
        await this.exec(command);
        return command;
    }

    async getAllRunning(): Promise<Pod[]> {
        logger.info(`get all running pods`);
        const output = await Util.exec(`docker ps --no-trunc  --filter status=running --format "{{.ID}} {{.Image}} {{.Names}}"`) as string;
        const rows = output.split('\n').map(x => x.trim()).filter(x => x);
        return rows.map(x => {
            const tmp = x.split(' ');
            return {
                id: tmp[0], image: tmp[1], name: tmp[2]
            }
        })

    }

    async stop(pod: Pod) {
        logger.info(`stoping ferrum service ${pod.name}:${pod.id}`);
        const log = await Util.exec(`docker stop ${pod.id}`);
        if (log)
            logger.info(log);
    }



}