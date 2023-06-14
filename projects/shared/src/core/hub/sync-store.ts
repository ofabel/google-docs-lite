import * as db from '../db';
import * as log from '../log';
import * as mom from '../mom';
import * as msg from '../msg';
import * as uid from '../uid';
import * as store from '../store';
import {ISyncStore, Roles, RootStateTree} from '../store';
import * as util from '../util';
import {State, stateFactory, stateId, stateType} from './state';
import {HubStoreHandler} from './store-handler';

export type ServerControlActions = 'who is in charge?' | 'i am' | 'ready?' | 'ready';

export type StoreInstanceControlActions = 'open' | 'close' | 'delete';

export type StoreInstanceControlMessage = {
  type: string;
  id: string;
  action: StoreInstanceControlActions;
}

export class SyncStoreHub {
  public readonly dispatcher: mom.IDispatcher;

  protected readonly log = log.getLogger('hub');

  protected readonly persistenceAdapter: db.IPersistenceAdapter;
  protected persistAllInstancesJob: NodeJS.Timeout | number | undefined;

  protected readonly debounceSyncStoreMessages: number;

  protected readonly canBeServer: boolean;
  protected currentRole: store.Roles | 'undecided' = 'undecided';
  protected leadershipElectionPublishResult?: mom.IDispatcherPublishResult<ServerControlActions>;
  protected leadershipElectionKnownCandidates = new Set<string>();
  protected temporaryLeadershipRanking: string[] = [];
  protected leaderIsReady?: boolean;

  protected readonly storeInstanceRegistry: Map<string, store.ISyncStore<any>> = new Map(); // eslint-disable-line
  protected readonly stateFactoryRegistry: Map<string, store.StateTreeFactory<any>>; // eslint-disable-line

  protected readonly serverControlBroadcastTopic: string = '/wodss/mom/sync-store-hub/control/broadcast';
  protected readonly serverControlResponseTopic: string;

  protected readonly storeInstanceControlRequestTopic: string = '/wodss/mom/public/sync-store-hub/control/request';
  protected readonly storeInstanceControlResponseTopic: string = '/wodss/mom/public/sync-store-hub/control/response';

  protected readonly dispatcherEventListenerRegistry: Map<string, mom.UnregisterListenerCallback> = new Map();

  protected readyFlag = false;

  protected readonly hubStore: HubStoreHandler;

  protected constructor(dispatcher: mom.IDispatcher, persistenceAdapter: db.IPersistenceAdapter, role: store.Roles, debounce: number, ...stateFactories: store.StateTreeFactory<any>[]) { // eslint-disable-line
    this.dispatcher = dispatcher;
    this.persistenceAdapter = persistenceAdapter;
    this.canBeServer = role == 'server';

    this.debounceSyncStoreMessages = debounce;

    this.stateFactoryRegistry = new Map(stateFactories.map(factory => [factory.type, factory]))
    this.serverControlResponseTopic = `/wodss/mom/sync-store-hub/control/${dispatcher.clientId}`;

    this.hubStore = this.createHubStore();

    if (!this.canBeServer) {
      this.currentRole = 'client';
    }

    const offDestroy = this.dispatcher.on('destroy', () => this.destroy());

    this.dispatcherEventListenerRegistry.set('c6cd0a2c-f824-4210-93f7-294a1d4fc182', offDestroy);
  }

  public async destroy(): Promise<void> {
    this.stopPersistAllInstancesJob();

    await this.unsubscribeFromServerControlMessages();
    await this.unsubscribeFromStoreInstanceControlRequestMessages();
    await this.unsubscribeFromStoreInstanceControlResponseMessages();

    await this.persistAllInstances();

    const instances = this.storeInstanceRegistry.values();
    this.storeInstanceRegistry.clear();

    for (const instance of instances) {
      await instance.destroy();
    }

    this.unregisterDispatcherEventListener(); // FIXME consider move to start of this method
  }

  public whenReady(): Promise<void> {
    return util.waitUntil(() => this.readyFlag);
  }

  public get blocking(): boolean {
    for (const instance of this.storeInstanceRegistry.values()) {
      if (instance.blocking) {
        return true;
      }
    }

    return false;
  }

  public isReady(): boolean {
    return this.readyFlag;
  }

  protected set ready(ready: boolean) {
    this.readyFlag = ready;
  }

  public get role(): Roles {
    return this.currentRole as Roles;
  }

