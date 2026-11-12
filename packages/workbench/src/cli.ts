#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "node:fs";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { dirname, join, resolve } from "node:path";
import { checkConfig } from "./config.ts";
import { checkProject, validate } from "./contract.ts";
import { inspect, install } from "./init.ts";
import { exportProject, readManifest } from "./project.ts";
import { checkValues, hostFiles, listValues, writeValues } from "./plugin.ts";
import { parseOverrides } from "./overrides.ts";
// oxlint-disable-next-line import/max-dependencies -- the command line dispatches one command per module
import { matchRoles } from "./theme.ts";

// The files of the host the command runs in (ADR-045), read once a command needs them.
const files = () => hostFiles(process.cwd());
const USAGE = `Usage: pnpm workbench list [--json]
       pnpm workbench manifest
       pnpm workbench export > look.project.json
       pnpm workbench check-project <file>
       pnpm workbench check-config [.workbench/config.json]
       pnpm workbench roles
       pnpm workbench dev --target http://localhost:5173 [--port 5180]
       pnpm workbench init <root> [--dry-run | --yes] [--side left|right]
       pnpm workbench set <selector> <name> <value>
       pnpm workbench unset <selector> <name>
       pnpm workbench check
Element baselines are null without a browser. Quote selectors and values containing spaces.`;

const COMMANDS: Record<
  string,
  { counts: number[]; run: (args: string[]) => void | Promise<void> }
> = {
  list: { counts: [0, 1], run: list },
  set: {
    counts: [3],
    run: ([selector = "", name = "", value = ""]) => {
      edit(selector, name, value);
    },
  },
  unset: {
    counts: [2],
    run: ([selector = "", name = ""]) => {
      edit(selector, name, null);
    },
  },
  manifest: { counts: [0], run: manifest },
  dev: { counts: [2, 4], run: dev },
  init: { counts: [1, 2, 3, 4], run: init },
  export: { counts: [0], run: exportFile },
  "check-project": {
    counts: [1],
    run: ([file = ""]) => {
      checkProjectFile(file);
    },
  },
  roles: { counts: [0], run: roles },
  "check-config": {
    counts: [0, 1],
    run: ([file = ".workbench/config.json"]) => {
      checkConfigFile(file);
    },
  },
  check: {
    counts: [0],
    run: () => {
      checkValues(readFileSync(files().overrides, "utf8"), files().map);
      process.stdout.write("Override file is valid.\n");
    },
  },
};

function list(args: string[]): void {
  if (args.length === 1 && args[0] !== "--json") throw new Error(USAGE);
  const { overrides, tokens } = files();
  const text = readFileSync(overrides, "utf8");
  const rows = listValues(text, tokens === null ? "" : readFileSync(tokens, "utf8"));
  process.stdout.write(
    args[0] === "--json"
      ? `${JSON.stringify(rows, null, 2)}\n`
      : `selector\tname\tbaseline\tsaved\n${rows.map((row) => [row.selector, row.name, row.baseline ?? "null", row.saved ?? "null"].join("\t")).join("\n")}\n`,
  );
}

// Prints this repo's manifest and every contract failure; exits 1 when there is any (ADR-029).
async function manifest(): Promise<void> {
  const result = await readManifest();
  const failures = validate(JSON.stringify(result));
  process.stdout.write(`${JSON.stringify({ manifest: result, failures }, null, 2)}\n`);
  if (failures.length > 0) process.exitCode = 1;
}

// Prints this repo as a project file; refuses, exiting 1, when its manifest breaks the contract.
async function exportFile(): Promise<void> {
  const { project, failures } = await exportProject();
  if (failures.length > 0) {
    process.stderr.write(`${JSON.stringify(failures, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${JSON.stringify(project, null, 2)}\n`);
}

// Prints a project file's checklist, the same list the Workbench shows; exits 1 on any failure.
function checkProjectFile(file: string): void {
  const items = checkProject(readFileSync(file, "utf8")); // → CheckItem[]
  const lines = items.map(({ path, failure }) =>
    failure ? `FAIL ${path}  ${failure.code}: ${failure.message}` : `ok   ${path}`,
  ); // → string[]
  process.stdout.write(`${lines.join("\n")}\n`);
  if (items.some((i) => i.failure)) process.exitCode = 1;
}

// Prints which variable in the app's tokens file plays each theme role, by the name table that
// found it; exits 1 when any role is unmatched, the list an agent adapts the app from.
function roles(): void {
  const { tokens } = files();
  if (tokens === null) throw new Error("Name the app's tokens file in .workbench/config.json.");
  const matches = matchRoles(readFileSync(tokens, "utf8")); // → RoleMatch[]
  const lines = matches.map(({ role, name, table }) =>
    name === null ? `MISSING ${role}` : `ok      ${role.padEnd(15)} ${name} (${table})`,
  ); // → string[]
  process.stdout.write(`${lines.join("\n")}\n`);
  if (matches.some((m) => m.name === null)) process.exitCode = 1;
}

// Serves the Workbench in front of the app's own dev server until stopped (ADR-043).
async function dev(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: { target: { type: "string" }, port: { type: "string", default: "5180" } },
  });
  if (values.target === undefined || !/^\d{2,5}$/.test(values.port)) throw new Error(USAGE);
  const { startDev } = await import("./dev.ts"); // only `dev` needs Vite
  const url = await startDev(values.target, Number(values.port), process.cwd());
  process.stdout.write(`Workbench at ${url}, in front of ${values.target}\n`);
}

