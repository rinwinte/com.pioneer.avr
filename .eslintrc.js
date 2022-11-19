module.exports = {
  root: true,
  extends: 'athom',
  parser: '@babel/eslint-parser',
  parserOptions: {
    sourceType: 'module',
    requireConfigFile: false,
  },
  rules:
  {
    // 'no-console': 'off',
    'node/no-unsupported-features/es-syntax': [
      'error',
      { ignores: ['modules'] },
    ],
    'no-extend-native': 'off',
    'node/no-missing-require': 'off',
    'node/no-unpublished-require': 'off',
    'import/extensions': 'off',
  },
};