  public get openHandles(): number {
    return this.storeInstanceRegistry.size;
  }

  public isServer(): boolean {
    return this.currentRole === 'server';
  }

  public isClient(): boolean {
    return this.currentRole === 'client';
  }

  public has(id: string): boolean {
    return this.storeInstanceRegistry.has(id);
  }

  public open<S extends store.RootStateTree>(factoryOrId: string | store.StateTreeFactory<S>, relatedFactory?: store.StateTreeFactory<S>): [store.ISyncStore<S>, Promise<store.ISyncStore<S>>] {
    const typeOrId = factoryOrId instanceof store.StateTreeFactory ? factoryOrId.type : uid.slug(factoryOrId);

    if (this.canBeServer && this.storeInstanceRegistry.has(typeOrId)) {
      const syncStore = this.storeInstanceRegistry.get(typeOrId) as store.ISyncStore<S>;
      const request: StoreInstanceControlMessage = {
        id: syncStore.id,
        type: syncStore.type,
        action: 'open'
      };

      this.publishStoreInstanceControlRequestMessage(request).catch(this.log.error);

      const promise = util.waitUntil(() => syncStore.ready && syncStore.synchronized).then(() => syncStore);

      return [syncStore, promise];
    }

    if (this.storeInstanceRegistry.has(typeOrId)) {
      const syncStore = this.storeInstanceRegistry.get(typeOrId) as store.ISyncStore<S>;

      const promise = util.waitUntil(() => syncStore.ready && syncStore.synchronized).then(() => syncStore);

      return [syncStore, promise];
    }

    if (this.stateFactoryRegistry.has(typeOrId) || relatedFactory) {
      const factory = this.stateFactoryRegistry.get(typeOrId) as store.StateTreeFactory<S> ?? relatedFactory;
      const type = factory.type;
      const id = relatedFactory ? typeOrId : factory.create()._id;
      const persist = factory.persist;
      const request: StoreInstanceControlMessage = {
        id: id,
        type: type,
        action: 'open'
      };

      const [syncStore, promise] = store.SyncStore.init<S>(id, type, this.dispatcher, persist, this.debounceSyncStoreMessages);

      this.storeInstanceRegistry.set(id, syncStore);

      this.publishStoreInstanceControlRequestMessage(request).catch(this.log.error);

      return [syncStore, promise];
    }

    throw new Error('unable to open store instance');
  }

  public close<S extends store.RootStateTree>(storeOrId: string | store.ISyncStore<S>): Promise<boolean> {
    return this.closeOrDeleteInternal(storeOrId, 'close');
  }

  public delete<S extends store.RootStateTree>(storeOrId: string | store.ISyncStore<S>): Promise<boolean> {
    return this.closeOrDeleteInternal(storeOrId, 'delete');
  }

  protected async closeOrDeleteInternal<S extends store.RootStateTree>(storeOrId: string | store.ISyncStore<S>, action: StoreInstanceControlActions): Promise<boolean> {
    const id = typeof storeOrId === 'string' ? uid.slug(storeOrId) : storeOrId.id;
    const instance = this.storeInstanceRegistry.get(id);

    if (!instance) {
      return false;
    }

    const type = instance.type;
    const request: StoreInstanceControlMessage = {
      id: id,
      type: type,
      action: action
    };

    await this.publishStoreInstanceControlRequestMessage(request);

    if (!this.canBeServer) {
      this.storeInstanceRegistry.delete(id);

      await instance.destroy();
    }

    return this.canBeServer || !this.storeInstanceRegistry.has(id);
  }

  protected async initClient(): Promise<void> {
    await this.dispatcher.whenReady();

    await this.subscribeToStoreInstanceControlResponseMessages();

    this.ready = true;
  }

  protected async initServerCandidate(): Promise<void> {
    await this.dispatcher.whenReady();

    await this.subscribeToServerControlMessages();

    this.leadershipElectionKnownCandidates.clear();
    this.leadershipElectionKnownCandidates.add(this.dispatcher.clientId);

    const whoIsInCharge = await this.performLeadershipElection();

    if (whoIsInCharge === this.dispatcher.clientId) {
      this.log.info(`I'am in charge`);

      this.currentRole = 'server';
    } else {
      this.log.info(`participant ${whoIsInCharge} is in charge`);

      this.currentRole = 'client';
    }

    await this.waitUntilLeaderIsReady();
    await this.initHubStateStore();
    this.registerDispatcherEventListener();
    await this.openStoreHandles();
    await this.subscribeToStoreInstanceControlRequestMessages();
    await this.subscribeToStoreInstanceControlResponseMessages();
    await this.startPersistAllInstancesJob();
    await this.leaderReadyNotifyClients();

    this.log.info(`participant is ready as ${this.currentRole}`);
  }

