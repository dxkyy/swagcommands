import { spawnSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
rmSync(resolve(root, "dist"), { recursive: true, force: true });

const compiler = resolve(root, "node_modules", "typescript", "bin", "tsc");
const result = spawnSync(process.execPath, [compiler, "-p", "tsconfig.json"], {
  cwd: root,
  stdio: "inherit",
});

if (result.error) throw result.error;
if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
} else {
  const require = createRequire(import.meta.url);
  const api = require(resolve(root, "dist/index.js"));
  const namedExports = Object.keys(api).filter((name) => name !== "default" && name !== "__esModule");
  writeFileSync(resolve(root, "dist/index.mjs"), [
    'import api from "./index.js";',
    "export default api.default;",
    ...namedExports.map((name) => `export const ${name} = api.${name};`),
    "",
  ].join("\n"));
  writeFileSync(resolve(root, "dist/index.d.mts"), [
    'export * from "./index.js";',
    'import { SWAGCommands } from "./index.js";',
    "export default SWAGCommands;",
    "",
  ].join("\n"));
}
