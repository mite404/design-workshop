// Install (ETH-146, ADR-042): what `init` writes at a host's root from what detection found,
// asking a person only what code cannot know.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { inspect, isSide, type detect, type Side } from "./init.ts";
import { setOverride } from "./overrides.ts";
import { answerRoles } from "./theme.ts";

const SCRIPT = "design-workshop";
const PACKAGE = "design-workshop";
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

// A package.json's fields, its scripts and devDependencies, its `workbench` script and whether it
// already depends on the Workbench; fields are null when the text is absent or not a JSON object.
function packageScripts(text: string | null) {
  let pkg: unknown = null;
  try {
    pkg = text === null ? null : JSON.parse(text);
  } catch {
    // Not JSON: refused as no package.json object.
  }
  const fields = object(pkg) ? pkg : null;
  const scripts = object(fields?.scripts) ? fields.scripts : {};
  const devDependencies = object(fields?.devDependencies) ? fields.devDependencies : {};
  const depends = [devDependencies, fields?.dependencies].some(
    (deps) => object(deps) && Object.hasOwn(deps, PACKAGE),
  );
  return { fields, scripts, devDependencies, depends, script: scripts.workbench };
}

// What `init` does at a host given what it `found`, the chosen `side` and the host's current
// `package.json` text (null when absent) and `.workbench/` files: files to write by root-relative
// path, files kept as they are, and refusals, any of which means nothing is written. Files that
// already exist are kept, so a second run writes nothing.
function installFiles(
  found: ReturnType<typeof detect>,
  side: Side,
  host: { packageJson: string | null; config: boolean; overrides: boolean; spec: string },
): { writes: Map<string, string>; kept: string[]; refusals: string[] } {
  const { fields, scripts, devDependencies, depends, script } = packageScripts(host.packageJson);
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
      fields !== null && (script === undefined || !depends),
      "package.json",
      `${JSON.stringify(
        {
          ...fields,
          scripts: { ...scripts, workbench: SCRIPT },
          ...(depends ? {} : { devDependencies: { ...devDependencies, [PACKAGE]: host.spec } }),
        },
        null,
        2,
      )}\n`,
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

// The workspace root holding `dir`: its nearest folder with a pnpm-workspace.yaml, else null.
function workspaceOf(dir: string): string | null {
  if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
  return dirname(dir) === dir ? null : workspaceOf(dirname(dir));
}

/**
 * How the host at `root` depends on the unpublished package (PRD section 16): `workspace:*` when
 * the package is in the host's own workspace, else a path to it, `file:` for npm, which has no
 * `link:`. ponytail: assumes the workspace's globs include the package; `pnpm install` names it
 * when they do not.
 */
export function specFor(root: string, workbench: string, manager: string | null): string {
  const workspace = workspaceOf(root);
  if (workspace !== null && !relative(workspace, workbench).startsWith("..")) return "workspace:*";
  return `${manager === "npm" ? "file:" : "link:"}${relative(root, workbench)}`;
}

// What the host at `root` already has of the files `init` writes, and the dependency it would add.
function hostFiles(root: string, manager: string | null) {
  const pkg = join(root, "package.json");
  return {
    packageJson: existsSync(pkg) ? readFileSync(pkg, "utf8") : null,
    config: existsSync(join(root, ".workbench/config.json")),
    overrides: existsSync(join(root, ".workbench/overrides.css")),
    spec: specFor(root, WORKBENCH, manager),
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
  // An app in a pnpm workspace has its lockfile at the workspace root, or none yet.
  const manager = detected.packageManager ?? (workspaceOf(root) === null ? null : "pnpm");
  const host = hostFiles(root, manager);
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
  return [...(options.yes ? lines : []), `Done. Next: ${manager ?? "npm"} install`];
}
