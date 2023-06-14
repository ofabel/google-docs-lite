import * as uid from '../uid';
import * as mom from '../mom';
import {IDispatcher} from '../mom';
import * as msg from '../msg';
import * as util from '../util';
import {AbstractStore, PatchInternalCallback, Transaction} from './abstract';
import {Lockable, RootStateTree, StateValue} from './state';
import {IStore, OnPatchCallback, PatchCallback, ReadonlyStateError, StoreEvents} from './type';
import * as yjs from './yjs';

export type OnUpdateCallback<S extends RootStateTree> = (store: ISyncStore<S>) => any; // eslint-disable-line

export type OnSyncCallback<S extends RootStateTree> = (store: ISyncStore<S>) => any; // eslint-disable-line

export type OnReadyCallback<S extends RootStateTree> = (store: ISyncStore<S>) => any; // eslint-disable-line

export type OnPauseCallback<S extends RootStateTree> = (store: ISyncStore<S>) => any; // eslint-disable-line

export type OnResumeCallback<S extends RootStateTree> = (store: ISyncStore<S>) => any; // eslint-disable-line

export type OnDestroyCallback = () => any; // eslint-disable-line

export type UpdateEvent = 'update';

export type SyncEvent = 'sync';

export type ReadyEvent = 'ready';

export type DestroyEvent = 'destroy';

export type PauseEvent = 'pause';

export type ResumeEvent = 'resume';

export type SyncStoreEvents = StoreEvents | UpdateEvent | SyncEvent | ReadyEvent | DestroyEvent | PauseEvent | ResumeEvent;

export type ISyncStore<S extends RootStateTree> = IStore<S> & {
  /**
   * Indicate if a store is synchronized.
   */
  get synchronized(): boolean;

  /**
   * Indicate if a store is ready. The store is ready as soon as all relevant topics are subscribed.
   */
  get ready(): boolean;

  /**
   * Indicate if a store is paused.
   */
  get paused(): boolean;

  /**
   * Indicate if a store is destroyed.
   */
  get destroyed(): boolean;

  /**
   * Get the current role of a store.
   */
  get role(): Roles;

  /**
   * Get the store's dispatcher instance.
   */
  get dispatcher(): IDispatcher;

  /**
   * Set the store's role.
   */
  setRole(role: Roles): Promise<boolean>;

  /**
   * Destroy the store instance.
   */
  destroy(): Promise<void>;

  /**
   * Pause the store instance.
   */
  pause(): Promise<boolean>;

  /**
   * Resume a paused instance.
   */
  resume(): Promise<boolean>;

  /**
   * Fulfills when the store is ready.
   */
  whenReady(): Promise<void>;

  /**
   * Subscribe to update events.
   */
  on(event: UpdateEvent, callback: OnUpdateCallback<S>): () => boolean;

  /**
   * Subscribe to sync events.
   */
  on(event: SyncEvent, callback: OnSyncCallback<S>): () => boolean;

  /**
   * Subscribe to ready events.
   */
  on(event: ReadyEvent, callback: OnReadyCallback<S>): () => boolean;

  /**
   * Subscribe to pause events.
   */
  on(event: PauseEvent, callback: OnPauseCallback<S>): () => boolean;

  /**
   * Subscribe to resume events.
   */
  on(event: ResumeEvent, callback: OnResumeCallback<S>): () => boolean;

  /**
   * Subscribe to destroy events.
   */
  on(event: DestroyEvent, callback: OnDestroyCallback): () => boolean;

  /**
   * Force the store to synchronize its state.
   */
  syncState(): Promise<void>;
}

export type UpdateMessage = msg.Message<Uint8Array>;

export type SyncRequestMessage = msg.Message<Uint8Array | undefined>;

export type SyncResponseMessage = msg.Message<Uint8Array>;

export type MutexAction = 'acquire' | 'release'

export type MutexRequest = {
  mutex: string;
  action: MutexAction;
};

