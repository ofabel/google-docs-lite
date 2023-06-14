import * as core from '@syncedstore/core';
import * as uid from '../uid';
import * as log from '../log';
import * as util from '../util';
import * as yjs from './yjs';
import {decode, encode} from './marshal';
import {Lockable, RootStateTree, StateValue} from './state';
import {IStore, MutexError, OnPatchCallback, PatchCallback, ReadonlyStateError, StoreEvents} from './type';

export const enableVueBindings = core.enableVueBindings;

export type MutexRegistry = {
  [id: string]: string;
}

export type UserMutexRegistry = {
  [user: string]: {
    [mutex: string]: true
  }
}

export type InternalState<S extends RootStateTree> = {
  readonly state: S;

  readonly mutexRegistry: MutexRegistry;

  readonly userMutexRegistry: UserMutexRegistry;

  readonly meta: {
    revision?: string
  }
};

export type PropertyRegistry<T extends string> = {
  readonly state: {
    [Property in T]: boolean | number | string | undefined;
  } & {
    initialized: boolean | undefined;

    readonly: boolean | undefined;

    blocking: number | undefined;

    dirty: boolean | undefined;

    persist: boolean | undefined;
  }
}

export type PatchInternalCallback<S extends RootStateTree, R> = (internalState: InternalState<S>) => R;

export type Transaction<R = undefined> = {
  update: Uint8Array;
  origin: string;
  result: R;
}

export type TransactionRegistryEntry<R> = {
  resolve: (transaction: Transaction<R>) => void;
  result: R;
}

export abstract class AbstractStore<S extends RootStateTree, P extends string = ''> implements IStore<S> {
  public readonly id: string;

  public readonly type: string;

  public readonly owner: string;

  public readonly properties: PropertyRegistry<P | 'initialized' | 'readonly' | 'blocking'>;

  protected readonly internalState: InternalState<S>;
  protected readonly internalStateDoc: yjs.Doc;

  protected readonly transactionRegistry: Map<string, TransactionRegistryEntry<any>> = new Map(); // eslint-disable-line

  protected readonly eventCallbackRegistry: util.LookupTable<StoreEvents, Map<string, unknown>>;

  protected readonly log = log.getLogger('store');

  protected constructor(id: string, type: string, owner: string, persist: boolean, initialState?: S) {
    this.id = uid.validate(id) ? uid.slug(id) : uid.slug(id, '4c3afe15-adac-4f9a-873a-d417d43228e7');
    this.type = uid.slug(type);
    this.owner = owner;
    this.eventCallbackRegistry = this.initEventCallbackRegistry();
    this.properties = this.createPropertyRegistry();
    this.persist = persist;

    [
      this.internalState,
      this.internalStateDoc
    ] = this.createStateAndDoc();

    this.initStoreWithState(initialState);
  }

  public get state(): S {
    return this.internalState.state;
  }

  public get snapshot(): S {
    return util.deepClone(this.state);
  }

  public get initialized(): boolean {
    return !!this.properties.state.initialized;
  }

  protected set initialized(initialized: boolean) {
    this.properties.state.initialized = initialized;
  }

  public get readonly(): boolean {
    return !!this.properties.state.readonly;
  }

  public set readonly(readonly: boolean) {
    this.properties.state.readonly = readonly;
  }

  public get blocking(): boolean {
    return !!this.properties.state.blocking && this.properties.state.blocking > 0;
  }

  public get dirty(): boolean {
    return !!this.properties.state.dirty;
  }

  public set dirty(dirty: boolean) {
    this.properties.state.dirty = dirty;
  }

  public get persist(): boolean {
    return !!this.properties.state.persist;
  }

  protected set persist(persist: boolean) {
    this.properties.state.persist = persist;
  }

  public toJSON(): S {
    return encode(this.state);
  }

  protected startBlocking(): void {
    this.properties.state.blocking = typeof this.properties.state.blocking === 'number' ? this.properties.state.blocking + 1 : 1;
  }

  protected stopBlocking(): void {
    this.properties.state.blocking = typeof this.properties.state.blocking === 'number' ? this.properties.state.blocking - 1 : 0;
  }

