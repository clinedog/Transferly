import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';

const browserGlobals = {
  AbortController: 'readonly',
  Blob: 'readonly',
  CSS: 'readonly',
  FileReader: 'readonly',
  FormData: 'readonly',
  Headers: 'readonly',
  HTMLElement: 'readonly',
  HTMLCanvasElement: 'readonly',
  Image: 'readonly',
  IntersectionObserver: 'readonly',
  ResizeObserver: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  atob: 'readonly',
  btoa: 'readonly',
  cancelAnimationFrame: 'readonly',
  clearInterval: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  crypto: 'readonly',
  document: 'readonly',
  fetch: 'readonly',
  localStorage: 'readonly',
  navigator: 'readonly',
  performance: 'readonly',
  process: 'readonly',
  requestAnimationFrame: 'readonly',
  sessionStorage: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
  window: 'readonly'
};

export default [
  {
    ignores: ['node_modules/**', 'dist/**', '.vite/**', 'test-results/**', 'playwright-report/**']
  },
  {
    files: ['src/**/*.{js,jsx}', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: browserGlobals
    },
    plugins: {
      react: reactPlugin
    },
    settings: {
      react: {
        version: 'detect'
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off'
    }
  }
];