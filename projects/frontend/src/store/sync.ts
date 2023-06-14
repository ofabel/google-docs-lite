import * as wodss from '@fhnw/wodss-shared'

export const [dispatcher] = new wodss.core.mom.Builder('VUE_APP_').build();

const debounce = parseInt(process.env.VUE_APP_WODSS_SYNC_STORE_DEBOUNCE ?? '0');

export const [hub] = wodss.core.hub.SyncStoreHub.init(dispatcher, new wodss.core.db.DummyAdapter(), 'client', debounce, wodss.chat.stateFactory, wodss.index.stateFactory, wodss.user.stateFactory, wodss.editor.stateFactory);

export const chat = new wodss.chat.ChatStore(hub.open('185d334c-69d3-410d-9329-662067e862e4', wodss.chat.stateFactory)[0]);
export const index = new wodss.index.IndexStore(hub.open('b79bf894-d58d-4d3f-a5c1-a57d64055fef', wodss.index.stateFactory)[0]);
export const user = new wodss.user.UserStore(hub.open('034b36d5-c73e-4a09-b923-79a8565fd062', wodss.user.stateFactory)[0]);
