const tsParser = require('@typescript-eslint/parser');
const reactHooks = require(require.resolve('eslint-plugin-react-hooks', {
  paths: [require.resolve('@react-native/eslint-config')],
}));

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
  {
    files: ['src/index.tsx'],
    plugins: {'react-hooks': reactHooks},
    rules: {'react-hooks/rules-of-hooks': 'error'},
  },
];
