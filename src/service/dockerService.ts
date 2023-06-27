import { logger, Service, Util } from "rest.portal";
import { NetworkService } from "./networkService";
import * as ChildProcess from "node:child_process";

export interface Pod {
    id: string, image: string, name: string; details?: any; svc?: { id: string, port: number, isTcp: boolean, isUdp: boolean, replica: number, lastUpdate: string, gatewayId: string }
}
/**
 * @summary docker management
 */
export class DockerService {

    //security check, input from outer
    normalizeName(str: string) {
        return str.replace(/[^a-z0-9]/gi, '');
    }

    getEnv(svc: Service, port: number, isTcp?: boolean, isUdp?: boolean, rootFqdn?: string) {


        let tcp = isTcp ? `-e RAW_DESTINATION_TCP_PORT=${port}` : '';
        let udp = isUdp ? `-e RAW_DESTINATION_UDP_PORT=${port}` : '';

        let tcp_listen = isTcp ? `-e RAW_LISTEN_TCP_PORT=${port}` : '';
        let udp_listen = isUdp ? `-e RAW_LISTEN_UDP_PORT=${port}` : '';
        let redis_pass = process.env.REDIS_PASS ? `-e REDIS_PASS=${process.env.REDIS_PASS}` : ''
        let redis_intel_pass = process.env.REDIS_INTEL_PASS ? `-e REDIS_INTEL_PASS=${process.env.REDIS_INTEL_PASS}` : ''
        let db_folder = process.env.DB_FOLDER ? `-e DB_FOLDER=${process.env.DB_FOLDER}` : '';
        let disable_policy = process.env.DISABLE_POLICY ? `-e DISABLE_POLICY=${process.env.DISABLE_POLICY}` : '';

        let env = `
-e LOG_LEVEL=${process.env.LOG_LEVEL || 'info'}
-e SYSLOG_HOST=${process.env.SYSLOG_HOST || 'localhost:9292'}
-e REDIS_HOST=${process.env.REDIS_HOST || 'localhost:6379'}
${redis_pass}
-e REDIS_INTEL_HOST=${process.env.REDIS_INTEL_HOST || 'localhost:6379'}
${redis_intel_pass}
-e RAW_DESTINATION_HOST=${svc.hosts[0].host}
${tcp} ${udp}
-e RAW_LISTEN_IP=${svc.assignedIp}
-e PROTOCOL_TYPE=${svc.protocol || 'raw'}
-e SYSLOG_HOST=${process.env.SYSLOG_HOST || 'log:9292'}
${db_folder}
-e POLICY_DB_FOLDER=${process.env.POLICY_DB_FOLDER || '/var/lib/ferrumgate/policy'}
-e DNS_DB_FOLDER=${process.env.DNS_DB_FOLDER || '/var/lib/ferrumgate/dns'}
-e AUTHZ_DB_FOLDER=${process.env.AUTHZ_DB_FOLDER || '/var/lib/ferrumgate/authz'}
-e TRACK_DB_FOLDER=${process.env.AUTHZ_DB_FOLDER || '/var/lib/ferrumgate/track'}
-e ROOT_FQDN=${rootFqdn || 'ferrumgate.zero'}
${disable_policy}
${tcp_listen} ${udp_listen}
`;
        return env.replace(/\n/g, ' ');

    }
    getGatewayServiceInstanceId(gatewayId: string, svc: Service) {
        let env = `
-e GATEWAY_ID=${gatewayId}
-e SERVICE_ID=${svc.id}
-e INSTANCE_ID=${Util.randomNumberString(16)}`
        return env.replace(/\n/g, ' ');
    }



