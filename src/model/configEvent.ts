
/**
 * @summary 
 * @remark this class comes from rest.portal
 */
export interface ConfigEvent {
    type: 'saved' | 'updated' | 'deleted';
    path: string;
    data?: any;
}