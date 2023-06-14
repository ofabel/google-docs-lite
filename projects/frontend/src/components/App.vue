<template>
  <login :login="(email) => login(email)" v-if="loginRequired"/>
  <div role="presentation" data-test="loadingScreen" aria-busy="true" v-if="blocking" class="blocking d-flex justify-content-center flex-column" v-on:dblclick.prevent>
    <div class="d-flex justify-content-center">
      <div class="spinner-border"></div>
    </div>
  </div>
  <div class="container-fluid" v-if="!loginRequired">
    <div class="row">
      <div class="col-xl shadow-sm pt-3 d-flex flex-column justify-content-between overflow-auto sidebar">
        <nav class="pb-3" v-if="showSidebar">
          <ul class="nav nav-pills flex-column">
            <li class="nav-item w-100" data-test="navigationElement">
              <div class="nav-link w-100 text-start" :class="currentPage === accountPageId ? 'active' : ''">
                <div class="d-flex">
                  <button class="bg-transparent p-0 m-0 border-0 color-inherit flex-grow-1 text-start" data-test="account" type="button" v-on:click="goto(accountPageId)">
                    <i class="me-1 bi bi-person" role="presentation"></i>
                    {{ i18n.account }}
                  </button>
                  <button class="bg-transparent p-0 m-0 border-0 color-inherit" v-on:click="logout()">
                    <i class="bi bi-box-arrow-right" role="presentation"></i>
                    <span class="visually-hidden">{{ i18n.logout }}</span>
                  </button>
                </div>
              </div>
            </li>
            <li class="nav-item w-100" data-test="navigationElement" v-for="({_id, title, participants}) in index.documents" v-bind:key="_id">
              <button type="button" class="nav-link w-100 text-start" data-test="document" :class="currentPage === _id ? 'active' : ''" v-on:click="open(_id)">
                <span class="d-flex">
                  <i class="bi-file-earmark me-1" role="presentation"></i>
                  <span class="flex-grow-1 text-truncate">
                    {{ title.value }}
                  </span>
                  <span class="ms-1 d-flex flex-column justify-content-center" v-bind:class="{invisible: Object.keys(participants).length === 0}">
                    <span class="badge rounded-pill" :class="currentPage === _id ? 'bg-light text-primary' : 'bg-primary'">
                      {{ Object.keys(participants).length }}
                    </span>
                  </span>
                </span>
              </button>
            </li>
            <li class="nav-item w-100" data-test="navigationElement">
              <button type="button" class="nav-link w-100 text-start" data-test="createNewDocument" v-on:click="create">
                <i class="bi bi-plus me-1"></i>
                {{ i18n.createNewDocument }}
              </button>
            </li>
          </ul>
        </nav>
        <div class="row border-top py-2 revision" role="presentation" v-if="showSidebar">
          <div class="font-monospace col small">{{ revision }}</div>
        </div>
      </div>
      <main class="col-xl d-flex overflow-auto" v-bind:class="{'overflow-hidden': !showSidebar}">
        <div v-if="currentPage === accountPageId" class="row py-3 flex-grow-1 w-100">
          <account/>
        </div>
        <div v-else class="row flex-grow-1 w-100">
          <simple-editor :documentId="currentPage" v-if="hub.has(currentPage)"/>
        </div>
      </main>
    </div>
  </div>
</template>

<script lang="ts">
import * as vue from 'vue';
import * as wodss from '@fhnw/wodss-shared';
import {i18n} from '@/i18n';
import {hub, index, user} from '@/store/sync';
import {session} from '@/store/local';
import SimpleEditor from '@/components/Editor.vue';
import Account from '@/components/Account.vue';
import Login from '@/components/Login.vue';
import {log} from '@/log';

export default vue.defineComponent({
  name: 'App',
  components: {
    SimpleEditor,
    Account,
    Login
  },
  setup(props) {
    return {
      hub: hub,
      index: index,
      props
    }
  },
  data() {
    return {
      i18n: i18n,
      loginRequired: !user.hasSession(),
      accountPageId: '93a95449-e2f9-402f-a581-33fab9b37f8d'
    };
  },
  computed: {
    currentPage: {
      get(): string {
        return session.currentPage ?? this.accountPageId;
      },
      set(currentPage: string) {
        session.currentPage = currentPage;
      }
    },
    showSidebar() {
      return !session.editMode;
    },
    revision() {
      return process.env.VUE_APP_WODSS_REVISION;
    },
    blocking() {
      return hub.blocking;
    }
  },
  methods: {
    async login(email: string) {
      const userId = wodss.core.uid.slug(email, 'f22c29dc-861e-4b10-aa0e-0118ad119174');

      await user.addSession(userId, session.firstname, session.lastname, session.color);

      session.userId = userId;

      this.loginRequired = !user.hasSession();
    },
    async logout() {
      await user.removeSession();
      await session.clear();

      this.loginRequired = true;
    },
    goto(id: string) {
      if (this.currentPage === id) {
        return;
      }

      this.currentPage = id;
    },
    async create() {
      const title = i18n.newDocument({
        index: index.documents.length + 1
      });

      const id = await index.createDocument(title);

      await this.open(id);
    },
    async open(id: string) {
      this.goto(id);

      if (!hub.has(id)) {
        const [store] = hub.open<wodss.editor.State>(id, wodss.editor.stateFactory);

        await store.whenReady();
      }
    }
  },
  beforeMount() {
    if (this.currentPage && index.hasDocument(this.currentPage)) {
      this.open(this.currentPage);
    }
  },
  errorCaptured(error) {
    log.error(error as Error);
  }
});
</script>

<style lang="scss">
@import '../../node_modules/bootstrap/scss/functions';
@import '../../node_modules/bootstrap/scss/variables';
@import '../../node_modules/bootstrap/scss/mixins';

@include media-breakpoint-up(xl) {
  .sidebar {
    max-height: 100vh;
    max-width: 20rem;
  }

  main {
    height: 100vh;
  }
}

@include media-breakpoint-down(xl) {
  .revision {
    display: none;
  }
}

.blocking {
  animation-name: blocking;
  animation-duration: 1s;
  animation-iteration-count: 1;
  animation-fill-mode: forwards;
  z-index: 99999;
  position: fixed;
  inset: 0;
  cursor: wait;
  width: 100vw;
  height: 100vh;
}

@keyframes blocking {
  0% {
    background-color: rgba(255, 255, 255, 0.0);
    opacity: 0;
  }

  99.99% {
    background-color: rgba(255, 255, 255, 0.0);
    opacity: 0;
  }

  100% {
    background-color: rgba(255, 255, 255, 0.75);
    opacity: 1;
  }
}

.color-inherit {
  color: inherit;
}
</style>
