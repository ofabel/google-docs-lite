import * as wodss from '@fhnw/wodss-shared';

export type EditorState = {
  currentPageValue: number,
  paragraphInScope?: string,
  paragraphInScopeValue?: string,
  referenceInScope?: string,
  referenceInScopeValue?: string
};

const stateFactory = wodss.core.store.createStateFactory(id => ({
  _id: id(),
  _type: 'cb9785e9-133d-45bb-ae50-86c5be376889',
  _persist: false,
  currentPage: undefined as undefined | string,
  userId: undefined as undefined | string,
  editMode: false as boolean,
  editorStates: {} as Record<string, EditorState>,
  firstname: undefined as undefined | string,
  lastname: undefined as undefined | string,
  color: undefined as undefined | string
}));

const state = stateFactory.create('253d45bc-f697-4c7f-8c0a-37b6bae26c58');

export const id = state._id;

export const json = JSON.stringify(state);

export type State = wodss.core.store.StateOf<typeof stateFactory>;
