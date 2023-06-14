import {ISyncStore, StoreHandler} from '../store';
import {State} from './state';

export class HubStoreHandler extends StoreHandler<State, ISyncStore<State>> {
  public async init(activeClients: string[], ranking: string[]): Promise<boolean> {
    if (this.internal.readonly) {
      return true;
    }

    return this.internal.patch(state => {
      activeClients.forEach(clientId => HubStoreHandler.addClientInternal(state, clientId));

      state.serverOrder = ranking.map(candidate => ({
        id: candidate
      }));

      ranking.forEach(candidate => state.servers[candidate] = candidate === this.internal.owner);

      return true;
    });
  }

  public async changeLeadership(clientId: string = this.internal.owner): Promise<void> {
    if (this.internal.readonly) {
      return;
    }

    await this.internal.patch(state => state.servers[clientId] = true);
  }

  public async addCandidate(clientId: string, isCurrentLeader = false): Promise<number> {
    if (this.internal.readonly) {
      return 0;
    }

    return this.internal.patch(state => {
      const numOfCandidates = HubStoreHandler.addCandidateInternal(state, clientId, isCurrentLeader);

      HubStoreHandler.addClientInternal(state, clientId);

      return numOfCandidates;
    });
  }

  public async addClient(clientId: string): Promise<void> {
    if (this.internal.readonly) {
      return;
    }

    return this.internal.patch(state => HubStoreHandler.addClientInternal(state, clientId));
  }

  public async removeClientOrCandidateAndCleanOpenHandles(clientId: string): Promise<Set<[id: string, type: string]>> {
    if (this.internal.readonly) {
      return new Set();
    }

    return this.internal.patch(state => {
      HubStoreHandler.removeCandidate(state, clientId);

      return HubStoreHandler.removeClientAndRelatedHandles(state, clientId);
    });
  }

  public async openHandle(clientId: string, id: string, type: string): Promise<number> {
    if (this.internal.readonly) {
      return 0;
    }

    return this.internal.patch(state => {
      if (!state.handles[id]) {
        state.handles[id] = {
          _type: type
        };
      }

      if (!state.clients[clientId]) {
        state.clients[clientId] = {};
      }

      state.handles[id][clientId] = true;
      state.clients[clientId][id] = true;

      return Object.keys(state.handles[id]).length - 1;
    });
  }

  public async closeHandle(clientId: string, handle: string): Promise<number> {
    if (this.internal.readonly) {
      return 0;
    }

    return await this.internal.patch(state => {
      if (clientId in state.clients) {
        delete state.clients[clientId][handle];
      }

      if (handle in state.handles) {
        delete state.handles[handle][clientId];
      }

      if (Object.keys(state.handles[handle] ?? {}).length === 1) {
        delete state.handles[handle];
      }

      return state.handles[handle] ? Object.keys(state.handles[handle]).length - 1 : 0;
    });
  }

  private static addClientInternal(state: State, clientId: string) {
    if (!state.clients[clientId]) {
      state.clients[clientId] = {};
    }
  }

  private static addCandidateInternal(state: State, clientId: string, isCurrentLeader: boolean): number {
    const numOfCandidates = state.serverOrder.push({id: clientId});

    state.servers[clientId] = isCurrentLeader;

    return numOfCandidates;
  }

  private static removeClientAndRelatedHandles(state: State, clientId: string): Set<[id: string, type: string]> {
    const handles = Object.keys(state.clients[clientId] ?? {});

    if (clientId in state.clients) {
      delete state.clients[clientId];
    }

    const removedHandles = new Set<[id: string, type: string]>();

    for (const handle of handles) {
      delete state.handles[handle][clientId];

      // cleanup related empty handles
      if (Object.keys(state.handles[handle] ?? {}).length === 1) {
        const type = state.handles[handle]._type;

        delete state.handles[handle];

        removedHandles.add([handle, type]);
      }
    }

    return removedHandles;
  }

  private static removeCandidate(state: State, clientId: string) {
    if (clientId in state.servers) {
      const index = state.serverOrder.findIndex(server => server.id === clientId);

      if (index !== -1) {
        delete state.serverOrder[index];
        delete state.servers[clientId];
      }
    }
  }
}
