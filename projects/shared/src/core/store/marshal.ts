import * as core from '@syncedstore/core';
import {LongText, RootStateTree, StateTree, StateValue} from './state';
import * as yjs from './yjs';

type EncodedLongText = {
  nodeName: string;
  attributes: Record<string, string>;
  children: EncodedLongText[];
} | {
  text: {
    insert: string;
  }[];
} | EncodedLongText[];

function encodeLongTextInternal(source: LongText | yjs.XmlText | yjs.XmlElement): EncodedLongText {
  if (source instanceof yjs.XmlText) {
    return {
      text: source.toDelta()
    };
  } else {
    const children = [];

    for (let i = 0; i < source.length; i++) {
      const element = source.get(i);
      const child = encodeLongTextInternal(element);

      children.push(child);
    }

    return source instanceof yjs.XmlElement ? {
      nodeName: source.nodeName,
      attributes: source.getAttributes(),
      children: children
    } : children;
  }
}

const longTextId = '_8ibG_8r7Qm2EO3gqgG1HRQ';

function encodeLongText(source: LongText): StateTree {
  const target: StateTree = {};

  target[longTextId] = encodeLongTextInternal(source) as StateTree;

  return target;
}

function decodeLongTextInternal(source: EncodedLongText): yjs.XmlText | yjs.XmlElement | Array<yjs.XmlElement | yjs.XmlText> {
  if (Array.isArray(source)) {
    return source.map(item => decodeLongTextInternal(item)) as Array<yjs.XmlElement | yjs.XmlText>;
  }

  if ('text' in source) {
    const text = new yjs.XmlText();

    text.applyDelta(source.text);

    return text;
  }

  if ('nodeName' in source) {
    const element = new yjs.XmlElement(source.nodeName);

    for (const [key, value] of Object.entries(source.attributes)) {
      element.setAttribute(key, value);
    }

    const children = decodeLongTextInternal(source.children) as Array<yjs.XmlElement | yjs.XmlText>;

    element.push(children);

    return element;
  }

  throw new Error('can not decode element')
}

export function decodeLongText(source: EncodedLongText, text = new LongText()): LongText {
  const content = decodeLongTextInternal(source);

  text.push(content as Array<yjs.XmlElement | yjs.XmlText>);

  return text;
}

function decodeStateValue<S extends StateValue>(source: S): StateValue {
  if (source === null || source === undefined) {
    return source;
  }

  if (Array.isArray(source)) {
    return source.map(item => decodeStateValue(item)) as StateValue;
  }

  if (typeof source === 'object') {
    const target: StateTree = {};

    for (const [key, value] of Object.entries(source)) {
      if (key === longTextId) {
        return decodeLongText(value);
      } else {
        target[key] = decodeStateValue(value);
      }
    }

    return target;
  }

  return source;
}

type InternalStateValue<T extends StateValue> = T | yjs.Array<T> | yjs.Map<T>;

function encodeYjsStateValue<T extends StateValue>(source: InternalStateValue<T>): StateValue {
  if (source === null || source === undefined) {
    return source;
  }

  if (source instanceof yjs.Array) {
    return source.map(item => encodeYjsStateValue(item)) as StateTree[];
  }

  if (source instanceof yjs.Map) {
    const target: StateTree = {};

    for (const [key, value] of source.entries()) {
      target[key] = value instanceof LongText ? encodeLongText(value) : encodeYjsStateValue(value);
    }

    return target;
  }

  return source;
}

function encodePlainStateValue<T extends StateValue>(source: T): StateValue {
  if (source === null || source === undefined) {
    return source;
  }

  if (Array.isArray(source)) {
    return source.map(item => encodePlainStateValue(item)) as StateValue;
  }

  if (typeof source === 'object') {
    const target: StateTree = {};

    for (const [key, value] of Object.entries(source)) {
      target[key] = value instanceof LongText ? encodeLongText(value) : encodePlainStateValue(value);
    }

    return target;
  }

  return source;
}

export function encode<S extends RootStateTree>(state: S): S {
  const internal = core.getYjsValue(state) as InternalStateValue<S> | undefined;

  return internal ? encodeYjsStateValue(internal) as S : encodePlainStateValue(state) as S;
}

export function decode<S extends RootStateTree>(state: S): S {
  return decodeStateValue(state) as S;
}

export function clone<S extends RootStateTree>(state: S): S {
  const clone = encode(state);

  return decode(clone);
}
