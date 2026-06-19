module.exports = {
  root: true,
  extends: ['../../packages/eslint-config/index.cjs'],
  ignorePatterns: ['dist', 'node_modules', '*.cjs'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
  },
};
