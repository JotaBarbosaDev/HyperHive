const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// victory-native passes React Native-only props (accessibilityHint) through react-native-svg,
// which reach the DOM on web. The `victory` package has the same API and renders plain SVG.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const target = platform === 'web' && moduleName === 'victory-native' ? 'victory' : moduleName;
  return context.resolveRequest(context, target, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
