import * as wodss from '@fhnw/wodss-shared'

const hash = window.location.hash
const config = window.location.hash.length > 1 ? JSON.parse(atob(hash.substring(1))) : undefined
const url = config?.url ?? prompt('url?', 'ws://localhost:9001/ws')
const username = config?.username ?? prompt('username?', 'monitor')
const password = config?.password ?? prompt('password?', 'Go7kJoK1S77eCExwmd3u')
const topic = process.env.VUE_APP_WODSS_LOGGER_MQTT_TOPIC as string

window.location.hash = btoa(JSON.stringify({
  url: url,
  username: username,
  password: password
}))

// eslint-disable-next-line
new wodss.core.log.Client(url, username, password, topic, {
  root: {
    level: 'TRACE',
    appenders: [{
      name: 'dom'
    }]
  },
  categories: [],
  appenders: [{
    name: 'dom',
    type: 'DOM',
    target: '#log'
  }]
})