    async execute(cmd: string) {
        return await Util.exec(cmd)
    }
    async executeSpawn(cmd: string, args?: string[], throwError = true, redirectError = false) {
        return await Util.spawn(cmd, args, throwError, redirectError);
    }
    async executeWithoutError(cmd: string) {
        return await Util.exec(cmd, false)
    }
    async ipAddr(svc: Service) {
        if (svc.assignedIp != '127.0.0.1')
            await NetworkService.ipAddr('lo', svc.assignedIp);
    }
    getLabels(svc: Service, port: number, isTcp?: boolean, isUdp?: boolean, replicaNumber?: number, gatewayId?: string) {
        return `--label Ferrum_Svc_LastUpdate=${svc.updateDate || ''} --label Ferrum_Svc_Id=${svc.id} --label Ferrum_Svc_Port=${port} --label Ferrum_Svc_IsTcp=${isTcp ? 'true' : 'false'} --label Ferrum_Svc_IsUdp=${isUdp ? 'true' : 'false'} --label Ferrum_Svc_Replica=${replicaNumber || 0} --label Ferrum_Gateway_Id=${gatewayId || 0}`
    }
    async run(svc: Service, gatewayId: string, network: string, rootFqdn: string, port: number, isTcp?: boolean, isUdp?: boolean, replica?: number) {
        logger.info(`starting ferrum service ${svc.name}`)
        let volume = `--volume ${process.env.VOLUME_LMDB || 'fg-' + gatewayId + '_lmdb'}:${process.env.LMDB_FOLDER || '/var/lib/ferrumgate'} --volume /dev/urandom:/dev/urandom`
        let net = network ? `--net=${network}` : '';
        let pid = network ? `--pid=${network}` : '';
        await this.ipAddr(svc);
        let image = process.env.FERRUM_IO_IMAGE || 'ferrum.io';

        let command = `
docker run --cap-add=NET_ADMIN --rm --restart=no ${net} ${pid} ${volume} --name  fg-${gatewayId}-svc-${this.normalizeName(svc.name).toLocaleLowerCase().substring(0, 6)}-${svc.id}-${Util.randomNumberString(6)}
${this.getLabels(svc, port, isTcp, isUdp, replica, gatewayId)} 
-d ${this.getEnv(svc, port, isTcp, isUdp, rootFqdn)}
${this.getGatewayServiceInstanceId(gatewayId, svc)}
${image}`
        command = command.replace(/\n/g, ' ');

        logger.debug(command);
        await this.execute(command);

        return command;
    }
    async inspect(podId: string | string[]) {
        let command = [];
        command.push('docker');
        command.push('inspect');
        if (Array.isArray(podId))
            command = command.concat(podId);
        else
            command.push(podId);
        const inspect = await this.executeSpawn(command[0], command.slice(1), false, true) as string;
        //const inspect = await this.executeSpawn(`docker inspect ${Array.isArray(podId) ? podId.join(' ') : podId} 2> /dev/null || true `) as string;
        //const inspect = await this.executeWithoutError(`docker inspect ${Array.isArray(podId) ? podId.join(' ') : podId}`) as string;

        try {
            return JSON.parse(inspect);
        }
        catch (ignore) { logger.error(ignore) };
        return [];
    }

    async getAllRunning(gatewayId?: string): Promise<Pod[]> {
        logger.info(`get all running pods`);
        let command = [];
        command.push('docker');
        command.push('ps');
        command.push('--no-trunc');
        command.push('--filter');
        command.push('status=running');
        if (gatewayId) {
            command.push('--filter');
            command.push(`label=Ferrum_Gateway_Id=${gatewayId}`);

        }
        command.push('--format');
        command.push(`{{.ID}} {{.Image}} {{.Names}}`);

        const output = await this.executeSpawn(command[0], command.slice(1)) as string;
        //const output2 = await this.execute(`docker ps --no-trunc  --filter status=running ${gatewayId ? '--filter label=Ferrum_Gateway_Id=' + gatewayId : ''} --format "{{.ID}} {{.Image}} {{.Names}}"`) as string;
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
        let pageSize = 50;
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
                if (finded) {
                    finded.details = x;
                    const serviceId = x.Config?.Labels.Ferrum_Svc_Id;
                    const lastUpdate = x.Config?.Labels.Ferrum_Svc_LastUpdate;
                    const port = Number(x.Config?.Labels.Ferrum_Svc_Port) || 0;
                    const isTcp = x.Config?.Labels.Ferrum_Svc_IsTcp == 'true' ? true : false;
                    const isUdp = x.Config?.Labels.Ferrum_Svc_IsUdp == 'true' ? true : false;
                    const replica = Number(x.Config?.Labels.Ferrum_Svc_Replica) || 0;
                    const gatewayId = x.Config?.Labels.Ferrum_Gateway_Id;
                    finded.svc = { id: serviceId, port: port, isTcp: isTcp, isUdp: isUdp, replica: replica, lastUpdate: lastUpdate, gatewayId: gatewayId };

                }
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