  protected async waitUntilLeaderIsReady(): Promise<void> {
    if (this.isServer()) {
      return;
    }

    const request = msg.Builder.to<ServerControlActions>(this.serverControlBroadcastTopic, 'ready?').build();

    await this.dispatcher.publish(request);

    await util.waitUntil(() => !!this.leaderIsReady);
  }

  protected async leaderReadyNotifyClients() {
    this.ready = true;
    this.leaderIsReady = true;

    const message = msg.Builder.to<ServerControlActions>(this.serverControlBroadcastTopic, 'ready').build();

    await this.dispatcher.publish(message);
  }

  protected async unsubscribeFromServerControlMessages(): Promise<boolean> {
    return this.dispatcher.unsubscribe(this.serverControlBroadcastTopic);
  }

  protected async subscribeToServerControlMessages(): Promise<void> {
    await this.dispatcher.subscribe({
      topic: this.serverControlBroadcastTopic,
      echoAllowed: false,
      onMessageReceive: (message: msg.Message<ServerControlActions>) => this.handleServerControlMessage(message)
    });
  }

  protected async handleServerControlMessage(message: msg.Message<ServerControlActions>): Promise<void> {
    // handle leadership requests when server is leader
    if (message.body === 'who is in charge?' && this.isServer()) {
      const response = msg.Builder.replyTo<ServerControlActions>(message)
        .withBody('i am')
        .build();

      await this.dispatcher.publish(response);

      const numOfCandidates = await this.hubStore.addCandidate(message.head.sender);

      this.log.info(`new server candidate ${message.head.sender} detected and added on position #${numOfCandidates}`);

      return;
    }

    // during leader election process
    if (message.body === 'who is in charge?' && this.currentRole === 'undecided' && !this.leadershipElectionKnownCandidates.has(message.head.sender)) {
      this.leadershipElectionPublishResult?.cancel();
      this.leadershipElectionKnownCandidates.add(message.head.sender);

      this.log.info(`new candidate ${message.head.sender} joins the election ...`);

      return;
    }

    // respond to is server ready requests
    if (message.body === 'ready?' && this.isReady() && this.isServer()) {
      const response = msg.Builder.to<ServerControlActions>(this.serverControlBroadcastTopic, 'ready').build();

      await this.dispatcher.publish(response);

      return;
    }

    // handle leader server ready broadcast messages
    if (message.body === 'ready' && this.isClient()) {
      this.leaderIsReady = true;

      return;
    }
  }

  protected async performLeadershipElection(): Promise<string> {
    await this.dispatcher.subscribe({
      topic: this.serverControlResponseTopic,
      echoAllowed: false
    });

    for (; ;) {
      const leader = await this.broadcastWhoIsInChargeMessage();

      if (leader) {
        return leader;
      }
    }
  }

  protected async broadcastWhoIsInChargeMessage(): Promise<string | undefined> {
    const responseTimeout = 2_000; // FIXME: create env variable for this value and care about concurrent starting servers (who will be the leader?)

    this.log.info(`candidate asks who is in charge?`);

    return new Promise((resolve) => {
      const request = new msg.Builder<ServerControlActions>()
        .withReplyTo(this.serverControlResponseTopic)
        .withTopic(this.serverControlBroadcastTopic)
        .withBody('who is in charge?')
        .build();

      this.dispatcher.publish({
        message: request,
        onResponseTimeout: responseTimeout,
        onResponse: (message: msg.Message<ServerControlActions>) => this.handleWhoIsInChargeResponse(resolve, message.head.sender),
        onResponseTimeoutError: () => this.handleWhoIsInChargeResponse(resolve),
        onCancel: () => resolve(undefined)
      }).then(result => this.leadershipElectionPublishResult = result);
    });
  }

