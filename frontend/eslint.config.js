import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'src/routeTree.gen.ts']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // The new react-hooks 7.x rule fires on legitimate "load server data
      // into local editable state" and "reset derived state on input change"
      // patterns. Both are intentional in this codebase.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    // TanStack Router file-based routes export both `Route` and the page
    // component from one file by design — Fast Refresh can't help here, so
    // silence the warning for these files.
    files: ['src/routes/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
