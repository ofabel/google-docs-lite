import * as store from '../core/store';

export type Message = {
  id: string;
  user: string;
  message: string;
  date: string;
};

export const stateFactory = store.createStateFactory(id => ({
  _id: id(),
  _type: '3057528f-a0cd-4bb5-8af7-80d76feb9f63',
  _persist: true,
  rooms: {} as {
    [id: string]: Message[];
  }
}));

export type State = store.StateOf<typeof stateFactory>;
