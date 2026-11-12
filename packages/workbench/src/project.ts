// Project files (ETH-125): this repo's manifest and override values in one JSON file, built
// on the Node side for the command line and the Workbench alike. Exporting writes nothing in
// the repo; acceptance is the contract's validator alone (ADR-029).
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { parseConfig } from "./config.ts";
import { manifestOf, validate, type Failure } from "./contract.ts";
import { parseOverrides } from "./overrides.ts";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const OVERRIDES = join(REPO, "packages/catalog/src/overrides.css");

// Each `data-<attribute>` value the source folders declare: [value, root-relative path, line].
async function declared(
  attribute: string,
  root: string,
  sources: string[],
): Promise<[string, string, number][]> {
  const pattern = new RegExp(`data-${attribute}="([A-Za-z][\\w-]*)"`, "g");
  const found = await Promise.all(
    sources.map(async (dir) => {
      const files = (await readdir(join(root, dir), { recursive: true, encoding: "utf8" })).filter(
        (file) => file.endsWith(".tsx") && !file.includes(".stories.") && !file.includes(".test."),
      );
      const texts = await Promise.all(files.map((file) => readFile(join(root, dir, file), "utf8")));
      return texts.flatMap((text, i) =>
        [...text.matchAll(pattern)].map((m): [string, string, number] => [
          m[1] ?? "",
          `${dir}/${files[i] ?? ""}`,
          text.slice(0, m.index).split("\n").length, // offset → 1-based line
        ]),
      );
    }),
  );
  return found.flat();
}

/**
 * Where each `data-wb` name is declared, as `path:line` from the repo root (R12): what a chat
 * reference tells an agent about the component it points into.
 */
export async function readSources(root = REPO): Promise<Record<string, string>> {
  const { sources } = parseConfig(await readFile(join(root, ".workbench/config.json"), "utf8"));
  const names = await declared("wb", root, sources); // → [name, path, line][]
  return Object.fromEntries(names.map(([name, file, line]) => [name, `${file}:${line}`]));
}

// The installed Storybook's version and its index, from the project beside its config folder.
// With no Storybook both are empty, which the contract refuses as a version failure.
async function readStorybook(root: string, configDir: string | null) {
  if (configDir === null) return { version: "", index: {} };
  const project = join(root, dirname(configDir)); // the folder whose node_modules hold Storybook
  const out = await mkdtemp(join(tmpdir(), "manifest-"));
  try {
    const indexFile = join(out, "index.json");
    await promisify(execFile)(
      join(project, "node_modules/.bin/storybook"),
      ["index", "-o", indexFile, "-c", join(root, configDir)],
      { cwd: project },
    );
    const pkg: unknown = JSON.parse(
      await readFile(join(project, "node_modules/storybook/package.json"), "utf8"),
    );
    return {
      version: String(typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "version") : ""),
      index: JSON.parse(await readFile(indexFile, "utf8")) as unknown,
    };
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}

/**
 * A root's manifest, from its config's folders: the installed Storybook, its index and the
 * source's declarations. The root defaults to this repo.
 * @throws When the config is missing or refused, or `storybook index` fails.
 */
export async function readManifest(root = REPO): Promise<ReturnType<typeof manifestOf>> {
  const { sources, storybook } = parseConfig(
    await readFile(join(root, ".workbench/config.json"), "utf8"),
  );
  const [{ version, index }, slots, names] = await Promise.all([
    readStorybook(root, storybook?.configDir ?? null),
    declared("slot", root, sources),
    declared("wb", root, sources),
  ]);
  return manifestOf({
    version,
    index,
    slots: slots.map(([slot]) => slot),
    names: new Map(names.map(([name, file]) => [name, basename(file)])),
  });
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
