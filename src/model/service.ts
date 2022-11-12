/**
 * @summary a target service
 * @remark this code comes from rest.port project
 */
export interface Service {
    id: string;
    name: string;
    labels?: string[];
    tcp?: number;
    udp?: number;
    protocol?: string;
    host: string;
    networkId: string;
    isEnabled: boolean;
    assignedIp: string;
    insertDate: string;
    updateDate: string;

}
