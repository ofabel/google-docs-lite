import * as store from '../store';

export type IPersistenceAdapter = {
  get<S extends store.RootStateTree>(id: string): Promise<S>;

  set<S extends store.RootStateTree>(state: S): Promise<S>;

  has(id: string): Promise<boolean>;

  delete(id: string): Promise<boolean>;
}
