import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Linting acts as an automated proof-reader for code quality and common mistakes
export default defineConfig([
  globalIgnores(['dist']),
  {
    // Apply these rules to TypeScript and React component files
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      // This project runs in modern browsers
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
