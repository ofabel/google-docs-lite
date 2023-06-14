/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 * https://github.com/hieuxlu/jest-typescript-selenium
 */
import type { Config } from '@jest/types'

const config = {
  setupFiles: [
    'dotenv/config'
  ],
  // All imported modules in your tests should be mocked automatically
  // automock: false,
  clearMocks: true,
  testTimeout: 30000,
  testEnvironment: 'jsdom',
  collectCoverage: true,
  collectCoverageFrom: [
    'src/*.{js,ts,vue}',
    '!**/node_modules/**'
  ],
  // Indicates which provider should be used to instrument code for coverage
  coverageProvider: 'babel',
  moduleFileExtensions: ['vue', 'js', 'json', 'jsx', 'ts', 'tsx', 'node'],
  // support the same @ -> src alias mapping in source code
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transformIgnorePatterns: ['/node_modules/(?!name-of-lib-o-transform)'],
  // A map from regular expressions to paths to transformers
  transform: {
    '^.+\\.[jt]sx?$': 'ts-jest',
    '.*\\.(vue)$': '@vue/vue3-jest'
  }

}
export default config
