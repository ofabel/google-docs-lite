// eslint-disable-next-line
// @ts-ignore
global.WODSS_LOG_CONFIG = {
  root: {
    name: 'test',
    level: 'WARN',
    appenders: [{
      name: 'standard',
    }]
  },
  categories: [],
  appenders: [{
    name: 'standard',
    type: 'Standard'
  }]
};
