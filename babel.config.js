module.exports = function (api) {
  const isTest = api.env("test");

  return {
    presets: [['babel-preset-expo'], ...(!isTest ? ['nativewind/babel'] : [])],

    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],

          alias: {
            '@': './',
            'tailwind.config': './tailwind.config.js',
          },
        },
      ],
      'react-native-worklets/plugin',
    ],
  };
};
