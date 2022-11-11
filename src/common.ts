
import log4js from 'log4js';


log4js.configure({
    appenders: { out: { type: 'stdout', layout: { type: 'pattern', pattern: '[%d] [%p] %c - %m' } } },
    categories: { default: { appenders: ['out'], level: process.env.LOG_LEVEL?.toString() || 'info' } }
});

/**
 * @description log4js instance for logging
 * @example logger.error() logger.info() logger.warn() logger.fatal()
 */
export const logger = log4js.getLogger();







