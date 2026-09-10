const appJson = require("./app.json");

/** Custom domain poultrytechapp.com is served at /. Set EXPO_BASE_URL=/poultry-app only for project-page previews. */
const baseUrl = process.env.EXPO_BASE_URL || "";

module.exports = {
  expo: {
    ...appJson.expo,
    experiments: {
      ...(appJson.expo.experiments ?? {}),
      ...(baseUrl ? { baseUrl } : {}),
    },
  },
};
