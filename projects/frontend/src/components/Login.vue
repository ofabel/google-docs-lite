<template>
  <div class="d-flex justify-content-center flex-column flex-grow-1 min-vh-100" v-if="ready">
    <div class="d-flex justify-content-center">
      <div class="container-fluid login">
        <div class="row mb-3">
          <div class="col">
            <label for="email" class="form-label">{{ i18n.email }}</label>
            <input v-model="email" data-test="email" type="email" class="form-control" id="email"/>
          </div>
        </div>
        <div class="row">
          <div class="col">
            <button type="button" class="btn btn-primary" data-test="login" v-on:click="login(email)">{{ i18n.login }}</button>
          </div>
        </div>
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
import {session} from '@/store/local';

export default vue.defineComponent({
  name: 'Login',
  props: {
    login: {
      type: Function,
      required: true
    }
  },
  data() {
    const firstname = session.firstname.toLocaleLowerCase();
    const lastname = session.lastname.toLocaleLowerCase();

    return {
      i18n: i18n,
      email: `${firstname}.${lastname}@fhnw.ch`
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

<style scoped>
.login {
  max-width: 20rem;
}
</style>
