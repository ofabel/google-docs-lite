import * as uid from '../uid';
import {AbstractStore} from './abstract';
import {RootStateTree} from './state';
import {IStore, PatchCallback, ReadonlyStateError} from './type';


export type ILocalStore<S extends RootStateTree> = IStore<S>;

export class LocalStore<S extends RootStateTree> extends AbstractStore<S> implements ILocalStore<S> {
  public async patch<R>(callback: PatchCallback<S, R>): Promise<R> {
    if (this.readonly) {
      throw new ReadonlyStateError();
    }

    const {result} = await this.transact(() => callback(this.state), 'patch-');

    this.fireEvent('patch', this);

    return result;
  }

  protected async executeMutexCriticalSection<R>(callback: PatchCallback<S, R>): Promise<R> {
    const {result} = await this.transact(() => callback(this.state), 'mutex-');

    this.fireEvent('patch', this);

    return result;
  }

  protected async acquireMutexInternal(id: string): Promise<boolean> {
    await this.transact(() => {
      this.mutexRegistry[id] = this.owner;

      if (!this.userMutexRegistry[this.owner]) {
        this.userMutexRegistry[this.owner] = {};
      }

      this.userMutexRegistry[this.owner][id] = true;
    }, 'acquire-mutex-');

    return this.isLocked(id) === this.owner;
  }

  protected async releaseMutexInternal(id: string): Promise<boolean> {
    await this.transact(() => {
      delete this.mutexRegistry[id];
      delete this.userMutexRegistry[this.owner][id];
    }, 'release-mutex-');

    return this.mutexRegistry[id] !== this.owner;
  }

  protected handleUnresolvedUpdateEvent(_update: Uint8Array, origin?: string): void {
    this.log.warn(`handle unresolved update event from ${origin?.toString()}`);
  }

  public static init<S extends RootStateTree>(state: S) {
    const id = state._id;
    const type = state._type;
    const persist = state._persist as boolean ?? false;
    const owner = uid.slug('baf5d55b-176c-4027-bb38-f6fa11367125');

    return new this(id, type, owner, persist, state);
  }
}
