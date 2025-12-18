import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  // Node/CommonJS code (Cloud Functions, Netlify functions, scripts)
  {
    files: [
      'functions/**/*.js',
      'netlify/**/*.js',
      'scripts/**/*.js',
      'notifier-service/**/*.js',
      'fix-notifications.js',
      'test-*.js',
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.node },
      parserOptions: { sourceType: 'commonjs' },
    },
    rules: {
      // Allow CommonJS globals like require/module/exports
      'no-undef': 'off',
      'react-refresh/only-export-components': 'off',
      // Cloud function files often export helpers or handlers that appear unused to the linter
      'no-unused-vars': 'off',
      'no-empty': 'off',
    },
  },
  // Service worker and web worker files
  {
    files: [
      'public/firebase-messaging-sw.js',
      'public/service-worker.js',
      'public/sw-version.js',
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.serviceworker,
        ...globals.browser,
        importScripts: 'readonly',
        clients: 'readonly',
        firebase: 'readonly',
        firebaseConfig: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',
    },
  },
  // Files that are not React components but share utilities
  {
    files: ['src/firebase/config.js'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  // Context files often export hooks and providers; disable react-refresh restriction here
  {
    files: ['src/context/**'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
