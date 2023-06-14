import * as util from '../util';
import {Head, Message, Meta} from './message';

export type MessageBuilderHeadOptions = {
  readonly [Property in keyof Head]: Head[Property];
}

export type MessageBuilderMetaOptions = {
  readonly [Property in keyof Meta]: Meta[Property];
}

export type MessageBuilderBodyOptions<T> = {
  readonly body: T;
}

export type MessageBuilderOptions<T> =
  MessageBuilderHeadOptions
  & MessageBuilderMetaOptions
  & MessageBuilderBodyOptions<T>;

export type IBuilder<Type> = {
  build(): Type;
}

export type IOptionsBuilder<Type, Options> = IBuilder<Type> & {
  -readonly [Property in keyof Options as `with${Capitalize<string & Property>}`]: (value: Options[Property]) => IOptionsBuilder<Type, Options>;
}

export class Builder<T> implements IOptionsBuilder<Message<T>, Omit<MessageBuilderOptions<T>, 'sender' | 'contentType' | 'timestamp' | 'revision'>> { // FIXME exclude messageId
  private readonly options: Partial<util.Writeable<MessageBuilderOptions<T>>>;

  constructor(opts: Partial<MessageBuilderOptions<T>> = {}) {
    this.options = opts;
  }

  public withTopic(topic: MessageBuilderOptions<T>['topic']): Builder<T> {
    this.options.topic = topic;

    return this;
  }

  public withReceiver(receiver: MessageBuilderOptions<T>['receiver']): Builder<T> {
    this.options.receiver = receiver;

    return this;
  }

  public withMessageId(messageId: MessageBuilderOptions<T>['messageId']): Builder<T> {
    this.options.messageId = messageId;

    return this;
  }

  public withEchoAllowed(echo: MessageBuilderOptions<T>['echoAllowed']): Builder<T> {
    this.options.echoAllowed = echo;

    return this;
  }

  public withRef(ref: MessageBuilderOptions<T>['ref']): Builder<T> {
    this.options.ref = ref;

    return this;
  }

  public withReplyTo(replyTo: MessageBuilderOptions<T>['replyTo']): Builder<T> {
    this.options.replyTo = replyTo;

    return this;
  }

  public withCompress(compress: MessageBuilderOptions<T>['compress']): Builder<T> {
    this.options.compress = compress;

    return this;
  }

  public withQos(qos: MessageBuilderOptions<T>['qos']): Builder<T> {
    this.options.qos = qos;

    return this;
  }

  public withBody(body: MessageBuilderOptions<T>['body']): Builder<T> {
    this.options.body = body;

    return this;
  }

  public build(): Message<T> {
    const {
      body,
      ...rest
    } = this.options as MessageBuilderOptions<T>;

    const {
      topic,
      contentType,
      qos,
      ...head
    } = rest;

    const meta: Meta = {
      topic: topic,
      contentType: contentType,
      qos: qos
    };

    return {
      meta: meta,
      head: head,
      body: body
    };
  }

  public static from<T>(message: Message<T>, overrides: Partial<MessageBuilderOptions<T>> = {}): Builder<T> {
    return new Builder({
      ...message.meta,
      ...message.head,
      body: message.body,
      ...overrides
    });
  }

  public static to<T>(topic: string, body: T): Builder<T> {
    return new Builder({
      topic: topic,
      body: body
    });
  }

  public static replyTo<T>(message: Message<unknown>): Builder<T> {
    return new Builder({
      topic: message.head.replyTo,
      ref: message.head.messageId
    });
  }
}
