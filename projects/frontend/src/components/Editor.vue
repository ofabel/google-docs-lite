<template>
  <div v-if="ready" class="col-xl py-3 editor" v-bind:class="{'overflow-hidden': !showSidebar}" ref="editor">
    <div class="row controls" v-bind:class="{invisible: hideControls}">
      <label for="title" class="col-xl-2 col-form-label-sm">{{ i18n.title }}</label>
      <div class="col-xl d-flex">
        <input id="title" data-test="documentTitle" class="form-control form-control-sm me-2" v-model="title" :disabled="hasLock || !index.canChangeTitle(documentId)" v-on:focus="index.lock(documentId)" v-on:blur="index.unlock(documentId)" autocomplete="off" v-on:keydown.enter.prevent maxlength="150"/>
        <button type="button" data-test="deleteDocumentButton" class="btn btn-sm btn-danger" v-on:click="remove" :disabled="!index.canRemoveDocument(documentId) || hasLock">
          <i class="bi bi-trash" role="presentation"></i>
          <span class="visually-hidden">{{ i18n.delete }}</span>
        </button>
      </div>
    </div>
    <div class="row border-top pt-2 mt-2" v-if="fuzzy" v-bind:class="{invisible: hideControls}">
      <div class="col-auto">
        <button class="btn btn-sm btn-primary test" v-on:click="startStopFuzzyTest()" id="toggle-fuzzy-test">
          <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" v-if="fuzzyActive"></span>
          {{ fuzzyActive ? 'Stop' : 'Start' }} Fuzzy Test
        </button>
      </div>
      <div class="col-auto d-flex flex-column justify-content-center">
        <label for="fuzzy-test-speed" class="visually-hidden">Fuzzy Test Speed</label>
        <input type="range" v-model="fuzzySpeed" min="-2000" max="-80" step="10" class="test form-range" id="fuzzy-test-speed"/>
      </div>
      <div class="col-1 d-flex flex-column justify-content-center text-center">
        {{ editor.paragraphs.length }}
      </div>
      <div class="col-1 d-flex flex-column justify-content-center text-nowrap text-center">
        {{ fuzzyFailed }}/{{ fuzzySuccess + fuzzyFailed }}
      </div>
      <div class="col-1 d-flex flex-column justify-content-center text-nowrap text-center">
        {{ fuzzyOpsPerSec.toPrecision(2) }}
      </div>
    </div>
    <div class="row border-top py-2 mt-2" v-bind:class="{invisible: hideControls}">
      <div class="col">
        <editor-pagination :numOfPages="pages.length" :currentPage="currentPage" :previous="() => currentPage--" :next="() => currentPage++" :goto="page => currentPage = page" :disabled="hasLock"/>
      </div>
    </div>
    <div v-for="paragraph in editor.paragraphs.slice(currentPage * paragraphsPerPage, currentPage * paragraphsPerPage + paragraphsPerPage)" v-bind:key="paragraph._id" data-test="paragraph">
      <editor-paragraph :paragraph="paragraph" :editor="editor" :hasLock="hasLock" :fuzzy="fuzzy" :setScope="setScope" :scoped="paragraph._id === paragraphInScopeValue" :ref="`paragraph-${paragraph._id}`" v-bind:class="{invisible: hideControls}"/>
    </div>
    <div class="row border-top py-2" v-if="currentPage === pages.length - 1" v-bind:class="{invisible: hideControls}">
      <div class="col">
        <button class="btn btn-sm btn-primary" data-test="addParagraph" :disabled="hasLock" v-on:click="addParagraph">
          <i class="bi bi-plus me-1" role="presentation"></i>
          {{ i18n.addParagraph }}
        </button>
      </div>
    </div>
    <div class="row border-top pt-2" v-bind:class="{invisible: hideControls}">
      <div class="col">
        <editor-pagination :numOfPages="pages.length" :currentPage="currentPage" :previous="() => currentPage--" :next="() => currentPage++" :goto="page => currentPage = page" :disabled="hasLock"/>
      </div>
    </div>
  </div>
  <editor-chat :documentId="documentId" v-if="ready"/>
</template>

<script lang="ts">
import * as wodss from '@fhnw/wodss-shared';
import * as vue from 'vue';
import EditorChat from '@/components/Chat.vue';
import EditorParagraph from '@/components/Paragraph.vue';
import EditorPagination from '@/components/Pagination.vue';
import {i18n} from '@/i18n';
import {chat, hub, index, user} from '@/store/sync';
import {session} from '@/store/local';

declare global {
  let fuzzySpeed: number | undefined;
}

