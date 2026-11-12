import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validate } from "./contract.ts";
import { exportProject, readManifest } from "./project.ts";
import { checkValues, listValues, writeValues } from "./plugin.ts";
import { parseOverrides } from "./overrides.ts";

const OVERRIDES = fileURLToPath(new URL("../../catalog/src/overrides.css", import.meta.url));
const TOKENS = fileURLToPath(new URL("../../catalog/src/tokens.css", import.meta.url));
const USAGE = `Usage: pnpm workbench list [--json]
       pnpm workbench manifest
       pnpm workbench export > look.project.json
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
  export: { counts: [0], run: exportFile },
  check: {
    counts: [0],
    run: () => {
      checkValues(readFileSync(OVERRIDES, "utf8"));
      process.stdout.write("Override file is valid.\n");
    },
  },
};

function list(args: string[]): void {
  if (args.length === 1 && args[0] !== "--json") throw new Error(USAGE);
  const text = readFileSync(OVERRIDES, "utf8");
  const rows = listValues(text, readFileSync(TOKENS, "utf8"));
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

function edit(selector: string, name: string, value: string | null): void {
  const was = parseOverrides(readFileSync(OVERRIDES, "utf8")).get(selector)?.get(name) ?? null;
  const reply = writeValues(OVERRIDES, { selector, name, value, was });
  if (reply.status !== 200) throw new Error(JSON.stringify(reply.body));
}

async function run([verb = "", ...args]: string[]): Promise<void> {
  const command = Object.hasOwn(COMMANDS, verb) ? COMMANDS[verb] : undefined;
  if (command === undefined || !command.counts.includes(args.length)) throw new Error(USAGE);
  await command.run(args);
}

run(process.argv.slice(2)).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
