import fs from 'node:fs'
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { importX } from 'eslint-plugin-import-x'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Layers only depend downwards: shared <- features <- app. A feature never imports another feature;
// whatever combines several of them lives in app/. Read from disk so a new feature is covered as is.
const features = fs.readdirSync(new URL('./src/features', import.meta.url))

const layerZones = [
  ...features.map((feature) => ({
    target: `./src/features/${feature}`,
    from: './src/features',
    except: [`./${feature}`],
    message: 'A feature cannot import another feature: compose them in src/app.',
  })),
  {
    target: './src/features',
    from: './src/app',
    message: 'Features cannot import from src/app.',
  },
  {
    target: './src/shared',
    from: ['./src/features', './src/app'],
    message: 'src/shared cannot depend on features or on src/app.',
  },
]

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
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
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'import-x': importX },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver({ project: './tsconfig.app.json' })],
    },
    rules: {
      'import-x/no-restricted-paths': ['error', { basePath: import.meta.dirname, zones: layerZones }],
    },
  },
])
