module.exports = {
  extends: ['eslint-config-digital-twin-fm'],
  root: true,
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'off',
  },
};