export type MutexRequestMessage = msg.Message<MutexRequest>;

export type MutexResponseMessage = msg.Message<string | undefined>;

export type MutexBroadcast = 'switcheroo';

export type MutexBroadcastMessage = msg.Message<MutexBroadcast>;

export type Roles = 'client' | 'server';

export class SyncStore<S extends RootStateTree> extends AbstractStore<S, 'synchronized' | 'ready' | 'paused' | 'destroyed'> implements ISyncStore<S> {
  private currentRole?: Roles;
  private roleToResume?: Roles;

  private readonly updateTopic: string;
  private readonly syncRequestTopic: string;
  private readonly syncResponseTopic: string;
  private readonly mutexRequestTopic: string;
  private readonly mutexResponseTopic: string;
  private readonly mutexBroadcastTopic: string;

  public readonly dispatcher: mom.IDispatcher;

  private unregisterDispatcherByeListener?: mom.UnregisterListenerCallback;
  private readonly unregisterDispatcherDestroyListener: mom.UnregisterListenerCallback;

  private lastUpdate = 0;
  private publishPendingUpdatesTimeout: NodeJS.Timeout | number | undefined;
  private readonly pendingUpdates: Uint8Array[] = [];
  private readonly debounceUpdateMessagesDuration;

  private readonly mutexRequestRegistry: Map<string, mom.CancelResponseCallback> = new Map();

  private readonly updateMessageQoS: 0 | 1 | 2 = parseInt(process.env.WODSS_SYNC_STORE_MQTT_QOS ?? process.env.VUE_APP_WODSS_SYNC_STORE_MQTT_QOS ?? '2') as 0 | 1 | 2;

  private constructor(id: string, type: string, dispatcher: mom.IDispatcher, persist: boolean, debounce: number, role?: Roles, initialState?: S) {
    super(id, type, dispatcher.clientId, persist, initialState);

    this.updateTopic = `/wodss/mom/public/store/${this.id}/update`;
    this.syncRequestTopic = `/wodss/mom/public/store/${this.id}/sync/request`;
    this.syncResponseTopic = `/wodss/mom/public/store/${this.id}/sync/response/${dispatcher.clientId}`;
    this.mutexRequestTopic = `/wodss/mom/public/store/${this.id}/mutex/request`;
    this.mutexResponseTopic = `/wodss/mom/public/store/${this.id}/mutex/response/${dispatcher.clientId}`;
    this.mutexBroadcastTopic = `/wodss/mom/public/store/${this.id}/mutex/broadcast`;

    this.debounceUpdateMessagesDuration = debounce;

    this.dispatcher = dispatcher;

    this.unregisterDispatcherDestroyListener = this.dispatcher.on('destroy', () => this.destroy());

    this.setRole(role).catch(this.log.error);
  }

  public get synchronized(): boolean {
    return !!this.properties.state.synchronized;
  }

  protected set synchronized(synchronized: boolean) {
    this.properties.state.synchronized = synchronized;
  }

  public get ready(): boolean {
    return !!this.properties.state.ready;
  }

  protected set ready(ready: boolean) {
    this.properties.state.ready = ready;
  }

  public get paused(): boolean {
    return !!this.properties.state.paused;
  }

  protected set paused(paused: boolean) {
    this.properties.state.paused = paused;
  }

  public get destroyed(): boolean {
    return !!this.properties.state.destroyed;
  }

  protected set destroyed(destroyed: boolean) {
    this.properties.state.destroyed = destroyed;
  }

  public get role(): Roles {
    return this.currentRole as Roles;
  }

