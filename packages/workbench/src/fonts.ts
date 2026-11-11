// The font picker's data and rules (ETH-106), shared by the page and the font endpoint: a
// Fontsource ID, a Google font's details and the files and `@font-face` rules that copy it into
// the repo, the `font-family` value the Workbench saves, and the picker's search and lists.

/** The one host the font endpoint fetches font files and licences from. */
export const FONT_HOST = "cdn.jsdelivr.net";

/** The largest font file or licence the font endpoint saves, in bytes. */
export const MAX_FILE = 5 * 1024 * 1024;

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// A family name: at most 100 characters, none that could close the quote, the declaration or
// the block, open a comment, or start a tag.
const NAME = /^[^"'\\{};<>\r\n]{1,100}$/;
const FALLBACKS = ["serif", "sans-serif", "monospace"] as const;
const VALUE = /^"([^"]*)", (serif|sans-serif|monospace)$/;

// A generic family a saved `font-family` falls back to.
type Fallback = (typeof FALLBACKS)[number];

/** Whether `id` is a Fontsource ID: lower-case letters, digits and single hyphens, ≤ 64 long. */
export const isFontId = (id: unknown): id is string =>
  typeof id === "string" && id.length <= 64 && ID.test(id);

/** Whether `name` may be written into a CSS file as a quoted family name. */
export const isFamilyName = (name: string): boolean =>
  NAME.test(name) && !name.includes("/*") && !name.includes("*/");

/** Whether `value` is a `font-family` the Workbench may save: `"Family", serif`. */
export function isFamilyValue(value: string): boolean {
  const name = VALUE.exec(value)?.[1];
  return name !== undefined && isFamilyName(name);
}

/** The generic family for a Google category: display and handwriting fall back to sans-serif. */
export const fallbackOf = (category: string | undefined): Fallback =>
  FALLBACKS.find((f) => f === category) ?? "sans-serif";

/** The `font-family` value for `family`: "Newsreader", "serif" → `"Newsreader", serif`. */
export const familyValue = (family: string, fallback: Fallback): string =>
  `"${family}", ${fallback}`;

/** A Google family as the Fontsource list gives it. */
export type GoogleFont = {
  id: string;
  family: string;
  category: string;
  variable: boolean;
  weights: number[];
  styles: string[];
  subset: string;
};

const prop = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
const str = (value: unknown): string => (typeof value === "string" ? value : "");
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
const entries = (value: unknown): [string, unknown][] =>
  typeof value === "object" && value !== null ? Object.entries(value) : [];
const numbers = (value: unknown): number[] =>
  Array.isArray(value) ? value.filter((v): v is number => Number.isInteger(v)) : [];

/** One entry of the Fontsource list, or null when its ID or family cannot be used. */
export function parseGoogleFont(entry: unknown): GoogleFont | null {
  const id = prop(entry, "id");
  const family = str(prop(entry, "family"));
  // The subset names files and paths, so it takes the ID's shape: "latin", "latin-ext".
  const subset = str(prop(entry, "defSubset")) || "latin";
  if (!isFontId(id) || !isFamilyName(family) || !isFontId(subset)) return null;
  return {
    id,
    family,
    category: str(prop(entry, "category")),
    variable: prop(entry, "variable") === true,
    weights: numbers(prop(entry, "weights")),
    styles: strings(prop(entry, "styles")),
    subset,
  };
}

// A Google font's full details: its list entry, version, weight axis and static files.
type FontDetails = GoogleFont & {
  version: string;
  // The weight axis of a variable font, or null for a font of separate weights.
  wght: [number, number] | null;
  // Each static woff2 file of the default subset, by weight and style.
  files: { weight: number; style: string; url: string }[];
};

/**
 * A font's details from Fontsource's `/v1/fonts/ID` reply and, for a variable font, its
 * `/v1/variable/ID` reply. Null when the details are not a usable font.
 */
export function parseDetails(details: unknown, axes: unknown): FontDetails | null {
  const font = parseGoogleFont(details);
  const version = str(prop(details, "npmVersion"));
  if (font === null || !/^\d+\.\d+\.\d+$/.test(version)) return null;
  const wght = prop(prop(axes, "axes"), "wght");
  const [min, max] = [Number(prop(wght, "min")), Number(prop(wght, "max"))];
  const files = entries(prop(details, "variants")).flatMap(([weight, styles]) =>
    entries(styles).flatMap(([style, subsets]) => {
      const url = prop(prop(prop(subsets, font.subset), "url"), "woff2");
      const w = Number(weight);
      return typeof url === "string" && Number.isInteger(w) && /^(normal|italic)$/.test(style)
        ? [{ weight: w, style, url }]
        : [];
    }),
  );
  return {
    ...font,
    version,
    wght: font.variable && Number.isFinite(min) && Number.isFinite(max) ? [min, max] : null,
    files,
  };
}

