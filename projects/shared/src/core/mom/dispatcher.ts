import * as mqtt from 'mqtt';
import * as uid from '../uid';
import * as log from '../log';
import * as msg from '../msg';
import {EncoderConfig} from '../msg';
import * as util from '../util';
import {delay, LookupTable, waitUntil} from '../util';
import {Config} from './config';

export type OnMessagePublished<T> = (message: msg.Message<T>) => void;

export type OnMessagePublishError<T> = (message: msg.Message<T>, error?: Error) => void;

export type OnMessageReceive<T> = (message: msg.Message<T>, isEcho: boolean) => void;

export type UnregisterListenerCallback = () => boolean;

export type IDispatcherSubscribeOptions<T> = {
  readonly topic: string;

  /**
   * @default true
   */
  readonly echoAllowed?: boolean;

  /**
   * @default 2
   */
  readonly qos?: 0 | 1 | 2;

  readonly onMessagePublished?: OnMessagePublished<T>; // FIXME use or remove

  readonly onMessagePublishError?: OnMessagePublishError<T>; // FIXME use or remove

  readonly onMessageReceive?: OnMessageReceive<T>;
};

export type IDispatcherPublishOptions<T, R> = {
  readonly message: msg.Message<T>;

  readonly onEcho?: OnMessageReceive<T>;

  readonly onResponse?: OnMessageReceive<R>;

  readonly onEchoTimeoutError?: OnMessagePublishError<T>;

  readonly onResponseTimeoutError?: OnMessagePublishError<T>;

  readonly onCancel?: OnMessagePublishError<T>;

  readonly onEchoTimeout?: number;

  readonly onResponseTimeout?: number;
};

export type CancelResponseCallback = () => void;

export type IDispatcherPublishResult<T> = {
  readonly message: msg.Message<T>;

  readonly error?: Error;

  readonly cancel: CancelResponseCallback;
}

export type IDispatcher = {
  readonly clientId: string;

  get online(): boolean;

  get offline(): boolean;

  get ready(): boolean;

  get activeClients(): string[];

  whenOnline(): Promise<void>;

  whenOffline(): Promise<void>;

  whenReady(): Promise<void>;

  isActiveClient(client: string): boolean;

  destroy(force?: boolean): Promise<void>;

  on(event: DestroyEvent, callback: OnDestroyCallback): UnregisterListenerCallback;

  on(event: OnlineEvent, callback: OnOnlineCallback): UnregisterListenerCallback;

  on(event: OfflineEvent, callback: OnOfflineCallback): UnregisterListenerCallback;

  on(event: ClientHelloEvent, callback: OnClientHelloCallback): UnregisterListenerCallback;

  on(event: ClientByeEvent, callback: OnClientByeCallback): UnregisterListenerCallback;

  subscribe<T>(opts: IDispatcherSubscribeOptions<T>): Promise<boolean>;

  unsubscribe(topic: string): Promise<boolean>;

  publish<T, R>(opts: IDispatcherPublishOptions<T, R>): Promise<IDispatcherPublishResult<T>>;

  publish<T>(opts: msg.Message<T>): Promise<IDispatcherPublishResult<T>>;
};

export type HelloAction = 'hello';

export type ByeAction = 'bye';

export type ControlActions = HelloAction | ByeAction;

export type DestroyEvent = 'destroy';

export type OnlineEvent = 'online';

export type OfflineEvent = 'offline';

export type ClientHelloEvent = 'hello';

export type ClientByeEvent = 'bye';

export type Events = DestroyEvent | OnlineEvent | OfflineEvent | ClientHelloEvent | ClientByeEvent;

export type OnDestroyCallback = (clientId: string) => void;

export type OnOnlineCallback = (clientId: string) => void;

export type OnOfflineCallback = (clientId: string) => void;

export type OnClientHelloCallback = (clientId: string) => void;

export type OnClientByeCallback = (clientId: string) => void;

