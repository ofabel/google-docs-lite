import * as store from '../store';
import {IPersistenceAdapter} from './adapter';

export class MemoryAdapter implements IPersistenceAdapter {
  private readonly storage: Map<string, string> = new Map();

  public async get<S extends store.RootStateTree>(id: string): Promise<S> {
    const json = this.storage.get(id);

    if (!json) {
      throw new Error(`state with id ${id} not found in storage`);
    }

    return JSON.parse(json) as S;
  }

  public async set<S extends store.RootStateTree>(state: S): Promise<S> {
    const json = JSON.stringify(state);

    this.storage.set(state._id, json);

    return state;
  }

  public async has(id: string): Promise<boolean> {
    return this.storage.has(id);
  }

  public async delete(id: string): Promise<boolean> {
    return this.storage.delete(id);
  }
}
