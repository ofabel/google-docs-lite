<template>
  <div class="row border-top py-2 paragraph position-relative" v-bind:class="{scoped: scoped, focusable: !scoped}" v-on:focusout="onBlur">
    <div class="position-absolute top-0 start-0 end-0 bottom-0 p-0" v-on:click="onFocus('edit')" v-if="!scoped"></div>
    <div class="col editor" v-bind:class="{editable: editable, 'py-2': editable}">
      <long-text :ref="'txt-' + paragraph._id" :editable="editable" :disabled="disabled" :text="paragraph.text" :color="lockedBy?.color.value" :onFocus="() => onFocus('txt')" :onBlur="onBlur" :onUpdate="onUpdate">
        <template v-slot:info>
          <div class="text-center text-truncate" v-if="!editable">
            {{ disabled || hasLock ? lockedBy?.nickname.value : modifiedBy }}
          </div>
        </template>
        <template v-slot:meta>
          <div class="small text-black-50 text-center text-nowrap pt-2 hstack gap-2 justify-content-between">
            <div class="text-truncate">
              {{ createdBy }}
            </div>
            <div class="font-monospace text-truncate" v-if="fuzzy">
              {{ paragraph._id }}
            </div>
            <div class="text-truncate">
              {{ createdAt }}
            </div>
          </div>
        </template>
        <template v-slot:menu>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-sm btn-primary" data-test="editParagraph" type="button" :disabled="!canSaveOrEdit" v-on:click="saveOrEdit" :ref="`edit-${paragraph._id}`" v-on:focus="onFocus('edit')">
              <i :class="editor.isLockOwner(paragraph._id) ? 'bi-check2' : 'bi-pencil'" class="bi" role="presentation"></i>
              <span class="visually-hidden">{{ editor.isLockOwner(paragraph._id) ? i18n.save : i18n.edit }}</span>
            </button>
          </div>
          <div class="btn-group btn-group-sm ms-2" v-if="!editable">
            <button class="btn btn-sm btn-primary" data-test="addParagraphAbove" type="button" :disabled="hasLock" v-on:click="addParagraphAbove" :ref="`add-${paragraph._id}`" v-on:focus="onFocus('add')">
              <i class="bi bi-plus" role="presentation"></i>
              <span class="visually-hidden">{{ i18n.addParagraphAbove }}</span>
            </button>
            <button class="btn btn-sm btn-primary" data-test="deleteParagraph" type="button" :disabled="!editor.canRemove(paragraph._id) || hasLock" v-on:click="remove" :ref="`remove-${paragraph._id}`" v-on:focus="onFocus('remove')">
              <i class="bi bi-trash" role="presentation"></i>
              <span class="visually-hidden">{{ i18n.remove }}</span>
            </button>
          </div>
          <div class="btn-group btn-group-sm ms-2" v-if="!editable">
            <button class="btn btn-sm btn-primary" data-test="moveUp" type="button" :disabled="editor.isFirst(paragraph._id) || hasLock" v-on:click="moveUp" :ref="`move-up-${paragraph._id}`" v-on:focus="onFocus('move-up')">
              <i class="bi bi-arrow-up" role="presentation"></i>
              <span class="visually-hidden">{{ i18n.moveUp }}</span>
            </button>
            <button class="btn btn-sm btn-primary" data-test="moveDown" type="button" :disabled="editor.isLast(paragraph._id) || hasLock" v-on:click="moveDown" :ref="`move-down-${paragraph._id}`" v-on:focus="onFocus('move-down')">
              <i class="bi bi-arrow-down" role="presentation"></i>
              <span class="visually-hidden">{{ i18n.moveDown }}</span>
            </button>
          </div>
        </template>
      </long-text>
    </div>
  </div>
</template>

<script lang="ts">
import * as wodss from '@fhnw/wodss-shared';
import * as vue from 'vue';
import {i18n} from '@/i18n';
import LongText from '@/components/LongText.vue';
import {user} from '@/store/sync';
import {session} from '@/store/local';

