import * as wodss from '../../src';
import {editorStoreId, topicPrefix} from './config';

const userId = wodss.core.uid.full();

const [dispatcher] = new wodss.core.mom.Builder()
  .withTopicPrefix(topicPrefix)
  .withMinLatency(5)
  .withMaxLatency(10)
  .build();

const adapter = new wodss.core.db.DummyAdapter();

const [hub] = wodss.core.hub.SyncStoreHub.init(dispatcher, adapter, 'client', 150, wodss.editor.stateFactory);

const editor = new wodss.editor.EditorStore(hub.open(editorStoreId, wodss.editor.stateFactory)[0]);

const operation = async () => {
  let result;
  const random = Math.random();
  const size = editor.state.order.value.length;
  const index = Math.floor(Math.random() * (size - 2) + 1);
  const id = editor.state.order.value[index];
  const min = 10;
  const max = 100;

  if (size < min) {
    result = editor.addParagraph(userId)
  } else if (size < max && random < 0.3) {
    result = editor.addParagraph(userId, id)
  } else if (size > min && random < 0.5) {
    result = editor.remove(id)
  } else if (size > min && random < 0.8) {
    result = editor.setParagraphText(id, userId, 'test')
  } else {
    const direction = Math.random() > 0.5 ? 'up' : 'down'
    result = editor.move(id, direction)
  }

  return result;
};

const check = () => !editor.checkIntegrity();

wodss.core.util.waitUntil(() => editor.ready)
  .then(() => wodss.core.util.retryUntil(operation, check))
  .finally(() => dispatcher.destroy());