// One file the endpoint saves: where it comes from, its name in the font's folder, its face.
type FontFile = { url: string; name: string; weight: string; style: string };

/**
 * The woff2 files of a font's default subset: a variable font's weight-axis file and its
 * italic, or one file per weight and style.
 */
export function fontFiles(font: FontDetails): FontFile[] {
  const { id, version, subset, wght } = font;
  if (wght !== null) {
    return font.styles
      .filter((s) => s === "normal" || s === "italic")
      .toSorted((a, b) => b.localeCompare(a))
      .map((style) => ({
        url: `https://${FONT_HOST}/fontsource/fonts/${id}:vf@${version}/${subset}-wght-${style}.woff2`,
        name: `${subset}-wght-${style}.woff2`,
        weight: `${wght[0]} ${wght[1]}`,
        style,
      }));
  }
  return font.files
    .toSorted((a, b) => a.weight - b.weight || b.style.localeCompare(a.style))
    .map(({ weight, style, url }) => ({
      url,
      name: `${subset}-${weight}-${style}.woff2`,
      weight: String(weight),
      style,
    }));
}

/** The licence's address: the `@fontsource` package's LICENSE, which holds the font's own. */
export const licenseUrl = (font: FontDetails): string =>
  `https://${FONT_HOST}/npm/@fontsource/${font.id}@${font.version}/LICENSE`;

/** The comment line above a font's rules in fonts.css, which marks the font as saved. */
export const marker = (id: string): string => `/* fontsource: ${id} */`;

/** A font's `@font-face` rules for fonts.css, under its marker, one per file. */
export function fontRules(font: FontDetails, files: FontFile[]): string {
  const faces = files.map(
    (f) =>
      `@font-face {\n  font-family: "${font.family}";\n  font-style: ${f.style};\n` +
      `  font-display: swap;\n  font-weight: ${f.weight};\n` +
      `  src: url("./fonts/${font.id}/${f.name}") format("woff2");\n}\n`,
  );
  return `${marker(font.id)}\n${faces.join("")}`;
}

/** Whether a family's name holds `query`, anywhere and ignoring case. */
export const matchesFamily = (query: string, family: string): boolean =>
  family.toLowerCase().includes(query.trim().toLowerCase());

/** The name Google gives a family the mockup loads: "Inter Variable" → "Inter". */
export const googleName = (family: string): string => family.replace(/ Variable$/, "");

/**
 * The picker's first two groups: the mockup's families once each, sorted, and the Google
 * families the mockup does not already have, with or without " Variable" after the name.
 */
export function mergeFamilies(
  mockup: string[],
  google: GoogleFont[],
): { mockup: string[]; google: GoogleFont[] } {
  const used = new Set(mockup.map((f) => googleName(f)));
  return {
    mockup: [...new Set(mockup)].toSorted((a, b) => a.localeCompare(b)),
    google: google.filter((g) => !used.has(g.family)),
  };
}

// The nine weight names, from 100, without spaces, hyphens or case.
const WEIGHTS = [
  ["thin", "hairline"],
  ["extralight", "ultralight"],
  ["light"],
  ["regular", "normal"],
  ["medium"],
  ["semibold", "demibold"],
  ["bold"],
  ["extrabold", "ultrabold"],
  ["black", "heavy"],
];

/**
 * An installed family's faces from its style names, as `styleList` takes them: "Bold Italic" →
 * 700 italic, "Italic" → 400 italic. A name that is not one of the nine weights is left out.
 */
export function installedFaces(styles: string[]): { weight: string; style: string }[] {
  return styles.flatMap((name) => {
    const words = name.toLowerCase().replaceAll(/[\s_-]/g, "");
    const italic = /(italic|oblique)$/.test(words);
    const rest = words.replace(/(italic|oblique)$/, "") || "regular";
    const at = WEIGHTS.findIndex((names) => names.includes(rest));
    return at === -1
      ? []
      : [{ weight: String((at + 1) * 100), style: italic ? "italic" : "normal" }];
  });
}

/**
 * The files that preview a Google font straight from FONT_HOST, with nothing saved: a variable
 * font's axis files over every weight, or each weight and style of the font's list entry.
 */
export function previewFiles(font: GoogleFont): FontFile[] {
  const base = `https://${FONT_HOST}/fontsource/fonts/${font.id}@latest/${font.subset}`;
  return fontFiles({
    ...font,
    version: "latest",
    wght: font.variable ? [Math.min(...font.weights), Math.max(...font.weights)] : null,
    files: font.weights.flatMap((weight) =>
      font.styles.map((style) => ({ weight, style, url: `${base}-${weight}-${style}.woff2` })),
    ),
  });
}
