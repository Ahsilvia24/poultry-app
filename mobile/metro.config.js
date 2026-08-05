const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes("pdf")) {
  config.resolver.assetExts.push("pdf");
}
if (!config.resolver.assetExts.includes("wasm")) {
  config.resolver.assetExts.push("wasm");
}

// pdf-lib's ESM tslib entry breaks under Metro/Hermes web (`tslib.default` undefined).
// Force the CJS build for all tslib resolutions.
const tslibCjs = path.resolve(__dirname, "node_modules/tslib/tslib.js");
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "tslib" ||
    moduleName === "tslib.js" ||
    moduleName.endsWith("/tslib.js") ||
    moduleName.endsWith("/tslib/modules/index.js") ||
    moduleName.includes("tslib/modules")
  ) {
    return { filePath: tslibCjs, type: "sourceFile" };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
