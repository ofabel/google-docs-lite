import './styles/styles.scss';
import 'bootstrap';

import * as wodss from '@fhnw/wodss-shared';
import * as vue from 'vue';
import App from '@/components/App.vue';
import {chat, index, user} from '@/store/sync';
import {session} from '@/store/local';
import {log} from '@/log';

wodss.core.store.enableVueBindings(vue);

wodss.core.util.waitUntil(() => chat.ready && index.ready && user.ready && session.ready)
  .then(() => index.removeStaleParticipants())
  .then(() => user.removeStaleSessions())
  .then(() => user.addSession(session.userId, session.firstname, session.lastname, session.color))
  .then(() => vue.createApp(App).mount('#app'))
  .catch(log.error);
