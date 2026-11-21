/**
 * Tells Google Play that no hardware is required to install Almari.
 *
 * Play reads requirements into the manifest that the app never asked for:
 * a portrait-locked screen means "needs a portrait screen" (which hides the
 * app from tablets, Chromebooks and XR headsets), and the camera permission
 * means "needs a camera with autofocus". Almari works without all of them:
 * papers can be picked from files instead of photographed, and the PIN
 * unlocks it without a fingerprint. Each is declared here as not required.
 */
const { withAndroidManifest } = require('expo/config-plugins');

const OPTIONAL = [
  'android.hardware.screen.portrait',
  'android.hardware.camera',
  'android.hardware.camera.autofocus',
  'android.hardware.fingerprint',
];

module.exports = function withOptionalFeatures(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const features = (manifest['uses-feature'] = manifest['uses-feature'] ?? []);
    for (const name of OPTIONAL) {
      const found = features.find((f) => f.$?.['android:name'] === name);
      if (found) found.$['android:required'] = 'false';
      else features.push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
    return cfg;
  });
};