  public async setRole(role?: Roles): Promise<boolean> {
    if (!role || !this.initialized || this.destroyed) {
      return false;
    }

    if (this.currentRole === role) {
      return false;
    }

    return this.performBlockingOperation(async () => {
      await this.dispatcher.whenReady();

      const previousRole = this.currentRole;

      this.currentRole = role;

      if (previousRole !== undefined && previousRole === 'server') {
        await this.unsubscribeFromMutexRequestMessages();
        await this.unsubscribeFromSyncRequestMessages();
      }

      if (previousRole === undefined) {
        await this.subscribeToUpdateMessages();
        await this.subscribeToMutexResponseMessages();
        await this.subscribeToMutexBroadcastMessages();
      }

      if (role === 'server') {
        await this.subscribeToMutexRequestMessages();
        await this.subscribeToSyncRequestMessages();
      }

      if (previousRole === undefined && role === 'client') {
        await this.syncState();
      }

      if (previousRole === undefined && role === 'server') {
        this.synchronized = true;
      }

      if (previousRole === undefined && !this.ready) {
        this.ready = true;

        this.fireEvent('ready', this);
      }

      if (previousRole !== undefined) {
        await this.publishMutexBroadcastMessage('switcheroo');
      }

      this.paused = false;

      return true;
    });
  }

  public async destroy(): Promise<void> {
    this.destroyed = true;

    this.fireEvent('destroy');

    await this.unsubscribeAndUnregister();

    this.unregisterDispatcherDestroyListener();
  }

  protected async unsubscribeAndUnregister(): Promise<void> {
    await this.unsubscribeFromUpdateMessages();
    await this.unsubscribeFromMutexBroadcastMessages();
    await this.unsubscribeFromMutexRequestMessages();
    await this.unsubscribeFromMutexResponseMessages();
    await this.unsubscribeFromSyncRequestMessages();
    await this.unsubscribeFromSyncResponseMessages();

    if (this.unregisterDispatcherByeListener) {
      this.unregisterDispatcherByeListener();
    }
  }

  public async pause(): Promise<boolean> {
    if (!this.ready || this.destroyed || this.paused) {
      return false;
    }

    if (this.currentRole === 'server') {
      this.log.warn('cannot pause a sync store with server role');

      return false;
    }

    this.log.info(`pause store ${this.id}`);

    this.paused = true;

    await util.waitUntil(() => this.pendingUpdates.length === 0);

    await this.unsubscribeAndUnregister();

    this.roleToResume = this.currentRole;
    this.currentRole = undefined;

    this.fireEvent('pause', this);

    return true;
  }

  public async resume(): Promise<boolean> {
    if (!this.ready || !this.paused) {
      return false;
    }

    this.log.info(`resume store ${this.id}`);

    const result = this.setRole(this.roleToResume);

    this.fireEvent('resume', this);

    return result;
  }

  public whenReady(): Promise<void> {
    return util.waitUntil(() => this.ready);
  }

  /**
   * Perform a state mutation through a callback function.
   * After the function call, the mutation will be published through the dispatcher.
   *
   * @param callback A callback function, which performs the state transition.
   * @returns A promise, which resolves when the state mutation is published through the dispatcher.
   */
  public async patch<R>(callback: PatchCallback<S, R>): Promise<R> {
    if (this.readonly) {
      throw new ReadonlyStateError();
    }

    const transaction = await this.transact(() => callback(this.state), 'patch-');

    await this.enqueueUpdateMesssage(transaction);

    this.fireEvent('patch', this);

    return transaction.result;
  }

  public isLocked<T extends StateValue>(lockableOrId: Lockable<T> | string): string | undefined {
    const mutexOwner = super.isLocked(lockableOrId);

    return mutexOwner && this.dispatcher.isActiveClient(mutexOwner) ? mutexOwner : undefined;
  }

  public on(event: SyncStoreEvents, callback: OnPatchCallback<S> | OnUpdateCallback<S> | OnSyncCallback<S> | OnReadyCallback<S> | OnPauseCallback<S> | OnResumeCallback<S> | OnDestroyCallback): () => boolean {
    return this.registerEventListener(event as StoreEvents, callback);
  }