  protected get mutexRegistry(): MutexRegistry {
    return this.internalState.mutexRegistry;
  }

  protected get userMutexRegistry(): UserMutexRegistry {
    return this.internalState.userMutexRegistry;
  }

  public initStoreWithState(state?: S): boolean {
    if (!state || this.initialized) {
      return false;
    }

    this.initialized = true;
    this.dirty = true;

    const origin = 'init-' + this.internalStateDoc.guid;

    if (Object.keys(state).length > 0) {
      this.transactionRegistry.set(origin, {
        resolve: util.nop,
        result: undefined
      });
    }

    yjs.transact(this.internalStateDoc, () => {
      const stateToAssign = decode(state);

      Object.assign(this.internalState.state, stateToAssign);
    }, origin);

    return true;
  }

  public abstract patch<R>(callback: PatchCallback<S, R>): Promise<R>;

  public async mutex<T extends StateValue, R>(lockable: Lockable<T>, callback: PatchCallback<S, R>, enterIfNotOwnerAndReleaseAtEnd = true): Promise<R> {
    if (this.readonly) {
      throw new ReadonlyStateError();
    }

    await this.acquireMutex(lockable);

    try {
      return this.executeMutexCriticalSection(callback);
    } finally {
      if (enterIfNotOwnerAndReleaseAtEnd) {
        await this.releaseMutex(lockable);
      }
    }
  }

  public async tryMutex<T extends StateValue, R>(lockable: Lockable<T>, callback: PatchCallback<S, R>, enterIfNotOwnerAndReleaseAtEnd = true): Promise<R> {
    if (this.readonly) {
      throw new ReadonlyStateError();
    }

    if (!await this.tryAcquireMutex(lockable, enterIfNotOwnerAndReleaseAtEnd)) {
      throw new MutexError();
    }

    try {
      return await this.executeMutexCriticalSection(callback);
    } finally {
      if (enterIfNotOwnerAndReleaseAtEnd) {
        await this.releaseMutex(lockable);
      }
    }
  }

  public async acquireMutex<T extends StateValue>(lockable: Lockable<T>): Promise<boolean> {
    if (this.readonly) {
      throw new ReadonlyStateError();
    }

    const id = lockable._id;
    const operation = () => util.retryUntil(() => this.acquireMutexInternal(id));

    return this.performBlockingOperation(operation);
  }

  public async tryAcquireMutex<T extends StateValue>(lockable: Lockable<T>, failIfAlreadyAcquired = true): Promise<boolean> {
    if (this.readonly) {
      throw new ReadonlyStateError();
    }

    const id = lockable._id;
    const mutexOwner = this.isLocked(id);

    switch (mutexOwner) {
      case this.owner:
        return !failIfAlreadyAcquired;
      case undefined:
        return await this.performBlockingOperation(() => this.acquireMutexInternal(id));
      default:
        return false;
    }
  }

  public async releaseMutex<T extends StateValue>(lockable: Lockable<T>): Promise<boolean> {
    if (this.readonly) {
      throw new ReadonlyStateError();
    }

    const operation = () => util.retryUntil(() => this.releaseMutexInternal(lockable._id));

    return await this.performBlockingOperation(operation);
  }

  public async tryReleaseMutex<T extends StateValue>(lockable: Lockable<T>): Promise<boolean> {
    if (this.readonly) {
      throw new ReadonlyStateError();
    }

    const mutexOwner = this.isLocked(lockable);
    const operation = () => this.releaseMutexInternal(lockable._id);

    return mutexOwner === this.owner ? await this.performBlockingOperation(operation) : false;
  }

  public isLocked<T extends StateValue>(lockableOrId: Lockable<T> | string): string | undefined {
    const id = typeof lockableOrId === 'string' ? lockableOrId : lockableOrId?._id;

    return this.mutexRegistry[id];
  }

  public getLocks(owner?: string): util.LookupTable<string, true> {
    return this.userMutexRegistry[owner ?? this.owner] ?? {};
  }

  protected abstract executeMutexCriticalSection<R>(callback: PatchCallback<S, R>): Promise<R>;