  protected async handleWhoIsInChargeResponse(resolver: (clientId?: string) => void, currentLeader?: string): Promise<void> {
    await this.dispatcher.unsubscribe(this.serverControlResponseTopic);

    if (currentLeader) {
      return resolver(currentLeader);
    }

    this.temporaryLeadershipRanking = [...this.leadershipElectionKnownCandidates].sort(uid.compare);

    this.leadershipElectionKnownCandidates.clear();
    this.leadershipElectionPublishResult = undefined;

    resolver(this.temporaryLeadershipRanking[0]);
  }

  protected unregisterDispatcherEventListener() {
    this.dispatcherEventListenerRegistry.forEach(off => off());

    this.dispatcherEventListenerRegistry.clear();
  }

  protected registerDispatcherEventListener(): void {
    const helloOff = this.dispatcher.on('hello', clientId => this.handleDispatcherHelloEvent(clientId));
    const byeOff = this.dispatcher.on('bye', clientId => this.handleDispatcherByeEvent(clientId));

    this.dispatcherEventListenerRegistry
      .set('4505e1f5-a65b-4b9c-8d49-94d93a13bb41', helloOff)
      .set('36ac927e-8232-468f-ae50-42c137cedbef', byeOff);
  }

  protected async handleDispatcherHelloEvent(clientId: string): Promise<void> {
    await this.hubStore.addClient(clientId);
  }

  protected async handleDispatcherByeEvent(clientId: string): Promise<void> {
    if (this.isCurrentLeader(clientId)) {
      await this.tryPerformSwitcheroo(clientId);
    }

    const emptyHandles = await this.hubStore.removeClientOrCandidateAndCleanOpenHandles(clientId);

    if (emptyHandles.size) {
      this.log.info(`closing ${emptyHandles.size} of ${this.openHandles} handles with no related clients`);
    }

    for (const [handle, type] of emptyHandles) {
      await this.closeStoreInstanceInternal(handle);
      await this.publishStoreInstanceControlResponseMessage({ // FIXME possible optimization with bulk actions as array
        id: handle,
        type: type,
        action: 'close'
      });
    }
  }

  protected async tryPerformSwitcheroo(formerLeader: string): Promise<boolean> {
    if (!this.isNextLeader()) {
      const nextLeader = this.getNextLeader();

      this.log.info(`candidate ${nextLeader} replaces the leadership of ${formerLeader}`);

      return false;
    }

    this.currentRole = 'server';

    this.hubStore.internal.readonly = false;

    await this.hubStore.internal.setRole('server');

    for (const [, instance] of this.storeInstanceRegistry) {
      await instance.setRole('server');
    }

    await this.hubStore.changeLeadership();

    this.log.info(`replacing the leadership of ${formerLeader}`);

    await this.persistAllInstances(true);

    return true;
  }

  protected async openStoreHandles() {
    for (const [id, handle] of Object.entries(this.hubStore.state.handles)) {
      const type = handle._type;

      await this.openStoreInstanceAsClient(id, type);
    }
  }

  protected createHubStore(): HubStoreHandler {
    const [instance] = store.SyncStore.init<State>(stateId, stateType, this.dispatcher, false, 0);

    if (!this.canBeServer) {
      instance.destroy().catch(this.log.error);
    }

    instance.readonly = true;

    return new HubStoreHandler(instance);
  }

  protected async initHubStateStore(): Promise<void> {
    const initialState = this.isServer() ? stateFactory.create() : {} as State;

    this.hubStore.internal.readonly = this.isClient();

    this.hubStore.internal.initStoreWithState(initialState);

    await this.hubStore.internal.setRole(this.role);

    if (await this.hubStore.init(this.dispatcher.activeClients, this.temporaryLeadershipRanking)) {
      this.temporaryLeadershipRanking = [];
    }
  }

  protected isCurrentLeader(clientId = this.dispatcher.clientId): boolean {
    return this.hubStore.state.serverOrder[0].id === clientId;
  }

  protected isNextLeader(clientIdToCheck = this.dispatcher.clientId): boolean {
    return this.getNextLeader() === clientIdToCheck;
  }

  protected getNextLeader(): string {
    for (const serverCandidate of this.hubStore.state.serverOrder) {
      if (this.dispatcher.isActiveClient(serverCandidate.id)) {
        return serverCandidate.id;
      }
    }

    throw new Error('unable to determine next leader');
  }

  protected async unsubscribeFromStoreInstanceControlRequestMessages(): Promise<boolean> {
    return this.dispatcher.unsubscribe(this.storeInstanceControlRequestTopic);
  }