  public async syncState(): Promise<void> {
    await this.subscribeToSyncResponseMessages();

    return new Promise((resolve, reject) => {
      const rawState = this.synchronized ? yjs.encodeStateVector(this.internalStateDoc) : undefined;

      const message = new msg.Builder()
        .withTopic(this.syncRequestTopic)
        .withReplyTo(this.syncResponseTopic)
        .withBody(rawState)
        .build();

      this.dispatcher.publish({
        message: message,
        onResponse: (response: SyncResponseMessage) => this.handleSyncStateResponse(response).then(resolve).catch(reject)
      }).catch(reject);
    });
  }

  protected subscribeToSyncResponseMessages(): Promise<boolean> {
    return this.dispatcher.subscribe({
      topic: this.syncResponseTopic,
      echoAllowed: false
    });
  }

  protected unsubscribeFromSyncResponseMessages(): Promise<boolean> {
    return this.dispatcher.unsubscribe(this.syncResponseTopic);
  }

  private async handleSyncStateResponse({body, head}: SyncResponseMessage): Promise<void> {
    await this.unsubscribeFromSyncResponseMessages();

    await this.applyUpdate(this.internalStateDoc, body, 'sync-', head.messageId, yjs.applyUpdateV1, false);

    this.synchronized = true;

    this.fireEvent('sync', this);
  }

  protected async executeMutexCriticalSection<R>(callback: PatchCallback<S, R>): Promise<R> {
    const transaction = await this.transact(() => callback(this.state), 'mutex-');

    await this.enqueueUpdateMesssage(transaction);

    this.fireEvent('patch', this);

    return transaction.result;
  }

  protected async acquireMutexInternal(mutex: string): Promise<boolean> {
    const mutexOwner = this.isLocked(mutex);
    if (mutexOwner !== undefined) {
      return mutexOwner === this.owner;
    }

    return this.publishMutexRequestMessage(mutex, 'acquire', (owner) => this.isLocked(mutex) === owner && owner === this.owner);
  }

  protected async releaseMutexInternal(mutex: string): Promise<boolean> {
    const mutexOwner = this.isLocked(mutex);
    if (mutexOwner !== this.owner) {
      return true;
    }

    return this.publishMutexRequestMessage(mutex, 'release', (owner) => this.isLocked(mutex) === owner && owner !== this.owner);
  }

  protected publishMutexRequestMessage(mutex: string, action: MutexAction, onResponse: (mutexOwner: string | undefined) => boolean): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const reference = uid.short();
      const message = new msg.Builder<MutexRequest>()
        .withTopic(this.mutexRequestTopic)
        .withReplyTo(this.mutexResponseTopic)
        .withBody({
          action: action,
          mutex: mutex
        }).build();

