// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// pdf-lib depends on tslib 1.x. Through package "exports", Metro picks tslib's
// "import" wrapper, which reads a default export the UMD build does not have
// and crashes at startup ("Cannot destructure property '__extends'").
// Point every import of tslib at its plain ES module build instead.
const tslibEs6 = path.join(__dirname, 'node_modules', 'tslib', 'tslib.es6.js');
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'tslib') return { type: 'sourceFile', filePath: tslibEs6 };
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
