import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { COLOUR_ROOT } from "./colour";
import { matchRoles, parseTheme, themeValues, type Theme } from "./theme";

const bundled = (name: string) =>
  readFileSync(new URL(`../themes/${name}.theme.json`, import.meta.url), "utf8");
// Narrows a parse to the theme, failing the test with the refusal reason otherwise.
function ok(text: string): Theme {
  const parsed = parseTheme(text);
  if (typeof parsed === "string") throw new Error(parsed);
  return parsed;
}
const theme = (extra: object) =>
  JSON.stringify({ format: "design-workshop/theme", version: 1, name: "t", ...extra });

test("the bundled themes parse and set only their own mode", () => {
  const vesper = ok(bundled("vesper"));
  const latte = ok(bundled("catppuccin-latte"));
  expect(themeValues(vesper).every((v) => v.selector === COLOUR_ROOT.dark)).toBe(true);
  expect(themeValues(latte).every((v) => v.selector === COLOUR_ROOT.light)).toBe(true);
  expect(themeValues(latte)).toContainEqual({
    selector: COLOUR_ROOT.light,
    name: "--olive",
    value: "#8839ef",
  });
});

test("roles map to Template values in both modes, type on :root", () => {
  const parsed = ok(
    theme({
      colours: { accent: { light: "#112233", dark: "#445566" } },
      type: { "text-font": '"Inter", sans-serif', ratio: "1.25" },
    }),
  );
  expect(themeValues(parsed)).toEqual([
    { selector: COLOUR_ROOT.light, name: "--olive", value: "#112233" },
    { selector: COLOUR_ROOT.dark, name: "--olive", value: "#445566" },
    { selector: ":root", name: "--font-text", value: '"Inter", sans-serif' },
    { selector: ":root", name: "--type-ratio", value: "1.25" },
  ]);
});

test("a theme is refused with the reason, never applied in part", () => {
  expect(parseTheme("{")).toBe("not JSON");
  expect(parseTheme(theme({ version: 2 }))).toBe("unknown format");
  expect(parseTheme(theme({ name: "../escape" }))).toBe("bad name");
  // A CSS variable name is not a role: themes must stay portable across apps.
  expect(parseTheme(theme({ colours: { "--olive": { light: "#112233" } } }))).toBe(
    "unknown colour role: --olive",
  );
  expect(parseTheme(theme({ colours: { accent: {} } }))).toMatch(/needs light and\/or dark/);
  expect(parseTheme(theme({ colours: { accent: { sepia: "#112233" } } }))).toBe(
    "bad sepia hex for colour role accent",
  );
  expect(parseTheme(theme({ colours: { accent: { light: "red" } } }))).toBe(
    "bad light hex for colour role accent",
  );
  expect(parseTheme(theme({ type: { "base-size": "15px" } }))).toBe(
    "bad value for type role base-size",
  );
  expect(parseTheme(theme({ type: { "text-font": "x; }" } }))).toBe(
    "bad value for type role text-font",
  );
});

test("roles match Template names first, then shadcn names, and list the rest", () => {
  const css = `:root { --bg: #fff; --background: #eee; --card: #fff; --accent-foreground: #111;
  --font-sans: Inter; }`;
  const byRole = new Map(matchRoles(css).map((m) => [m.role, m]));
  expect(byRole.get("page")).toEqual({ role: "page", name: "--bg", table: "template" });
  expect(byRole.get("surface")).toEqual({ role: "surface", name: "--card", table: "shadcn" });
  expect(byRole.get("text-font")?.name).toBe("--font-sans");
  // --accent-foreground is not --accent, and accent has no shadcn name.
  expect(byRole.get("hover")?.name).toBeNull();
  expect(byRole.get("accent")?.name).toBeNull();
});
