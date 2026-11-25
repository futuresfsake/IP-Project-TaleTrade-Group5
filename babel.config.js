// module.exports = {
//   presets: ['module:@react-native/babel-preset'],
//   plugins: ['react-native-reanimated/plugin'],
// };


//* babel is a universal translator, a simplified version that the mobile hardware can actually execute


module.exports = api => {
  // Jest maps `@env` to __mocks__/env.js (see jest.config.js), so the .env inlining plugin
  // is skipped under test: results then never depend on a developer's local .env.
  const isTest = api.env('test');

  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
      'react-native-reanimated/plugin',
      ...(isTest
        ? []
        : [
            [
              'module:react-native-dotenv',
              {
                moduleName: '@env',
                path: '.env',
              },
            ],
          ]),
    ],
  };
};
