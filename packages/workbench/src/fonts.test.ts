import { expect, test } from "vitest";
import {
  installedFaces,
  isFamilyValue,
  matchesFamily,
  mergeFamilies,
  parseGoogleFont,
  type GoogleFont,
} from "./fonts";

const google = (family: string): GoogleFont => {
  const font = parseGoogleFont({ id: family.toLowerCase().replaceAll(" ", "-"), family });
  if (font === null) throw new Error(family);
  return font;
};

test("a family value is one quoted name and a generic fallback", () => {
  expect(isFamilyValue('"Newsreader", serif')).toBe(true);
  expect(isFamilyValue('"Source Code Pro", monospace')).toBe(true);
  const hostile = [
    '"News"; } * { color: red } a { b: "c", serif',
    '"News\\", serif',
    '"News" serif',
    '"News", serif; color: red',
    '"<style>", serif',
    '"News /* x */", serif',
    '"News\nreader", serif',
    '"News{", serif',
    `"${"a".repeat(101)}", serif`,
    '"", serif',
    '"News", fantasy',
    "News, serif",
  ];
  expect(hostile.filter((v) => isFamilyValue(v))).toEqual([]);
});

test("search matches anywhere in the name, ignoring case", () => {
  expect(matchesFamily("news", "Newsreader Variable")).toBe(true);
  expect(matchesFamily("READ", "Newsreader")).toBe(true);
  expect(matchesFamily(" var ", "Inter Variable")).toBe(true);
  expect(matchesFamily("serif", "Inter")).toBe(false);
});

test("an installed family's weights come from its style names", () => {
  expect(
    installedFaces([
      "Regular",
      "Italic",
      "Bold Italic",
      "Semi Bold",
      "ExtraLight",
      "Book",
      "Black",
    ]),
  ).toEqual([
    { weight: "400", style: "normal" },
    { weight: "400", style: "italic" },
    { weight: "700", style: "italic" },
    { weight: "600", style: "normal" },
    { weight: "200", style: "normal" },
    { weight: "900", style: "normal" },
  ]);
});

test("a Google family the mockup has, with or without Variable, is listed once, first", () => {
  const merged = mergeFamilies(
    ["Newsreader Variable", "Inter Variable", "Inter Variable", "Lora"],
    ["Inter", "Lora", "Newsreader", "Roboto"].map((f) => google(f)),
  );
  expect(merged.mockup).toEqual(["Inter Variable", "Lora", "Newsreader Variable"]);
  expect(merged.google.map((g) => g.family)).toEqual(["Roboto"]);
});
