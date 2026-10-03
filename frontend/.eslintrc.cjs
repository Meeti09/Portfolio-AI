/* ESLint configuration.
 *
 * This file must stay CommonJS: package.json sets "type": "module", so a plain
 * `.js` config would be parsed as ESM and `module.exports` would throw. The
 * `.cjs` extension forces the CommonJS loader.
 *
 * Note the format here is the legacy `.eslintrc` schema, which is what the
 * installed ESLint 8.x consumes. Flat config (`eslint.config.js`) is only
 * honoured by ESLint 9+, and would be silently ignored here.
 */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', 'node_modules', 'coverage', '*.cjs'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json'],
  },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/consistent-type-imports': 'error',
    'no-unused-vars': 'off',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  overrides: [
    {
      // Tests intentionally poke at partially-typed data and assert on casts.
      files: ['src/tests/**/*.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
}