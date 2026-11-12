import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { manifestOf, validate } from "./contract.ts";
import { checkValues, listValues, writeValues } from "./plugin.ts";
import { parseOverrides } from "./overrides.ts";

const OVERRIDES = fileURLToPath(new URL("../../catalog/src/overrides.css", import.meta.url));
const TOKENS = fileURLToPath(new URL("../../catalog/src/tokens.css", import.meta.url));
const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const SOURCE_DIRS = ["packages/catalog/src", "packages/ui/src", "apps/web/src"];
const USAGE = `Usage: pnpm workbench list [--json]
       pnpm workbench manifest
       pnpm workbench set <selector> <name> <value>
       pnpm workbench unset <selector> <name>
       pnpm workbench check
Element baselines are null without a browser. Quote selectors and values containing spaces.`;

const COMMANDS: Record<string, { counts: number[]; run: (args: string[]) => void }> = {
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

// Each `data-<attribute>` value the Template's source declares, with the file declaring it.
function declared(attribute: string): [string, string][] {
  const pattern = new RegExp(`data-${attribute}="([A-Za-z][\\w-]*)"`, "g");
  return SOURCE_DIRS.flatMap((dir) =>
    readdirSync(join(REPO, dir), { recursive: true, encoding: "utf8" })
      .filter(
        (file) => file.endsWith(".tsx") && !file.includes(".stories.") && !file.includes(".test."),
      )
      .flatMap((file) =>
        [...readFileSync(join(REPO, dir, file), "utf8").matchAll(pattern)].map(
          (m): [string, string] => [m[1] ?? "", basename(file)],
        ),
      ),
  );
}

// Prints this repo's manifest and every contract failure; exits 1 when there is any (ADR-029).
function manifest(): void {
  const out = mkdtempSync(join(tmpdir(), "manifest-"));
  try {
    const indexFile = join(out, "index.json");
    execFileSync("pnpm", ["--filter", "storybook", "exec", "storybook", "index", "-o", indexFile], {
      cwd: REPO,
      stdio: "ignore",
    });
    const storybook = join(REPO, "apps/storybook/node_modules/storybook/package.json");
    const pkg: unknown = JSON.parse(readFileSync(storybook, "utf8"));
    const result = manifestOf({
      version: String(typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "version") : ""),
      index: JSON.parse(readFileSync(indexFile, "utf8")),
      slots: declared("slot").map(([slot]) => slot),
      names: new Map(declared("wb")),
    });
    const failures = validate(JSON.stringify(result));
    process.stdout.write(`${JSON.stringify({ manifest: result, failures }, null, 2)}\n`);
    if (failures.length > 0) process.exitCode = 1;
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

function edit(selector: string, name: string, value: string | null): void {
  const was = parseOverrides(readFileSync(OVERRIDES, "utf8")).get(selector)?.get(name) ?? null;
  const reply = writeValues(OVERRIDES, { selector, name, value, was });
  if (reply.status !== 200) throw new Error(JSON.stringify(reply.body));
}

function run([verb = "", ...args]: string[]): void {
  const command = Object.hasOwn(COMMANDS, verb) ? COMMANDS[verb] : undefined;
  if (command === undefined || !command.counts.includes(args.length)) throw new Error(USAGE);
  command.run(args);
}

try {
  run(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
