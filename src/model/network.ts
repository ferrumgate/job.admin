/**
 * @remark this code comes from rest.portal
 */
export interface Gateway {
    id: string;
    name: string;
    labels: string[];
    networkId?: string;
    isEnabled?: boolean;
    insertDate: string;
    updateDate: string;
}



/**
 * @remark this code comes from rest.portal
 */
export interface Network {
    id: string;
    name: string;
    labels: string[];
    clientNetwork: string;
    serviceNetwork: string;
    insertDate: string;
    updateDate: string;
    isEnabled?: boolean;

}