import {IPersistenceAdapter} from '@fhnw/wodss-shared/src/core/db';
import * as wodss from '@fhnw/wodss-shared';
import * as mongodb from 'mongodb';

export class MongoAdapter implements IPersistenceAdapter {
  private readonly log = wodss.core.log.getLogger('mongodb');

  private readonly collection: mongodb.Collection;

  constructor(collection: mongodb.Collection) {
    this.collection = collection;
  }

  public async get<S extends wodss.core.store.RootStateTree>(id: string): Promise<S> {
    this.log.debug(`Get ${id}`);

    try {
      const json = await this.collection.findOne({
        id: id
      });

      if (!json) {
        throw new Error(`state with id ${id} not found in storage`);
      }

      return JSON.parse(json.value) as S;
    } catch (error) {
      this.log.error(error as string);

      throw error;
    }
  }

  public async set<S extends wodss.core.store.RootStateTree>(state: S): Promise<S> {
    this.log.debug(`Set ${state._id}`);

    try {
      const hasOne = await this.has(state._id);
      const json = JSON.stringify(state);

      if (hasOne) {
        await this.collection.updateOne({
          id: state._id
        }, {
          $set: {
            value: json
          }
        });
      } else {
        await this.collection.insertOne(
          {
            id: state._id,
            value: json
          });
      }
    } catch (error) {
      this.log.error(error as string);
    }

    return state;
  }

  public async has(id: string): Promise<boolean> {
    this.log.debug(`Has ${id}`);

    try {
      const result = await this.collection.findOne({
        id: id
      });

      return result !== null;
    } catch (error) {
      this.log.error(error as string);

      return false;
    }
  }

  public async delete(id: string): Promise<boolean> {
    this.log.debug(`Delete ${id}`);

    try {
      const result = await this.collection.deleteOne({
        id: id
      });

      return result.acknowledged;
    } catch (error) {
      this.log.error(error as string);

      return false;
    }
  }
}
