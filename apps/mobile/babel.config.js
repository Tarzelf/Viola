module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    // Reanimated's plugin must be listed last.
    plugins: ['react-native-worklets/plugin'],
  };
};
