// oxlint-disable no-console -- browser lever results
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import {
  closeSync,
  constants,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { arg, launch, ROOT, workbenchPage } from "./harness.mjs";

function cloneSnapshot(clone) {
  execFileSync("git", ["clone", "--quiet", "--shared", ROOT, clone]);
  execFileSync("git", ["remote", "remove", "origin"], { cwd: clone });
  const files = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    {
      cwd: ROOT,
      encoding: "utf8",
    },
  );
  for (const file of new Set(files.split("\0").filter(Boolean))) {
    if (!existsSync(path.join(ROOT, file))) continue;
    mkdirSync(path.dirname(path.join(clone, file)), { recursive: true });
    cpSync(path.join(ROOT, file), path.join(clone, file));
  }
  const modules = ["node_modules", ".turbo"].filter((p) => existsSync(path.join(ROOT, p)));
  for (const group of ["apps", "packages"]) {
    for (const entry of readdirSync(path.join(ROOT, group))) {
      const relative = path.join(group, entry, "node_modules");
      if (existsSync(path.join(ROOT, relative))) modules.push(relative);
    }
  }
  for (const relative of modules) {
    cpSync(path.join(ROOT, relative), path.join(clone, relative), {
      recursive: true,
      verbatimSymlinks: true,
      mode: constants.COPYFILE_FICLONE,
    });
  }
}

async function readyServer(base, server, log) {
  const ready = AbortSignal.timeout(120_000);
  // oxlint-disable-next-line no-unnecessary-condition -- poll readiness, not elapsed time
  while (true) {
    ready.throwIfAborted();
    if (server.exitCode !== null) throw new Error(readFileSync(log, "utf8"));
    try {
      // oxlint-disable-next-line no-await-in-loop -- each response decides whether to retry
      if ((await fetch(`${base}/__workbench/values`, { signal: ready })).ok) return;
    } catch {
      ready.throwIfAborted();
    }
    // oxlint-disable-next-line no-await-in-loop -- readiness retry, not an assertion delay
    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });
  }
}

async function disposableCommit() {
  const folder = mkdtempSync(path.join(tmpdir(), "workbench-browser-"));
  const clone = path.join(folder, "repo");
  const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" });
  const sourceFile = path.join(ROOT, "packages/catalog/src/overrides.css");
  const sourceBytes = readFileSync(sourceFile, "utf8");
  let server;
  const stop = () => {
    if (server?.pid !== undefined && server.exitCode === null) {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {
        // The server may have already exited.
      }
    }
  };
  process.once("exit", stop);
  try {
    cloneSnapshot(clone);
    const socket = createServer();
    socket.listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise((resolve) => {
      socket.close(resolve);
    });
    const base = `http://127.0.0.1:${port}`;
    const log = openSync(path.join(folder, "server.log"), "w");
    server = spawn(
      "pnpm",
      [
        "--filter",
        "web",
        "exec",
        "react-router",
        "dev",
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
        "--strictPort",
      ],
      {
        cwd: clone,
        detached: true,
        stdio: ["ignore", log, log],
      },
    );
    closeSync(log);
    await readyServer(base, server, path.join(folder, "server.log"));
    const child = spawn(
      process.execPath,
      [
        "apps/web/scripts/commit-check.mjs",
        "--commit",
        "--base",
        base,
        "--out",
        path.resolve(arg("--out", ".artifacts/commit")),
      ],
      {
        cwd: clone,
        env: { ...process.env, WORKBENCH_COMMIT_CLONE: clone },
        stdio: "inherit",
      },
    );
    const [code] = await once(child, "exit");
    assert.equal(code, 0, "disposable real-commit browser run");
    assert.equal(
      execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }),
      sourceHead,
    );
    assert.equal(readFileSync(sourceFile, "utf8"), sourceBytes);
    console.log("ok disposable clone leaves source HEAD and override bytes unchanged");
  } finally {
    stop();
    if (server !== undefined && server.exitCode === null && server.signalCode === null)
      await once(server, "exit");
    process.removeListener("exit", stop);
    rmSync(folder, { recursive: true, force: true });
  }
}

if (process.argv.includes("--commit") && process.env.WORKBENCH_COMMIT_CLONE !== ROOT) {
  await disposableCommit();
  process.exit(0);
}

