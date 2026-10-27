const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// @sayly/shared is linked from ../../packages/shared (rules the app and the API share).
const sharedDir = path.resolve(__dirname, "../../packages/shared");
config.watchFolders = [...(config.watchFolders ?? []), sharedDir];

// Packages imported by shared code (zod, Babel helpers) come from the app's node_modules, so the
// bundle holds one copy of each and never reaches into packages/shared/node_modules.
const appRoot = path.join(__dirname, "package.json");
const resolveDefault = config.resolver.resolveRequest;
const isPackageImport = (name) => !name.startsWith(".") && !path.isAbsolute(name);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const fromShared = context.originModulePath.startsWith(sharedDir + path.sep);
  const nextContext =
    fromShared && isPackageImport(moduleName) ? { ...context, originModulePath: appRoot } : context;
  return resolveDefault
    ? resolveDefault(nextContext, moduleName, platform)
    : nextContext.resolveRequest(nextContext, moduleName, platform);
};

module.exports = config;
