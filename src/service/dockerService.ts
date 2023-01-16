import { logger, Service, Util } from "rest.portal";
import { NetworkService } from "./networkService";

export interface Pod {
    id: string, image: string, name: string; details?: any;
}
/**
 * @summary docker management
 */
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


            let env = `
-e LOG_LEVEL=${process.env.LOG_LEVEL || 'info'}
-e SYSLOG_HOST=${process.env.SYSLOG_HOST || 'localhost:9292'}
-e REDIS_HOST=${process.env.REDIS_HOST || 'localhost:6379'} 
${redis_pass}
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
-e INSTANCE_ID=${Util.randomNumberString(16)}
-e SYSLOG_HOST=${process.env.SYSLOG_HOST || 'log:9292'}`
        return env.replace(/\n/g, ' ');
    }
    async execute(cmd: string) {
        return await Util.exec(cmd)
    }
    async executeWithoutError(cmd: string) {
        return await Util.exec(cmd, false)
    }
    async ipAddr(svc: Service) {
        if (svc.assignedIp != '127.0.0.1')
            await NetworkService.ipAddr('lo', svc.assignedIp);
    }
    getLabels(svc: Service) {
        return `--label Ferrum_Svc_LastUpdate=${svc.updateDate || ''} --label Ferrum_Svc_Id=${svc.id}`
    }
    async run(svc: Service, gatewayId: string, network: string) {
        logger.info(`starting ferrum service ${svc.name}`)
        let volume = `--volume ${process.env.VOLUME_LMDB || 'ferrumgate_lmdb'}:/var/lib/ferrumgate --volume /dev/urandom:/dev/urandom`
        let net = network ? `--net=${network}` : '';
        let pid = network ? `--pid=${network}` : '';
        await this.ipAddr(svc);
        let image = process.env.FERRUM_IO_IMAGE || 'ferrum.io';
        let command = `
docker run --cap-add=NET_ADMIN --rm --restart=no ${net} ${pid} ${volume} --name  ferrumgate-svc-${this.normalizeName(svc.name).toLocaleLowerCase().substring(0, 6)}-${svc.id}-${Util.randomNumberString(6)}
${this.getLabels(svc)} 
-d ${this.getEnv(svc)}
${this.getGatewayServiceInstanceId(gatewayId, svc)}
${image}`
        command = command.replace(/\n/g, ' ');

        logger.debug(command);
        await this.execute(command);
        return command;
    }
    async inspect(podId: string | string[]) {
        const inspect = await this.execute(`docker inspect ${Array.isArray(podId) ? podId.join(' ') : podId} 2> /dev/null`) as string;
        //const inspect = await this.executeWithoutError(`docker inspect ${Array.isArray(podId) ? podId.join(' ') : podId}`) as string;

        try {
            return JSON.parse(inspect);
        }
        catch (ignore) { logger.error(ignore) };
        return [];
    }

    async getAllRunning(): Promise<Pod[]> {
        logger.info(`get all running pods`);
        const output = await this.execute(`docker ps --no-trunc  --filter status=running --format "{{.ID}} {{.Image}} {{.Names}}"`) as string;
        const rows = output.split('\n').map(x => x.trim()).filter(x => x);
        let pods = rows.map((x) => {
            const tmp = x.split(' ');
            let item: Pod = {
                id: tmp[0], image: tmp[1], name: tmp[2]
            }
            return item;
        })
        let podDetails: any[] = [];
        let page = 0;
        let pageSize = 100;
        while (true) {
            const podsSliced = pods.slice(page * pageSize, (page + 1) * pageSize)
            if (!podsSliced.length) break;
            page++;
            let foundeds = await this.inspect(pods.map(x => x.id));
            podDetails = podDetails.concat(...foundeds);
        }
        podDetails.forEach(x => {
            if (x.Id) {
                let finded = pods.find(y => y.id == x.Id)
                if (finded)
                    finded.details = x;
            }
        })

        return pods;

    }

    async stop(pod: Pod) {
        logger.info(`stoping ferrum service ${pod.name}:${pod.id}`);
        const log = await this.execute(`docker stop ${pod.id}`);
        if (log)
            logger.info(log);
    }



}