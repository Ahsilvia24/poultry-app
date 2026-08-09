const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes("pdf")) {
  config.resolver.assetExts.push("pdf");
}

// expo-sqlite web needs wasm assets + COOP/COEP for SharedArrayBuffer.
if (!config.resolver.assetExts.includes("wasm")) {
  config.resolver.assetExts.push("wasm");
}

// Metro/web can resolve tslib's ESM "default" export incorrectly, which breaks
// packages that do `const { __extends } = tslib` (tslib.default is undefined).
const ALIASES = {
  tslib: path.resolve(__dirname, "node_modules/tslib/tslib.es6.js"),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // sql.js pulls in node:fs — keep it out of native iOS/Android bundles.
  if (
    platform !== "web" &&
    (moduleName === "sql.js" ||
      moduleName.startsWith("sql.js/") ||
      moduleName === "node:fs" ||
      moduleName === "fs")
  ) {
    return { type: "empty" };
  }

  return context.resolveRequest(
    context,
    ALIASES[moduleName] ?? moduleName,
    platform,
  );
};

config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    return middleware(req, res, next);
  };
};

module.exports = config;
