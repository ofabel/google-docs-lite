import {Lockable, RootStateTree, StateValue} from './state';
import * as util from '../util';

export type PatchCallback<S extends RootStateTree, R> = (state: S) => R;

export class ReadonlyStateError extends Error {
  constructor() {
    super('cannot modify a readonly state');
  }
}

export class MutexError extends Error {
  constructor() {
    super('cannot acquire mutex');
  }
}

export type OnPatchCallback<S extends RootStateTree> = (store: IStore<S>) => any; // eslint-disable-line

export type PatchEvent = 'patch';

export type StoreEvents = PatchEvent;

export type IStore<S extends RootStateTree> = {
  /**
   * The id of this store, e.g. 7f4875ab-ba58-4af1-8222-39791eb1ce9c
   */
  readonly id: string;

  /**
   * The type of this store, e.g. 7f4875ab-ba58-4af1-8222-39791eb1ce9c
   */
  readonly type: string;

  /**
   * The current owner of this store.
   */
  readonly owner: string;

  /**
   * Indicate if this store is initialized with a state.
   */
  get initialized(): boolean;

  /**
   * Indicate if this store has a readonly state.
   */
  get readonly(): boolean;

  /**
   * Change the readonly flag of this store.
   */
  set readonly(readonly: boolean);

  /**
   * Check if this store is currently in a blocking state (e.g. waiting to acquire a mutex).
   */
  get blocking(): boolean;

  /**
   * Check if the state in this store is dirty. Every mutation on the store's state results in a dirty state.
   */
  get dirty(): boolean;

  /**
   * Reset the dirty flag.
   */
  set dirty(dirty: boolean);

  /**
   * Check if the state in this store should be persisted.
   */
  get persist(): boolean;

  /**
   * Get the reactive state of this store. Don't alter the object in the state! Mutations must be performed through {@link patch} or {@link mutex}.
   */
  get state(): S;

  /**
   * Get a snapshot of the state in this store (not reactive).
   */
  get snapshot(): S;

  /**
   * Convert the state of this store to a JSON serializable object.
   */
  toJSON(): S;

  /**
   * Initialize the store with a state.
   */
  initStoreWithState(state: S): boolean;

  /**
   * Perform a state mutation through a given callback function.
   */
  patch<R>(callback: PatchCallback<S, R>): Promise<R>;

  /**
   * Perform a state mutation on a lockable resource through a given callback function. Blocks until success.
   */
  mutex<T extends StateValue, R>(lockable: Lockable<T>, callback: PatchCallback<S, R>, enterIfNotOwnerAndReleaseAtEnd?: boolean): Promise<R>;

  /**
   * Try to perform a state mutation on a lockable resource through a given callback function. The attempt may fail.
   */
  tryMutex<T extends StateValue, R>(lockable: Lockable<T>, callback: PatchCallback<S, R>, enterIfNotOwnerAndReleaseAtEnd?: boolean): Promise<R>;

  /**
   * Acquire a mutex. Blocks until success.
   */
  acquireMutex<T extends StateValue>(lockable: Lockable<T>): Promise<boolean>;

  /**
   * Try to acquire a mutex. The attempt may fail if the mutex is already acquired by someone else.
   */
  tryAcquireMutex<T extends StateValue>(lockable: Lockable<T>, failIfAlreadyAcquired?: boolean): Promise<boolean>;

  /**
   * Release a mutex. Blocks until success.
   */
  releaseMutex<T extends StateValue>(lockable: Lockable<T>): Promise<boolean>;

  /**
   * Try to release an acquired mutex. The attempt may fail.
   */
  tryReleaseMutex<T extends StateValue>(lockable: Lockable<T>): Promise<boolean>;

  /**
   * Check if a mutex is locked and return the owner of the mutex.
   */
  isLocked<T extends StateValue>(lockable: Lockable<T>): string | undefined;

  /**
   * Check if a mutex is locked and return the owner of the mutex.
   */
  isLocked(id: string): string | undefined;

  /**
   * Get all locks of a specific owner.
   */
  getLocks(owner?: string): util.LookupTable<string, true>;

  /**
   * Handle on patch events.
   */
  on(event: PatchEvent, callback: OnPatchCallback<S>): () => boolean;
}
