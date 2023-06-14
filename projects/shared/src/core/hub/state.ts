import * as uid from '../uid';
import * as store from '../store';

export type Server = {
  id: string;
}

export type Clients = {
  [id: string]: Record<string, true>;
}

export type Handles = {
  [id: string]: Record<string, string | true> & {
    _type: string;
  };
}

export const stateId = uid.slug('09d8c22f-4f86-4c26-bf35-3e59ff6a2072'); // TODO: get from env variables

export const stateType = uid.slug('720007ad-025d-4ae3-a32b-81caa1a11add');

export const stateFactory = store.createStateFactory(() => ({
  _id: stateId,
  _type: stateType,
  _persist: false,
  serverOrder: [] as Server[],
  servers: {} as Record<string, boolean>,
  handles: {} as Handles,
  clients: {} as Clients
}));

export type State = store.StateOf<typeof stateFactory>;
