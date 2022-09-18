import { Tunnel } from "../model/tunnel";

export class HelperService {
    /**
    * @summary check if tunnel session is valid
    * @param ses 
    */
    static isValidTunnel(tun: Tunnel | undefined) {
        if (!tun)
            throw new Error('tunnel is not valid, undefined object');

        if (!tun.authenticatedTime)
            throw new Error('tunnel is not valid, no authenticatedTime');
        if (!tun.tun)
            throw new Error('tunnel is not valid, no tun');
        if (!tun.userId)
            throw new Error('tunnel is not valid, no user');
        if (!tun.assignedClientIp)
            throw new Error('tunnel is not valid, no assignedClientIp');
        if (!tun.hostId)
            throw new Error('tunnel is not valid, no hostId');
        if (!tun.serviceNetwork)
            throw new Error('tunnel is not valid, no serviceNetwork');

    }
}