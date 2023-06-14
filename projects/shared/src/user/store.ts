import * as core from '../core';
import {State, User} from './state';

export class UserStore extends core.store.StoreHandler<State, core.store.ISyncStore<State>> {
  constructor(store: core.store.ISyncStore<State>) {
    super(store);

    store.dispatcher.on('bye', sessionId => this.removeSession(sessionId));
  }

  public get sessionId(): string {
    return this.internal.owner;
  }

  public get id(): string {
    return this.state.sessions[this.sessionId];
  }

  public get nickname(): string {
    return this.state.users[this.id]?.nickname.value ?? core.util.getRandomName().map(core.util.ucfirst).join(' ')
  }

  public set nickname(nickname: string) {
    if (!this.state.users[this.id]) {
      return;
    }

    this.internal.mutex(this.state.users[this.id].nickname, state => {
      state.users[this.id].nickname.value = nickname;
    }, false)
  }

  public get color(): string {
    return this.state.users[this.id]?.color.value ?? core.util.getRandomColor()
  }

  public set color(color: string) {
    if (!this.state.users[this.id]) {
      return;
    }

    this.internal.mutex(this.state.users[this.id].color, state => {
      state.users[this.id].color.value = color;
    });
  }

  public get sessions(): string[] {
    return Object.keys(this.state.sessions);
  }

  public getUserBySession(session: string): User {
    const userId = this.state.sessions[session];

    return this.state.users[userId];
  }

  public getUserById(user: string): User {
    return this.state.users[user];
  }

  public async addSession(userId: string | null | undefined, firstname?: string, lastname?: string, color?: string): Promise<boolean> {
    if (!userId || !firstname || !lastname || !color) {
      return false;
    }

    return this.internal.patch(state => {
      if (!state.users[userId]) {
        state.users[userId] = {
          _id: userId,
          nickname: {
            _id: core.uid.slug(),
            value: `${firstname} ${lastname}`
          },
          color: {
            _id: core.uid.slug(),
            value: color
          }
        };
      }

      state.sessions[this.sessionId] = userId;

      return true;
    });
  }

  public removeSession(sessionId: string = this.sessionId): Promise<void> {
    return this.internal.patch(state => {
      try {
        delete state.sessions[sessionId];
      } catch (error) {
        // NOP
      }
    })
  }

  public hasSession(): boolean {
    return this.sessionId in this.state.sessions;
  }

  public async lockNickname(): Promise<boolean> {
    if (!this.state.users[this.id]) {
      return false;
    }

    return this.internal.acquireMutex(this.state.users[this.id].nickname);
  }

  public async unlockNickname(): Promise<boolean> {
    if (!this.state.users[this.id]) {
      return false;
    }

    return this.internal.releaseMutex(this.state.users[this.id].nickname);
  }

  public canChangeNickname(): boolean {
    if (!this.state.users[this.id]) {
      return true;
    }

    const lockOwner = this.internal.isLocked(this.state.users[this.id].nickname);


    return lockOwner === undefined || lockOwner === this.sessionId;
  }

  public removeStaleSessions(): Promise<void> {
    const staleSessions = this.sessions.filter(session => !this.internal.dispatcher.isActiveClient(session));

    return this.internal.patch(state => {
      for (const session of staleSessions) {
        try {
          delete state.sessions[session];
        } catch (error) {
          // NOP
        }
      }
    });
  }
}