      this.dispatcher.publish({
        message: message,
        onResponse: ({body}: MutexResponseMessage) => this.handleMutexResponseMessage(reference, resolve, onResponse(body)),
        onResponseTimeoutError: () => this.handleMutexResponseMessage(reference, resolve, false),
        onCancel: () => this.handleMutexResponseMessage(reference, resolve, false)
      }).then(result => {
        this.mutexRequestRegistry.set(reference, result.cancel);
      }).catch(error => {
        this.mutexRequestRegistry.delete(reference);

        reject(error);
      });
    });
  }

  protected handleMutexResponseMessage(reference: string, resolve: (result: boolean) => void, result: boolean) {
    this.mutexRequestRegistry.delete(reference);

    resolve(result);
  }

  protected async handleUnresolvedUpdateEvent(update: Uint8Array, origin?: string): Promise<void> {
    const transaction: Transaction = {
      update: update,
      origin: origin ?? 'unresolved-update-' + uid.short(),
      result: undefined
    };

    await this.enqueueUpdateMesssage(transaction);
  }

  protected async patchInternal<R>(callback: PatchInternalCallback<S, R>): Promise<R> {
    const {update, result} = await this.transact(() => callback(this.internalState), 'patch-internal-');

    await this.publishUpdateMessage(update);

    return result;
  }

  protected async enqueueUpdateMesssage<R>({update}: Transaction<R>): Promise<void> {
    this.pendingUpdates.push(update);

    if (Date.now() - this.lastUpdate < this.debounceUpdateMessagesDuration) {
      clearTimeout(this.publishPendingUpdatesTimeout as number);

      this.publishPendingUpdatesTimeout = setTimeout(() => this.dequeuePendingUpdates(), this.debounceUpdateMessagesDuration);
    } else {
      await this.dequeuePendingUpdates();
    }
  }

  protected async dequeuePendingUpdates(): Promise<void> {
    const updatesToMerge = this.pendingUpdates.splice(0, this.pendingUpdates.length);
    const mergedUpdates = yjs.mergeUpdates(updatesToMerge);

    this.lastUpdate = Date.now();

    await this.publishUpdateMessage(mergedUpdates);
  }

  protected async publishUpdateMessage(update: Uint8Array): Promise<void> {
    const message = new msg.Builder<UpdateMessage['body']>()
      .withTopic(this.updateTopic)
      .withBody(update)
      .withQos(this.updateMessageQoS)
      .build();

    await this.dispatcher.publish(message);
  }

  protected unsubscribeFromUpdateMessages(): Promise<boolean> {
    return this.dispatcher.unsubscribe(this.updateTopic);
  }

  protected subscribeToUpdateMessages(): Promise<boolean> {
    return this.dispatcher.subscribe({
      topic: this.updateTopic,
      echoAllowed: false,
      onMessageReceive: ({head, body}: UpdateMessage) => this.handleUpdateMessage(body, head.messageId)
    });
  }

  protected async handleUpdateMessage(update: Uint8Array, origin: string): Promise<void> {
    await this.applyUpdate(this.internalStateDoc, update, 'update-from-', origin);

    this.fireEvent('update', this);
  }

  protected unsubscribeFromSyncRequestMessages(): Promise<boolean> {
    return this.dispatcher.unsubscribe(this.syncRequestTopic);
  }

  protected subscribeToSyncRequestMessages(): Promise<boolean> {
    return this.dispatcher.subscribe({
      topic: this.syncRequestTopic,
      onMessageReceive: (message: SyncRequestMessage) => this.handleSyncRequestMessage(message)
    });
  }

  protected async handleSyncRequestMessage(request: SyncRequestMessage): Promise<void> {
    const update = yjs.encodeStateAsUpdateV1(this.internalStateDoc, request.body);

    const response = msg.Builder.replyTo(request)
      .withReceiver(request.head.sender)
      .withBody(update)
      .build();

    await this.dispatcher.publish(response);
  }

  protected async maintainMutexRegistry(removedClient: string): Promise<void> {
    await this.patchInternal(state => {
      const acquiredMutexes = Object.keys(state.userMutexRegistry[removedClient] ?? {});

      for (const mutex of acquiredMutexes) {
        if (state.mutexRegistry[mutex] === removedClient) {
          try {
            delete state.mutexRegistry[mutex];
          } catch (error) {
            // NOP
          }
        }
      }

      try {
        delete state.userMutexRegistry[removedClient];
      } catch (error) {
        // NOP
      }
    });
  }

  protected unsubscribeFromMutexRequestMessages(): Promise<boolean> {
    if (this.unregisterDispatcherByeListener) {
      this.unregisterDispatcherByeListener();
    }

    return this.dispatcher.unsubscribe(this.mutexRequestTopic);
  }

  protected async subscribeToMutexRequestMessages(): Promise<boolean> {
    if (this.unregisterDispatcherByeListener) {
      this.unregisterDispatcherByeListener();
    }

    this.unregisterDispatcherByeListener = this.dispatcher.on('bye', clientId => this.maintainMutexRegistry(clientId));

    return this.dispatcher.subscribe({
      topic: this.mutexRequestTopic,
      echoAllowed: true,
      onMessageReceive: (message: MutexRequestMessage) => this.handleMutexRequestMessage(message)
    });
  }

  protected async handleMutexRequestMessage(request: MutexRequestMessage): Promise<void> {
    const {
      action,
      mutex
    } = request.body;
    const sender = request.head.sender;

    let success = false;

    if (action === 'acquire' && this.mutexRegistry[mutex] === undefined) {
      success = await this.patchInternal(state => {
        state.mutexRegistry[mutex] = state.mutexRegistry[mutex] === undefined ? sender : state.mutexRegistry[mutex];

        if (!state.userMutexRegistry[sender]) {
          state.userMutexRegistry[sender] = {};
        }

        state.userMutexRegistry[sender][mutex] = true;

        return state.mutexRegistry[mutex] === sender;
      });
    } else if (action === 'release' && this.mutexRegistry[mutex] === sender) {
      success = await this.patchInternal(state => {
        try {
          delete state.mutexRegistry[mutex];
        } catch (error) {
          // NOP
        }

        try {
          delete state.userMutexRegistry[sender][mutex];
        } catch (error) {
          // NOP
        }

        return true;
      });
    }

    this.log.debug(`client ${sender} ${action}s mutex ${mutex} ${success ? 'successful' : 'not successful'}`);

    const response = msg.Builder.replyTo(request)
      .withReceiver(sender)
      .withBody(this.mutexRegistry[mutex])
      .build();

    await this.dispatcher.publish(response);
  }

  protected unsubscribeFromMutexResponseMessages(): Promise<boolean> {
    return this.dispatcher.unsubscribe(this.mutexResponseTopic);
  }

  protected subscribeToMutexResponseMessages(): Promise<boolean> {
    return this.dispatcher.subscribe({
      topic: this.mutexResponseTopic,
      echoAllowed: true
    });
  }

  protected cancelAllPendingMutexRequests(): void {
    this.mutexRequestRegistry.forEach(callback => callback());

    this.mutexRequestRegistry.clear();
  }

  protected async publishMutexBroadcastMessage(message: MutexBroadcast): Promise<void> {
    const broadcast = msg.Builder.to(this.mutexBroadcastTopic, message).build();

    await this.dispatcher.publish(broadcast);
  }

  protected handleMutexBroadcastMessage(message: MutexBroadcast) {
    if (message === 'switcheroo' && this.role === 'client') {
      this.cancelAllPendingMutexRequests();
    }
  }

  protected subscribeToMutexBroadcastMessages(): Promise<boolean> {
    return this.dispatcher.subscribe({
      topic: this.mutexBroadcastTopic,
      echoAllowed: true,
      onMessageReceive: (message: MutexBroadcastMessage) => this.handleMutexBroadcastMessage(message.body)
    });
  }

  protected unsubscribeFromMutexBroadcastMessages(): Promise<boolean> {
    return this.dispatcher.unsubscribe(this.mutexBroadcastTopic);
  }

  protected fireEvent(event: SyncStoreEvents, ...args: unknown[]): void {
    super.fireEvent(event as StoreEvents, ...args);
  }

  protected initEventCallbackRegistry(): util.LookupTable<SyncStoreEvents, Map<string, unknown>> {
    return {
      ...super.initEventCallbackRegistry(),
      'update': new Map(),
      'sync': new Map(),
      'ready': new Map(),
      'pause': new Map(),
      'resume': new Map(),
      'destroy': new Map()
    };
  }

  public static init<S extends RootStateTree>(id: string, type: string, dispatcher: mom.IDispatcher, persist: boolean, debounce: number, role?: Roles, initialState?: S): [ISyncStore<S>, Promise<ISyncStore<S>>] {
    const store = new SyncStore(id, type, dispatcher, persist, debounce, role, initialState);

    const operation = () => util.waitUntil(() => store.destroyed || (store.synchronized && store.ready)).then(() => store);
    const promise = store.performBlockingOperation(operation);

    return [store, promise];
  }
}
