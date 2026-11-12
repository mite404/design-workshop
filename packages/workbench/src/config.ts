// The Workbench config (ADR-042): the few facts about a host the project contract cannot derive,
// in `.workbench/config.json`. Checking it is pure, like the contract's: a sorted failure list,
// where an empty list accepts.
import type { Failure } from "./contract.ts";

const FIELDS = new Set(["format", "version", "sources", "storybook"]);

const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// Code-unit order by path then code, so the list does not depend on the machine's locale.
const key = (f: Failure) => `${f.path}\u0000${f.code}`;

// A folder below the root, written with `/`: not empty, not absolute, never climbing out.
const inside = (path: unknown): path is string =>
  typeof path === "string" &&
  path !== "" &&
  !path.startsWith("/") &&
  !/^[A-Za-z]:|\\/.test(path) &&
  !path.split("/").includes("..");

// The failures of one folder field: its shape, then whether it exists under the root.
function checkFolder(
  path: unknown,
  at: string,
  code: string,
  exists: (path: string) => boolean,
): Failure[] {
  if (!inside(path))
    return [{ code, path: at, message: "Must be a folder inside the root, written with /." }];
  return exists(path)
    ? []
    : [{ code: "missing-folder", path: at, message: `No folder ${path} under the root.` }];
}

function checkFields(data: Record<string, unknown>, exists: (path: string) => boolean): Failure[] {
  const sources = Array.isArray(data.sources) ? data.sources : null;
  const storybook = data.storybook;
  return [
    ...Object.keys(data)
      .filter((field) => !FIELDS.has(field))
      .map((field) => ({ code: "unknown-field", path: field, message: `No field ${field}.` })),
    ...(sources === null || sources.length === 0
      ? [{ code: "bad-sources", path: "sources", message: "Sources must list one folder or more." }]
      : sources.flatMap((s, i) => checkFolder(s, `sources/${i}`, "bad-source", exists))),
    ...(storybook === null
      ? []
      : record(storybook) && Object.keys(storybook).join() === "configDir"
        ? checkFolder(storybook.configDir, "storybook/configDir", "bad-storybook", exists)
        : [
            {
              code: "bad-storybook",
              path: "storybook",
              message: "Storybook must be null or { configDir }.",
            },
          ]),
  ];
}

/**
 * Every reason config `text` is refused, sorted by path then code; an empty list accepts it.
 * `exists` says whether a folder, relative to the root, is there; the default skips that check.
 */
export function checkConfig(
  text: string,
  exists: (path: string) => boolean = () => true,
): Failure[] {
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
 * The folders config `text` names, once `checkConfig` accepts it.
 * @throws With the first failure's path and message when it is refused.
 */
export function parseConfig(text: string): {
  sources: string[];
  storybook: { configDir: string } | null;
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
  };
}
