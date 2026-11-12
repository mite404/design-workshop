// Project files (ETH-125): this repo's manifest and override values in one JSON file, built
// on the Node side for the command line and the Workbench alike. Exporting writes nothing in
// the repo; acceptance is the contract's validator alone (ADR-029).
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { manifestOf, validate, type Failure } from "./contract.ts";
import { parseOverrides } from "./overrides.ts";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const OVERRIDES = join(REPO, "packages/catalog/src/overrides.css");
const SOURCE_DIRS = ["packages/catalog/src", "packages/ui/src", "apps/web/src"];

// Each `data-<attribute>` value the Template's source declares, with the file declaring it.
async function declared(attribute: string): Promise<[string, string][]> {
  const pattern = new RegExp(`data-${attribute}="([A-Za-z][\\w-]*)"`, "g");
  const found = await Promise.all(
    SOURCE_DIRS.map(async (dir) => {
      const files = (await readdir(join(REPO, dir), { recursive: true, encoding: "utf8" })).filter(
        (file) => file.endsWith(".tsx") && !file.includes(".stories.") && !file.includes(".test."),
      );
      const texts = await Promise.all(files.map((file) => readFile(join(REPO, dir, file), "utf8")));
      return texts.flatMap((text, i) =>
        [...text.matchAll(pattern)].map((m): [string, string] => [
          m[1] ?? "",
          basename(files[i] ?? ""),
        ]),
      );
    }),
  );
  return found.flat();
}

/**
 * This repo's manifest, from the installed Storybook, its index and the source's declarations.
 * @throws When `storybook index` fails or Storybook is not installed.
 */
export async function readManifest(): Promise<ReturnType<typeof manifestOf>> {
  const out = await mkdtemp(join(tmpdir(), "manifest-"));
  try {
    const indexFile = join(out, "index.json");
    await promisify(execFile)(
      "pnpm",
      ["--filter", "storybook", "exec", "storybook", "index", "-o", indexFile],
      { cwd: REPO },
    );
    const pkg: unknown = JSON.parse(
      await readFile(join(REPO, "apps/storybook/node_modules/storybook/package.json"), "utf8"),
    );
    const index: unknown = JSON.parse(await readFile(indexFile, "utf8"));
    const [slots, names] = await Promise.all([declared("slot"), declared("wb")]);
    return manifestOf({
      version: String(typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "version") : ""),
      index,
      slots: slots.map(([slot]) => slot),
      names: new Map(names),
    });
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}

/**
 * This repo as a project file, and the contract failures of its manifest; an export with
 * failures is not offered.
 * @throws As readManifest does, or when the override file cannot be read.
 */
export async function exportProject(): Promise<{ project: unknown; failures: Failure[] }> {
  const [manifest, overrides] = await Promise.all([readManifest(), readFile(OVERRIDES, "utf8")]);
  const project = {
    format: "design-workshop/project",
    version: 1,
    manifest,
    overrides: Object.fromEntries(
      [...parseOverrides(overrides)].map(([selector, values]) => [
        selector,
        Object.fromEntries(values),
      ]),
    ),
  };
  return { project, failures: validate(JSON.stringify(manifest)) };
}