export default vue.defineComponent({
  name: 'EditorParagraph',
  components: {
    LongText
  },
  data() {
    return {
      i18n: i18n
    };
  },
  props: {
    paragraph: {
      type: Object,
      required: true
    },
    editor: {
      type: wodss.editor.EditorStore,
      required: true
    },
    hasLock: {
      type: Boolean,
      required: true
    },
    fuzzy: {
      type: Boolean,
      required: true
    },
    scoped: {
      type: Boolean,
      required: true
    },
    setScope: {
      type: Function,
      required: true
    }
  },
  setup(props) {
    return {
      props
    };
  },
  computed: {
    editable() {
      return this.editor.isLocked(this.paragraph._id) && this.editor.isLockOwner(this.paragraph._id);
    },
    disabled() {
      return (this.editor.isLocked(this.paragraph._id) && !this.editor.isLockOwner(this.paragraph._id)) || (this.hasLock && !this.editor.isLockOwner(this.paragraph._id));
    },
    menuId() {
      return `menu-${this.paragraph._id}`;
    },
    dateFormat(): Intl.DateTimeFormatOptions {
      return {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };
    },
    createdAt() {
      const date = new Date(this.paragraph.createdAt);

      return date.toLocaleString(undefined, this.dateFormat);
    },
    createdBy() {
      return user.getUserById(this.paragraph.createdBy).nickname.value;
    },
    modifiedAt() {
      const date = new Date(this.paragraph.modifiedAt);

      return date.toLocaleString(undefined, this.dateFormat);
    },
    modifiedBy() {
      return user.getUserById(this.paragraph.modifiedBy).nickname.value;
    },
    lockedBy() {
      const lockOwner = this.editor.internal.isLocked(this.paragraph._id);

      return lockOwner ? user.getUserBySession(lockOwner) : undefined;
    },
    canSaveOrEdit(): boolean {
      if (this.editor.isLocked(this.paragraph._id)) {
        return this.editor.isLockOwner(this.paragraph._id);
      } else {
        return !this.hasLock;
      }
    }
  },
  methods: {
    onFocus(ref: string, onlyIf = true) {
      if (onlyIf) {
        this.setScope(this.paragraph._id, `${ref}-${this.paragraph._id}`);
      }
    },
    onBlur() {
      this.setScope(undefined, undefined);
    },
    onUpdate() {
      if (!this.editable) {
        return;
      }

      this.editor.update(this.paragraph._id, user.id);
    },
    async saveOrEdit() {
      await this.editor.toggleLock(this.paragraph._id);

      const isLockOwner = this.editor.isLockOwner(this.paragraph._id);
      const ref = isLockOwner ? `txt-${this.paragraph._id}` : `edit-${this.paragraph._id}`;

      session.editMode = isLockOwner;

      this.setScope(this.paragraph._id, ref);
    },
    async addParagraphAbove() {
      const id = await this.editor.addParagraph(user.id, this.paragraph._id);

      this.setScope(id, `edit-${id}`);
    },
    async remove() {
      await this.editor.remove(this.paragraph._id);

      this.setScope(undefined, undefined);
    },
    async moveUp() {
      await this.editor.move(this.paragraph._id, 'up');

      this.setScope(this.paragraph._id, `move-up-${this.paragraph._id}`);
    },
    async moveDown() {
      await this.editor.move(this.paragraph._id, 'down');

      this.setScope(this.paragraph._id, `move-down-${this.paragraph._id}`);
    }
  }
});
</script>

<style lang="scss" scoped>
.paragraph {
  .btn-group {
    opacity: 0;
  }

  &:hover,
  &.scoped {
    .btn-group {
      opacity: 1;
    }
  }

  &.focusable {
    cursor: pointer;
  }
}

.editor {
  &.editable {
    position: fixed;
    inset: 0;
    background-color: #fff;
    z-index: 99999;
    visibility: visible;
    overflow: auto;
  }
}
</style>
