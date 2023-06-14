import * as core from '../core';
import {Message, State} from './state';

export class ChatStore extends core.store.StoreHandler<State, core.store.ISyncStore<State>> {
  public getMessagesByRoom(room: string): Message[] {
    return this.state.rooms[room] ?? [];
  }

  public sendMessage(room: string, user: string, message: string): Promise<string> {
    return this.internal.patch(state => {
      const id = core.uid.slug();
      const date = new Date().toISOString();
      const messageToSend: Message = {
        message: message,
        user: user,
        date: date,
        id: id
      };

      if (!state.rooms[room]) {
        state.rooms[room] = [];
      }

      state.rooms[room].push(messageToSend);

      return id;
    });
  }
}
