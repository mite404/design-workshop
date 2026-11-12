import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";
import { checkProject } from "./contract";
import { detect, inspect } from "./init";
import { parseOverrides } from "./overrides";
import { readManifest } from "./project";
import { COLOUR_ROLES, TYPE_ROLES } from "./theme";

const SHELL =
  '<div data-slot="window"><b data-slot="title-bar" /><nav data-slot="sidebar" /></div>';
const noStorybook = () => null;

test("an app-shell host that reads the side is asked it, defaulting to its Sidebar's side", () => {
  const found = detect(
    new Map([
      ["apps/web/src/shell/Shell.tsx", `${SHELL}<Sidebar collapsible side="right" />`],
      ["apps/web/src/shell/Shell.stories.tsx", '<i data-slot="ignored" />'],
      ["packages/ui/src/button.tsx", '<button data-slot="button" />'],
      ["apps/web/src/index.css", ':root[data-shell-side="right"] {}'],
      ["apps/storybook/.storybook/main.ts", ""],
      ["pnpm-lock.yaml", ""],
    ]),
    (dir) => (dir === "apps/storybook/.storybook" ? "10.6.0" : null),
  );
  expect(found).toEqual({
    config: {
      format: "design-workshop/config",
      version: 1,
      sources: ["apps/web/src", "packages/ui/src"],
      storybook: { configDir: "apps/storybook/.storybook" },
      roles: {},
    },
    failures: [],
    shell: "app-shell",
    missingSlots: [],
    storybook: { configDir: "apps/storybook/.storybook", version: "10.6.0" },
    side: { asked: true, default: "right" },
    packageManager: "pnpm",
    // No stylesheet names a role, so none is asked; all 22 are listed.
    unmatched: { asked: false, roles: Object.keys({ ...COLOUR_ROLES, ...TYPE_ROLES }) },
  });
});

test("some app-shell slots make a full-screen host, told what is missing, and not asked", () => {
  const found = detect(
    new Map([
      ["src/App.tsx", '<main data-slot="window" />'],
      ["src/app.css", "html { --shell-side: left; }"],
    ]),
    noStorybook,
  );
  expect(found.shell).toBe("full-screen");
  expect(found.missingSlots).toEqual(["title-bar", "sidebar"]);
  expect(found.side).toEqual({ asked: false, default: "left" });
});

test("a host with no declarations scans src and has no Storybook", () => {
  const found = detect(new Map([["src/main.tsx", "<App />"]]), noStorybook);
  expect(found.config.sources).toEqual(["src"]);
  expect(found.config.storybook).toBeNull();
  expect(found.missingSlots).toEqual([]);
  expect(found.packageManager).toBeNull();
});

test("a host with no source folder at all gives a config the check refuses", () => {
  const found = detect(new Map([["lib/x.ts", ""]]), noStorybook);
  expect(found.failures.map((f) => f.code)).toEqual(["bad-sources"]);
});

test("this repo's detected config is the one it commits", async () => {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const found = await inspect(root);
  // The tokens file is the stylesheet naming the most theme roles; every role has its Template name.
  const committed: unknown = JSON.parse(readFileSync(`${root}.workbench/config.json`, "utf8"));
  expect(found.config).toEqual(committed);
  expect(found.unmatched.roles).toEqual([]);
  expect(found.shell).toBe("app-shell");
  expect(found.storybook?.version).toBe("10.6.0");
  expect(found.side).toEqual({ asked: true, default: "left" });
});

// Scratch apps: a minimal Vite app's files, written to a temporary root, and `init` run on it as a
// person would, through the command line (INIT CLI story, completion checklist).
const CLI = fileURLToPath(new URL("./cli.ts", import.meta.url));
const EMPTY =
  "/* Written by the Workbench. One design value per line. Do not edit by hand. */\n:root {\n}\n";
