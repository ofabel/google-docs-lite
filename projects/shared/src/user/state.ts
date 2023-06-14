import * as store from '../core/store';

export type User = {
  readonly _id: string;
  nickname: store.Lockable<string>;
  color: store.Lockable<string>;
}

export const stateFactory = store.createStateFactory(id => ({
  _id: id(),
  _type: 'd72c873e-e7a4-4e85-9f5f-4cd0199075b9',
  _persist: true,
  users: {} as {
    [id: string]: User;
  },
  sessions: {} as {
    [id: string]: string;
  }
}));

export type State = store.StateOf<typeof stateFactory>;
