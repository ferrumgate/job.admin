import { Util } from "../util";
import { Service } from "../model/service";
import { NetworkService } from "./networkService";
import { logger } from "../common";

export interface Pod {
    name: string;
}

export class PodmanService {

    normalizeName(str: string) {
        return str.replace(/[^a-z0-9]/gi, '');
    }
    getRunning() {

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
    getHostServiceInstanceId() {
        let env = `
-e HOST_ID=${process.env.HOST_ID || 'hostId'}
-e SERVICE_ID=${process.env.SERVICE_ID || 'serviceId'}
-e INSTANCE_ID=${Util.randomNumberString(16)}`
        return env.replace(/\n/g, ' ');
    }
    async exec(cmd: string) {
        const log = await Util.exec(cmd)
        if (log)
            logger.error(log);
    }
    async ipAddr(svc: Service) {
        await NetworkService.ipAddr('lo', svc.assignedIp);
    }
    async run(svc: Service) {
        await this.ipAddr(svc);
        let image = process.env.FERRUM_IO_IMAGE || 'ferrum.io';
        let command = `
podman run --cap-add=NET_ADMIN --rm --restart=no --net=host --name ${svc.name.toLowerCase()}-${svc.id} 
-d ${this.getEnv(svc)}
${this.getHostServiceInstanceId()}
${image}`
        command = command.replace(/\n/g, ' ')
        await this.exec(command);
        return command;
    }
    isRunning(svc: Service) {


    }


}