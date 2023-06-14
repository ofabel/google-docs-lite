import * as core from '../core';
import {Document, State} from './state';

export class IndexStore extends core.store.StoreHandler<State, core.store.ISyncStore<State>> {
  constructor(store: core.store.ISyncStore<State>) {
    super(store);

    store.dispatcher.on('bye', sessionId => this.removeParticipant(sessionId));
  }

  public get documents(): Document[] {
    return Object.values(this.state.documents);
  }

  public createDocument(title: string): Promise<string> {
    return this.internal.patch(state => {
      const id = core.uid.slug();

      state.documents[id] = {
        _id: id,
        title: {
          _id: core.uid.slug(),
          value: title
        },
        participants: {}
      };

      return id;
    });
  }

  public canRemoveDocument(id: string): boolean {
    return Object.keys(this.state.documents[id]?.participants ?? {}).length <= 1;
  }

  public removeDocument(id: string): Promise<void> {
    return this.internal.patch(state => {
      try {
        delete state.documents[id];
      } catch (error) {
        // NOP
      }
    });
  }

  public hasDocument(id?: string): boolean {
    return id ? id in this.state.documents : false;
  }

  public addParticipantToDocument(id: string): Promise<void> {
    return this.internal.patch(state => {
      try {
        state.documents[id].participants[this.internal.owner] = true;
      } catch (error) {
        // NOP
      }

      try {
        if (!state.participants[this.internal.owner]) {
          state.participants[this.internal.owner] = {};
        }

        state.participants[this.internal.owner][id] = true;
      } catch (error) {
        // NOP
      }
    });
  }

  public removeParticipantFromDocument(id: string): Promise<void> {
    return this.internal.patch(state => {
      try {
        delete state.documents[id].participants[this.internal.owner];
      } catch (error) {
        // NOP
      }

      try {
        delete state.participants[this.internal.owner][id];
      } catch (error) {
        // NOP
      }
    });
  }

  public async lock(id: string): Promise<boolean> {
    if (!this.state.documents[id]) {
      return false;
    }

    return this.internal.acquireMutex(this.state.documents[id].title);
  }

  public async unlock(id: string): Promise<boolean> {
    if (!this.state.documents[id]) {
      return false;
    }

    return this.internal.releaseMutex(this.state.documents[id].title);
  }

  public isLocked(id: string): string | undefined {
    if (!this.state.documents[id]) {
      return undefined;
    }

    return this.internal.isLocked(this.state.documents[id].title);
  }

  public canChangeTitle(id: string): boolean {
    const lockOwner = this.isLocked(id);

    return lockOwner === undefined || lockOwner === this.internal.owner;
  }

  public async setTitle(id: string, title: string) {
    if (!this.state.documents[id]) {
      return;
    }

    await this.internal.mutex(this.state.documents[id].title, state => {
      state.documents[id].title.value = title;
    }, false);
  }

  public getTitle(id: string): string {
    return this.state.documents[id]?.title.value ?? '';
  }

  public getParticipants(id: string): string[] {
    return Object.keys(this.state.documents[id]?.participants ?? {});
  }

  public removeStaleParticipants(): Promise<void> {
    const staleParticipants = Object.keys(this.state.participants).filter(participant => !this.internal.dispatcher.isActiveClient(participant));

    return this.internal.patch(state => {
      for (const participant of staleParticipants) {
        this.removeParticipantInternal(state, participant);
      }
    });
  }

  public removeParticipant(participant: string): Promise<void> {
    return this.internal.patch(state => this.removeParticipantInternal(state, participant));
  }

  public removeParticipantInternal(state: State, participant: string): void {
    const documents = Object.keys(state.participants[participant] ?? {});

    try {
      delete state.participants[participant];
    } catch (error) {
      // NOP
    }

    for (const document of documents) {
      try {
        delete state.documents[document].participants[participant];
      } catch (error) {
        // NOP
      }
    }
  }
}
