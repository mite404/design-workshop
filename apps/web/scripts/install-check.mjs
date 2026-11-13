// Install check (ETH-165): the packed Workbench, extracted into a scratch pnpm monorepo as a
// workspace package, sets up an app with `init --yes` and serves it with `dev`, using nothing
// else from this repo.
//   node apps/web/scripts/install-check.mjs
// oxlint-disable no-console -- the check reports its result
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const APP_PORT = 5193;
const PROXY_PORT = 5183;
const PAGE = `<!doctype html><html><head></head><body><h1>Scratch app</h1></body></html>\n`;

const scratch = mkdtempSync(path.join(tmpdir(), "install-check-"));
const app = path.join(scratch, "apps/web");
const pkg = path.join(scratch, "packages/design-workshop");
const run = (cwd, cmd, ...args) => execFileSync(cmd, args, { cwd, encoding: "utf8" });
const write = (file, text) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
};
/**
 * Every file under `dir` but dependencies, as paths relative to it.
 * @param {string} dir
 */
const files = (dir) =>
  readdirSync(dir, { recursive: true, encoding: "utf8" }).filter(
    (f) => !f.split(path.sep).includes("node_modules") && statSync(path.join(dir, f)).isFile(),
  );

// Waits for `dev` to say where it serves, or fails with what it printed.
const started = (child) =>
  new Promise((resolve, reject) => {
    let output = "";
    const seen = (chunk) => {
      output += String(chunk);
      if (output.includes("Workbench at")) resolve();
    };
    child.stdout.on("data", seen);
    child.stderr.on("data", seen);
    child.on("exit", () => {
      reject(new Error(`dev exited:\n${output}`));
    });
  });

const get = async (url) => {
  const response = await fetch(`http://localhost:${PROXY_PORT}${url}`);
  assert.equal(response.status, 200, `${url} answers 200`);
  return response.text();
};

let dev;
const server = createServer((_, res) => {
  res.writeHead(200, { "content-type": "text/html" });
  res.end(PAGE);
});
try {
  // The package as `pnpm pack` ships it, with no tests, extracted like a host would.
  run(path.join(ROOT, "packages/workbench"), "pnpm", "pack", "--pack-destination", scratch);
  const tarball = readdirSync(scratch).find((f) => f.endsWith(".tgz"));
  assert.notEqual(tarball, undefined, "pnpm pack wrote a tarball");
  mkdirSync(pkg, { recursive: true });
  run(scratch, "tar", "-xzf", tarball, "-C", pkg, "--strip-components", "1");
  assert.equal(
    files(pkg).some((f) => f.includes(".test.")),
    false,
    "the tarball ships no tests",
  );

  write(path.join(scratch, "package.json"), '{ "name": "scratch", "private": true }\n');
  write(path.join(scratch, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n  - packages/*\n");
  write(path.join(app, "package.json"), '{ "name": "web", "private": true }\n');
  write(path.join(app, "src/index.css"), ":root {\n  --background: #ffffff;\n}\n");

  // As the install guide runs it: from the package's folder, before anything is installed.
  const before = files(app);
  run(scratch, "node", path.join(pkg, "src/cli.ts"), "init", "apps/web", "--yes");
  const added = files(app).filter((f) => !before.includes(f));
  assert.deepEqual(added.toSorted(), [".workbench/config.json", ".workbench/overrides.css"]);
  const manifest = readFileSync(path.join(app, "package.json"), "utf8");
  assert.match(manifest, /"workbench": "design-workshop"/, "init adds the workbench script");
  assert.match(manifest, /"design-workshop": "workspace:\*"/, "init adds the dependency");
  run(scratch, "pnpm", "install", "--prefer-offline", "--silent");

  await new Promise((resolve) => {
    server.listen(APP_PORT, resolve);
  });
  // The installed bin, run by Node itself, so killing it stops the server (`pnpm exec` would
  // leave it running).
  const bin = path.join(app, "node_modules/design-workshop/src/cli.ts");
  const target = `http://localhost:${APP_PORT}`;
  dev = spawn(process.execPath, [bin, "dev", "--target", target, "--port", `${PROXY_PORT}`], {
    cwd: app,
  });
  await started(dev);

  const editor = await get("/__workbench/");
  assert.match(editor, /<meta name="workbench-canvas" content="\/" \/>/);
  const script = /src="(\/__workbench\/@fs[^"]+page\.ts)"/.exec(editor)?.[1];
  assert.equal(script?.includes(pkg), true, "the editor runs the extracted package's page");
  await get(script);
  const page = await get("/");
  assert.match(page, /href="\/__workbench\/fonts\.css"/);
  assert.match(page, /href="\/__workbench\/overrides\.css"/);
  await get("/__workbench/fonts.css");
  await get("/__workbench/overrides.css");
  console.log("install check passed");
} finally {
  dev?.kill();
  server.closeAllConnections();
  server.close();
  rmSync(scratch, { recursive: true, force: true });
}
