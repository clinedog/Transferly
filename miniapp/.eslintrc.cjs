const js = require('@eslint/js');
const reactPlugin = require('eslint-plugin-react');

module.exports = [
  {
    ignores: ['node_modules', 'dist', '.vite']
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly'
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off'
    }
  }
];
