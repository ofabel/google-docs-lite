import * as pako from 'pako';

export type Protocol = 'ws' | 'wss' | 'mqtt';

export type Config = {
  readonly host: string;
  readonly port: number;
  readonly protocol: Protocol;
  readonly username: string;
  readonly password: string;
  readonly clientId: string;
  readonly topicPrefix?: string;
  readonly path?: string;
  readonly revision: string;
  readonly minLatency: number;
  readonly maxLatency: number;
  readonly compressionThreshold: number;
  readonly compressionLevel: pako.DeflateOptions['level'];
  readonly defaultOnEchoCallbackTimeout: number;
  readonly defaultOnResponseCallbackTimeout: number;
}
