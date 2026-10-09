const ignores = require('gts/eslint.ignores.js');

module.exports = [
  // build/ and node_modules are ignored by gts. src/version.ts is generated.
  {ignores: [...ignores, 'src/version.ts']},
  ...require('gts'),
  {
    // jest.config.js is a CommonJS file.
    files: ['jest.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {module: 'writable'},
    },
  },
];
