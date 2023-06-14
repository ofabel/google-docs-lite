import * as wodss from '@fhnw/wodss-shared';
import * as path from 'path';
import * as worker from 'worker_threads';
import * as os from 'os';
import {editorStoreId, topicPrefix} from './config';

describe('editor.EditorStore', () => {
  const duration = 0.5 * 60 * 1000;

  jest.setTimeout(duration + 10 * 1000);

  let dispatcher: wodss.core.mom.IDispatcher;

  beforeAll(() => {
    [dispatcher] = new wodss.core.mom.Builder().withTopicPrefix(topicPrefix).build();
  });

  afterAll(async () => {
    await dispatcher.destroy();
  });

  it(`can mutate the editor state concurrently with ${os.cpus().length} threads`, async () => {
    const adapter = new wodss.core.db.MemoryAdapter();
    const hub = await wodss.core.hub.SyncStoreHub.init(dispatcher, adapter, 'server', 0, wodss.editor.stateFactory)[1];

    await wodss.core.util.waitUntil(() => hub.isServer());

    const store = await hub.open(editorStoreId, wodss.editor.stateFactory)[1];
    const editor = new wodss.editor.EditorStore(store);

    const workers = os.cpus().map(() => new worker.Worker(path.resolve(__dirname, 'worker.js'), {env: process.env}));

    try {
      await wodss.core.util.waitUntil(() => !editor.checkIntegrity(), duration);
    } catch (e) {
      // NOP
    } finally {
      await Promise.all(workers.map(job => job.terminate()));

      expect(editor.paragraphs.length).toBeGreaterThan(10);
      expect(editor.checkIntegrity()).toBeTruthy();
    }
  });
});
