// Install detection (ETH-145, ADR-042): what `init` finds at a host's root, decided by code from
// the host's files alone. Nothing here asks a person or writes a file.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkConfig } from "./config.ts";
import CONTRACT from "./contract.json" with { type: "json" };
import { setOverride } from "./overrides.ts";
import { answerRoles, detectRoles } from "./theme.ts";

const SLOTS = CONTRACT.shells["app-shell"].slots;
const LOCKFILES = [
  ["pnpm-lock.yaml", "pnpm"],
  ["package-lock.json", "npm"],
  ["yarn.lock", "yarn"],
  ["bun.lock", "bun"],
] as const;
const DECLARES = /data-(?:slot|wb)="[A-Za-z][\w-]*"/;
const SLOT = /data-slot="([A-Za-z][\w-]*)"/g;
const READS_SIDE = /--shell-side|data-shell-side/;
const SIDEBAR_RIGHT = /<Sidebar\b[^>]*\bside="right"/;
const STORYBOOK_MAIN = /^((?:.*\/)?\.storybook)\/main\.[cm]?[jt]sx?$/;
const SKIP = new Set(["node_modules", "dist", "build"]);

// The rail and drawer side, the only layout choice Ethan allows (ADR-041).
type Side = "left" | "right";

// Whether `value` is a rail side: left or right, nothing else (ADR-041).
const isSide = (value: unknown): value is Side => value === "left" || value === "right";

// A component source file, as the manifest reads them: `.tsx`, not a story or a test.
const component = (path: string) =>
  path.endsWith(".tsx") && !path.includes(".stories.") && !path.includes(".test.");

// The source folder a declaring file belongs to: its nearest `src` ancestor, else its own folder.
function sourceOf(path: string): string {
  const parts = path.split("/");
  const src = parts.lastIndexOf("src", parts.length - 2);
  return (src === -1 ? parts.slice(0, -1) : parts.slice(0, src + 1)).join("/");
}

// The folders to scan: those holding `data-slot` or `data-wb` declarations, outermost only and
// sorted; with none, `src` when it exists. ponytail: a host declaring only at its root is skipped.
function sourcesOf(declaring: string[], paths: string[]): string[] {
  const found = [...new Set(declaring.map((p) => sourceOf(p)))].filter((s) => s !== "").toSorted();
  const outer = found.filter((s) => !found.some((o) => s.startsWith(`${o}/`)));
  if (outer.length > 0) return outer;
  return paths.some((p) => p.startsWith("src/")) ? ["src"] : [];
}

/**
 * The install answers for a host's `files` (root-relative path → text): the config to write, its
 * failures, the shell kind by the contract's rule, the Storybook it has, whether the rail side is
 * a question and its default, and the package manager. `versionOf` reads the Storybook version
 * installed beside a config folder.
 */
export function detect(
  files: ReadonlyMap<string, string>,
  versionOf: (configDir: string) => string | null,
) {
  const text = (path: string) => files.get(path) ?? "";
  const paths = [...files.keys()].toSorted();
  const sources = sourcesOf(
    paths.filter((p) => component(p) && DECLARES.test(text(p))),
    paths,
  );
  const own = paths.filter((p) => sources.some((s) => p.startsWith(`${s}/`)));
  const slots = new Set(
    own
      .filter((p) => component(p))
      .flatMap((p) => [...text(p).matchAll(SLOT)].map((m) => m[1] ?? "")),
  );
  const missing = SLOTS.filter((s) => !slots.has(s));
  const shell = missing.length === 0 ? "app-shell" : "full-screen";
  const configDir = paths.map((p) => STORYBOOK_MAIN.exec(p)?.[1]).find((d) => d !== undefined);
  const found = detectRoles(paths.filter((p) => p.endsWith(".css")).map((p) => [p, text(p)]));
  const config = {
    format: "design-workshop/config",
    version: 1,
    sources,
    storybook: configDir === undefined ? null : { configDir },
    ...found.fields,
  };
  return {
    config,
    failures: checkConfig(JSON.stringify(config)),
    shell,
    // Only a shell that has some app-shell slots but not all is told which are missing.
    missingSlots: missing.length < SLOTS.length ? missing : [],
    storybook: configDir === undefined ? null : { configDir, version: versionOf(configDir) },
    side: {
      asked: shell === "app-shell" && own.some((p) => READS_SIDE.test(text(p))),
      default: (own.some((p) => SIDEBAR_RIGHT.test(text(p))) ? "right" : "left") satisfies Side,
    },
    packageManager: LOCKFILES.find(([file]) => files.has(file))?.[1] ?? null,
    // Theme roles no stylesheet names, asked only when one names some (PRD section 13).
    unmatched: found.unmatched,
  };
}