export type OnEventCallback = OnDestroyCallback | OnOnlineCallback | OnOfflineCallback | OnClientHelloCallback | OnClientByeCallback;

export type CallbackRegistryEntry<T, R> = {
  readonly callback: OnMessageReceive<R>;

  readonly timeout: number | NodeJS.Timeout;

  readonly timeoutErrorHandler?: OnMessagePublishError<T>;

  remainingAttempts: number;
};

export class Dispatcher implements IDispatcher {
  public readonly clientId: string;
  public readonly acceptedRevision: string;

  private readonly log = log.getLogger('dispatcher');

  private readonly latency: () => Promise<void>;

  private readonly client: mqtt.Client;

  private readonly topicPrefix: string;
  private readonly topicRegistry: Map<string, IDispatcherSubscribeOptions<any>> = new Map(); // eslint-disable-line

  private readonly messageEchoCallbackRegistry: Map<string, CallbackRegistryEntry<any, any>> = new Map(); // eslint-disable-line
  private readonly messageResponseCallbackRegistry: Map<string, CallbackRegistryEntry<any, any>> = new Map(); // eslint-disable-line

  private readonly defaultOnEchoCallbackTimeout: number;
  private readonly defaultOnResponseCallbackTimeout: number;

  private readonly controlBroadcastTopic = '/wodss/mom/public/dispatcher/control/broadcast';
  private readonly controlResponseTopic: string;
  private readonly activeClientsRegistry: Set<string> = new Set();

  private readonly encoderConfig: EncoderConfig;

  private subscribedToControlTopic = false;

  private readyFlag = false;
  private onlineFlag = false;
  private offlineFlag = true;

  private readonly eventListenerCallbackRegistry: LookupTable<Events, Map<string, OnEventCallback>> = {
    'destroy': new Map(),
    'online': new Map(),
    'offline': new Map(),
    'hello': new Map(),
    'bye': new Map()
  };

  private constructor(config: Config) {
    this.clientId = uid.validate(config.clientId) ? uid.slug(config.clientId) : uid.slug(config.clientId, '9b99da0c-d7db-4e78-a62a-441d4dbfe1f5');
    this.acceptedRevision = config.revision;
    this.latency = this.latencySimulation(config.minLatency, config.maxLatency);
    this.topicPrefix = Dispatcher.normalizeTopic(config.topicPrefix ?? '');
    this.controlResponseTopic = `/wodss/mom/public/dispatcher/control/${this.clientId}`;
    this.defaultOnEchoCallbackTimeout = config.defaultOnEchoCallbackTimeout;
    this.defaultOnResponseCallbackTimeout = config.defaultOnResponseCallbackTimeout;

    this.encoderConfig = {
      level: config.compressionLevel,
      compressionThreshold: config.compressionThreshold ?? -1
    };

    this.client = this.getConnectedClient(config)
      .on('message', (topic, payload, packet) => this.handleMessageEvent(topic, payload, packet))
      .on('connect', () => this.handleConnectEvent())
      .on('offline', () => this.handleOfflineEvent())
      .on('disconnect', () => this.handleOfflineEvent());
  }

  public get online(): boolean {
    return this.onlineFlag;
  }

  public get offline(): boolean {
    return this.offlineFlag;
  }

  public get ready(): boolean {
    return this.readyFlag;
  }

  public get activeClients(): string[] {
    return [...this.activeClientsRegistry];
  }

  public whenOnline(): Promise<void> {
    return util.waitUntil(() => this.onlineFlag);
  }

  public whenOffline(): Promise<void> {
    return util.waitUntil(() => this.offlineFlag);
  }

  public whenReady(): Promise<void> {
    return util.waitUntil(() => this.readyFlag);
  }

  public isActiveClient(client: string): boolean {
    return this.activeClientsRegistry.has(client);
  }

