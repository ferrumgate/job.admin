/**
 * @summary tunnel session
 * when a tunnel is created, also this data is created
 * this class comes from rest.portal project
 */
export interface Tunnel {
    // a unique 64 byte random string
    id?: string;
    // assigned interface name
    tun?: string;
    //connected client id
    clientIp?: string;
    trackId?: number;
    // peer client ip
    assignedClientIp?: string;
    // authenticated user id
    userId?: string;
    // authentication time
    authenticatedTime?: string;
    // host id
    hostId?: string
    // service network
    serviceNetwork?: string;

}