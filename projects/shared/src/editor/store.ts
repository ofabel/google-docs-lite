import * as core from '../core';
import {Paragraph, State} from './state';
import {decodeLongText} from '../core/store';

export class EditorStore extends core.store.StoreHandler<State, core.store.ISyncStore<State>> {
  public get paragraphs(): Paragraph[] {
    return this.state.order.value
      .filter((id, index, self) => self.indexOf(id) === index)
      .filter(id => this.state.paragraphs[id])
      .map(id => this.state.paragraphs[id].value);
  }

  public get numOfParagraphs(): number {
    return this.state.order.value.length;
  }

  public addParagraph(userId: string, refId?: string): Promise<string> {
    return this.internal.mutex(this.state.order, state => {
      const id = core.uid.slug();
      const date = new Date().toUTCString();

      state.paragraphs[id] = {
        _id: id,
        value: {
          _id: id,
          createdAt: date,
          createdBy: userId,
          modifiedAt: date,
          modifiedBy: userId,
          text: new core.store.LongText()
        }
      };

      const index = refId ? this.findIndex(refId) : state.order.value.length;

      state.order.value.splice(index, 0, id);

      return id;
    });
  }

  public async setParagraphText(id: string, userId: string, text: string): Promise<boolean> {
    if (!this.state.paragraphs[id]) {
      return false;
    }

    return this.internal.mutex(this.state.paragraphs[id], state => {
      decodeLongText([
        {
          nodeName: 'paragraph',
          attributes: {},
          children: [
            {
              text: [
                {
                  insert: text
                }
              ]
            }
          ]
        }
      ], state.paragraphs[id].value.text);

      state.paragraphs[id].value.modifiedAt = new Date().toUTCString();
      state.paragraphs[id].value.modifiedBy = userId;

      return true;
    });
  }

  public isFirst(id: string): boolean {
    return this.state.order.value[0] === id;
  }

  public isLast(id: string): boolean {
    return this.state.order.value[this.state.order.value.length - 1] === id;
  }

  public findIndex(id: string): number {
    return this.state.order.value.findIndex(item => item === id);
  }

  public async move(id: string, direction: 'up' | 'down'): Promise<boolean> {
    if (!this.state.paragraphs[id]) {
      return false;
    }

    return this.internal.mutex(this.state.order, state => {
      const index = this.findIndex(id);
      const target = index + (direction === 'up' ? -1 : 1);

      if (index === -1 || target < 0 || target > state.order.value.length - 1 || !state.paragraphs[id]) {
        return false;
      }

      delete state.order.value[index];
      state.order.value.splice(target, 0, id);

      return true;
    });
  }

  public async remove(id: string): Promise<boolean> {
    if (this.internal.isLocked(this.state.paragraphs[id])) {
      return false;
    }

    return this.internal.mutex(this.state.order, state => {
      const index = this.findIndex(id);

      if (index !== -1) {
        delete state.order.value[index];
        delete state.paragraphs[id];
      }

      return index !== -1;
    });
  }

  public async update(id: string, user: string): Promise<boolean> {
    if (!this.state.paragraphs[id]) {
      return false;
    }

    return this.internal.mutex(this.state.paragraphs[id], state => {
      state.paragraphs[id].value.modifiedAt = new Date().toUTCString();
      state.paragraphs[id].value.modifiedBy = user;

      return true;
    }, false);
  }

  public lock(id: string): Promise<boolean> {
    return this.internal.acquireMutex(this.state.paragraphs[id]);
  }

  public unlock(id: string): Promise<boolean> {
    return this.internal.releaseMutex(this.state.paragraphs[id]);
  }

  public isLocked(id: string): boolean {
    return id ? this.internal.isLocked(this.state.paragraphs[id]) !== undefined : false;
  }

  public isLockOwner(id: string): boolean {
    return this.internal.isLocked(this.state.paragraphs[id]) === this.internal.owner;
  }

  public hasLock(): boolean {
    const locks = this.internal.getLocks();
    const numOfLocks = Object.keys(locks).length;

    return this.internal.isLocked(this.state.order) === this.internal.owner ? numOfLocks > 1 : numOfLocks > 0;
  }

  public canSaveOrEdit(id: string): boolean {
    if (this.isLocked(id)) {
      return this.isLockOwner(id);
    } else {
      return !this.hasLock();
    }
  }

  public canRemove(id: string): boolean {
    return !this.isLocked(id);
  }

  public async toggleLock(id: string): Promise<boolean> {
    if (this.isLocked(id) && this.isLockOwner(id)) {
      return this.unlock(id);
    }
    if (!this.isLocked(id)) {
      return this.lock(id);
    }

    return false;
  }

  public checkIntegrity(): boolean {
    const numOfUniqueParagraphs = this.paragraphs.length;
    return numOfUniqueParagraphs === Object.keys(this.state.paragraphs).length && numOfUniqueParagraphs === this.state.order.value.length;
  }

  public resetState(): Promise<void> {
    return this.internal.patch(state => {
      state.order.value = [];
      state.paragraphs = {};
    });
  }
}
