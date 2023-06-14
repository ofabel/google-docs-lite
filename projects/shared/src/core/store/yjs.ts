import * as yjs from 'yjs';

export type Version = 1 | 2;

export const VERSION: Version = parseInt(process.env.WODSS_YJS_VERSION ?? process.env.VUE_APP_WODSS_YJS_VERSION ?? '1') as Version;

export type Transaction = yjs.Transaction;

export type XmlFragment = yjs.XmlFragment;

export const XmlFragment = yjs.XmlFragment;

export type Array<T> = yjs.Array<T>;

export const Array = yjs.Array;

export type Map<T> = yjs.Map<T>;

export const Map = yjs.Map;

export type XmlElement = yjs.XmlElement;

export const XmlElement = yjs.XmlElement;

export type XmlText = yjs.XmlText;

export const XmlText = yjs.XmlText;

export type Text = yjs.Text;

export const Text = yjs.Text;

export type Doc = yjs.Doc;

export const Doc = yjs.Doc;

export const UPDATE_EVENT = VERSION === 1 ? 'update' : 'updateV2';

export const transact = yjs.transact;

export const encodeStateAsUpdateV1 = yjs.encodeStateAsUpdate;

export const encodeStateAsUpdate = VERSION === 1 ? yjs.encodeStateAsUpdate : yjs.encodeStateAsUpdateV2;

export const applyUpdateV1 = yjs.applyUpdate;

export const applyUpdate = VERSION === 1 ? yjs.applyUpdate : yjs.applyUpdateV2;

export const encodeStateVector = yjs.encodeStateVector;

export const mergeUpdates = VERSION === 1 ? yjs.mergeUpdates : yjs.mergeUpdatesV2;
