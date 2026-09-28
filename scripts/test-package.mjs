import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temp = mkdtempSync(join(tmpdir(), "swagcommands-package-"));
const packageDir = join(temp, "node_modules", "swagcommands");

function declarationsIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? declarationsIn(path) : path.endsWith(".d.ts") ? [path] : [];
  });
}

try {
  const tarballName = execFileSync(
    "npm",
    ["pack", "--pack-destination", temp, "--silent"],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, npm_config_cache: join(temp, "npm-cache") },
      stdio: ["ignore", "pipe", "inherit"],
    },
  ).trim().split("\n").at(-1);

  assert.ok(tarballName?.endsWith(".tgz"), "npm pack must produce a tarball");
  mkdirSync(packageDir, { recursive: true });
  execFileSync("tar", ["-xzf", join(temp, tarballName), "-C", packageDir, "--strip-components=1"]);

  const manifest = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
  assert.equal(manifest.main, "./dist/index.js");
  assert.equal(manifest.types, "./dist/index.d.ts");
  assert.ok(existsSync(join(packageDir, manifest.main)), "main must exist in the tarball");
  assert.ok(existsSync(join(packageDir, manifest.types)), "types must exist in the tarball");
  assert.ok(existsSync(join(packageDir, "dist/types.d.ts")), "public contracts must be emitted");
  assert.deepEqual(
    readdirSync(packageDir).sort(),
    ["LICENSE", "README.md", "dist", "package.json"],
    "only built code, metadata, and package documentation should ship",
  );

  const declarations = declarationsIn(join(packageDir, "dist"));
  assert.ok(declarations.length > 1, "the package must contain generated declarations");
  for (const declaration of declarations) {
    const source = readFileSync(declaration, "utf8");
    const imports = source.matchAll(/(?:from\s*|import\s*\()\s*["'](\.[^"']+)["']/g);
    for (const [, specifier] of imports) {
      const target = resolve(dirname(declaration), specifier);
      assert.ok(
        existsSync(`${target}.d.ts`) || existsSync(join(target, "index.d.ts")),
        `${declaration} references missing declaration ${specifier}`,
      );
    }
  }

  // Resolve dependencies from the checkout while testing the package's own JS and types.
  for (const dependency of Object.keys(manifest.dependencies)) {
    symlinkSync(join(root, "node_modules", dependency), join(temp, "node_modules", dependency), "junction");
  }

  const consumer = join(temp, "consumer.ts");
  copyFileSync(join(root, "tests", "fixtures", "package-consumer.ts.fixture"), consumer);
  execFileSync(
    process.execPath,
    [
      join(root, "node_modules", "typescript", "bin", "tsc"),
      "--noEmit", "--strict", "--skipLibCheck", "--target", "es2022",
      "--module", "node16", "--moduleResolution", "node16", "--esModuleInterop",
      consumer,
    ],
    { cwd: temp, stdio: "inherit" },
  );

  const require = createRequire(join(temp, "consumer.cjs"));
  const api = require("swagcommands");
  assert.equal(typeof api.default, "function");
  assert.equal(api.default, api.SWAGCommands);
  assert.equal(api.CommandType.SLASH, "SLASH");
  assert.equal(typeof api.MemoryPrefixStore, "function");
  assert.equal(typeof api.Precondition, "function");
  console.log(`Verified ${declarations.length} packaged declarations and CommonJS exports`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
