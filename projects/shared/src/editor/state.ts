import * as store from '../core/store';

export type Paragraph = {
  readonly _id: string;
  createdAt: string;
  createdBy: string;
  modifiedAt: string;
  modifiedBy: string;
  text: store.LongText;
};

export const stateFactory = store.createStateFactory(id => ({
  _id: id(),
  _type: 'f115adaf-611c-4409-a107-b093b725d013',
  _persist: true,
  order: {
    _id: id(),
    value: [] as string[]
  } as store.Lockable<string[]>,
  paragraphs: {} as {
    [id: string]: store.Lockable<Paragraph>;
  }
}));

export type State = store.StateOf<typeof stateFactory>;
