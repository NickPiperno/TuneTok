const {
  withProjectBuildGradle,
  createRunOncePlugin,
} = require("@expo/config-plugins");

// This regex insertion looks for "allprojects {" and appends code to configure Kotlin compile tasks.
function patchAllProjectsBuildGradle(buildGradle) {
  const pattern = /allprojects\s*{([\s\S]*?)}/;
  return buildGradle.replace(pattern, (match, group) => {
    // Instead of "afterEvaluate", we directly configure each subproject's Kotlin tasks here.
    const addition = `
    subprojects {
      tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
        kotlinOptions {
          jvmTarget = "17"
        }
      }
    }
    `;
    // Inject this snippet immediately inside "allprojects { ... }"
    return `allprojects {${group}\n${addition}\n}`;
  });
}

function withKotlinAllProjectsJvmTarget(config) {
  return withProjectBuildGradle(config, (config) => {
    // Patch the top-level android/build.gradle
    if (config.modResults.language === "groovy") {
      config.modResults.contents = patchAllProjectsBuildGradle(config.modResults.contents);
    } else {
      console.warn("withKotlinAllProjectsJvmTarget: Not a Groovy build.gradle - skipping jvmTarget patch.");
    }
    return config;
  });
}

// Wrap in createRunOncePlugin so it doesn't get applied multiple times
module.exports = createRunOncePlugin(
  withKotlinAllProjectsJvmTarget,
  "withKotlinAllProjectsJvmTarget",
  "1.0.0"
); 