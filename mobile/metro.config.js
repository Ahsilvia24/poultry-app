const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes("pdf")) {
  config.resolver.assetExts.push("pdf");
}

// Metro/web can resolve tslib's ESM "default" export incorrectly, which breaks
// packages that do `const { __extends } = tslib` (tslib.default is undefined).
const ALIASES = {
  tslib: path.resolve(__dirname, "node_modules/tslib/tslib.es6.js"),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  return context.resolveRequest(
    context,
    ALIASES[moduleName] ?? moduleName,
    platform,
  );
};

module.exports = config;
