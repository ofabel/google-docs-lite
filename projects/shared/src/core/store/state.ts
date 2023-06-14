import * as core from '@syncedstore/core';
import * as util from '../util';
import * as uid from '../uid';

export type RootStateTree = StateTree & {
  readonly _id: string;

  readonly _type: string;
}

export type StateTree = {
  [key: string]: StateValue;
}

export type Lockable<T extends StateValue> = {
  readonly _id: string;

  value: T;
}

export type LongText = core.SyncedXml;

export const LongText = core.SyncedXml;

export type StateValue = StateTree | string | number | boolean | undefined | null | LongText | Array<StateValue>;

export type IdProducer = () => string;

export type StateTreeShapeProducer<S extends RootStateTree> = (id: IdProducer) => S & {
  readonly _persist: boolean;
};

export class StateTreeFactory<S extends RootStateTree> {
  public readonly type: string;

  public readonly persist: boolean;

  private readonly shapeProducer: StateTreeShapeProducer<S>;

  public constructor(shapeProducer: StateTreeShapeProducer<S>) {
    const state = shapeProducer(uid.slug);

    this.type = uid.slug(state._type);
    this.persist = state._persist;
    this.shapeProducer = shapeProducer;
  }

  public create(id?: string): S {
    if (id && !uid.validate(id)) {
      throw new TypeError(`${id} is no valid UUID`);
    }

    const state = this.shapeProducer(uid.slug);
    const _id = uid.slug(id ?? state._id);
    const _type = uid.slug(state._type);

    return util.deepClone({
      ...state,
      _id: _id,
      _type: _type
    } as S);
  }
}

export function createStateFactory<S extends RootStateTree>(shapeProducer: StateTreeShapeProducer<S>): StateTreeFactory<S> {
  return new StateTreeFactory(shapeProducer);
}

export type StateOf<Factory extends StateTreeFactory<any>> = { // eslint-disable-line
  [Property in keyof ReturnType<Factory['create']> as Exclude<Property, '_id' | '_type' | '_persist'>]: ReturnType<Factory['create']>[Property];
} & {
  readonly _id: ReturnType<Factory['create']>['_id'];

  readonly _type: ReturnType<Factory['create']>['_type'];
};
