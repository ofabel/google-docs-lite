<template>
  <div class="row">
    <div class="col-auto">
      <div class="btn-toolbar" v-bind:class="{'invisible': !editable}" role="toolbar">
        <div class="btn-group" role="group">
          <button class="btn btn-sm btn-primary" data-test="boldText" v-on:click="bold()" :disabled="!editable">
            <i class="bi bi-type-bold" role="presentation"></i>
            <span class="visually-hidden">{{ i18n.bold }}</span>
          </button>
          <button class="btn btn-sm btn-primary" data-test="italicText" v-on:click="italic()" :disabled="!editable">
            <i class="bi bi-type-italic" role="presentation"></i>
            <span class="visually-hidden">{{ i18n.italic }}</span>
          </button>
          <button class="btn btn-sm btn-primary" data-test="strikeText" v-on:click="strike()" :disabled="!editable">
            <i class="bi bi-type-strikethrough" role="presentation"></i>
            <span class="visually-hidden">{{ i18n.strike }}</span>
          </button>
        </div>
      </div>
    </div>
    <div class="col d-flex flex-column justify-content-center">
      <slot name="info"></slot>
    </div>
    <div class="col-auto">
      <slot name="menu"></slot>
    </div>
  </div>
  <editor-content class="overflow-auto form-control mt-2 long-text-editor" data-test="editor" :aria-disabled="disabled" :editor="editor" v-on:focusin="onFocus" v-on:focusout="onBlur" :style="style"/>
  <div class="row">
    <slot name="meta"></slot>
  </div>
</template>

<script lang="ts">
import * as wodss from '@fhnw/wodss-shared';
import {i18n} from '@/i18n';
import {EditorContent, useEditor} from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CharacterCount from '@tiptap/extension-character-count';
import * as vue from 'vue';

export default vue.defineComponent({
  name: 'LongText',
  components: {
    EditorContent
  },
  props: {
    editable: {
      type: Boolean,
      required: true
    },
    disabled: {
      type: Boolean,
      required: false,
      default: false
    },
    color: {
      type: String,
      required: false,
      default: '#000000'
    },
    text: {
      type: wodss.core.store.LongText,
      required: true
    },
    onUpdate: {
      type: Function,
      required: true
    },
    onFocus: {
      type: Function,
      required: true
    },
    onBlur: {
      type: Function,
      required: true
    }
  },
  setup(props) {
    const editor = useEditor({
      editable: props.editable,
      injectCSS: false,
      onUpdate() {
        props.onUpdate();
      },
      extensions: [
        StarterKit.configure({
          history: false,
          heading: false,
          blockquote: false,
          bulletList: false,
          code: false,
          codeBlock: false,
          horizontalRule: false,
          listItem: false,
          orderedList: false
        }),
        Collaboration.configure({
          fragment: props.text
        }),
        CharacterCount.configure({
          limit: 250_000
        })
      ]
    });

    return {
      editor,
      props,
      i18n: i18n
    };
  },
  computed: {
    style() {
      return this.disabled ? {
        'border-color': this.color,
        'background-color': `${this.color}44`
      } : {};
    }
  },
  methods: {
    bold() {
      if (this.editor && this.editable) {
        this.editor.chain().focus().toggleBold().run();
      }
    },
    italic() {
      if (this.editor && this.editable) {
        this.editor.chain().focus().toggleItalic().run();
      }
    },
    strike() {
      if (this.editor && this.editable) {
        this.editor.chain().focus().toggleStrike().run();
      }
    }
  },
  updated() {
    this.editor?.setEditable(this.props.editable);
  }
})
</script>

<style lang="scss">
@import '~bootstrap/scss/functions';
@import '~bootstrap/scss/variables';

.long-text-editor {
  white-space: break-spaces;
}

.long-text-editor p:last-child {
  margin-bottom: 0;
}

.long-text-editor [contenteditable] {
  outline: none;
}

.long-text-editor:focus-within {
  box-shadow: $input-focus-box-shadow;
  background: $input-focus-bg;
  border-color: $input-focus-border-color;
  color: $input-focus-color;
}

.long-text-editor[aria-disabled="true"] {
  background: $input-disabled-bg;
  border-color: $input-disabled-border-color;
  cursor: not-allowed;
}
</style>
