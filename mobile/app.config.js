const appJson = require("./app.json");

/** GitHub project pages live at /poultry-app. Custom domains use root. */
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
