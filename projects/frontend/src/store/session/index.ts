import * as wodss from '@fhnw/wodss-shared'
import { SessionStore } from '@/store/session/store'
import { State, id, json } from '@/store/session/state'

const sessionState = JSON.parse(sessionStorage.getItem(id) ?? json)

export const session = new SessionStore(wodss.core.store.LocalStore.init<State>(sessionState))
