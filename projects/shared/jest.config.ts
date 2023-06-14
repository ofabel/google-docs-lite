export default {
  setupFiles: [
    'dotenv/config',
    '<rootDir>/src/test/index.ts'
  ],
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@fhnw/wodss-shared$': '<rootDir>'
  }
}
