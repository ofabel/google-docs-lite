import * as pako from 'pako';
import {getLogger} from '../log';
import {LookupTable, Writeable} from '../util';
import {Builder, MessageBuilderOptions} from './builder';
import {ContentType, Head, Message, Meta, RawHead, RawMessage} from './message';

const logger = getLogger('marshal');

const headEncoderMapping: LookupTable<keyof Head, (value: any) => string> = { // eslint-disable-line
  sender: v => v,
  receiver: v => v,
  messageId: v => v,
  echoAllowed: JSON.stringify,
  ref: v => v,
  replyTo: v => v,
  compress: JSON.stringify,
  timestamp: (v: number) => v.toString(),
  revision: v => v
}

const headDecoderMapping: LookupTable<keyof Head, (value: string) => any> = { // eslint-disable-line
  sender: v => v,
  receiver: v => v,
  messageId: v => v,
  echoAllowed: JSON.parse,
  ref: v => v,
  replyTo: v => v,
  compress: JSON.parse,
  timestamp: v => parseInt(v),
  revision: v => v
};

const bodyEncoderMapping: LookupTable<ContentType, ((value: Uint8Array) => Uint8Array) | ((value: any) => string)> = { // eslint-disable-line
  'string': (v: string) => v,
  'boolean': JSON.stringify,
  'number': JSON.stringify,
  'object': JSON.stringify,
  'undefined': () => '',
  'Uint8Array': (v: Uint8Array) => v,
};

const bodyDecoderMapping: LookupTable<ContentType, ((value: Buffer) => Uint8Array) | ((value: string) => any)> = { // eslint-disable-line
  'string': (v: string) => v,
  'boolean': JSON.parse,
  'number': JSON.parse,
  'object': JSON.parse,
  'undefined': () => undefined,
  'Uint8Array': (v: Buffer) => new Uint8Array(v)
};

export type EncoderConfig = {
  compressionThreshold: number;
} & pako.DeflateOptions;

export const defaultEncoderConfig: EncoderConfig = {
  compressionThreshold: -1
}

export function encode<T>({meta, head, body}: Message<T>, config: EncoderConfig = defaultEncoderConfig): RawMessage {
  const contentType = body instanceof Uint8Array ? 'Uint8Array' : typeof body as ContentType;
  const rawHead: Partial<Writeable<RawHead>> = {};
  const bodyEncoder = bodyEncoderMapping[contentType];
  const rawBody = bodyEncoder(body as any); // eslint-disable-line
  const compress = head.compress ?? (config.compressionThreshold >= 0 && rawBody.length >= config.compressionThreshold);
  const encodedBody = compress ? pako.deflate(rawBody, config) : rawBody;

  for (const [key, value] of Object.entries(head)) {
    if (value !== undefined) {
      rawHead[key as keyof Head] = headEncoderMapping[key as keyof Head](value);
    }
  }

  if (compress) {
    logger.debug(`compress message with size ${rawBody.length} bytes to ${encodedBody.length} bytes`);

    rawHead.compress = JSON.stringify(compress);
  }

  return {
    meta: {
      ...meta,
      contentType: contentType,
    },
    head: rawHead,
    body: encodedBody
  };
}

export function decode<T>(meta: Meta, rawHead: RawHead, payload: Buffer): Message<T> {
  const contentType = meta.contentType;
  const bodyDecoder = bodyDecoderMapping[contentType];
  const opts: Partial<Writeable<MessageBuilderOptions<T>>> = {
    ...meta
  };

  for (const [key, value] of Object.entries(rawHead)) {
    opts[key as keyof Head] = headDecoderMapping[key as keyof Head](value);
  }

  const inflateOpts: pako.InflateFunctionOptions = {
    to: contentType === 'Uint8Array' ? undefined : 'string'
  };

  const rawBody: any = contentType === 'Uint8Array' || opts.compress ? payload : payload.toString(); // eslint-disable-line

  const encodedBody = opts.compress ? pako.inflate(rawBody, inflateOpts) : rawBody;

  if (opts.compress) {
    logger.debug(`decompress message with size ${payload.length} bytes to ${encodedBody.length} bytes`);
  }

  opts.body = bodyDecoder(encodedBody);

  return new Builder(opts).build();
}
