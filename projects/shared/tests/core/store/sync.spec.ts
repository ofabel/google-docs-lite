import * as wodss from '@fhnw/wodss-shared';

describe('core.store.SyncStore', () => {
  jest.setTimeout(10_000);

  let topicPrefix: string;
  let clientId1: string;
  let clientId2: string;
  let serverId: string;
  let storeId: string;
  let clientDispatcher1: wodss.core.mom.IDispatcher;
  let clientDispatcher2: wodss.core.mom.IDispatcher;
  let serverDispatcher: wodss.core.mom.IDispatcher;
  let initialServerState: State;
  let initialClientState: State;

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
      _id: wodss.core.uid.slug('ecad10c3-b04a-45e5-91d3-222a0710e45d'),
      value: initialLockedStringValue
    } as wodss.core.store.Lockable<string>
  }));

  type State = wodss.core.store.StateOf<typeof stateFactory>;

  beforeEach(async () => {
    topicPrefix = `test/${wodss.core.uid.slug()}/`;
    clientId1 = wodss.core.uid.slug();
    clientId2 = wodss.core.uid.slug();
    serverId = wodss.core.uid.slug();
    storeId = wodss.core.uid.slug();
    clientDispatcher1 = await new wodss.core.mom.Builder()
      .withClientId(clientId1)
      .withTopicPrefix(topicPrefix)
      .build()[1];
    clientDispatcher2 = await new wodss.core.mom.Builder()
      .withClientId(clientId2)
      .withTopicPrefix(topicPrefix)
      .build()[1];
    serverDispatcher = await new wodss.core.mom.Builder()
      .withClientId(serverId)
      .withTopicPrefix(topicPrefix)
      .build()[1];
    initialServerState = stateFactory.create(storeId);
    initialClientState = {} as State;
  });

  afterEach(async () => {
    await clientDispatcher1.destroy();
    await clientDispatcher2.destroy();
    await serverDispatcher.destroy();
  });

  it('can sync updates between two clients and one server', async () => {
    const syncStoreServer = await wodss.core.store.SyncStore.init(storeId, typeId, serverDispatcher, true, 0, 'server', initialServerState)[1];
    const syncStoreClient1 = await wodss.core.store.SyncStore.init<State>(storeId, typeId, clientDispatcher1, true, 0, 'client', initialClientState)[1];
    const syncStoreClient2 = await wodss.core.store.SyncStore.init<State>(storeId, typeId, clientDispatcher2, true, 0, 'client', initialClientState)[1];

    expect(syncStoreServer).toBeInstanceOf(wodss.core.store.SyncStore);
    expect(syncStoreClient1).toBeInstanceOf(wodss.core.store.SyncStore);
    expect(syncStoreClient2).toBeInstanceOf(wodss.core.store.SyncStore);

    expect(syncStoreServer.snapshot).toEqual(initialServerState);
    expect(syncStoreClient1.snapshot).toEqual(initialServerState);
    expect(syncStoreClient2.snapshot).toEqual(initialServerState);

    // test event register and unregister
    syncStoreServer.on('update', () => expect(false).toBeTruthy())();
    syncStoreClient1.on('update', () => expect(false).toBeTruthy())();
    syncStoreClient2.on('update', () => expect(false).toBeTruthy())();

    let clientOk1 = false;
    let clientOk2 = false;
    let serverOk = false;

    const checkSnapshot = (snapshot: State) => {
      return snapshot.list.length === 6 && [13, 42].indexOf(snapshot.property as number) !== -1;
    }

    const offServer = syncStoreServer.on('update', ({snapshot}) => {
      if (checkSnapshot(snapshot)) {
        serverOk = true;

        offServer();
      }
    });

    const offClient1 = syncStoreClient1.on('update', ({snapshot}) => {
      if (checkSnapshot(snapshot)) {
        clientOk1 = true;

        offClient1();
      }
    });

    const offClient2 = syncStoreClient2.on('update', ({snapshot}) => {
      if (checkSnapshot(snapshot)) {
        clientOk2 = true;

        offClient2();
      }
    });

    await syncStoreClient2.patch(state => {
      state.property = 13;
      state.list.push({
        prop: '#3'
      });
    });

    await syncStoreClient1.patch(state => {
      state.property = 42;
      state.list.push({
        prop: '#2'
      });
    });

    await syncStoreClient1.patch(state => {
      state.list.push({
        prop: '#4'
      });
    });

    await syncStoreClient2.patch(state => {
      state.list.push({
        prop: '#5'
      }, {
        prop: '#6'
      });
    });

    await expect(wodss.core.util.waitUntil(() => clientOk1 && clientOk2 && serverOk, 5000)).resolves.toBeUndefined();

    const expectedFinalCommonState = syncStoreServer.snapshot;
    const actualListMembers = expectedFinalCommonState.list.map(v => v.prop);

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
    expect(syncStoreClient1.snapshot).toEqual(expectedFinalCommonState);
    expect(syncStoreClient2.snapshot).toEqual(expectedFinalCommonState);
  });

  it('can acquire and release a shared mutex', async () => {
    const syncStoreServer = await wodss.core.store.SyncStore.init(storeId, typeId, serverDispatcher, true, 0, 'server', initialServerState)[1];
    const syncStoreClient1 = await wodss.core.store.SyncStore.init<State>(storeId, typeId, clientDispatcher1, true, 0, 'client', initialClientState)[1];
    const syncStoreClient2 = await wodss.core.store.SyncStore.init<State>(storeId, typeId, clientDispatcher2, true, 0, 'client', initialClientState)[1];

    expect(syncStoreServer).toBeInstanceOf(wodss.core.store.SyncStore);
    expect(syncStoreClient1).toBeInstanceOf(wodss.core.store.SyncStore);
    expect(syncStoreClient2).toBeInstanceOf(wodss.core.store.SyncStore);

    expect(syncStoreServer.snapshot).toEqual(initialServerState);
    expect(syncStoreClient1.snapshot).toEqual(initialServerState);
    expect(syncStoreClient2.snapshot).toEqual(initialServerState);

    // client 1 acquires mutex
    await expect(syncStoreClient1.acquireMutex(syncStoreClient1.state.lockableString)).resolves.toBeTruthy();
    expect(syncStoreClient1.isLocked(syncStoreClient1.state.lockableString)).toBeDefined();
    await expect(syncStoreClient2.tryAcquireMutex(syncStoreClient2.state.lockableString)).resolves.toBeFalsy();
    expect(syncStoreServer.isLocked(syncStoreServer.state.lockableString)).toBeDefined();

    // client 1 tries to alter mutex value without success (mutex with 3th argument = false would be required)
    await expect(syncStoreClient1.tryMutex(syncStoreClient1.state.lockableString, state => state.lockableString.value = '42')).rejects.toThrow(wodss.core.store.MutexError);
    expect(syncStoreClient1.state.lockableString.value).toBe(initialLockedStringValue);
    expect(syncStoreClient2.state.lockableString.value).toBe(initialLockedStringValue);
    expect(syncStoreServer.state.lockableString.value).toBe(initialLockedStringValue);

    // client 2 tries to alter mutex value without success (is not mutex owner)
    await expect(syncStoreClient2.tryMutex(syncStoreClient2.state.lockableString, state => state.lockableString.value = '42')).rejects.toThrow(wodss.core.store.MutexError);
    expect(syncStoreClient1.state.lockableString.value).toBe(initialLockedStringValue);
    expect(syncStoreClient2.state.lockableString.value).toBe(initialLockedStringValue);
    expect(syncStoreServer.state.lockableString.value).toBe(initialLockedStringValue);

    const lockableStringValueByClient1 = '42';

    // client 1 changes mutex value
    await expect(syncStoreClient1.mutex(syncStoreClient1.state.lockableString, state => state.lockableString.value = lockableStringValueByClient1, false)).resolves.toBe(lockableStringValueByClient1);
    expect(syncStoreClient1.state.lockableString.value).toBe(lockableStringValueByClient1);

    // client 1 releases mutex
    await expect(syncStoreClient2.tryReleaseMutex(syncStoreClient2.state.lockableString)).resolves.toBeFalsy();
    expect(syncStoreClient1.isLocked(syncStoreClient1.state.lockableString)).toBeDefined();
    expect(syncStoreClient2.isLocked(syncStoreClient2.state.lockableString)).toBeDefined();
    expect(syncStoreServer.isLocked(syncStoreServer.state.lockableString)).toBeDefined();
    await expect(syncStoreClient1.releaseMutex(syncStoreClient1.state.lockableString)).resolves.toBeTruthy();
    expect(syncStoreServer.isLocked(syncStoreServer.state.lockableString)).toBeUndefined();
    await expect(syncStoreClient2.syncState()).resolves.toBeUndefined(); // sync client 2 to ensure consistency for the next tests
    await expect(syncStoreClient2.tryReleaseMutex(syncStoreClient2.state.lockableString)).resolves.toBeFalsy();

    const lockableStringValueByClient2 = '13';

    // client 2 changes mutex value with mutex method
    await expect(syncStoreClient2.mutex(syncStoreClient2.state.lockableString, state => state.lockableString.value = lockableStringValueByClient2)).resolves.toBe(lockableStringValueByClient2);
    expect(syncStoreClient2.state.lockableString.value).toBe(lockableStringValueByClient2);
    expect(syncStoreServer.isLocked(syncStoreServer.state.lockableString)).toBeUndefined();
    await expect(syncStoreClient1.syncState()).resolves.toBeUndefined(); // sync client 1 to ensure consistency for the next tests
    await expect(syncStoreClient2.syncState()).resolves.toBeUndefined(); // sync client 2 to ensure consistency for the next tests
    expect(syncStoreServer.state.lockableString.value).toBe(lockableStringValueByClient2);
    expect(syncStoreClient2.state.lockableString.value).toBe(lockableStringValueByClient2);
    expect(syncStoreClient1.state.lockableString.value).toBe(lockableStringValueByClient2);
    expect(syncStoreClient2.isLocked(syncStoreClient2.state.lockableString)).toBeUndefined();
    expect(syncStoreClient1.isLocked(syncStoreClient1.state.lockableString)).toBeUndefined();

    // check results
    expect(syncStoreClient1.snapshot).toEqual(syncStoreServer.snapshot);
    expect(syncStoreClient2.snapshot).toEqual(syncStoreServer.snapshot);
  });

  it('respects the readonly flag', async () => {
    const syncStoreServer = await wodss.core.store.SyncStore.init(storeId, typeId, serverDispatcher, true, 0, 'server', initialServerState)[1];
    const syncStoreClientRo = await wodss.core.store.SyncStore.init<State>(storeId, typeId, clientDispatcher1, true, 0, 'client', initialClientState)[1];
    const syncStoreClientRw = await wodss.core.store.SyncStore.init<State>(storeId, typeId, clientDispatcher2, true, 0, 'client', initialClientState)[1];

    // check if initial readonly flag is false
    expect(syncStoreServer.readonly).toBe(false);
    expect(syncStoreClientRo.readonly).toBe(false);
    expect(syncStoreClientRw.readonly).toBe(false);

    syncStoreClientRo.readonly = true;

    // check if only ro client has the readonly flag set
    expect(syncStoreServer.readonly).toBe(false);
    expect(syncStoreClientRo.readonly).toBe(true);
    expect(syncStoreClientRw.readonly).toBe(false);

    const numberToSet = 666;

    // check if the ro client can't mutate the state
    await expect(syncStoreClientRo.patch(state => state.property = numberToSet)).rejects.toThrow(wodss.core.store.ReadonlyStateError);
    expect(syncStoreClientRo.state.property).not.toBe(numberToSet);
    expect(syncStoreClientRw.state.property).not.toBe(numberToSet);
    expect(syncStoreServer.state.property).not.toBe(numberToSet);

    // check if rw client can patch the property
    await expect(syncStoreClientRw.patch(state => state.property = numberToSet)).resolves.toBe(numberToSet);
    expect(syncStoreClientRw.state.property).toBe(numberToSet);
    await expect(syncStoreClientRo.syncState()).resolves.toBeUndefined();
    expect(syncStoreClientRo.state.property).toBe(numberToSet);
    expect(syncStoreServer.state.property).toBe(numberToSet);

    const stringToSet = '666';

    // check if ro client can't aquire and release a mutex or mutate the state inside a mutex
    await expect(syncStoreClientRo.tryAcquireMutex(syncStoreClientRo.state.lockableString)).rejects.toThrow(wodss.core.store.ReadonlyStateError);
    expect(syncStoreServer.isLocked(syncStoreServer.state.lockableString)).toBeUndefined();
    await expect(syncStoreClientRo.tryReleaseMutex(syncStoreClientRo.state.lockableString)).rejects.toThrow(wodss.core.store.ReadonlyStateError);
    expect(syncStoreServer.isLocked(syncStoreServer.state.lockableString)).toBeUndefined();
    await expect(syncStoreClientRo.tryMutex(syncStoreClientRo.state.lockableString, state => state.lockableString.value = stringToSet)).rejects.toThrow(wodss.core.store.ReadonlyStateError);
    expect(syncStoreServer.isLocked(syncStoreServer.state.lockableString)).toBeUndefined();
    expect(syncStoreClientRo.state.lockableString.value).not.toBe(stringToSet);
    expect(syncStoreClientRw.state.lockableString.value).not.toBe(stringToSet);
    expect(syncStoreServer.state.lockableString.value).not.toBe(stringToSet);

    // check if the rw client can mutate the state inside a mutex
    await expect(syncStoreClientRw.mutex(syncStoreClientRw.state.lockableString, state => state.lockableString.value = stringToSet)).resolves.toBe(stringToSet);
    expect(syncStoreClientRw.state.lockableString.value).toBe(stringToSet);
    await expect(syncStoreClientRo.syncState()).resolves.toBeUndefined();
    expect(syncStoreClientRo.state.lockableString.value).toBe(stringToSet);
    expect(syncStoreServer.state.lockableString.value).toBe(stringToSet);

    // check final state
    expect(syncStoreClientRo.snapshot).toEqual(syncStoreServer.snapshot);
    expect(syncStoreClientRw.snapshot).toEqual(syncStoreServer.snapshot);
  });

  it('maintains the dirty flag', async () => {
    const syncStoreServer = await wodss.core.store.SyncStore.init(storeId, typeId, serverDispatcher, true, 0, 'server', initialServerState)[1];
    const syncStoreClient1 = await wodss.core.store.SyncStore.init<State>(storeId, typeId, clientDispatcher1, true, 0, 'client', initialClientState)[1];
    const syncStoreClient2 = await wodss.core.store.SyncStore.init<State>(storeId, typeId, clientDispatcher2, true, 0, 'client', initialClientState)[1];

    // check if initial dirty flag is true
    expect(syncStoreServer.dirty).toBe(true);
    expect(syncStoreClient1.dirty).toBe(true);
    expect(syncStoreClient2.dirty).toBe(true);

    // reset the dirty flag
    syncStoreServer.dirty = false;
    syncStoreClient1.dirty = false;
    syncStoreClient2.dirty = false;

    // check if dirty flag is false after reset
    expect(syncStoreServer.dirty).toBe(false);
    expect(syncStoreClient1.dirty).toBe(false);
    expect(syncStoreClient2.dirty).toBe(false);

    const numberToSet = 42;

    // check if a state mutation will set the dirty flag on the related stores
    await expect(syncStoreClient1.patch(state => state.property = numberToSet)).resolves.toBe(numberToSet);
    await expect(wodss.core.util.waitUntil(() => syncStoreClient2.state.property === numberToSet && syncStoreServer.state.property === numberToSet, 2000)).resolves.toBeUndefined();
    expect(syncStoreServer.dirty).toBe(true);
    expect(syncStoreClient1.dirty).toBe(true);
    expect(syncStoreClient2.dirty).toBe(true);

    // reset the dirty flag
    syncStoreServer.dirty = false;
    syncStoreClient1.dirty = false;
    syncStoreClient2.dirty = false;

    const stringToSet = 'some text';

    // check if the rw client can mutate the state inside a mutex
    await expect(syncStoreClient2.mutex(syncStoreClient2.state.lockableString, state => state.lockableString.value = stringToSet)).resolves.toBe(stringToSet);
    await expect(wodss.core.util.waitUntil(() => syncStoreClient1.state.lockableString.value === stringToSet && syncStoreServer.state.lockableString.value === stringToSet, 2000)).resolves.toBeUndefined();
    expect(syncStoreServer.dirty).toBe(true);
    expect(syncStoreClient1.dirty).toBe(true);
    expect(syncStoreClient2.dirty).toBe(true);
  });
});