  protected subscribeToStoreInstanceControlRequestMessages(): Promise<boolean> {
    return this.dispatcher.subscribe({
      topic: this.storeInstanceControlRequestTopic,
      echoAllowed: true,
      onMessageReceive: (message: msg.Message<StoreInstanceControlMessage>) => this.handleStoreInstanceControlRequestMessage(message)
    });
  }

  protected async handleStoreInstanceControlRequestMessage({head, body}: msg.Message<StoreInstanceControlMessage>): Promise<void> {
    if (this.isClient()) {
      // clients only react on response messages
      return;
    }

    const {
      id,
      type,
      action
    } = body;

    let informClients = false;

    switch (action) {
      case 'open':
        await this.openStoreInstanceAsServer(id, type);

        informClients = await this.hubStore.openHandle(head.sender, id, type) > 0;
        break;
      case 'close':
        informClients = await this.hubStore.closeHandle(head.sender, id) === 0;

        if (informClients) {
          await this.closeStoreInstanceInternal(id);
        }

        break;
      case 'delete':
        informClients = await this.hubStore.closeHandle(head.sender, id) === 0;

        if (informClients) {
          await this.deleteStoreInstanceAsServer(id);
        }

        break;
      default:
        throw new Error(`invalid action '${action}' received`);
    }

    this.log.info(`participant ${head.sender} ${action}s store ${id}`);

    if (informClients) {
      await this.publishStoreInstanceControlResponseMessage(body);
    }
  }

  protected async publishStoreInstanceControlResponseMessage(request: StoreInstanceControlMessage): Promise<msg.Message<StoreInstanceControlMessage>> {
    const response = new msg.Builder<StoreInstanceControlMessage>()
      .withTopic(this.storeInstanceControlResponseTopic)
      .withBody(request)
      .build();

    const {message} = await this.dispatcher.publish(response);

    return message;
  }

  protected async publishStoreInstanceControlRequestMessage(message: StoreInstanceControlMessage): Promise<void> {
    await this.whenReady();

    const response = new msg.Builder<StoreInstanceControlMessage>()
      .withTopic(this.storeInstanceControlRequestTopic)
      .withBody(message)
      .build();

    await this.dispatcher.publish(response);
  }

  protected unsubscribeFromStoreInstanceControlResponseMessages(): Promise<boolean> {
    return this.dispatcher.unsubscribe(this.storeInstanceControlResponseTopic);
  }

  protected subscribeToStoreInstanceControlResponseMessages(): Promise<boolean> {
    return this.dispatcher.subscribe({
      topic: this.storeInstanceControlResponseTopic,
      echoAllowed: true,
      onMessageReceive: (message: msg.Message<StoreInstanceControlMessage>) => this.handleStoreInstanceControlResponseMessage(message)
    });
  }

  protected async handleStoreInstanceControlResponseMessage({body}: msg.Message<StoreInstanceControlMessage>): Promise<void> {
    if (this.isServer()) {
      // server only reacts to request messages
      return;
    }

    const {
      id,
      type,
      action
    } = body;

    let instance;

    switch (action) {
      case 'open':
        instance = await this.openStoreInstanceAsClient(id, type);

        break;
      case 'close':
        instance = await this.closeStoreInstanceInternal(id);

        break;
      case 'delete':
        instance = await this.closeStoreInstanceInternal(id);

        break;
      default:
        throw new Error(`invalid action '${action}' received`);
    }

    if (instance) {
      this.log.info(`participant ${action}s store ${id}`);
    }
  }

  protected async openStoreInstanceAsServer<S extends RootStateTree>(id: string, type: string): Promise<ISyncStore<S> | undefined> {
    const instance = this.storeInstanceExistsInRegistryReadyAndSynchronized<S>(id);
    // store already exists in registry
    if (instance) {
      return instance;
    }

    // persistence adapter knows a state with this id
    if (await this.persistenceAdapter.has(id)) {
      const initialState = await this.persistenceAdapter.get(id) as S;

      return this.initStoreInstanceWithRoleAndInitialState(id, type, true, 'server', initialState);
    }

    // create a new state with the given id and type using the state factory
    if (this.stateFactoryRegistry.has(type)) {
      const factory = this.stateFactoryRegistry.get(type) as store.StateTreeFactory<S>;
      const persist = factory.persist;
      const initialState = factory.create(id);

      return this.initStoreInstanceWithRoleAndInitialState(id, type, persist, 'server', initialState);
    }

    throw new Error(`unable to create store for state with id ${id} and type ${type}`);
  }

