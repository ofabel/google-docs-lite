import * as store from '../core/store';

export type Document = {
  readonly _id: string;
  title: store.Lockable<string>;
  participants: {
    [id: string]: true;
  }
}

export const stateFactory = store.createStateFactory(id => ({
  _id: id(),
  _type: '549f2660-9589-4a86-8ed2-7ecaedeea326',
  _persist: true,
  participants: {} as {
    [sessionId: string]: {
      [documentId: string]: true
    };
  },
  documents: {} as {
    [id: string]: Document;
  }
}));

export type State = store.StateOf<typeof stateFactory>;
