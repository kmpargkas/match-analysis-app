import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Layer boundaries:
// domain is pure; features use storage only via repositories and never Dexie;
// only platform touches file APIs; features don't import each other.
const domainRules = {
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        { group: ['react', 'react-*', 'react/*', 'dexie', 'dexie-*'], message: 'domain/ must stay pure TS.' },
        { group: ['@/app/*', '@/features/*', '@/storage/*', '@/platform/*', '@/ui/*', '@/i18n/*'], message: 'domain/ imports nothing from other layers.' },
      ],
    },
  ],
  'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'indexedDB', 'navigator'],
};

const featureRules = {
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        { group: ['dexie', 'dexie-*', '@/storage/dexie/*'], message: 'Use repositories from @/storage, not Dexie.' },
        { group: ['@/platform/*'], message: 'Features reach platform/ only through storage/.' },
        { group: ['@/features/*/*'], message: "Features don't import each other's internals. Move shared code to ui/ or domain/." },
      ],
    },
  ],
};

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'public', 'playwright-report', 'test-results', '.claude/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2023, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  // shadcn-style modules export variants/hooks next to components by design.
  { files: ['src/ui/**/*.tsx', 'src/storage/**/*.tsx'], rules: { 'react-refresh/only-export-components': 'off' } },
  // Playwright fixtures call a parameter named `use`, which isn't React's hook.
  { files: ['tests/e2e/**/*.ts'], rules: { 'react-hooks/rules-of-hooks': 'off' } },
  { files: ['src/domain/**/*.ts'], rules: domainRules },
  { files: ['src/features/**/*.{ts,tsx}'], rules: featureRules },
  { files: ['tests/e2e/**/*.ts', 'playwright.config.ts'], languageOptions: { globals: { ...globals.node, ...globals.browser } }, rules: { 'react-hooks/rules-of-hooks': 'off' } },
);