  protected abstract acquireMutexInternal(id: string): Promise<boolean>;

  protected abstract releaseMutexInternal(id: string): Promise<boolean>;

  protected abstract handleUnresolvedUpdateEvent(update: Uint8Array, origin?: string): void;

  protected async performBlockingOperation<R>(operation: () => Promise<R>): Promise<R> {
    this.startBlocking();

    try {
      return await operation();
    } finally {
      this.stopBlocking();
    }
  }

  protected createPropertyRegistry(): PropertyRegistry<P> {
    return core.syncedStore({
      state: {}
    }) as PropertyRegistry<P>;
  }

  protected createStateAndDoc(): [InternalState<S>, yjs.Doc] {
    const doc = new yjs.Doc({
      guid: uid.slug()
    });
    const state: InternalState<S> = {
      state: {} as S,
      mutexRegistry: {},
      userMutexRegistry: {},
      meta: {}
    };
    const store = core.syncedStore(state, doc) as InternalState<S>;

    doc.on(yjs.UPDATE_EVENT, (update: Uint8Array, origin?: string) => this.handleDocUpdateEvent(update, origin));

    return [store, doc];
  }

  protected handleDocUpdateEvent(update: Uint8Array, origin?: string): void {
    this.dirty = true;

    if (!origin) {
      this.log.warn('yjs document update without an origin detected');

      return;
    }

    const callback = this.transactionRegistry.get(origin);

    if (!callback) {
      this.handleUnresolvedUpdateEvent(update, origin);

      return;
    }

    this.transactionRegistry.delete(origin);

    callback.resolve({
      update: update,
      origin: origin,
      result: callback.result
    });
  }

  protected transact<R>(mutation: () => R, originPrefix = '', originSuffix = uid.short()): Promise<Transaction<R>> {
    return new Promise<Transaction<R>>((resolve) => {
      const origin = originPrefix + originSuffix;

      this.transactionRegistry.set(origin, {
        resolve: resolve,
        result: undefined
      });

      this.internalStateDoc.transact(() => {
        try {
          this.performMutationWithinTransactionAndRegisterResult(mutation, origin);
        } catch (error) {
          this.log.error(error as Error);
        } finally {
          this.internalState.meta.revision = uid.short();
        }
      }, origin);
    });
  }

  protected performMutationWithinTransactionAndRegisterResult<R>(mutation: () => R, origin: string): void {
    const result = mutation();

    const registry = this.transactionRegistry.get(origin);

    if (registry) {
      registry.result = result;
    }
  }

  protected applyUpdate(doc: yjs.Doc, update: Uint8Array, originPrefix = '', originSuffix = uid.short(), applyFunc = yjs.applyUpdate, useTransactionRegistry = true): Promise<Transaction> {
    return new Promise((resolve, reject) => {
      const origin = originPrefix + originSuffix;

      if (useTransactionRegistry) {
        this.transactionRegistry.set(origin, {
          resolve: resolve,
          result: undefined
        });
      }

      try {
        applyFunc(doc, update, origin);
      } catch (error) {
        this.transactionRegistry.delete(origin);

        reject(error);
      }

      if (!useTransactionRegistry) {
        resolve({
          origin: origin,
          update: update,
          result: undefined
        });
      }
    });
  }

  public on(event: StoreEvents, callback: OnPatchCallback<S>): () => boolean {
    return this.registerEventListener(event, callback);
  }

  protected registerEventListener(event: StoreEvents, callback: unknown): () => boolean {
    const id = uid.slug();
    const offFunction = () => this.eventCallbackRegistry[event].delete(id);

    this.eventCallbackRegistry[event].set(id, callback);

    return offFunction;
  }

  protected fireEvent(event: StoreEvents, ...args: unknown[]): void { // eslint-disable-line
    const listeners = this.eventCallbackRegistry[event];

    // eslint-disable-next-line
    // @ts-ignore
    listeners.forEach(callback => callback(...args));
  }

  protected initEventCallbackRegistry(): util.LookupTable<StoreEvents, Map<string, unknown>> {
    return {
      'patch': new Map()
    };
  }
}
