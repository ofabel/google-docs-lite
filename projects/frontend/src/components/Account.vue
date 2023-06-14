<template>
  <div class="col" v-if="ready">
    <div class="row">
      <label for="nickname" class="col-xl-2 col-form-label-sm">{{ i18n.nickname }}</label>
      <div class="col-xl-10">
        <input id="nickname" type="text" class="form-control form-control-sm" v-model.trim="user.nickname" :disabled="!user.canChangeNickname()" v-on:focus="user.lockNickname()" v-on:blur="user.unlockNickname()" autocomplete="off" v-on:keydown.enter.prevent maxlength="100"/>
      </div>
    </div>
    <div class="row mt-2">
      <label for="color" class="col-xl-2 col-form-label-sm">{{ i18n.color }}</label>
      <div class="col-xl-10">
        <input id="color" type="color" class="form-control form-control-color" v-model="user.color"/>
      </div>
    </div>
  </div>
  <div v-else role="presentation" class="d-flex justify-content-center flex-column flex-grow-1">
    <div class="d-flex justify-content-center">
      <div class="spinner-border" role="presentation"></div>
    </div>
  </div>
</template>

<script lang="ts">
import * as wodss from '@fhnw/wodss-shared';
import * as vue from 'vue';
import {i18n} from '@/i18n';
import {user} from '@/store/sync';

export default vue.defineComponent({
  name: 'Account',
  data() {
    return {
      i18n: i18n
    };
  },
  computed: {
    user(): wodss.user.UserStore {
      return user;
    },
    ready() {
      return user.ready;
    }
  }
});
</script>
