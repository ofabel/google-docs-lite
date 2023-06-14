export type ContentType = 'object' | 'string' | 'number' | 'boolean' | 'undefined' | 'Uint8Array';

export type Head = {
  readonly sender: string;

  readonly receiver?: string;

  readonly messageId: string;

  readonly echoAllowed?: boolean;

  readonly ref?: string;

  readonly replyTo?: string;

  readonly compress?: boolean;

  readonly timestamp: number;

  readonly revision: string;
}

export type Meta = {
  readonly contentType: ContentType;

  readonly topic: string;

  readonly qos: 0 | 1 | 2;
}

export type Message<T> = {
  readonly head: Head;

  readonly meta: Meta;

  readonly body: T
}

export type RawHead = {
  readonly [Property in keyof Head]?: string;
}

export type RawMessage = {
  readonly meta: Meta;

  readonly head: RawHead;

  readonly body: string | Uint8Array | Buffer;
}
