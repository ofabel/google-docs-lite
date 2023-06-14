import * as wodss from '@fhnw/wodss-shared';

describe('core.hub.SyncStoreHub', () => {
  jest.setTimeout(15_000);

  const messageCallbackTimeout = 5_000;

  let topicPrefix: string;
  let clientId1: string;
  let clientId2: string;
  let serverId1: string;
  let serverId2: string;
  let serverId3: string;
  let stateId1: string;
  let stateId2: string;
  let clientDispatcher1: wodss.core.mom.IDispatcher;
  let clientDispatcher2: wodss.core.mom.IDispatcher;
  let serverDispatcher1: wodss.core.mom.IDispatcher;
  let serverDispatcher2: wodss.core.mom.IDispatcher;
  let serverDispatcher3: wodss.core.mom.IDispatcher;
  let initialServerState1: State;
  let initialServerState2: State;

  const typeId = wodss.core.uid.slug();
  const initialLockedStringValue = 'initial value';

  const stateFactory = wodss.core.store.createStateFactory(id => ({
    _id: id() as string,
    _type: typeId,
    _persist: true,
    property: 0 as number | undefined,
    list: [{
      prop: '#1' as string
    }],
    nestedObject: {
      property: 'untouched' as string
    },
    lockableString: {
      _id: wodss.core.uid.slug('1b024217-8c80-4e3f-818b-1c60911a279b'),
      value: initialLockedStringValue
    } as wodss.core.store.Lockable<string>
  }));

  type State = wodss.core.store.StateOf<typeof stateFactory>;

  beforeEach(async () => {
    topicPrefix = `test/${wodss.core.uid.slug()}/`;
    clientId1 = wodss.core.uid.slug();
    clientId2 = wodss.core.uid.slug();
    serverId1 = wodss.core.uid.slug();
    serverId2 = wodss.core.uid.slug();
    serverId3 = wodss.core.uid.slug();
    stateId1 = wodss.core.uid.slug();
    stateId2 = wodss.core.uid.slug();
    clientDispatcher1 = await new wodss.core.mom.Builder()
      .withClientId(clientId1)
      .withTopicPrefix(topicPrefix)
      .withDefaultOnEchoCallbackTimeout(messageCallbackTimeout)
      .withDefaultOnResponseCallbackTimeout(messageCallbackTimeout)
      .build()[1];
    clientDispatcher2 = await new wodss.core.mom.Builder()
      .withClientId(clientId2)
      .withTopicPrefix(topicPrefix)
      .withDefaultOnEchoCallbackTimeout(messageCallbackTimeout)
      .withDefaultOnResponseCallbackTimeout(messageCallbackTimeout)
      .build()[1];
    serverDispatcher1 = await new wodss.core.mom.Builder()
      .withClientId(serverId1)
      .withTopicPrefix(topicPrefix)
      .withDefaultOnEchoCallbackTimeout(messageCallbackTimeout)
      .withDefaultOnResponseCallbackTimeout(messageCallbackTimeout)
      .build()[1];
    serverDispatcher2 = await new wodss.core.mom.Builder()
      .withClientId(serverId2)
      .withTopicPrefix(topicPrefix)
      .withDefaultOnEchoCallbackTimeout(messageCallbackTimeout)
      .withDefaultOnResponseCallbackTimeout(messageCallbackTimeout)
      .build()[1];
    serverDispatcher3 = await new wodss.core.mom.Builder()
      .withClientId(serverId3)
      .withTopicPrefix(topicPrefix)
      .withDefaultOnEchoCallbackTimeout(messageCallbackTimeout)
      .withDefaultOnResponseCallbackTimeout(messageCallbackTimeout)
      .build()[1];
    initialServerState1 = stateFactory.create(stateId1);
    initialServerState2 = stateFactory.create(stateId2);
  });

  afterEach(async () => {
    await clientDispatcher1.destroy();
    await clientDispatcher2.destroy();
    await serverDispatcher1.destroy();
    await serverDispatcher2.destroy();
    await serverDispatcher3.destroy();
  });

  it('can start multiple servers, perform switcheroo and always only one leader is in charge', async () => {
    const serverHub1 = await wodss.core.hub.SyncStoreHub.init(serverDispatcher1, new wodss.core.db.MemoryAdapter(), 'server', 0, stateFactory)[1];
    const serverHub2 = await wodss.core.hub.SyncStoreHub.init(serverDispatcher2, new wodss.core.db.MemoryAdapter(), 'server', 0, stateFactory)[1];

    // basic instanceof check
    expect(serverHub1).toBeInstanceOf(wodss.core.hub.SyncStoreHub);
    expect(serverHub2).toBeInstanceOf(wodss.core.hub.SyncStoreHub);

    // check if all hubs are ready
    expect(serverHub1.isReady()).toBeTruthy();
    expect(serverHub2.isReady()).toBeTruthy();

    // check that only one is the leader
    expect(serverHub1.isServer() != serverHub2.isServer()).toBeTruthy();
    expect(serverHub1.isClient() != serverHub2.isClient()).toBeTruthy();

    // destroy current leader and perform switcheroo
    const currentLeader = serverHub1.isServer() ? serverHub1 : serverHub2;
    const nextLeader = serverHub1.isClient() ? serverHub1 : serverHub2;
    await expect(currentLeader.dispatcher.destroy()).resolves.toBeUndefined();

    // wait until next leader takes over the leadership
    await expect(wodss.core.util.waitUntil(() => nextLeader.isServer(), 1000)).resolves.toBeUndefined();

    expect(nextLeader.isClient()).toBeFalsy();

    // start new hub
    const serverHub3 = await wodss.core.hub.SyncStoreHub.init(serverDispatcher3, new wodss.core.db.MemoryAdapter(), 'server', 0, stateFactory)[1];

    // check if current leader is still in charge
    expect(serverHub3.isReady()).toBeTruthy();
    expect(nextLeader.isClient()).toBeFalsy();
    expect(nextLeader.isServer()).toBeTruthy();
    expect(serverHub3.isServer()).toBeFalsy();
    expect(serverHub3.isClient()).toBeTruthy();

    // check if there are no open handles
    expect(serverHub1.openHandles).toBe(0);
    expect(serverHub2.openHandles).toBe(0);
    expect(serverHub3.openHandles).toBe(0);

    // destroy current leader and perform switcheroo
    await expect(nextLeader.dispatcher.destroy()).resolves.toBeUndefined();

    // wait until new hub takes over the leadership
    await expect(wodss.core.util.waitUntil(() => serverHub3.isServer(), 1000)).resolves.toBeUndefined();

    // check if the new hub is now the leader
    expect(serverHub3.isClient()).toBeFalsy();

    await expect(serverHub1.destroy()).resolves.toBeUndefined();
    await expect(serverHub2.destroy()).resolves.toBeUndefined();
    await expect(serverHub3.destroy()).resolves.toBeUndefined();
  });

  it('can sync updates between two clients and two active hubs', async () => {
    const serverHub1 = await wodss.core.hub.SyncStoreHub.init(serverDispatcher1, new wodss.core.db.MemoryAdapter(), 'server', 0, stateFactory)[1];
    const serverHub2 = await wodss.core.hub.SyncStoreHub.init(serverDispatcher2, new wodss.core.db.MemoryAdapter(), 'server', 0, stateFactory)[1];
    const clientHub1 = await wodss.core.hub.SyncStoreHub.init(clientDispatcher1, new wodss.core.db.DummyAdapter(), 'client', 0, stateFactory)[1];
    const clientHub2 = await wodss.core.hub.SyncStoreHub.init(clientDispatcher2, new wodss.core.db.DummyAdapter(), 'client', 0, stateFactory)[1];

    // basic instanceof check
    expect(serverHub1).toBeInstanceOf(wodss.core.hub.SyncStoreHub);
    expect(serverHub2).toBeInstanceOf(wodss.core.hub.SyncStoreHub);
    expect(clientHub1).toBeInstanceOf(wodss.core.hub.SyncStoreHub);
    expect(clientHub2).toBeInstanceOf(wodss.core.hub.SyncStoreHub);

    // decide who is the server
    const serverHub = serverHub1.isServer() ? serverHub1 : serverHub2;
    const backupServerHub1 = serverHub1.isServer() ? serverHub2 : serverHub1;

    // start new backup server hub, will be #3 in line
    const serverHub3 = await wodss.core.hub.SyncStoreHub.init(serverDispatcher3, new wodss.core.db.MemoryAdapter(), 'server', 0, stateFactory)[1];

    // check if there are no open handles
    expect(serverHub1.openHandles).toBe(0);
    expect(serverHub2.openHandles).toBe(0);
    expect(serverHub3.openHandles).toBe(0);
    expect(clientHub1.openHandles).toBe(0);
    expect(clientHub2.openHandles).toBe(0);

    // check if client 1 and 2 can open a store with the same given state id
    const clientStore11 = await clientHub1.open(stateId1, stateFactory)[1];
    const clientStore21 = await clientHub2.open(stateId1, stateFactory)[1];
    const clientStore22 = await clientHub2.open(stateId2, stateFactory)[1];
    const serverStore11 = await serverHub.open(stateId1, stateFactory)[1];
    const backupStore11 = await backupServerHub1.open(stateId1, stateFactory)[1];
    const backupStore12 = await backupServerHub1.open(stateId2, stateFactory)[1];

    // check if both stores are equal
    expect(clientStore11.snapshot).toEqual(initialServerState1);
    expect(clientStore21.snapshot).toEqual(initialServerState1);
    expect(clientStore22.snapshot).toEqual(initialServerState2);
    expect(serverStore11.snapshot).toEqual(initialServerState1);
    expect(backupStore11.snapshot).toEqual(initialServerState1);
    expect(backupStore12.snapshot).toEqual(initialServerState2);

    // check if there are open handles as expected
    expect(serverHub1.openHandles).toBe(2);
    expect(serverHub2.openHandles).toBe(2);
    expect(serverHub3.openHandles).toBe(2);
    expect(clientHub1.openHandles).toBe(1);
    expect(clientHub2.openHandles).toBe(2);

    // test event register and unregister
    clientStore11.on('update', () => expect(false).toBeTruthy())();
    clientStore21.on('update', () => expect(false).toBeTruthy())();
    clientStore22.on('update', () => expect(false).toBeTruthy())();
    serverStore11.on('update', () => expect(false).toBeTruthy())();
    backupStore11.on('update', () => expect(false).toBeTruthy())();
    backupStore12.on('update', () => expect(false).toBeTruthy())();

    let clientOk1 = false;
    let clientOk2 = false;
    let serverOk2 = false;

    const checkSnapshot = (snapshot: State) => {
      return snapshot.list.length === 6 && [13, 42].indexOf(snapshot.property as number) !== -1;
    }

    const offServer2 = backupStore11.on('update', ({snapshot}) => {
      if (checkSnapshot(snapshot)) {
        offServer2();

        serverOk2 = true;
      }
    });

    const offClient1 = clientStore11.on('update', ({snapshot}) => {
      if (checkSnapshot(snapshot)) {
        offClient1();

        clientOk1 = true;
      }
    });

    const offClient2 = clientStore21.on('update', ({snapshot}) => {
      if (checkSnapshot(snapshot)) {
        offClient2();

        clientOk2 = true;
      }
    });

    await expect(clientStore21.patch(state => {
      state.property = 13;

      return state.list.push({
        prop: '#3'
      });
    })).resolves.toBeGreaterThanOrEqual(2);

    await expect(clientStore11.patch(state => {
      state.property = 42;

      return state.list.push({
        prop: '#2'
      });
    })).resolves.toBeGreaterThanOrEqual(2);

    // perform the switcheroo
    await expect(serverHub.dispatcher.destroy()).resolves.toBeUndefined();

    await expect(clientStore11.patch(state => {
      return state.list.push({
        prop: '#4'
      });
    })).resolves.toBeGreaterThanOrEqual(2);

    await expect(clientStore21.patch(state => {
      return state.list.push({
        prop: '#5'
      }, {
        prop: '#6'
      });
    })).resolves.toBeGreaterThanOrEqual(2);

    await expect(wodss.core.util.waitUntil(() => clientOk1, 5000)).resolves.toBeUndefined();
    await expect(wodss.core.util.waitUntil(() => clientOk2, 5000)).resolves.toBeUndefined();
    await expect(wodss.core.util.waitUntil(() => serverOk2, 5000)).resolves.toBeUndefined();

    const backupStore31 = await serverHub3.open(stateId1, stateFactory)[1];
    const expectedFinalCommonState = backupStore11.snapshot;
    const actualListMembers = expectedFinalCommonState.list.map(v => v.prop);

    await expect(wodss.core.util.waitUntil(() => checkSnapshot(backupStore31.snapshot), 3000)).resolves.toBeUndefined();

    expect(expectedFinalCommonState.list.length).toBe(6);
    expect(actualListMembers).toContain('#1');
    expect(actualListMembers).toContain('#2');
    expect(actualListMembers).toContain('#3');
    expect(actualListMembers).toContain('#4');
    expect(actualListMembers).toContain('#5');
    expect(actualListMembers).toContain('#6');
    expect(expectedFinalCommonState.property).toBeDefined();
    expect([13, 42, undefined].indexOf(expectedFinalCommonState.property)).not.toBe(-1);
    expect(expectedFinalCommonState.nestedObject.property).toBe('untouched');
    expect(clientStore11.snapshot).toEqual(expectedFinalCommonState);
    expect(clientStore21.snapshot).toEqual(expectedFinalCommonState);
    expect(backupStore31.snapshot).toEqual(expectedFinalCommonState);
    expect(clientStore22.snapshot).toEqual(backupStore12.snapshot);

    await expect(clientHub1.close(clientStore11)).resolves.toBeTruthy();
    await expect(clientHub2.close(clientStore21)).resolves.toBeTruthy();
    await expect(clientHub2.close(clientStore22)).resolves.toBeTruthy();

    // check if there are open handles as expected
    expect(serverHub.openHandles).toBe(0);
    expect(backupServerHub1.openHandles).toBe(2);
    expect(serverHub3.openHandles).toBe(2);
    expect(clientHub1.openHandles).toBe(0);
    expect(clientHub2.openHandles).toBe(0);

    await expect(backupServerHub1.close(backupStore11)).resolves.toBeTruthy();
    await expect(backupServerHub1.close(backupStore12)).resolves.toBeTruthy();

    // check if there are open handles as expected
    expect(serverHub.openHandles).toBe(0);
    expect(backupServerHub1.openHandles).toBe(2);
    expect(serverHub3.openHandles).toBe(2);
    expect(clientHub1.openHandles).toBe(0);
    expect(clientHub2.openHandles).toBe(0);

    await expect(serverHub3.close(backupStore31)).resolves.toBeDefined();

    await expect(wodss.core.util.waitUntil(() => backupServerHub1.openHandles === 0 && serverHub3.openHandles === 0, 2000)).resolves.toBeUndefined();

    expect(backupServerHub1.openHandles).toBe(0);
    expect(serverHub3.openHandles).toBe(0);

    await expect(clientHub1.destroy()).resolves.toBeUndefined();
    await expect(clientHub2.destroy()).resolves.toBeUndefined();
    await expect(serverHub1.destroy()).resolves.toBeUndefined();
    await expect(serverHub2.destroy()).resolves.toBeUndefined();
    await expect(serverHub3.destroy()).resolves.toBeUndefined();
  });

  it('can acquire and release a shared mutex with multiple hubs involved', async () => {
    const serverHub1 = await wodss.core.hub.SyncStoreHub.init(serverDispatcher1, new wodss.core.db.MemoryAdapter(), 'server', 0, stateFactory)[1];
    const serverHub2 = await wodss.core.hub.SyncStoreHub.init(serverDispatcher2, new wodss.core.db.MemoryAdapter(), 'server', 0, stateFactory)[1];
    const clientHub1 = await wodss.core.hub.SyncStoreHub.init(clientDispatcher1, new wodss.core.db.DummyAdapter(), 'client', 0, stateFactory)[1];
    const clientHub2 = await wodss.core.hub.SyncStoreHub.init(clientDispatcher2, new wodss.core.db.DummyAdapter(), 'client', 0, stateFactory)[1];

    // decide who is the server
    const serverHub = serverHub1.isServer() ? serverHub1 : serverHub2;
    const backupServerHub1 = serverHub1.isServer() ? serverHub2 : serverHub1;

    // start new backup server hub, will be #3 in line
    const serverHub3 = await wodss.core.hub.SyncStoreHub.init(serverDispatcher3, new wodss.core.db.MemoryAdapter(), 'server', 0, stateFactory)[1];

    // check if client 1 and 2 can open a store with the same given state id
    const clientStore11 = await clientHub1.open(stateId1, stateFactory)[1];
    const clientStore21 = await clientHub2.open(stateId1, stateFactory)[1];
    const clientStore32 = await clientHub2.open(stateId2, stateFactory)[1];
    const serverStore11 = await serverHub.open(stateId1, stateFactory)[1];
    const backupStore11 = await backupServerHub1.open(stateId1, stateFactory)[1];
    const backupStore12 = await backupServerHub1.open(stateId2, stateFactory)[1];

    // check if both stores are equal
    expect(clientStore11.snapshot).toEqual(initialServerState1);
    expect(clientStore21.snapshot).toEqual(initialServerState1);
    expect(clientStore32.snapshot).toEqual(initialServerState2);
    expect(serverStore11.snapshot).toEqual(initialServerState1);
    expect(backupStore11.snapshot).toEqual(initialServerState1);
    expect(backupStore12.snapshot).toEqual(initialServerState2);

    // client 1 acquires mutex
    await expect(clientStore11.acquireMutex(clientStore11.state.lockableString)).resolves.toBeTruthy();
    expect(clientStore11.isLocked(clientStore11.state.lockableString)).toBeDefined();
    await expect(clientStore21.tryAcquireMutex(clientStore21.state.lockableString)).resolves.toBeFalsy();
    expect(serverStore11.isLocked(serverStore11.state.lockableString)).toBeDefined();
    expect(backupStore11.isLocked(backupStore11.state.lockableString)).toBeDefined(); // FIXME may better wait until is undefined instead of checking it directly

    // client 1 tries to alter mutex value without success (mutex with 3th argument = false would be required)
    await expect(clientStore11.tryMutex(clientStore11.state.lockableString, state => state.lockableString.value = '42')).rejects.toThrow(wodss.core.store.MutexError);
    expect(clientStore11.state.lockableString.value).toBe(initialLockedStringValue);
    expect(clientStore21.state.lockableString.value).toBe(initialLockedStringValue);
    expect(serverStore11.state.lockableString.value).toBe(initialLockedStringValue);
    expect(backupStore11.state.lockableString.value).toBe(initialLockedStringValue);

    // client 2 tries to alter mutex value without success (is not mutex owner)
    await expect(clientStore21.tryMutex(clientStore21.state.lockableString, state => state.lockableString.value = '42')).rejects.toThrow(wodss.core.store.MutexError);
    expect(clientStore11.state.lockableString.value).toBe(initialLockedStringValue);
    expect(clientStore21.state.lockableString.value).toBe(initialLockedStringValue);
    expect(serverStore11.state.lockableString.value).toBe(initialLockedStringValue);
    expect(backupStore11.state.lockableString.value).toBe(initialLockedStringValue);

    const lockableStringValueByClient1 = '42';

    // client 1 changes mutex value
    await expect(clientStore11.mutex(clientStore11.state.lockableString, state => state.lockableString.value = lockableStringValueByClient1, false)).resolves.toBe(lockableStringValueByClient1);
    expect(clientStore11.state.lockableString.value).toBe(lockableStringValueByClient1);

    // client 1 releases mutex
    await expect(clientStore21.tryReleaseMutex(clientStore21.state.lockableString)).resolves.toBeFalsy();
    expect(clientStore11.isLocked(clientStore11.state.lockableString)).toBeDefined();
    expect(clientStore21.isLocked(clientStore21.state.lockableString)).toBeDefined();
    expect(serverStore11.isLocked(serverStore11.state.lockableString)).toBeDefined();
    expect(backupStore11.isLocked(backupStore11.state.lockableString)).toBeDefined();
    await expect(clientStore11.releaseMutex(clientStore11.state.lockableString)).resolves.toBeTruthy();
    expect(serverStore11.isLocked(serverStore11.state.lockableString)).toBeUndefined();
    await expect(clientStore21.syncState()).resolves.toBeUndefined(); // sync client 2 to ensure consistency for the next tests
    await expect(clientStore21.tryReleaseMutex(clientStore21.state.lockableString)).resolves.toBeFalsy();

    const lockableStringValueByClient2 = '13';

    // perform the switcheroo
    await expect(serverHub.dispatcher.destroy()).resolves.toBeUndefined();

    await expect(wodss.core.util.waitUntil(() => backupServerHub1.isServer(), 5000)).resolves.toBeUndefined();

    const backupStore21 = await serverHub3.open(stateId1, stateFactory)[1];

    // client 2 changes mutex value with mutex method
    await expect(clientStore21.mutex(clientStore21.state.lockableString, state => state.lockableString.value = lockableStringValueByClient2)).resolves.toBe(lockableStringValueByClient2);
    expect(clientStore21.state.lockableString.value).toBe(lockableStringValueByClient2);
    expect(backupStore11.isLocked(backupStore11.state.lockableString)).toBeUndefined();
    expect(backupStore21.isLocked(backupStore21.state.lockableString)).toBeUndefined(); // FIXME may better wait until is undefined instead of checking it directly
    await expect(clientStore11.syncState()).resolves.toBeUndefined(); // sync client 1 to ensure consistency for the next tests
    await expect(clientStore21.syncState()).resolves.toBeUndefined(); // sync client 2 to ensure consistency for the next tests
    expect(backupStore11.state.lockableString.value).toBe(lockableStringValueByClient2);
    expect(backupStore21.state.lockableString.value).toBe(lockableStringValueByClient2);
    expect(clientStore21.state.lockableString.value).toBe(lockableStringValueByClient2);
    expect(clientStore11.state.lockableString.value).toBe(lockableStringValueByClient2);
    expect(clientStore21.isLocked(clientStore21.state.lockableString)).toBeUndefined();
    expect(clientStore11.isLocked(clientStore11.state.lockableString)).toBeUndefined();

    // check results
    expect(clientStore11.snapshot).toEqual(backupStore11.snapshot);
    expect(clientStore21.snapshot).toEqual(backupStore11.snapshot);
    expect(backupStore21.snapshot).toEqual(backupStore11.snapshot);
    expect(clientStore32.snapshot).toEqual(backupStore12.snapshot);
    expect(backupStore12.snapshot).not.toEqual(backupStore11.snapshot);

    await expect(clientHub1.destroy()).resolves.toBeUndefined();
    await expect(clientHub2.destroy()).resolves.toBeUndefined();
    await expect(serverHub1.destroy()).resolves.toBeUndefined();
    await expect(serverHub2.destroy()).resolves.toBeUndefined();
    await expect(serverHub3.destroy()).resolves.toBeUndefined();
  });

  it('can persist and restore a state using the attached database adapter', async () => {
    const database = new wodss.core.db.MemoryAdapter();

    const serverHub1 = await wodss.core.hub.SyncStoreHub.init(serverDispatcher1, database, 'server', 0, stateFactory)[1];
    const serverHub2 = await wodss.core.hub.SyncStoreHub.init(serverDispatcher2, database, 'server', 0, stateFactory)[1];
    const clientHub1 = await wodss.core.hub.SyncStoreHub.init(clientDispatcher1, new wodss.core.db.DummyAdapter(), 'client', 0, stateFactory)[1];
    const clientHub2 = await wodss.core.hub.SyncStoreHub.init(clientDispatcher2, new wodss.core.db.DummyAdapter(), 'client', 0, stateFactory)[1];

    // decide who is the server
    const serverHub = serverHub1.isServer() ? serverHub1 : serverHub2;
    const backupServerHub1 = serverHub1.isServer() ? serverHub2 : serverHub1;

    // check that the states do not exist in the database
    await expect(database.has(stateId1)).resolves.toBeFalsy();
    await expect(database.has(stateId2)).resolves.toBeFalsy();

    // open some store handles
    const clientStore111 = await clientHub1.open(stateId1, stateFactory)[1];
    const clientStore211 = await clientHub2.open(stateId1, stateFactory)[1];

    // check the initial state of the stores
    expect(clientStore111.snapshot).toEqual(initialServerState1);
    expect(clientStore211.snapshot).toEqual(initialServerState1);

    const numberToSet = 13;

    // perform some state mutations
    await expect(clientStore111.patch(state => state.property = numberToSet)).resolves.toBe(numberToSet);
    await expect(clientStore211.patch(state => state.list.push({prop: '#2'}))).resolves.toBe(2);

    // check that the hub has not persisted the states yet
    await expect(clientHub1.close(clientStore111)).resolves.toBeTruthy();
    await expect(database.has(stateId1)).resolves.toBeFalsy();
    await expect(database.has(stateId2)).resolves.toBeFalsy();
    expect(clientHub1.openHandles).toBe(0);

    // check that the hub has persisted the states
    await expect(clientHub2.close(clientStore211)).resolves.toBeTruthy();
    expect(clientHub2.openHandles).toBe(0);
    await expect(wodss.core.util.waitUntil(() => database.has(stateId1), 2000)).resolves.toBeUndefined();
    await expect(database.has(stateId1)).resolves.toBeTruthy();
    await expect(database.has(stateId2)).resolves.toBeFalsy();
    await expect(database.get<State>(stateId1).then(state => state.property)).resolves.toBe(numberToSet);
    await expect(database.get<State>(stateId1).then(state => state.list.length)).resolves.toBe(2);

    // close all server hubs
    await expect(serverHub.dispatcher.destroy()).resolves.toBeUndefined();
    await expect(backupServerHub1.dispatcher.destroy()).resolves.toBeUndefined();

    // start a new server hub and check if the client can restore the state
    const serverHub3 = await wodss.core.hub.SyncStoreHub.init(serverDispatcher3, database, 'server', 0, stateFactory)[1];
    const clientStore112 = await clientHub1.open(stateId1, stateFactory)[1];
    expect(clientStore112.state.property).toBe(numberToSet);
    expect(clientStore112.state.list.length).toBe(2);
    await expect(clientHub1.close(clientStore112)).resolves.toBeTruthy();
    expect(clientHub1.openHandles).toBe(0);

    await expect(clientHub1.destroy()).resolves.toBeUndefined();
    await expect(clientHub2.destroy()).resolves.toBeUndefined();
    await expect(serverHub1.destroy()).resolves.toBeUndefined();
    await expect(serverHub2.destroy()).resolves.toBeUndefined();
    await expect(serverHub3.destroy()).resolves.toBeUndefined();
  });
});
