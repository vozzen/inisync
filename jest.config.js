/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: 'node',
  // Skip compiled copies of the tests in build/.
  testPathIgnorePatterns: ['/node_modules/', '/build/'],
  transform: {
    '^.+.tsx?$': ['ts-jest', {}],
  },
};
