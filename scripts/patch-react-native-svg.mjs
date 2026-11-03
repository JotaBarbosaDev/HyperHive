import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * react-native-svg's web renderer (`WebShape`) spreads every prop onto the DOM
 * node it creates. victory-native passes `accessibilityHint` (a React Native
 * only prop) to its SVG primitives, so the prop reaches the browser DOM and
 * React 19 warns:
 *
 *   React does not recognize the `accessibilityHint` prop on a DOM element.
 *
 * react-native-web has no mapping for `accessibilityHint`, so dropping it in
 * the web `prepare` step is safe: it was never rendered on web anyway.
 *
 * This script is idempotent and runs from the `postinstall` hook so the patch
 * survives `npm install`.
 */

const MARKER = "// hh-patch: drop react-native accessibilityHint before DOM render";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const targets = [
  "node_modules/react-native-svg/src/web/utils/prepare.ts",
  "node_modules/react-native-svg/lib/module/web/utils/prepare.js",
  "node_modules/react-native-svg/lib/commonjs/web/utils/prepare.js",
];

let patched = 0;

for (const target of targets) {
  const file = join(root, target);
  if (!existsSync(file)) continue;

  const source = readFileSync(file, "utf8");
  if (source.includes(MARKER)) continue;

  const index = source.lastIndexOf("  return clean;");
  if (index === -1) {
    console.warn(`[patch-react-native-svg] could not find insertion point in ${target}`);
    continue;
  }

  const insertion = [
    `  ${MARKER}`,
    "  delete clean.accessibilityHint;",
    "  return clean;",
  ].join("\n");

  const updated = `${source.slice(0, index)}${insertion}${source.slice(index + "  return clean;".length)}`;
  writeFileSync(file, updated);
  patched += 1;
  console.log(`[patch-react-native-svg] patched ${target}`);
}

if (patched === 0) {
  console.log("[patch-react-native-svg] nothing to do");
}
