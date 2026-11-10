/**
 * Backend tests: run against the local Supabase (`npx supabase start`).
 * `npm run test:backend`. They create throwaway accounts and delete them after.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/backend/**/*.test.ts'],
  transform: { '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
  transformIgnorePatterns: ['node_modules/(?!(@scure|@noble)/)'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testTimeout: 60000,
  maxWorkers: 1,
};