// Every source, style and Storybook main file under `dir`, skipping dependencies, build output
// and dot folders other than `.storybook`.
async function walk(root: string, dir = ""): Promise<string[]> {
  const entries = await readdir(join(root, dir), { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = dir === "" ? entry.name : `${dir}/${entry.name}`;
      if (entry.isDirectory())
        return SKIP.has(entry.name) || (entry.name.startsWith(".") && entry.name !== ".storybook")
          ? []
          : walk(root, path);
      return /\.(?:tsx?|css)$/.test(entry.name) || STORYBOOK_MAIN.test(path) ? [path] : [];
    }),
  );
  return nested.flat();
}

// The Storybook version installed in the project that holds `configDir`, or null.
function installedStorybook(root: string, configDir: string): string | null {
  const project = configDir.split("/").slice(0, -1).join("/");
  try {
    const pkg: unknown = JSON.parse(
      readFileSync(join(root, project, "node_modules/storybook/package.json"), "utf8"),
    );
    const version: unknown =
      typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "version") : null;
    return typeof version === "string" ? version : null;
  } catch {
    return null;
  }
}

/**
 * The install answers for the host at `root`, read from its files.
 * @throws When the root cannot be read.
 */
export async function inspect(root: string): Promise<ReturnType<typeof detect>> {
  const paths = await walk(root); // → root-relative paths
  const texts = await Promise.all(paths.map((p) => readFile(join(root, p), "utf8")));
  const files = new Map(paths.map((p, i) => [p, texts[i] ?? ""]));
  for (const [file] of LOCKFILES) if (existsSync(join(root, file))) files.set(file, "");
  return detect(files, (configDir) => installedStorybook(root, configDir));
}

const SCRIPT = "design-workshop";
const EMPTY_OVERRIDES =
  "/* Written by the Workbench. One design value per line. Do not edit by hand. */\n:root {\n}\n";

// The seeded override file: the chosen side only when it is asked and not the host's default.
const overridesFor = (found: ReturnType<typeof detect>, side: Side) =>
  found.side.asked && side !== found.side.default
    ? setOverride(EMPTY_OVERRIDES, ":root", "--shell-side", side)
    : EMPTY_OVERRIDES;

// One file to write, when `when` holds.
const entry = (when: boolean, path: string, text: string): [string, string][] =>
  when ? [[path, text]] : [];

const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// A package.json's fields, its scripts and its `workbench` script; fields are null when the text
// is absent or not a JSON object.
function packageScripts(text: string | null) {
  let pkg: unknown = null;
  try {
    pkg = text === null ? null : JSON.parse(text);
  } catch {
    // Not JSON: refused as no package.json object.
  }
  const fields = object(pkg) ? pkg : null;
  const scripts = object(fields?.scripts) ? fields.scripts : {};
  return { fields, scripts, script: scripts.workbench };
}

// What `init` does at a host given what it `found`, the chosen `side` and the host's current
// `package.json` text (null when absent) and `.workbench/` files: files to write by root-relative
// path, files kept as they are, and refusals, any of which means nothing is written. Files that
// already exist are kept, so a second run writes nothing.
function installFiles(
  found: ReturnType<typeof detect>,
  side: Side,
  host: { packageJson: string | null; config: boolean; overrides: boolean },
): { writes: Map<string, string>; kept: string[]; refusals: string[] } {
  const { fields, scripts, script } = packageScripts(host.packageJson);
  const refusals = [
    ...(fields === null ? ["No package.json object at the root."] : []),
    ...(script === undefined || script === SCRIPT
      ? []
      : [`package.json already has a different workbench script: ${JSON.stringify(script)}.`]),
    ...found.failures.map((f) => `config ${f.path}: ${f.message}`),
  ];
  const writes = new Map<string, string>([
    ...entry(!host.config, ".workbench/config.json", `${JSON.stringify(found.config, null, 2)}\n`),
    ...entry(!host.overrides, ".workbench/overrides.css", overridesFor(found, side)),
    ...entry(
      fields !== null && script === undefined,
      "package.json",
      `${JSON.stringify({ ...fields, scripts: { ...scripts, workbench: SCRIPT } }, null, 2)}\n`,
    ),
  ]);
  const kept = [".workbench/config.json", ".workbench/overrides.css", "package.json"].filter(
    (path) => !writes.has(path),
  );
  return { writes: refusals.length > 0 ? new Map<string, string>() : writes, kept, refusals };
}

