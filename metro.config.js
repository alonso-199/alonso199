const path = require('path');

// Simple Metro config that maps the '@' alias to project root.
// Uses a Proxy to resolve arbitrary module paths to the project directory.
module.exports = {
  resolver: {
    extraNodeModules: new Proxy({}, {
      get: (_, name) => path.join(process.cwd(), name),
    }),
  },
  watchFolders: [path.resolve(__dirname)],
};
const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

module.exports = withRorkMetro(config);
