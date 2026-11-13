// The Workbench config (ADR-042): the few facts about a host the project contract cannot derive,
// in `.workbench/config.json`. Checking it is pure, like the contract's: a sorted failure list,
// where an empty list accepts.
import type { Failure } from "./contract.ts";
import { COLOUR_ROLES, TYPE_ROLES } from "./theme.ts";

const FIELDS = new Set([
  "format",
  "version",
  "sources",
  "storybook",
  "tokens",
  "fonts",
  "roles",
  "colourSelectors",
]);
const ROLES = new Set([...Object.keys(COLOUR_ROLES), ...Object.keys(TYPE_ROLES)]);
// A custom property's name, and a selector that cannot open, close or end a rule in the override
// file it is written into.
const VARIABLE = /^--[A-Za-z0-9-]+$/;
const SELECTOR = /^[^\s{};][^{};]*[^\s{};]$|^[^\s{};]$/;

const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const stringsOf = (v: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(v).filter((e): e is [string, string] => typeof e[1] === "string"),
  );

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

// Optional (PRD section 13): the variable that plays each theme role the app has.
function checkRoles(roles: unknown): Failure[] {
  if (roles === undefined) return [];
  if (!record(roles))
    return [
      { code: "bad-roles", path: "roles", message: "Roles must map role names to variables." },
    ];
  return Object.entries(roles).flatMap(([role, name]) =>
    ROLES.has(role) && typeof name === "string" && VARIABLE.test(name)
      ? []
      : [
          {
            code: "bad-role",
            path: `roles/${role}`,
            message: ROLES.has(role) ? "Must be a --custom-property name." : `No role ${role}.`,
          },
        ],
  );
}

// Optional: the selectors that hold the app's light and dark colours.
function checkSelectors(selectors: unknown): Failure[] {
  if (selectors === undefined) return [];
  const ok =
    record(selectors) &&
    Object.keys(selectors).toSorted().join() === "dark,light" &&
    [selectors.light, selectors.dark].every((v) => typeof v === "string" && SELECTOR.test(v));
  return ok
    ? []
    : [
        {
          code: "bad-colour-selectors",
          path: "colourSelectors",
          message: "Colour selectors must be { light, dark }, each one selector.",
        },
      ];
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
    // Optional: the folder whose fonts.css and fonts/ the Workbench writes (ADR-021).
    ...(data.fonts === undefined ? [] : checkPath(data.fonts, "fonts", "bad-fonts", exists)),
    ...checkRoles(data.roles),
    ...checkSelectors(data.colourSelectors),
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
  fonts: string | null;
  roles: Record<string, string> | null;
  colourSelectors: { light: string; dark: string } | null;
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
    fonts: typeof fields.fonts === "string" ? fields.fonts : null,
    roles: record(fields.roles) ? stringsOf(fields.roles) : null,
    colourSelectors: record(fields.colourSelectors)
      ? { light: String(fields.colourSelectors.light), dark: String(fields.colourSelectors.dark) }
      : null,
  };
}
