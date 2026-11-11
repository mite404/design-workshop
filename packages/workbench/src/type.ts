// The Typography section's maths (ETH-105): the values each type property may take, letter
// spacing between Figma's percentage and CSS's `em`, matching a size to a step of the type
// scale, and the styles a family offers.

/** The type properties the Workbench sets on an element, in the inspector's order. */
export const TYPE = [
  "font-weight",
  "font-style",
  "font-size",
  "line-height",
  "letter-spacing",
  "text-align",
  "align-content",
] as const;

/** A type property the Workbench sets. */
export type TypeName = (typeof TYPE)[number];

/** The nine steps of the type scale (ETH-104), smallest first: `--text-2xs` to `--text-4xl`. */
export const STEPS = ["2xs", "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl"] as const;

/** A step of the type scale. */
export type TextStep = (typeof STEPS)[number];

const WHOLE_PX = /^[1-9]\d{0,3}px$/;
const STEP_VAR = new RegExp(`^var\\(--text-(?:${STEPS.join("|")})\\)$`);
const EM = /^-?\d(?:\.\d{1,3})?em$/;
const WEIGHT = /^(?:[1-9]\d{0,2}|1000)$/;

// Each type property's check: the whole value must pass before it reaches the file.
const CHECKS: Record<TypeName, (v: string) => boolean> = {
  "font-weight": (v) => WEIGHT.test(v),
  "font-style": (v) => v === "normal" || v === "italic",
  "font-size": (v) => STEP_VAR.test(v) || WHOLE_PX.test(v),
  "line-height": (v) => WHOLE_PX.test(v),
  "letter-spacing": (v) => EM.test(v) && Number.parseFloat(v) >= -1 && Number.parseFloat(v) <= 2,
  "text-align": (v) => v === "left" || v === "center" || v === "right",
  "align-content": (v) => v === "start" || v === "center" || v === "end",
};

/** Whether `name` is a type property the Workbench sets. */
export const isType = (name: string): name is TypeName =>
  (TYPE as readonly string[]).includes(name);

/** Whether `value` is one the Workbench may save for the type property `name`. */
export const typeValue = (name: TypeName, value: string): boolean => CHECKS[name](value);

/** A letter spacing percentage of the size as CSS: 5 → "0.05em", to three decimals. */
export function emOf(percent: number): string {
  const em = Math.round(percent * 10) / 1000; // -0.5 → -0.005
  return `${em === 0 ? 0 : em}em`;
}

/** A computed letter spacing in px as a percentage of the size, to one decimal: -0.2, 14 → -1.4. */
export const percentOf = (spacing: number, size: number): number =>
  size === 0 ? 0 : Math.round((spacing / size) * 1000) / 10 || 0;

/** The step whose pixel size is `size`, from each step's size in px, or null when none is. */
export function stepOf(size: number, sizes: Partial<Record<TextStep, number>>): TextStep | null {
  return STEPS.find((s) => sizes[s] === size) ?? null;
}

/** One entry of the Style list: a weight, whether it is italic, and its name. */
export type Style = { weight: number; italic: boolean; label: string };

// Figma's names for each hundred, from 100.
const NAMES = [
  "Thin",
  "ExtraLight",
  "Light",
  "Regular",
  "Medium",
  "SemiBold",
  "Bold",
  "ExtraBold",
  "Black",
];

const keyword: Record<string, string> = { normal: "400", bold: "700" };

// A FontFace's weight descriptor as a range: "100 900" → [100, 900], "bold" → [700, 700].
function range(weight: string): [number, number] {
  const [low = 400, high = low] = weight
    .split(/\s+/)
    .map((w) => Number(keyword[w] ?? w))
    .filter((w) => Number.isFinite(w));
  return [low, high];
}

// The name of `weight`, italic or not: 700, true → "Bold Italic"; 400, true → "Italic".
function styleName(weight: number, italic: boolean): string {
  const name = weight % 100 === 0 ? (NAMES[weight / 100 - 1] ?? String(weight)) : String(weight);
  if (!italic) return name;
  return name === "Regular" ? "Italic" : `${name} Italic`;
}

/**
 * The Style list for a family from its font faces (FontFace's `weight` and `style`): every
 * hundred inside each face's weight range, with italics where it has an italic face, lightest
 * first. A family with no face, a system font, offers Regular and Bold. A current weight off the
 * hundreds, such as 550, comes first.
 */
export function styleList(
  faces: { weight: string; style: string }[],
  current: { weight: number; italic: boolean },
): Style[] {
  const found = new Map<string, Style>();
  const add = (weight: number, italic: boolean) =>
    found.set(`${weight}${italic ? "i" : ""}`, {
      weight,
      italic,
      label: styleName(weight, italic),
    });
  const known =
    faces.length > 0
      ? faces
      : [
          { weight: "400", style: "normal" },
          { weight: "700", style: "normal" },
        ];
  for (const face of known) {
    const [low, high] = range(face.weight);
    const italic = face.style !== "normal";
    for (let w = Math.ceil(low / 100) * 100; w <= high; w += 100) add(w, italic);
  }
  const list = [...found.values()].toSorted(
    (a, b) => a.weight - b.weight || Number(a.italic) - Number(b.italic),
  );
  if (found.has(`${current.weight}${current.italic ? "i" : ""}`)) return list;
  return [{ ...current, label: styleName(current.weight, current.italic) }, ...list];
}