// `init`'s flags: a root, then --dry-run (which writes nothing, whatever else is given), --yes
// and --side, which `install` checks.
function initFlags(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { "dry-run": { type: "boolean" }, yes: { type: "boolean" }, side: { type: "string" } },
  });
  const [root] = positionals;
  if (root === undefined || positionals.length > 1) throw new Error(USAGE);
  return { root, side: values.side, preview: values["dry-run"] === true, yes: values.yes === true };
}

// A prompt that asks on stdout and reads each answer as a line of stdin, opening stdin only on
// the first question, so `--yes` never waits on it; close ends it.
function prompter() {
  let lines: AsyncIterator<string> | undefined;
  let rl: ReturnType<typeof createInterface> | undefined;
  return {
    ask: async (question: string) => {
      process.stdout.write(question);
      rl ??= createInterface({ input: process.stdin });
      lines ??= rl[Symbol.asyncIterator]();
      const line = await lines.next();
      return line.done === true ? "" : line.value.trim();
    },
    close: () => rl?.close(),
  };
}

// Prints what `init` detects at a root and whether it matches the config there; writes nothing.
async function dryRun(root: string): Promise<void> {
  const found = await inspect(root);
  const file = join(root, ".workbench/config.json");
  const current: unknown = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  const matches = JSON.stringify(current) === JSON.stringify(found.config);
  process.stdout.write(`${JSON.stringify({ ...found, configMatches: matches }, null, 2)}\n`);
  if (found.failures.length > 0) process.exitCode = 1;
}

// Sets the Workbench up at a host's root, or with --dry-run only prints what it detects.
async function init(args: string[]): Promise<void> {
  const flags = initFlags(args);
  if (flags.preview) return dryRun(flags.root);
  const prompt = prompter();
  try {
    const lines = await install(flags.root, flags, prompt.ask);
    process.stdout.write(`${lines.join("\n")}\n`);
  } finally {
    prompt.close();
  }
}

// Prints each config failure, paths checked under the root that holds `.workbench/`; exits 1 on
// any (ADR-042).
function checkConfigFile(file: string): void {
  const root = dirname(dirname(resolve(file))); // .workbench/config.json → the host root
  const exists = (path: string, kind: "folder" | "file") =>
    existsSync(join(root, path)) &&
    (kind === "folder"
      ? statSync(join(root, path)).isDirectory()
      : statSync(join(root, path)).isFile());
  const failures = checkConfig(readFileSync(file, "utf8"), exists); // → Failure[]
  process.stdout.write(
    failures.length === 0
      ? "Config is valid.\n"
      : `${failures.map((f) => `FAIL ${f.path}  ${f.code}: ${f.message}`).join("\n")}\n`,
  );
  if (failures.length > 0) process.exitCode = 1;
}

function edit(selector: string, name: string, value: string | null): void {
  const { overrides, map } = files();
  const was = parseOverrides(readFileSync(overrides, "utf8")).get(selector)?.get(name) ?? null;
  const reply = writeValues(overrides, { selector, name, value, was }, map);
  if (reply.status !== 200) throw new Error(JSON.stringify(reply.body));
}

async function run([verb = "", ...args]: string[]): Promise<void> {
  const command = Object.hasOwn(COMMANDS, verb) ? COMMANDS[verb] : undefined;
  if (command === undefined || !command.counts.includes(args.length)) throw new Error(USAGE);
  await command.run(args);
}

try {
  await run(process.argv.slice(2));
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
