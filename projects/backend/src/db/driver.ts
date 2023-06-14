import * as mongodb from 'mongodb';

export async function connectToDatabase(): Promise<mongodb.Db> {
  const username = process.env.WODSS_MONGODB_USERNAME;
  const password = process.env.WODSS_MONGODB_PASSWORD;
  const host = process.env.WODSS_MONGODB_HOST;
  const port = process.env.WODSS_MONGODB_PORT;
  const database = process.env.WODSS_MONGODB_DATABASE;
  const url = `mongodb://${username}:${password}@${host}:${port}/${database}`;
  const client = new mongodb.MongoClient(url);

  await client.connect();

  return client.db(database);
}
