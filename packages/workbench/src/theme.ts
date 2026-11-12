// Theme files (ADR-028): the Workbench's own JSON, keyed by roles rather than CSS variables, so
// one theme can reskin any app whose role map says which of its values play each role.
import { COLOUR_ROOT, HEX } from "./colour.ts";
import { isFamilyValue } from "./fonts.ts";
import { isScale, scaleValue } from "./type.ts";

/** Each colour role and the Template design value that plays it, light and dark. */
export const COLOUR_ROLES = {
  page: "--bg",
  surface: "--paper",
  hover: "--paper-deep",
  compose: "--compose-bg",
  control: "--control-bg",
  ink: "--ink",
  "ink-soft": "--soft-ink",
  "ink-faint": "--faint-ink",
  accent: "--olive",
  "on-accent": "--on-accent",
  send: "--send",
  focus: "--focus",
  selection: "--blue",
  chrome: "--chrome",
  "on-chrome": "--on-chrome",
  "on-chrome-soft": "--on-chrome-soft",
  "chrome-hover": "--chrome-hover",
} as const;

/** Each type role and the Template design value that plays it, on `:root`. */
export const TYPE_ROLES = {
  "text-font": "--font-text",
  "display-font": "--font-display",
  "base-size": "--type-base",
  ratio: "--type-ratio",
  leading: "--type-leading",
} as const;

export type ColourRole = keyof typeof COLOUR_ROLES;
export type TypeRole = keyof typeof TYPE_ROLES;
// A dark-only theme (Vesper) sets only `dark`; a light-only one (Catppuccin Latte) only `light`.
type Modes = { light?: string; dark?: string };

/** A theme as saved: a palette carries `colours`, a type pairing `type`, a full theme both. */
export type Theme = {
  format: "design-workshop/theme";
  version: 1;
  name: string;
  colours?: Partial<Record<ColourRole, Modes>>;
  type?: Partial<Record<TypeRole, string>>;
};

/** One override value a theme sets. */
export type ThemeValue = { selector: string; name: string; value: string };

const NAME = /^[a-z0-9][a-z0-9-]{0,47}$/;
const has = <K extends string>(map: Record<K, string>, key: string): key is K =>
  Object.hasOwn(map, key);
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function typeOk(role: TypeRole, value: unknown): value is string {
  if (typeof value !== "string") return false;
  const name = TYPE_ROLES[role];
  return isScale(name) ? scaleValue(name, value) : isFamilyValue(value);
}

// One colour role's modes, or why they are refused.
function parseModes(role: string, modes: unknown): Modes | string {
  if (!record(modes)) return `colour role ${role} must be an object`;
  const set: Modes = {};
  for (const [mode, v] of Object.entries(modes)) {
    if (!has(COLOUR_ROOT, mode) || typeof v !== "string" || !HEX.test(v))
      return `bad ${mode} hex for colour role ${role}`;
    set[mode] = v;
  }
  return set.light === undefined && set.dark === undefined
    ? `colour role ${role} needs light and/or dark hex values`
    : set;
}

function parseColours(colours: Record<string, unknown>): Theme["colours"] | string {
  const out: NonNullable<Theme["colours"]> = {};
  for (const [role, modes] of Object.entries(colours)) {
    if (!has(COLOUR_ROLES, role)) return `unknown colour role: ${role}`;
    const set = parseModes(role, modes);
    if (typeof set === "string") return set;
    out[role] = set;
  }
  return out;
}

function parseType(type: Record<string, unknown>): Theme["type"] | string {
  const out: NonNullable<Theme["type"]> = {};
  for (const [role, value] of Object.entries(type)) {
    if (!has(TYPE_ROLES, role)) return `unknown type role: ${role}`;
    if (!typeOk(role, value)) return `bad value for type role ${role}`;
    out[role] = value;
  }
  return out;
}

/** Reads a theme file's text, or says the first thing wrong with it. Unknown roles are refused. */
export function parseTheme(text: string): Theme | string {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return "not JSON";
  }
  if (!record(data)) return "not an object";
  if (data.format !== "design-workshop/theme" || data.version !== 1) return "unknown format";
  if (typeof data.name !== "string" || !NAME.test(data.name)) return "bad name";
  const { colours = {}, type = {} } = data;
  if (!record(colours) || !record(type)) return "colours and type must be objects";
  const parsedColours = parseColours(colours);
  if (typeof parsedColours === "string") return parsedColours;
  const parsedType = parseType(type);
  if (typeof parsedType === "string") return parsedType;
  return {
    format: "design-workshop/theme",
    version: 1,
    name: data.name,
    colours: parsedColours,
    type: parsedType,
  };
}

/** The override values that apply `theme`, through the role maps. */
export function themeValues(theme: Theme): ThemeValue[] {
  const colours = Object.entries(theme.colours ?? {}).flatMap(([role, modes]) =>
    has(COLOUR_ROLES, role)
      ? (["light", "dark"] as const).flatMap((mode) => {
          const value = modes[mode];
          return value === undefined
            ? []
            : [{ selector: COLOUR_ROOT[mode], name: COLOUR_ROLES[role], value }];
        })
      : [],
  );
  const type = Object.entries(theme.type ?? {}).flatMap(([role, value]) =>
    has(TYPE_ROLES, role) ? [{ selector: ":root", name: TYPE_ROLES[role], value }] : [],
  );
  return [...colours, ...type];
}

// The shadcn names this repo maps onto its own roles (packages/ui/src/styles/globals.css), read
// in reverse. A role without one is unmatched, never guessed (PRD section 13).
const SHADCN_ROLES: Record<string, string> = {
  page: "--background",
  surface: "--card",
  compose: "--popover",
  hover: "--accent",
  ink: "--foreground",
  "ink-soft": "--muted-foreground",
  focus: "--ring",
  "text-font": "--font-sans",
  "display-font": "--font-serif",
};

/** One role and the app's name for it, by the table that found it; null names are unmatched. */
export type RoleMatch = {
  role: string;
  name: string | null;
  table: "template" | "shadcn" | null;
};

/**
 * Which CSS variable in a stylesheet plays each theme role: its Template name first, then its
 * shadcn name. A name counts when the sheet declares it anywhere.
 */
export function matchRoles(css: string): RoleMatch[] {
  // ponytail: any declaration counts, whatever its selector; parse rules if a sheet scopes them
  const declares = (name: string) => new RegExp(`(?:^|[\\s;{])${name}\\s*:`).test(css);
  const roles = Object.entries({ ...COLOUR_ROLES, ...TYPE_ROLES }); // → [role, Template name][]
  return roles.map(([role, template]) => {
    const shadcn = has(SHADCN_ROLES, role) ? SHADCN_ROLES[role] : undefined;
    if (declares(template)) return { role, name: template, table: "template" };
    if (shadcn !== undefined && declares(shadcn)) return { role, name: shadcn, table: "shadcn" };
    return { role, name: null, table: null };
  });
}