  public async destroy(force = false): Promise<void> {
    this.fireEvent('destroy', this.clientId);

    await this.detachAllEventListener();

    await util.waitUntil(() => this.messageResponseCallbackRegistry.size === 0 && this.messageEchoCallbackRegistry.size === 0);

    await this.unsubscribeFromControlMessages();

    for (const [, opts] of this.topicRegistry) {
      await this.unsubscribe(opts.topic);
    }

    this.topicRegistry.clear();

    for (const [, callback] of this.messageEchoCallbackRegistry) {
      clearTimeout(callback.timeout as number);
    }

    this.messageEchoCallbackRegistry.clear();

    for (const [, callback] of this.messageResponseCallbackRegistry) {
      clearTimeout(callback.timeout as number);
    }

    this.messageResponseCallbackRegistry.clear();

    await this.publishByeMessage().catch(util.nop);

    // FIXME refactor event and dispatcher destroy handling

    return new Promise<void>((resolve, reject) => {
      this.client.end(force, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    }).catch(this.log.error);
  }

  private async detachAllEventListener(): Promise<void> {
    try {
      return await waitUntil(() => this.numOfAttachedListeners() === 0, 5000);
    } catch (e) {
      this.log.warn('pending event listeners detected');

      Object.values(this.eventListenerCallbackRegistry).forEach(registry => registry.clear());
    }
  }

  private numOfAttachedListeners(): number {
    return Object.values(this.eventListenerCallbackRegistry)
      .map(listeners => listeners.size)
      .reduce((sum, current) => sum + current, 0);
  }

  public on(event: Events, callback: OnEventCallback): UnregisterListenerCallback {
    const id = uid.slug();
    const offFunction = () => this.eventListenerCallbackRegistry[event].delete(id);

    this.eventListenerCallbackRegistry[event].set(id, callback);

    return offFunction;
  }

  public async subscribe<T>(opts: IDispatcherSubscribeOptions<T>): Promise<boolean> {
    await this.whenReady();

    return this.subscribeInternal(opts);
  }

  private async subscribeInternal<T>(opts: IDispatcherSubscribeOptions<T>): Promise<boolean> {
    const topic = this.getTopicWithPrefix(opts.topic);
    const qos = opts.qos ?? 2;
    const echoAllowed = opts.echoAllowed ?? true;
    const mqttOpts: mqtt.IClientSubscribeOptions = {
      qos: qos,
      nl: !echoAllowed, // invert, because nl means no local
    };

    if (this.topicRegistry.has(topic)) {
      this.log.debug(`topic ${topic} is already registered`);

      return false;
    }

    await this.latency();

    return new Promise((resolve, reject) => {
      this.client.subscribe(topic, mqttOpts, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          this.topicRegistry.set(topic, {
            ...opts,
            qos: qos,
            echoAllowed: echoAllowed
          });

          resolve(true);
        }
      });
    });
  }

  public async unsubscribe(topic: string): Promise<boolean> {
    const prefixedTopic = this.getTopicWithPrefix(topic);

    if (!this.topicRegistry.delete(prefixedTopic)) {
      this.log.debug(`topic ${prefixedTopic} is not registered`);

      return false;
    }

    await this.latency();

    return new Promise((resolve, reject) => {
      this.client.unsubscribe(prefixedTopic, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          resolve(true);
        }
      });
    });
  }

  public async publish<T, R>(optsOrMessage: IDispatcherPublishOptions<T, R> | msg.Message<T>): Promise<IDispatcherPublishResult<T>> {
    const opts = 'message' in optsOrMessage ? optsOrMessage as IDispatcherPublishOptions<T, R> : {
      message: optsOrMessage as msg.Message<T>
    };

    if (this.client.disconnecting) {
      this.log.debug('unable to send message, client is disconnecting');

      return {
        message: opts.message,
        error: new Error('client is disconnecting'),
        cancel: util.nop
      }
    }

    await this.whenReady();

    return await this.publishInternal(opts);
  }

  private async publishInternal<T, R>(opts: IDispatcherPublishOptions<T, R>): Promise<IDispatcherPublishResult<T>> {
    await this.latency();

    return new Promise((resolve, reject) => {
      const topic = this.getTopicWithPrefix(opts.message.meta.topic);
      const messageId = opts.message.head.messageId ?? uid.slug(); // FIXME ensure message id is always a valid slug UUID
      const echoAllowed = opts.message.head.echoAllowed;
      const qos = opts.message.meta.qos ?? 2;
      const compress = opts.message.head.compress;
      const replyTo = opts.message.head.replyTo;
      const prefixedReplyTo = replyTo ? this.getTopicWithPrefix(replyTo) : undefined;
      const builder = msg.Builder.from(opts.message, {
        topic: topic,
        messageId: messageId,
        qos: qos,
        timestamp: util.utc(),
        revision: this.acceptedRevision,
        sender: this.clientId
      });

      const messageToSend = builder.build();

      const rawMessage = msg.encode<T>(messageToSend, this.encoderConfig);

      const messageToReturn = msg.Builder.from(messageToSend, {
        compress: compress ?? rawMessage.head.compress === 'true',
        contentType: rawMessage.meta.contentType
      }).build();

      const publishOpts: mqtt.IClientPublishOptions = {
        qos: qos,
        properties: {
          userProperties: rawMessage.head,
          contentType: rawMessage.meta.contentType
        }
      };
      const hasEchoCallback = opts.onEcho && echoAllowed;
      const hasResponseCallback = opts.onResponse && replyTo;

      if (hasEchoCallback && !this.topicRegistry.get(topic)?.echoAllowed) {
        const error = new Error('can only use onEcho when subscription to topic exists with echoAllowed enabled');

        reject(error);
      }

      if (hasResponseCallback && prefixedReplyTo && !this.topicRegistry.has(prefixedReplyTo)) {
        const error = new Error('can only use onResponse when subscription to replyTo topic exists');

        reject(error);
      }

      this.client.publish(topic, rawMessage.body as Buffer | string, publishOpts, error => {
        if (error) {
          return reject(error);
        }

        if (hasEchoCallback) {
          this.registerPublishCallback(
            this.messageEchoCallbackRegistry,
            messageToReturn,
            opts.onEcho,
            opts.onEchoTimeoutError,
            opts.onEchoTimeout ?? this.defaultOnEchoCallbackTimeout,
            0);
        }

        if (hasResponseCallback) {
          this.registerPublishCallback(
            this.messageResponseCallbackRegistry,
            messageToReturn,
            opts.onResponse,
            opts.onResponseTimeoutError,
            opts.onResponseTimeout ?? this.defaultOnResponseCallbackTimeout,
            0);
        }

        resolve({
          message: messageToReturn,
          cancel: () => this.cancelMessageHandlers(messageToReturn, opts.onCancel)
        });
      });
    });
  }

  private registerPublishCallback<T, R>(registry: Map<string, CallbackRegistryEntry<T, R>>, message: msg.Message<T>, callback: OnMessageReceive<R>, errorHandler: OnMessagePublishError<T> | undefined, timeout: number, attempts: number) {
    const messageId = message.head.messageId;

    registry.set(messageId, {
      callback: callback,
      timeout: setTimeout(() => this.handleOnMessageTimeoutError(registry, message), timeout),
      timeoutErrorHandler: errorHandler,
      remainingAttempts: attempts
    });
  }

  private cancelMessageHandlers<T>(message: msg.Message<T>, onCancelHandler?: OnMessagePublishError<T>): void {
    const id = message.head.messageId;
    const echoTimeout = this.messageEchoCallbackRegistry.get(id)?.timeout as number ?? 0;
    const responseTimeout = this.messageResponseCallbackRegistry.get(id)?.timeout as number ?? 0;

    clearTimeout(echoTimeout);
    clearTimeout(responseTimeout);

    this.messageEchoCallbackRegistry.delete(id);
    this.messageResponseCallbackRegistry.delete(id);

    if (onCancelHandler) {
      onCancelHandler(message);
    } else {
      this.log.debug('message canceled without a onCancel handler registered');
    }
  }

  private handleOnMessageTimeoutError<T, R>(registry: Map<string, CallbackRegistryEntry<T, R>>, message: msg.Message<T>) {
    const messageId = message.head.messageId;
    const config = registry.get(messageId);

    if (!config) {
      // this should never be the case

      this.log.debug(`callback registry entry for ${messageId} not found`);

      throw new Error(`callback registry entry for ${messageId} not found`);
    }

    registry.delete(messageId);

    const error = new Error(`callback timeout reached for message ${messageId} on topic ${message.meta.topic}`);

    if (!config.timeoutErrorHandler) {
      throw error;
    }

    config.timeoutErrorHandler(message, error);
  }

  private async handleMessageEvent(topic: string, payload: Buffer, packet: mqtt.IPublishPacket): Promise<void> {
    const opts = this.topicRegistry.get(topic);

    if (!opts) {
      // no handler registered for this topic
      return;
    }

    await this.latency();

    const meta: msg.Meta = {
      contentType: packet.properties?.contentType as msg.ContentType ?? 'string',
      topic: packet.topic,
      qos: packet.qos
    };

    const rawHead = packet.properties?.userProperties ?? {} as msg.RawHead;
    const message = msg.decode(meta, rawHead, payload);
    const sender = message.head.sender;

    if (!this.canHandleMessage(opts, message.head)) {
      // cannot handle message
      return;
    }

    const isEcho = sender === this.clientId;
    const onEchoConfig = this.messageEchoCallbackRegistry.get(message.head.messageId);
    const onResponseConfig = this.messageResponseCallbackRegistry.get(message.head.ref as string);

    // clear timeout before calling handlers to prevent timeout errors
    clearTimeout(onEchoConfig?.timeout as number);
    clearTimeout(onResponseConfig?.timeout as number);

    // call the onReceive handler
    if (opts?.onMessageReceive) {
      opts.onMessageReceive(message, isEcho);
    }

    // execute the onEcho callback
    if (onEchoConfig) {
      this.messageEchoCallbackRegistry.delete(message.head.messageId);

      onEchoConfig.callback(message, isEcho);
    }

    // execute the onResponse callback
    if (onResponseConfig) {
      this.messageResponseCallbackRegistry.delete(message.head.ref as string);

      onResponseConfig.callback(message, false);
    }
  }

  private canHandleMessage<T>(opts: IDispatcherSubscribeOptions<T>, {echoAllowed, sender, receiver, revision}: msg.Head): boolean {
    if (revision !== this.acceptedRevision) {
      this.log.warn(`message from ${sender} has a incompatible revision ${revision}`);

      return false;
    }

    if (echoAllowed ?? opts.echoAllowed) {
      return true;
    }

    if (this.clientId === receiver) {
      return true;
    }

    return sender !== this.clientId;
  }

  private async handleConnectEvent(): Promise<void> {
    this.onlineFlag = true;
    this.offlineFlag = false;

    this.activeClientsRegistry.add(this.clientId);

    await this.subscribeToControlMessages();
    await this.publishHelloMessage();

    this.readyFlag = true;

    this.fireEvent('online', this.clientId);
  }

  private async handleOfflineEvent(): Promise<void> {
    this.onlineFlag = false;
    this.offlineFlag = true;

    this.fireEvent('offline', this.clientId);
  }

  private getConnectedClient(config: Config): mqtt.Client {
    const lastWillMessage = new msg.Builder<ByeAction>({
      messageId: uid.slug(),
      body: 'bye',
      sender: this.clientId,
      timestamp: util.utc(),
      revision: config.revision
    }).build();
    const rawLastWillMessage = msg.encode(lastWillMessage, this.encoderConfig);
    const lastWillTopic = this.getTopicWithPrefix(this.controlBroadcastTopic);

    // eslint-disable-next-line
    // @ts-ignore
    return mqtt.connect({
      host: config.host,
      hostname: config.host,
      path: config.path,
      port: config.port,
      protocol: config.protocol,
      protocolVersion: 5,
      username: config.username,
      password: config.password,
      clientId: config.clientId,
      autoUseTopicAlias: true,
      will: {
        payload: rawLastWillMessage.body as string,
        topic: lastWillTopic,
        qos: 2,
        retain: false,
        properties: {
          contentType: rawLastWillMessage.meta.contentType,
          userProperties: rawLastWillMessage.head
        }
      }
    });
  }

  private async publishHelloMessage(): Promise<void> {
    const message = new msg.Builder()
      .withTopic(this.controlBroadcastTopic)
      .withReplyTo(this.controlResponseTopic)
      .withBody('hello')
      .build();

    await this.publishInternal({message: message});
  }

  private async publishByeMessage(): Promise<void> {
    const message = new msg.Builder()
      .withTopic(this.controlBroadcastTopic)
      .withBody('bye')
      .build();

    await this.publishInternal({message: message});
  }

  private async subscribeToControlMessages(): Promise<boolean> {
    if (this.subscribedToControlTopic) {
      return false;
    }

    await this.subscribeInternal({
      topic: this.controlResponseTopic,
      echoAllowed: false,
      onMessageReceive: (message: msg.Message<ControlActions>) => this.handleControlMessage(false, message)
    });

    await this.subscribeInternal({
      topic: this.controlBroadcastTopic,
      echoAllowed: false,
      onMessageReceive: (message: msg.Message<ControlActions>) => this.handleControlMessage(true, message)
    });

    this.subscribedToControlTopic = true;

    return true;
  }

  private async unsubscribeFromControlMessages(): Promise<boolean> {
    if (!this.subscribedToControlTopic) {
      return false;
    }

    await this.unsubscribe(this.controlBroadcastTopic);
    await this.unsubscribe(this.controlResponseTopic);

    this.subscribedToControlTopic = false;

    return true;
  }

  private async handleControlMessage(isBroadcast: boolean, message: msg.Message<ControlActions>): Promise<void> {
    const sender = message.head.sender;

    switch (message.body) {
      case 'hello':
        this.activeClientsRegistry.add(sender);

        this.log.info(`hello from client ${sender} received`);

        this.fireEvent('hello', sender);

        if (isBroadcast) {
          const response = msg.Builder.replyTo(message)
            .withBody('hello')
            .build();
          await this.publish(response);
        }

        break;
      case 'bye':
        this.activeClientsRegistry.delete(sender);

        this.log.info(`bye from client ${sender} received`);

        this.fireEvent('bye', sender);

        break;
      default:
        this.log.warn(`invalid control action ${message.body} received from ${sender}`);
        break;
    }
  }

  private getTopicWithPrefix(topic: string): string {
    return Dispatcher.normalizeTopic(this.topicPrefix, topic);
  }

  private fireEvent(event: Events, arg: any, ...args: []): void { // eslint-disable-line
    this.eventListenerCallbackRegistry[event].forEach(callback => callback(arg, ...args));
  }

  private latencySimulation(min: number, max: number): () => Promise<void> {
    if (max === 0 || min > max) {
      return async () => util.nop();
    }
    return () => delay(Math.random() * max + min);
  }

  public static normalizeTopic(...segments: string[]) {
    const normalizedSegments = [];

    for (const segment of segments) {
      const normalizedSegment = segment
        .trim()
        .replace(/^\/*/, '')
        .replace(/\/*$/, '');
      if (normalizedSegment.length > 0) {
        normalizedSegments.push(normalizedSegment);
      }
    }

    return normalizedSegments.length > 0 ? '/' + normalizedSegments.join('/') : '';
  }

  public static init(config: Config): [dispatcher: IDispatcher, promise: Promise<IDispatcher>] {
    const dispatcher = new Dispatcher(config);

    const promise = dispatcher.whenReady().then(() => dispatcher);

    return [dispatcher, promise];
  }
}
