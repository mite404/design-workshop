// Install detection (ETH-145, ADR-042): what `init` finds at a host's root, decided by code from
// the host's files alone. Nothing here asks a person or writes a file.
import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { checkConfig } from "./config.ts";
import CONTRACT from "./contract.json" with { type: "json" };
import { fontsField } from "./fonts.ts";
import { detectRoles } from "./theme.ts";

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

// The rail and drawer side, the only layout choice Ethan allows (ADR-041), and its check.
export type Side = "left" | "right";
export const isSide = (value: unknown): value is Side => value === "left" || value === "right";

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
    ...fontsField(files),
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
