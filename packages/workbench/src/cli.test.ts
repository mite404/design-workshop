import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";
import { writeValues } from "./plugin.ts";

const EMPTY = "/* Workbench values */\n:root {\n}\n";
const folders: string[] = [];

function checkout() {
  const root = mkdtempSync(join(tmpdir(), "workbench-cli-"));
  folders.push(root);
  const src = join(root, "packages/workbench/src");
  cpSync(import.meta.dirname, src, { recursive: true });
  const catalog = join(root, "packages/catalog/src");
  mkdirSync(catalog, { recursive: true });
  cpSync(
    fileURLToPath(new URL("../../catalog/src/tokens.css", import.meta.url)),
    join(catalog, "tokens.css"),
  );
  writeFileSync(join(root, "package.json"), '{"type":"module"}\n');
  const file = join(catalog, "overrides.css");
  writeFileSync(file, EMPTY);
  return {
    file,
    catalog,
    run: (...args: string[]) =>
      spawnSync(process.execPath, [join(src, "cli.ts"), ...args], {
        cwd: root,
        encoding: "utf8",
      }),
  };
}

afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

test("commands list, save and remove values without a server or changes to other files", () => {
  const { file, catalog, run } = checkout();
  expect(run("set", ":root", "--window-radius", "28px").status).toBe(0);
  expect(
    writeValues(file, {
      selector: ":root",
      name: "--window-radius",
      value: "36px",
      was: null,
    }).status,
  ).toBe(409);
  expect(readFileSync(file, "utf8")).toBe(
    "/* Workbench values */\n:root {\n  --window-radius: 28px;\n}\n",
  );
  const listed = run("list", "--json");
  expect(listed.status).toBe(0);
  const values: unknown = JSON.parse(listed.stdout);
  expect(values).toEqual(
    expect.arrayContaining([
      { selector: ":root", name: "--window-radius", baseline: "12px", saved: "28px" },
      { selector: ':root[data-theme="dark"]', name: "--paper", baseline: "#242223", saved: null },
    ]),
  );
  expect(run("list").stdout).toContain(":root\t--window-radius\t12px\t28px");
  expect(run("check").status).toBe(0);
  expect(run("unset", ":root", "--window-radius").status).toBe(0);
  expect(readFileSync(file, "utf8")).toBe(EMPTY);
  const selector = '[data-wb="ChatPanel"] > p:nth-child(2)';
  expect(run("set", selector, "gap", "18px").status).toBe(0);
  expect(JSON.parse(run("list", "--json").stdout)).toEqual(
    expect.arrayContaining([
      { selector, name: "gap", baseline: null, saved: "18px" },
      { selector, name: "padding-left", baseline: null, saved: null },
    ]),
  );
  expect(run("unset", selector, "gap").status).toBe(0);
  expect(readFileSync(file, "utf8")).toBe(EMPTY);
  expect(readdirSync(catalog).toSorted()).toEqual(["overrides.css", "tokens.css"]);
});

test("refused arguments and values exit nonzero and write nothing", () => {
  const { file, run } = checkout();
  for (const args of [
    ["set", ":root", "--space", "12px"],
    ["set", ":root", "--window-radius", "8em"],
    ["set", "body, p", "gap", "2px"],
    ["unset", ":root", "gap"],
    ["set", ":root", "--window-radius"],
    ["unset", ":root", "--window-radius", "extra"],
    ["list", "--bogus"],
    ["check", "extra"],
    ["commit"],
    [],
  ]) {
    const reply = run(...args);
    expect(reply.status).not.toBe(0);
    expect(reply.stderr).not.toBe("");
    expect(readFileSync(file, "utf8")).toBe(EMPTY);
  }
  expect(run("set", ":root", "--space", "12px").stderr).toContain(
    "not an editable selector and name",
  );
  expect(run("set", ":root", "--window-radius", "8em").stderr).toContain(
    "not a value --window-radius takes",
  );
});

test("check names malformed and unwritable lines without changing the file", () => {
  const { file, run } = checkout();
  for (const [text, line] of [
    [":root {\n --window-radius: 8px;\n}\n", 2],
    [":root {\n  --space: 8px;\n}\n", 2],
    [":root {\n  --window-radius: 8em;\n}\n", 2],
    [":root {\n}\nbody, p {\n  gap: 2px;\n}\n", 3],
    [":root {\n}", 2],
    [":root {\n", 2],
    ["", 1],
  ] as const) {
    writeFileSync(file, text);
    const reply = run("check");
    expect(reply.status).toBe(1);
    expect(reply.stderr).toContain(`line ${line}:`);
    expect(readFileSync(file, "utf8")).toBe(text);
  }
});