let fuzzyTestTimeout: unknown;

export default vue.defineComponent({
  name: 'SimpleEditor',
  components: {
    EditorChat,
    EditorParagraph,
    EditorPagination
  },
  props: {
    documentId: {
      type: String,
      required: true
    }
  },
  setup(props) {
    return {
      user: user,
      index: index,
      chat: chat,
      props
    };
  },
  data() {
    const state = this.loadState();

    return {
      i18n: i18n,
      fuzzyActive: false,
      fuzzySpeed: typeof fuzzySpeed === 'undefined' ? -500 : fuzzySpeed, // eslint-disable-line no-undef
      fuzzySuccess: 0,
      fuzzyFailed: 0,
      fuzzyOps: [] as number[],
      paragraphsPerPage: 10,
      currentPageValue: state.currentPageValue ?? 0,
      paragraphInScope: state.paragraphInScope as undefined | string,
      paragraphInScopeValue: state.paragraphInScopeValue as undefined | string,
      referenceInScope: state.referenceInScope as undefined | string,
      referenceInScopeValue: state.referenceInScopeValue as undefined | string
    };
  },
  computed: {
    editor(): wodss.editor.EditorStore {
      const [store] = hub.open<wodss.editor.State>(this.documentId, wodss.editor.stateFactory);

      return new wodss.editor.EditorStore(store);
    },
    title: {
      get(): string {
        return this.index.getTitle(this.documentId);
      },
      set(title: string) {
        this.index.setTitle(this.documentId, title);
      }
    },
    ready(): boolean {
      return this.index.ready && this.user.ready && this.editor.ready && this.chat.ready;
    },
    fuzzy() {
      return window.location.search.includes('fuzzy');
    },
    fuzzyOpsPerSec(): number {
      const totalPause = this.fuzzyOps.map((v, i, a) => i === 0 ? 0 : v - a[i - 1]).reduce((p, c) => p + c, 0);
      const averagePause = totalPause / this.fuzzyOps.length;

      return averagePause > 0 ? 1000 / averagePause : 0;
    },
    pages() {
      const numOfPages = Math.ceil(this.editor.numOfParagraphs / this.paragraphsPerPage);

      return Array(numOfPages === 0 ? 1 : numOfPages).fill(0).map((_, i) => i);
    },
    currentPage: {
      get(): number {
        return this.currentPageValue >= this.pages.length ? this.pages.length - 1 : this.currentPageValue;
      },
      set(currentPage: number) {
        this.currentPageValue = currentPage >= this.pages.length ? this.pages.length - 1 : currentPage;

        this.saveState();
      }
    },
    hasLock() {
      return this.editor.hasLock();
    },
    hideControls() {
      return session.editMode;
    },
    showSidebar() {
      return !session.editMode;
    }
  },
  methods: {
    saveState() {
      session.setEditorState(this.documentId, {
        currentPageValue: this.currentPageValue,
        paragraphInScope: this.paragraphInScope,
        paragraphInScopeValue: this.paragraphInScopeValue,
        referenceInScope: this.referenceInScope,
        referenceInScopeValue: this.referenceInScopeValue
      });
    },
    loadState() {
      return session.getCurrentEditorPage(this.documentId) ?? {};
    },
    async remove() {
      await hub.delete(this.documentId);

      await this.index.removeDocument(this.documentId);
    },
    startStopFuzzyTest() {
      if (!this.fuzzyActive) {
        this.fuzzyActive = true;

        this.fuzzySuccess = 0;
        this.fuzzyFailed = 0;
        this.fuzzyOps = [];
        this.runFuzzyTest();
      } else {
        this.fuzzyActive = false;

        clearTimeout(fuzzyTestTimeout as number);
      }
    },
    checkIntegrity() {
      if (!this.editor.checkIntegrity()) {
        console.info(wodss.core.util.deepClone(this.editor.state));

        if (confirm('store integrity violation detected ! Reset state?')) {
          this.editor.resetState();
        }

        this.startStopFuzzyTest();
      }
    },
    async addParagraph() {
      const id = await this.editor.addParagraph(this.user.id);

      this.setScope(id, `edit-${id}`);
    },
    async runFuzzyTest() {
      if (!this.fuzzyActive) {
        this.fuzzyActive = false;

        return;
      }

      this.checkIntegrity();

      let result;
      const random = Math.random();
      const size = this.editor.state.order.value.length;
      const index = Math.floor(Math.random() * (size - 2) + 1);
      const id = this.editor.state.order.value[index];
      const min = 10;
      const max = 100;

      if (size < min) {
        result = await this.editor.addParagraph(this.user.id);
      } else if (size < max && random < 0.3) {
        result = await this.editor.addParagraph(this.user.id, id);
      } else if (size > min && random < 0.5) {
        result = await this.editor.remove(id);
      } else if (size > min && random < 0.75) {
        const length = Math.floor(Math.random() * 99_000 + 1000);
        const text = Array(length)
          .fill('')
          .map((_, i) => i % 10 ? Math.floor(Math.random() * 36).toString(36) : ' ')
          .join('')
          .trim();
        result = await this.editor.setParagraphText(id, this.user.id, text);
      } else {
        const direction = Math.random() > 0.5 ? 'up' : 'down';
        result = await this.editor.move(id, direction);
      }

      if (result) {
        this.fuzzySuccess++;
      } else {
        this.fuzzyFailed++;
      }

      this.fuzzyOps.push(Date.now());

      while (this.fuzzyOps.length > 10) {
        this.fuzzyOps.shift();
      }

      const speed = Math.abs(this.fuzzySpeed);

      fuzzyTestTimeout = setTimeout(() => this.runFuzzyTest(), speed);
    },
    pause(id: string) {
      if (hub.has(id)) {
        const [instance] = hub.open(id);

        instance.pause();
      }
    },
    resume(id: string) {
      if (hub.has(id)) {
        const [instance] = hub.open(id);

        instance.resume();
      }
    },
    setScope(paragraph?: string, reference?: string) {
      const isParagraphLocked = this.paragraphInScopeValue && this.editor.isLockOwner(this.paragraphInScopeValue);

      this.paragraphInScope = isParagraphLocked ? this.paragraphInScopeValue : paragraph;
      this.referenceInScope = reference;
    },
    setFocusByScope() {
      const main = this.$refs.editor as vue.RendererElement;

      if (!main || !this.paragraphInScopeValue) {
        return;
      }

      const ref = `paragraph-${this.paragraphInScopeValue}` as string;
      const paragraph = (this.$refs[ref] as typeof EditorParagraph[]);
      const element = this.referenceInScopeValue ? paragraph?.[0]?.$refs[this.referenceInScopeValue] as vue.DefineComponent : undefined;

      if (element && !element.disabled) {
        (element.$options?.name === 'LongText' && this.editor.isLockOwner(this.paragraphInScopeValue) ? element.editor.commands : element).focus?.();
      }

      const paragraphElement = paragraph?.[0]?.$el;

      if (paragraph && element) {
        paragraphElement.scrollIntoView({block: 'nearest'});
      }
    }
  },
  watch: {
    documentId(newDocumentId, oldDocumentId) {
      this.resume(newDocumentId);
      this.pause(oldDocumentId);

      this.index.addParticipantToDocument(newDocumentId);
      this.index.removeParticipantFromDocument(oldDocumentId);

      const state = this.loadState();

      Object.assign(this.$data, state);
    },
    paragraphInScope(newParagraphInScope, oldParagraphInScope) {
      this.paragraphInScopeValue = newParagraphInScope;

      this.setFocusByScope();

      if (newParagraphInScope !== oldParagraphInScope) {
        this.saveState();
      }
    },
    referenceInScope(newReferenceInScope, oldReferenceInScope) {
      this.referenceInScopeValue = newReferenceInScope;

      this.setFocusByScope();

      if (newReferenceInScope !== oldReferenceInScope) {
        this.saveState();
      }
    },
    ready(newReady, oldReady) {
      if (newReady && newReady !== oldReady && this.paragraphInScopeValue && session.editMode) {
        this.editor.toggleLock(this.paragraphInScopeValue);
      }
    }
  },
  beforeMount() {
    this.resume(this.documentId);

    this.index.addParticipantToDocument(this.documentId);
  },
  unmounted() {
    this.index.removeParticipantFromDocument(this.documentId);
  },
  beforeUpdate() {
    if (this.ready && this.paragraphInScopeValue) {
      const index = this.editor.findIndex(this.paragraphInScopeValue);

      this.currentPage = index !== -1 ? Math.floor(index / this.paragraphsPerPage) : this.currentPage;
    }
  },
  updated() {
    this.$nextTick(() => {
      this.setFocusByScope();
    })
  }
});
</script>

<style lang="scss" scoped>
@import '~bootstrap/scss/functions';
@import '~bootstrap/scss/variables';
@import '~bootstrap/scss/mixins';

.test {
  z-index: 999999;
  position: relative;
}

@include media-breakpoint-up(xl) {
  .editor {
    height: 100vh;
    overflow: auto;
  }
}
</style>
