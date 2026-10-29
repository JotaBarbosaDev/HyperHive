import { readFile, writeFile } from "node:fs/promises";

const [action, input] = process.argv.slice(2);
const files = {
  package: new URL("../package.json", import.meta.url),
  lock: new URL("../package-lock.json", import.meta.url),
  app: new URL("../app.json", import.meta.url),
};

function versionCode(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  if (!match) throw new Error(`Expected a stable semantic version (x.y.z), received: ${version}`);
  const [major, minor, patch] = match.slice(1).map(Number);
  const code = major * 1_000_000 + minor * 1_000 + patch;
  if (minor > 999 || patch > 999 || code < 1 || code > 2_100_000_000) {
    throw new Error(`Version cannot be represented as an Android versionCode: ${version}`);
  }
  return code;
}

const [pkg, lock, app] = await Promise.all(Object.values(files).map(async (url) =>
  JSON.parse(await readFile(url, "utf8"))));

if (action === "set") {
  const version = typeof input === "string" ? input.replace(/^v/, "") : "";
  const code = versionCode(version);
  pkg.version = version;
  lock.version = version;
  lock.packages[""].version = version;
  app.expo.version = version;
  app.expo.android.versionCode = code;
  await Promise.all([
    writeFile(files.package, `${JSON.stringify(pkg, null, 2)}\n`),
    writeFile(files.lock, `${JSON.stringify(lock, null, 2)}\n`),
    writeFile(files.app, `${JSON.stringify(app, null, 2)}\n`),
  ]);
  console.log(`HyperHive ${version}; Android versionCode ${code}`);
} else if (action === "check") {
  const version = app.expo.version;
  const code = versionCode(version);
  if (pkg.version !== version || lock.version !== version || lock.packages[""]?.version !== version || app.expo.android.versionCode !== code) {
    throw new Error("HyperHive versions are out of sync; run npm run version:set -- <version>.");
  }
  console.log(`HyperHive ${version}; Android versionCode ${code}`);
} else {
  throw new Error("Usage: node scripts/hh-version.mjs <set <version>|check>");
}