const base = arg("--base", "http://localhost:5173");
const out = arg("--out", path.join(ROOT, ".artifacts/commit"));
const file = path.join(ROOT, "packages/catalog/src/overrides.css");
const starting = readFileSync(file, "utf8");
const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
const browser = await launch();
const { page, context, errors } = await workbenchPage(browser);
const button = (name) => page.getByRole("button", { name, exact: true });
const off = (name) => page.getByRole("button", { name, exact: true, disabled: true }).waitFor();
const status = page.locator(".commit-status");
const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`) });
mkdirSync(out, { recursive: true });

async function statusHas(value, timeout = 30_000) {
  await page.waitForFunction(
    (s) => document.querySelector(".commit-status").textContent.includes(s),
    value,
    { timeout },
  );
}

async function shotModes(name) {
  // oxlint-disable no-await-in-loop -- capture the same dialog against both canvas modes
  for (const mode of ["light", "dark", "light"]) {
    await page.locator("#theme").evaluate((select, value) => {
      select.value = value;
      select.dispatchEvent(new Event("change"));
    }, mode);
    await shot(`${name}-${mode}`);
  }
}

async function startCommit() {
  await page
    .getByRole("button", { name: "Check and commit", exact: true, disabled: false })
    .waitFor();
  await button("Check and commit").click();
  await page.getByRole("dialog", { name: "Check and commit", exact: true }).waitFor();
}

try {
  await context.route(/api\.fontsource\.org|cdn\.jsdelivr\.net/, (route) => route.abort());
  await page.goto(`${base}/__workbench/?path=/t/demo-brief`);
  await page.frameLocator("iframe").locator("[data-slot=window]").waitFor();
  await page.frameLocator("iframe").locator("section.card.state").first().waitFor();
  const values = await (await page.request.get(`${base}/__workbench/values`)).json();
  const token = values.tokens["--window-radius"];
  const initialRadius = parseFloat(token.override ?? token.baseline);
  const radius = initialRadius + 6;
  await page.waitForFunction(
    (r) => Number(document.querySelector("#radius").value) === r,
    initialRadius,
  );
  await off("Check and commit");
  await shot("clean");
  await page.locator("#radius").fill(String(radius));
  await page.locator("#radius").press("Enter");
  await page.getByRole("button", { name: "Undo", exact: true, disabled: false }).waitFor();
  await shot("dirty");
  await page
    .frameLocator("iframe")
    .locator("section.card.state")
    .first()
    .click({ position: { x: 10, y: 10 } });
  await page.waitForFunction(() => document.querySelector(".selector").textContent !== "");
  const selected = await page.locator(".selector").textContent();
  const foreign = await page.request.post(`${base}/__workbench/commit`, {
    headers: { origin: "http://foreign.invalid" },
    data: {},
  });
  assert.equal(foreign.status(), 403);
  const invalid = await page.request.post(`${base}/__workbench/commit`, {
    headers: { origin: base },
    data: {},
  });
  assert.equal(invalid.status(), 400);

  await page.route("**/__workbench/commit", (route) =>
    route.fulfill({
      contentType: "application/x-ndjson",
      body: `${JSON.stringify({ kind: "checking", command: "pnpm test" })}\n${JSON.stringify({
        kind: "error",
        message: "pnpm test failed\nAssertionError: example check output",
      })}\n`,
    }),
  );
  let releasePreview;
  const previewHeld = new Promise((resolve) => {
    releasePreview = resolve;
  });
  await page.route("**/__workbench/commit/preview", async (route) => {
    await previewHeld;
    await route.continue();
  });
  await startCommit();
  await page.keyboard.press("Escape");
  assert.ok(await page.getByRole("dialog", { name: "Check and commit", exact: true }).isVisible());
  releasePreview();
  await statusHas("pnpm test failed", 5000);
  await page.unroute("**/__workbench/commit/preview");
  assert.match(await status.textContent(), /AssertionError/);
  assert.equal(await page.locator(".commit-diff, .commit-message, .commit-value").count(), 0);
  assert.equal(await button("Run checks and commit").count(), 0);
  assert.ok(readFileSync(file, "utf8").includes(`--window-radius: ${radius}px;`));
  await shotModes("failed");
  await page.keyboard.press("Escape");
  await page.locator(".commit-dialog").waitFor({ state: "hidden", timeout: 3000 });
  assert.equal(
    await page.locator(".selector").textContent(),
    selected,
    "dialog Escape keeps the canvas selection",
  );
  await page.unroute("**/__workbench/commit");
  console.log(
    "ok one press starts checks without a diff or message; failure output and request refusals",
  );

  if (process.argv.includes("--commit")) {
    const manifest = path.join(ROOT, "package.json");
    const original = readFileSync(manifest, "utf8");
    const held = JSON.parse(original);
    held.scripts.typecheck = `node -e 'setInterval(() => {}, 1000)'`;
    writeFileSync(manifest, JSON.stringify(held));
    try {
      await startCommit();
      await statusHas("Running pnpm typecheck");
      await shotModes("checking");
      await button("Cancel checks").click();
      await statusHas("Cancelled. Nothing was committed.");
      await shot("cancelled");
    } finally {
      writeFileSync(manifest, original);
    }
    assert.equal(
      execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim(),
      head,
    );
    await button("Close").click();
    console.log("ok real cancellation leaves HEAD unchanged");
    await startCommit();
    await page
      .getByRole("button", { name: "Close", exact: true, disabled: false })
      .waitFor({ timeout: 900_000 });
    assert.match(await status.textContent(), /^Committed /);
    await shotModes("success");
    assert.equal(
      execFileSync("git", ["show", "--format=", "--name-only", "HEAD"], {
        cwd: ROOT,
        encoding: "utf8",
      }).trim(),
      "packages/catalog/src/overrides.css",
    );
    const committed = execFileSync("git", ["show", "HEAD:packages/catalog/src/overrides.css"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    assert.ok(committed.includes(`--window-radius: ${radius}px;`));
    console.log(
      execFileSync("git", ["show", "--stat", "--oneline", "HEAD"], {
        cwd: ROOT,
        encoding: "utf8",
      }),
    );
    await button("Close").click();
    await off("Check and commit");
    await off("Undo");
    await off("Redo");
    await shot("committed");
    console.log(
      "ok real checks and override-only commit; button disabled and edit history cleared",
    );
  }
  assert.deepEqual(errors, []);
} catch (error) {
  try {
    console.error(await status.textContent({ timeout: 5000 }));
    await page.screenshot({ path: path.join(out, "unexpected.png"), timeout: 5000 });
  } catch (captureError) {
    console.error("Could not capture failure", captureError);
  }
  throw error;
} finally {
  writeFileSync(file, starting);
  await browser.close();
}
