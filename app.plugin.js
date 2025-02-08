// app.plugin.js

// Import the older helper
const { withAppBuildGradle, createRunOncePlugin } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

function withGoogleServicesJSON(config) {
  // Instead of withAndroidAppGradle, use withAppBuildGradle
  return withAppBuildGradle(config, (config) => {
    const appGradlePath = config.modResults?.language === "groovy" ? config.modResults.path : null;

    if (!appGradlePath) {
      return config;
    }

    // Copy google-services.json into the Android project if needed.
    // The default path in a managed workflow build will be `<projectRoot>/android/app`.
    const srcGoogleServicesJsonPath = path.resolve(config.modRequest.projectRoot, "google-services.json");
    const dstGoogleServicesJsonPath = path.resolve(config.modRequest.platformProjectRoot, "app", "google-services.json");

    if (fs.existsSync(srcGoogleServicesJsonPath)) {
      fs.copyFileSync(srcGoogleServicesJsonPath, dstGoogleServicesJsonPath);
      console.log("Copied google-services.json into Android project.");
    } else {
      console.warn("google-services.json not found at " + srcGoogleServicesJsonPath);
    }

    return config;
  });
}

function withAndroidGoogleServicesPlugin(config) {
  // Skip withAndroidProperties altogether if your version doesn't have it
  return withGoogleServicesJSON(config);
}

// createRunOncePlugin ensures the plugin runs only once in the build process
module.exports = createRunOncePlugin(
  withAndroidGoogleServicesPlugin,
  "withAndroidGoogleServicesPlugin",
  "1.0.0"
); 