const {
  withAndroidManifest,
  withDangerousMod,
} = require("@expo/config-plugins");
const fs = require("fs/promises");
const path = require("path");

const networkSecurityConfig = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config>
    <trust-anchors>
      <certificates src="system" />
      <certificates src="user" />
    </trust-anchors>
  </base-config>
</network-security-config>
`;

const withAndroidUserCertificates = (config) => {
  config = withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];

    if (!application) {
      throw new Error("Android application manifest entry was not found.");
    }

    application.$ = application.$ ?? {};
    application.$["android:networkSecurityConfig"] = "@xml/network_security_config";

    return config;
  });

  return withDangerousMod(config, ["android", async (config) => {
    const resourceDirectory = path.join(
      config.modRequest.platformProjectRoot,
      "app/src/main/res/xml"
    );

    await fs.mkdir(resourceDirectory, { recursive: true });
    await fs.writeFile(
      path.join(resourceDirectory, "network_security_config.xml"),
      networkSecurityConfig
    );

    return config;
  }]);
};

module.exports = withAndroidUserCertificates;
