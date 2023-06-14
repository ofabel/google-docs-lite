<template>
  <aside class="col-xl shadow-sm border-top d-xl-flex flex-xl-column">
    <div class="row">
      <div class="col participants overflow-auto py-3" role="region" :aria-label="i18n.participants">
        <ul class="list-unstyled m-0">
          <li v-for="participant in participants" v-bind:key="participant" class="d-flex">
            <i class="bi bi-circle-fill me-1" role="presentation" :style="{color: participant.color.value}"></i>
            <span class="text-truncate">{{ participant.nickname.value }}</span>
          </li>
        </ul>
      </div>
    </div>
    <div class="row border-top flex-xl-grow-1 overflow-auto" ref="history">
      <div class="col history py-3 d-flex flex-column" role="log" aria-relevant="additions" :aria-label="i18n.chat">
        <div class="flex-grow-1">
          <ul class="p-0 m-0 vstack gap-2">
            <li class="card" v-for="message in messages" :key="message.id" v-bind:class="{'ms-4':message.user._id === user.id,'me-4':message.user._id !== user.id}" :style="{'border-color':message.user.color.value}">
              <div class="card-body px-2 py-1">
                <div class="card-title d-flex mb-1">
                  <div class="fw-bold flex-grow-1 small text-truncate" :aria-label="i18n.sender" :style="{color:message.user.color.value}">
                    {{ message.user.nickname.value }}
                  </div>
                  <div class="small d-flex flex-column justify-content-end text-nowrap text-black-50">
                    <time :datetime="message.date.toISOString()">
                      {{ message.date.toLocaleDateString(undefined, dateFormat) }}
                    </time>
                  </div>
                </div>
                <p class="card-text" data-test="chatMessage" :aria-label="i18n.message">{{ message.message }}</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
    <div class="row border-top flex-xl-shrink-1">
      <div class="col chat py-3">
        <div class="flex-shrink-1">
          <div class="input-group">
            <input type="text" class="form-control form-control-sm" data-test="chatInput" v-model.trim="message" :aria-label="i18n.message" aria-describedby="send-button" autocomplete="off" v-on:keydown.enter="send" maxlength="1000">
            <button class="btn btn-sm btn-primary" data-test="chatSend" type="button" id="send-button" v-on:click="send" :disabled="sending || message.length === 0">
              <i class="bi bi-send" role="presentation"></i>
              <span class="visually-hidden">{{ i18n.sendMessage }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script lang="ts">
import * as vue from 'vue';
import {chat, index, user} from '@/store/sync';
import {i18n} from '@/i18n';

export default vue.defineComponent({
  name: 'EditorChat',
  components: {},
  props: {
    documentId: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      message: '',
      sending: false,
      dateFormat: {
        hour12: false,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      } as Intl.DateTimeFormatOptions
    };
  },
  setup(props) {
    return {
      i18n: i18n,
      chat: chat,
      user: user,
      index: index,
      props
    };
  },
  computed: {
    participants() {
      return this.index.getParticipants(this.documentId)
        .map(session => user.getUserBySession(session))
        .filter(user => !!user);
    },
    messages() {
      return this.chat.getMessagesByRoom(this.documentId)
        .map(message => ({
          ...message,
          user: user.getUserById(message.user),
          date: new Date(message.date)
        }))
        .filter(message => !!message.user);
    }
  },
  methods: {
    async send() {
      if (this.sending || this.message.length === 0) {
        return;
      }

      this.sending = true;

      await this.chat.sendMessage(this.documentId, this.user.id, this.message);

      this.message = '';
      this.sending = false;
    },
    scrollToLatestMessage() {
      const history = this.$refs.history as HTMLDivElement;

      this.$nextTick(() => history.scrollTo({top: history.scrollHeight}));
    }
  },
  watch: {
    documentId() {
      this.message = '';

      this.scrollToLatestMessage();
    },
    participants() {
      this.scrollToLatestMessage();
    },
    messages() {
      this.scrollToLatestMessage();
    }
  },
  mounted() {
    this.scrollToLatestMessage();
  }
});
</script>

<style lang="scss" scoped>
@import '~bootstrap/scss/functions';
@import '~bootstrap/scss/variables';
@import '~bootstrap/scss/mixins';

@include media-breakpoint-up(xl) {
  aside {
    max-height: 100vh;
    max-width: 20rem;
    border-top: none !important;
  }

  .participants {
    min-height: 3rem;
    max-height: 20vh;
  }
}
</style>
