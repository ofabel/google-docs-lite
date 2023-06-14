import * as wodss from '@fhnw/wodss-shared'
import {EditorState, State} from '@/store/session/state'

export class SessionStore extends wodss.core.store.StoreHandler<State, wodss.core.store.ILocalStore<State>> {
  constructor(store: wodss.core.store.ILocalStore<State>) {
    super(store);

    store.on('patch', () => this.storeState());

    this.init();
  }

  public get currentPage(): string | undefined {
    return this.state.currentPage;
  }

  public set currentPage(currentPage: string | undefined) {
    this.internal.patch(state => {
      state.currentPage = currentPage;
    });
  }

  public get userId(): string | undefined {
    return this.state.userId;
  }

  public set userId(userId: string | undefined) {
    this.internal.patch(state => {
      state.userId = userId;
    });
  }

  public get editMode(): boolean {
    return this.state.editMode;
  }

  public set editMode(editMode: boolean) {
    this.internal.patch(state => {
      state.editMode = editMode;
    });
  }

  public get firstname(): string {
    return this.state.firstname ?? '';
  }

  public get lastname(): string {
    return this.state.lastname ?? '';
  }

  public get color(): string {
    return this.state.color ?? '';
  }

  public setEditorState(documentId: string, editorState: EditorState) {
    this.internal.patch(state => {
      state.editorStates[documentId] = editorState;
    });
  }

  public getCurrentEditorPage(documentId: string): EditorState {
    return this.state.editorStates[documentId];
  }

  public async clear(): Promise<void> {
    await this.internal.patch(state => {
      state.currentPage = undefined;
      state.userId = undefined;
      state.editMode = false;
      state.editorStates = {};
      state.lastname = undefined;
      state.firstname = undefined;
      state.color = undefined;
    });

    await this.init();
  }

  protected storeState(): void {
    if (!this.internal.dirty) {
      return;
    }

    const json = JSON.stringify(this.internal);

    sessionStorage.setItem(this.internal.id, json);

    this.internal.dirty = false;
  }

  protected init(): void {
    if (this.state.firstname && this.state.lastname) {
      return;
    }

    this.internal.patch(state => {
      const [firstname, lastname] = wodss.core.util.getRandomName();

      state.firstname = wodss.core.util.ucfirst(firstname);
      state.lastname = wodss.core.util.ucfirst(lastname);
      state.color = wodss.core.util.getRandomColor();
    });
  }
}
