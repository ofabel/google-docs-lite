import {RootStateTree} from './state';
import {IStore} from './type';
import {SyncStore} from './sync';

export type IStoreHandler<State extends RootStateTree, Store extends IStore<State>> = {
  readonly internal: Store;

  get state(): State;
}

export abstract class StoreHandler<State extends RootStateTree, Store extends IStore<State>> implements IStoreHandler<State, Store> {
  public readonly internal: Store;

  public constructor(store: Store) {
    this.internal = store;
  }

  public get state(): State {
    return this.internal.state;
  }

  public get ready(): boolean {
    return this.internal instanceof SyncStore ? this.internal.initialized && this.internal.ready && this.internal.synchronized && !this.internal.paused : this.internal.initialized;
  }

  public get blocking(): boolean {
    return this.internal.blocking;
  }
}