const PACKAGE = { name: "scratch", private: true, type: "module", scripts: { dev: "vite" } };
const VITE_APP = {
  "package.json": `${JSON.stringify(PACKAGE, null, 2)}\n`,
  "index.html": '<div id="root"></div><script type="module" src="/src/main.tsx"></script>\n',
  "src/main.tsx": 'import { App } from "./App";\n',
  "src/App.tsx": `export const App = () => ${SHELL};\n`,
  "src/app.css": ':root[data-shell-side="right"] nav { order: 2; }\n',
  "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
};
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function scratch(files: Record<string, string> = VITE_APP): string {
  const root = mkdtempSync(join(tmpdir(), "workbench-scratch-"));
  roots.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const init = (root: string, input: string, ...flags: string[]) =>
  spawnSync(process.execPath, [CLI, "init", root, ...flags], { encoding: "utf8", input });

// Every file under a root and its text, by root-relative path.
const snapshot = (root: string) =>
  Object.fromEntries(
    readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((path) => statSync(join(root, path)).isFile())
      .toSorted()
      .map((path) => [path, readFileSync(join(root, path), "utf8")]),
  );

test("init --yes in a scratch Vite app writes exactly its files, and a rerun writes nothing", async () => {
  const root = scratch();
  const before = snapshot(root);
  const first = init(root, "", "--yes", "--side", "right");
  expect(first.stderr).toBe("");
  expect(first.status).toBe(0);
  expect(first.stdout).toContain("Done. Next: pnpm add -D link:");
  const after = snapshot(root);
  expect(Object.keys(after).filter((path) => !(path in before))).toEqual([
    ".workbench/config.json",
    ".workbench/overrides.css",
  ]);
  for (const path of Object.keys(before).filter((p) => p !== "package.json"))
    expect(after[path]).toBe(before[path]);
  expect(JSON.parse(after["package.json"] ?? "")).toEqual({
    ...PACKAGE,
    scripts: { dev: "vite", workbench: "design-workshop" },
  });
  expect(JSON.parse(after[".workbench/config.json"] ?? "")).toEqual({
    format: "design-workshop/config",
    version: 1,
    sources: ["src"],
    storybook: null,
    roles: {},
  });
  expect(first.stdout).toContain("Themes skip roles with no variable");
  expect(after[".workbench/overrides.css"]).toBe(
    EMPTY.replace("{\n", "{\n  --shell-side: right;\n"),
  );

  const second = init(root, "", "--yes", "--side", "right");
  expect(second.status).toBe(0);
  expect(second.stdout.trimEnd().split("\n")).toEqual([
    "  keep  .workbench/config.json",
    "  keep  .workbench/overrides.css",
    "  keep  package.json",
  ]);
  expect(snapshot(root)).toEqual(after);

  const project = JSON.stringify({
    format: "design-workshop/project",
    version: 1,
    manifest: await readManifest(root),
    overrides: Object.fromEntries(
      [...parseOverrides(after[".workbench/overrides.css"] ?? "")].map(([s, v]) => [
        s,
        Object.fromEntries(v),
      ]),
    ),
  });
  const list = checkProject(project);
  expect(list.find((item) => item.path === "storybook/version")?.failure?.code).toBe(
    "storybook-version",
  );
  expect(checkProject(project)).toEqual(list);
});

test("a different workbench script is refused and nothing is written", () => {
  const pkg = `${JSON.stringify({ ...PACKAGE, scripts: { workbench: "storybook dev" } })}\n`;
  const root = scratch({ ...VITE_APP, "package.json": pkg });
  const result = init(root, "", "--yes");
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("different workbench script");
  expect(existsSync(join(root, ".workbench"))).toBe(false);
  expect(readFileSync(join(root, "package.json"), "utf8")).toBe(pkg);
});

test("a full-screen host skips the side and seeds no value", () => {
  const root = scratch({ ...VITE_APP, "src/App.tsx": '<main data-slot="window" />\n' });
  const result = init(root, "", "--yes", "--side", "right");
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("--side skipped");
  expect(readFileSync(join(root, ".workbench/overrides.css"), "utf8")).toBe(EMPTY);
});

test("a person answers the side and confirms, or declines and nothing is written", () => {
  const yes = scratch();
  const answered = init(yes, "right\ny\n");
  expect(answered.status).toBe(0);
  expect(answered.stdout).toContain("Rail and drawer side, left or right? [left]");
  expect(readFileSync(join(yes, ".workbench/overrides.css"), "utf8")).toContain(
    "--shell-side: right;",
  );

  const no = scratch();
  const declined = init(no, "\nn\n");
  expect(declined.status).toBe(0);
  expect(declined.stdout).toContain("Nothing written.");
  expect(existsSync(join(no, ".workbench"))).toBe(false);

  const bad = init(scratch(), "up\n");
  expect(bad.status).toBe(1);
  expect(bad.stderr).toContain("No side up.");
});

const SHADCN = {
  ...VITE_APP,
  "src/globals.css":
    ":root {\n  --background: #fff;\n  --foreground: #111;\n  --card: #fff;\n}\n.dark {\n  --background: #000;\n}\n",
};

test("a shadcn app's roles are detected, the rest asked one by one or listed with --yes", () => {
  const listed = scratch(SHADCN);
  const quiet = init(listed, "", "--yes");
  expect(quiet.status).toBe(0);
  expect(quiet.stdout).not.toContain("Variable for theme role");
  expect(quiet.stdout).toContain("adapt the app or add roles: hover, compose, control");
  expect(JSON.parse(readFileSync(join(listed, ".workbench/config.json"), "utf8"))).toMatchObject({
    tokens: "src/globals.css",
    roles: { page: "--background", surface: "--card", ink: "--foreground" },
    colourSelectors: { light: ":root", dark: ".dark" },
  });

  // The side, then each unmatched role in table order (hover first), then the confirmation.
  const asked = scratch(SHADCN);
  const answers = ["", "--paper-hover", ...Array.from({ length: 18 }, () => ""), "y"];
  const result = init(asked, `${answers.join("\n")}\n`);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("Variable for theme role hover? (Enter to skip)");
  const config: unknown = JSON.parse(readFileSync(join(asked, ".workbench/config.json"), "utf8"));
  expect(config).toHaveProperty("roles", {
    page: "--background",
    surface: "--card",
    ink: "--foreground",
    hover: "--paper-hover",
  });

  const bad = init(scratch(SHADCN), "\npaper\n");
  expect(bad.status).toBe(1);
  expect(bad.stderr).toContain("No variable paper.");
});
