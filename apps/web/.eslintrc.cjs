module.exports = {
  root: true,
  extends: ['../../packages/eslint-config/index.cjs'],
  ignorePatterns: ['.next', 'node_modules', '*.cjs'],
  plugins: ['react-hooks'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
};
