import * as uid from './uid';

export * as db from './db';
export * as hub from './hub';
export * as log from './log';
export * as mom from './mom';
export * as msg from './msg';
export * as store from './store';
export * as util from './util';
export * as uid from './uid';

export const INSTANCE_ID = process.env.WODSS_INSTANCE_ID ?? uid.slug();
