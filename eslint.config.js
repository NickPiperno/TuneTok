import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactNativePlugin from 'eslint-plugin-react-native';
import prettierConfig from 'eslint-config-prettier';

export default [
  eslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': tseslint,
      'react': reactPlugin,
      'react-native': reactNativePlugin,
    },
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        project: './tsconfig.json',
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react-native/no-inline-styles': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
    env: {
      'react-native/react-native': true,
    },
  },
  prettierConfig,
]; 