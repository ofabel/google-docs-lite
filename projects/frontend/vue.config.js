const path = require('path')
const webpack = require('webpack')
const { defineConfig } = require('@vue/cli-service')
const log = require('./log.json')

module.exports = defineConfig({
  pages: {
    index: './src/main.ts',
    monitor: './src/monitor.ts'
  },
  transpileDependencies: true,
  // see https://github.com/mqttjs/MQTT.js/issues/1412#issuecomment-1046369875 for details
  configureWebpack: {
    plugins: [
      new webpack.ProvidePlugin({
        process: 'process/browser'
      }),
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer']
      }),
      new webpack.DefinePlugin({
        WODSS_LOG_CONFIG: JSON.stringify(log)
      })
    ],
    externals: {
      'rotating-file-stream': 'null'
    },
    resolve: {
      fallback: {
        url: require.resolve('url')
      },
      alias: {
        '@fhnw/wodss-shared': path.resolve(__dirname, '..', 'shared'),
        yjs: path.resolve(__dirname, '..', 'shared', 'node_modules', 'yjs')
      }
    }
  }
})
