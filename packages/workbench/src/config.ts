// The Workbench config (ADR-042): the few facts about a host the project contract cannot derive,
// in `.workbench/config.json`. Checking it is pure, like the contract's: a sorted failure list,
// where an empty list accepts.
import type { Failure } from "./contract.ts";

const FIELDS = new Set(["format", "version", "sources", "storybook", "tokens"]);

const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// Code-unit order by path then code, so the list does not depend on the machine's locale.
const key = (f: Failure) => `${f.path}\u0000${f.code}`;

// Whether a folder or file below the root is there.
type Exists = (path: string, kind: "folder" | "file") => boolean;

// A path below the root, written with `/`: not empty, not absolute, never climbing out.
const inside = (path: unknown): path is string =>
  typeof path === "string" &&
  path !== "" &&
  !path.startsWith("/") &&
  !/^[A-Za-z]:|\\/.test(path) &&
  !path.split("/").includes("..");

// The failures of one path field: its shape, then whether it exists under the root.
function checkPath(
  path: unknown,
  at: string,
  code: string,
  exists: Exists,
  kind: "folder" | "file" = "folder",
): Failure[] {
  if (!inside(path))
    return [{ code, path: at, message: `Must be a ${kind} inside the root, written with /.` }];
  return exists(path, kind)
    ? []
    : [{ code: `missing-${kind}`, path: at, message: `No ${kind} ${path} under the root.` }];
}

function checkFields(data: Record<string, unknown>, exists: Exists): Failure[] {
  const sources = Array.isArray(data.sources) ? data.sources : null;
  const storybook = data.storybook;
  return [
    ...Object.keys(data)
      .filter((field) => !FIELDS.has(field))
      .map((field) => ({ code: "unknown-field", path: field, message: `No field ${field}.` })),
    ...(sources === null || sources.length === 0
      ? [{ code: "bad-sources", path: "sources", message: "Sources must list one folder or more." }]
      : sources.flatMap((s, i) => checkPath(s, `sources/${i}`, "bad-source", exists))),
    ...(storybook === null
      ? []
      : record(storybook) && Object.keys(storybook).join() === "configDir"
        ? checkPath(storybook.configDir, "storybook/configDir", "bad-storybook", exists)
        : [
            {
              code: "bad-storybook",
              path: "storybook",
              message: "Storybook must be null or { configDir }.",
            },
          ]),
    // Optional: the stylesheet whose `:root` values are the baselines (ADR-045).
    ...(data.tokens === undefined
      ? []
      : checkPath(data.tokens, "tokens", "bad-tokens", exists, "file")),
  ];
}

/**
 * Every reason config `text` is refused, sorted by path then code; an empty list accepts it.
 * `exists` says whether a folder or file, relative to the root, is there; the default skips that
 * check.
 */
export function checkConfig(text: string, exists: Exists = () => true): Failure[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [{ code: "not-json", path: "", message: "The config is not JSON." }];
  }
  if (!record(data) || data.format !== "design-workshop/config" || data.version !== 1)
    return [
      { code: "bad-format", path: "format", message: "Not a design-workshop/config, version 1." },
    ];
  return checkFields(data, exists).toSorted((a, b) =>
    key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0,
  );
}

/**
 * The paths config `text` names, once `checkConfig` accepts it; `tokens` is null when absent.
 * @throws With the first failure's path and message when it is refused.
 */
export function parseConfig(text: string): {
  sources: string[];
  storybook: { configDir: string } | null;
  tokens: string | null;
} {
  const [failure] = checkConfig(text); // → Failure | undefined
  if (failure !== undefined) throw new Error(`${failure.path}: ${failure.message}`);
  const data: unknown = JSON.parse(text);
  const fields = record(data) ? data : {};
  const storybook = record(fields.storybook) ? fields.storybook : {};
  return {
    sources: Array.isArray(fields.sources)
      ? fields.sources.filter((s): s is string => typeof s === "string")
      : [],
    storybook: typeof storybook.configDir === "string" ? { configDir: storybook.configDir } : null,
    tokens: typeof fields.tokens === "string" ? fields.tokens : null,
  };
}
