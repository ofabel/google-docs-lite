<template>
  <div class="btn-group btn-group-sm" role="navigation">
    <button class="btn btn-sm btn-outline-primary" :disabled="disabled || currentPage === 0" v-on:click="previous">
      <span role="presentation">&laquo;</span>
      <span class="visually-hidden">{{ i18n.previousPage }}</span>
    </button>
    <button class="btn btn-sm" v-bind:class="{'btn-primary': page === currentPage, 'btn-outline-primary': page !== currentPage}" v-on:click="goto(page)" v-for="page in pages"  v-bind:key="page" :aria-current="page === currentPage ? 'page' : 'false'" :disabled="disabled">
      {{ page + 1 }}
    </button>
    <button class="btn btn-sm btn-outline-primary" :disabled="disabled || currentPage === pages.length - 1" v-on:click="next">
      <span role="presentation">&raquo;</span>
      <span class="visually-hidden">{{ i18n.nextPage }}</span>
    </button>
  </div>
</template>

<script lang="ts">
import * as vue from 'vue'
import { i18n } from '@/i18n'

export default vue.defineComponent({
  name: 'EditorPagination',
  props: {
    numOfPages: {
      type: Number,
      required: true
    },
    currentPage: {
      type: Number,
      required: true
    },
    previous: {
      type: Function,
      required: true
    },
    next: {
      type: Function,
      required: true
    },
    goto: {
      type: Function,
      required: true
    },
    disabled: {
      type: Boolean,
      required: false
    }
  },
  data () {
    return {
      i18n: i18n
    }
  },
  computed: {
    pages () {
      return Array(this.$props.numOfPages).fill(0).map((_, i) => i)
    }
  }
})
</script>
