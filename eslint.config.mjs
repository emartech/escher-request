import eslint from '@eslint/js';
import chaiFriendly from 'eslint-plugin-chai-friendly';
import noOnlyTests from 'eslint-plugin-no-only-tests';
import security from 'eslint-plugin-security';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['dist/**', 'examples/**', 'eslint.config.mjs']),
  {
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      chaiFriendly.configs.recommendedFlat,
      security.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'no-only-tests': noOnlyTests,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-only-tests/no-only-tests': 'error',
    },
  },
);