// The rail side `init` writes: `flag` when given, else `answer` (a person's reply, null when not
// asked, empty for the default), else the detected default. Throws on any other answer.
function pickSide(
  found: ReturnType<typeof detect>,
  flag: string | undefined,
  answer: string | null,
): Side {
  const side = flag ?? (answer === null || answer === "" ? found.side.default : answer);
  if (!isSide(side)) throw new Error(`No side ${side}.`);
  return side;
}

const WORKBENCH = fileURLToPath(new URL("../", import.meta.url));
const LINK: Record<string, string> = {
  pnpm: "pnpm add -D link:",
  npm: "npm install -D ",
  yarn: "yarn add -D link:",
  bun: "bun add -D ",
};

// The command that links the unpublished package into the host (PRD section 16).
const nextStep = (manager: string | null) =>
  `Done. Next: ${(manager === null ? undefined : LINK[manager]) ?? LINK.npm}${WORKBENCH}`;

// What the host at `root` already has of the files `init` writes.
function hostFiles(root: string) {
  const pkg = join(root, "package.json");
  return {
    packageJson: existsSync(pkg) ? readFileSync(pkg, "utf8") : null,
    config: existsSync(join(root, ".workbench/config.json")),
    overrides: existsSync(join(root, ".workbench/overrides.css")),
  };
}

// The plan as lines: a notice when --side was skipped, each file written or kept, then the theme
// roles a written config leaves without a variable.
const planLines = (
  plan: ReturnType<typeof installFiles>,
  skipped: boolean,
  unmatched: string[],
) => [
  ...(skipped ? ["The shell's side is fixed by this app's own code; --side skipped."] : []),
  ...[...plan.writes.keys()].map((path) => `  write ${path}`),
  ...plan.kept.map((path) => `  keep  ${path}`),
  ...(plan.writes.has(".workbench/config.json") && unmatched.length > 0
    ? [`Themes skip roles with no variable; adapt the app or add roles: ${unmatched.join(", ")}`]
    : []),
];

// The side, asking a person only when no flag answers it and the host reads it.
async function sideFor(
  found: ReturnType<typeof detect>,
  options: { side?: string; yes: boolean },
  ask: (question: string) => Promise<string>,
): Promise<Side> {
  const asked = options.side === undefined && found.side.asked && !options.yes;
  const question = `Rail and drawer side, left or right? [${found.side.default}] `;
  return pickSide(found, options.side, asked ? await ask(question) : null);
}

/**
 * Sets the Workbench up at the host `root` (ADR-042): asks `ask` only the rail side, when the
 * host reads it, and to confirm, unless `options` answer them; writes what `installFiles` plans
 * and returns the lines to print. Never touches the host's source.
 * @throws With every refusal, before anything is written.
 */
export async function install(
  root: string,
  options: { side?: string; yes: boolean },
  ask: (question: string) => Promise<string>,
): Promise<string[]> {
  const detected = await inspect(root);
  const host = hostFiles(root);
  const side = await sideFor(detected, options, ask);
  const asking = !options.yes && !host.config && detected.unmatched.asked;
  const { config, unmatched } = await answerRoles(
    detected.config,
    detected.unmatched.roles,
    asking ? ask : null,
  );
  const found = { ...detected, config };
  const plan = installFiles(found, side, host);
  if (plan.refusals.length > 0) throw new Error(plan.refusals.join("\n"));
  const lines = planLines(plan, options.side !== undefined && !found.side.asked, unmatched);
  if (plan.writes.size === 0) return lines;
  const confirmed =
    options.yes || (await ask(`${lines.join("\n")}\nWrite these files? (y/N) `)) === "y";
  if (!confirmed) return ["Nothing written."];
  mkdirSync(join(root, ".workbench"), { recursive: true });
  for (const [path, text] of plan.writes) writeFileSync(join(root, path), text);
  return [...(options.yes ? lines : []), nextStep(found.packageManager)];
}
