import * as wodss from '@fhnw/wodss-shared';
import {connectToDatabase} from './db/driver';
import {MongoAdapter} from './db/adapter';

const log = wodss.core.log.getLogger();
const [dispatcher] = new wodss.core.mom.Builder().build();

const collectionName = 'editor';

connectToDatabase().then((db) => {
  const adapter = new MongoAdapter(db.collection(collectionName));

  wodss.core.hub.SyncStoreHub.init(dispatcher, adapter, 'server', 0, wodss.chat.stateFactory, wodss.index.stateFactory, wodss.user.stateFactory, wodss.editor.stateFactory);

  const broker = `Broker:      ${process.env.WODSS_MQTT_PROTOCOL}://${process.env.WODSS_MQTT_HOST}:${process.env.WODSS_MQTT_PORT}`;
  const database = `Database:    mongodb://${process.env.WODSS_MONGODB_USERNAME}@${process.env.WODSS_MONGODB_HOST}:${process.env.WODSS_MONGODB_PORT}/${process.env.WODSS_MONGODB_DATABASE}`;
  const clientId = `Client:      ${dispatcher.clientId}`;

  log.info(broker);
  log.info(database);
  log.info(clientId);

  log.info(`Revision:    ${process.env.WODSS_REVISION}`);
  log.info(`YJS Version: ${wodss.core.store.YJS_VERSION}`);
  log.info('-'.repeat(Math.max(broker.length, clientId.length, database.length)));
}).catch(log.error);
