import {Config, defaultConfig} from './config';
import {ILogger} from './logger';
import {Manager} from './manager';

declare global {
  let WODSS_LOG_CONFIG: Config;
}

if (typeof WODSS_LOG_CONFIG === 'undefined') {
  console.warn('global variable WODSS_LOG_CONFIG is not defined, using default config');
}

const manager = new Manager(WODSS_LOG_CONFIG ?? defaultConfig);

export const getLogger: (category?: string) => ILogger = manager.getLogger.bind(manager);