  protected storeInstanceExistsInRegistryReadyAndSynchronized<S extends RootStateTree>(id: string): ISyncStore<S> | undefined {
    const instance = this.storeInstanceRegistry.get(id);

    return instance && instance.ready && instance.synchronized ? instance : undefined;
  }

  protected async initStoreInstanceWithRoleAndInitialState<S extends RootStateTree>(id: string, type: string, persist: boolean, role: Roles, initialState: S): Promise<ISyncStore<S> | undefined> {
    const instance = this.storeInstanceRegistry.get(id);

    if (instance) {
      instance.initStoreWithState(initialState);

      await instance.setRole(role);

      return instance;
    }
    // only server candidates need to create instances to listen for updates
    else if (this.canBeServer) {
      const [instance, promise] = store.SyncStore.init(id, type, this.dispatcher, persist, this.debounceSyncStoreMessages, role, initialState);

      this.storeInstanceRegistry.set(id, instance);

      return promise;
    }
  }

  protected async closeStoreInstanceInternal(id: string): Promise<void> {
    const instance = this.storeInstanceRegistry.get(id);

    if (!instance) {
      return;
    }

    const unregisterListener = this.dispatcherEventListenerRegistry.get(id);

    if (unregisterListener) {
      unregisterListener();
    }

    this.dispatcherEventListenerRegistry.delete(id);
    this.storeInstanceRegistry.delete(id);

    await this.persistInstance(instance);

    await instance.destroy();
  }

  protected async deleteStoreInstanceAsServer(id: string): Promise<void> {
    await this.closeStoreInstanceInternal(id);

    await this.persistenceAdapter.delete(id);
  }

  protected openStoreInstanceAsClient<S extends RootStateTree>(id: string, type: string): Promise<ISyncStore<S> | undefined> {
    if (!this.stateFactoryRegistry.has(type)) {
      throw new Error(`no state factory found for type ${type}`);
    }

    const factory = this.stateFactoryRegistry.get(type) as store.StateTreeFactory<S>;
    const persist = factory.persist;

    return this.initStoreInstanceWithRoleAndInitialState(id, type, persist, 'client', {} as S);
  }

  protected async startPersistAllInstancesJob(): Promise<void> {
    if (this.persistAllInstancesJob !== undefined || !this.canBeServer) {
      return;
    }

    const interval = 30_000; // FIXME move to env variable
    const job = async () => {
      await this.persistAllInstances();

      if (this.persistAllInstancesJob !== undefined) {
        this.persistAllInstancesJob = setTimeout(job, interval);
      }
    };

    this.persistAllInstancesJob = setTimeout(job, interval);
  }

  protected stopPersistAllInstancesJob(): void {
    clearTimeout(this.persistAllInstancesJob as number);

    this.persistAllInstancesJob = undefined;
  }

  protected async persistAllInstances(force = false): Promise<void> {
    if (this.isClient() || this.storeInstanceRegistry.size === 0) {
      return;
    }

    const instances = [...this.storeInstanceRegistry.values()].filter(instance => instance.persist);
    const instancesToPersist = instances.filter(instance => force || instance.dirty);

    this.log.info(`persisting ${instancesToPersist.length} of ${instances.length} store instances`)

    for (const instance of instancesToPersist) {
      instance.dirty = false;

      await this.persistInstance(instance).catch(this.log.error);
    }
  }

  protected async persistInstance<S extends RootStateTree>(instance: ISyncStore<S>): Promise<void> {
    if (this.isClient() || !instance.persist) {
      return;
    }

    const state = instance.toJSON();

    await this.persistenceAdapter.set(state).catch(this.log.error);
  }

  public static init(dispatcher: mom.IDispatcher, persistenceAdapter: db.IPersistenceAdapter, role: store.Roles, debounce: number, ...stateFactories: store.StateTreeFactory<any>[]): [hub: SyncStoreHub, promise: Promise<SyncStoreHub>] { // eslint-disable-line
    const hub = new this(dispatcher, persistenceAdapter, role, debounce, ...stateFactories);

    if (hub.canBeServer) {
      return [hub, hub.initServerCandidate().then(() => hub)];
    } else {
      return [hub, hub.initClient().then(() => hub)];
    }
  }
}
