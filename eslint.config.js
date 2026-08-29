const tsParser = require('@typescript-eslint/parser');

module.exports = [
  {ignores: ['android/**', 'ios/**', 'node_modules/**', 'coverage/**']},
  {
    files: ['*.{js,mjs}'],
    languageOptions: {parserOptions: {ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: {jsx: true}}, globals: {require: 'readonly', module: 'readonly', globalThis: 'readonly'}},
  },
  {
    files: ['src/**/*.{ts,tsx}', '__tests__/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: {jsx: true}},
      globals: {console: 'readonly', globalThis: 'readonly', jest: 'readonly', describe: 'readonly', test: 'readonly', it: 'readonly', expect: 'readonly'},
    },
    rules: {'no-debugger': 'error', 'no-constant-condition': 'error'},
  },
];
