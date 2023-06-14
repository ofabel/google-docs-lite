import * as store from '../store';
import {IPersistenceAdapter} from './adapter';

export class DummyAdapter implements IPersistenceAdapter {
  public async get<S extends store.RootStateTree>(): Promise<S> {
    return {} as S;
  }

  public async set<S extends store.RootStateTree>(state: S): Promise<S> {
    return state;
  }

  public async has(): Promise<boolean> {
    return false;
  }

  public async delete(): Promise<boolean> {
    return true;
  }
}
