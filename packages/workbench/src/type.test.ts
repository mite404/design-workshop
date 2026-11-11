import { expect, test } from "vitest";
import { emOf, percentOf, stepOf, styleList } from "./type";

const labels = (list: { label: string }[]) => list.map((s) => s.label);

test("letter spacing goes from a percentage to em and back", () => {
  expect(emOf(5)).toBe("0.05em");
  expect(emOf(-0.5)).toBe("-0.005em");
  expect(emOf(-0)).toBe("0em");
  expect(emOf(1.25)).toBe("0.013em"); // three decimals, as the endpoint takes
  expect(percentOf(-0.2, 14)).toBe(-1.4);
  expect(percentOf(-0.07, 14)).toBe(-0.5);
  expect(percentOf(0, 0)).toBe(0);
});

test("a size matches a step only at its exact pixel size", () => {
  const sizes = { sm: 14, base: 16, lg: 20 };
  expect(stepOf(20, sizes)).toBe("lg");
  expect(stepOf(15, sizes)).toBeNull();
  expect(stepOf(14.5, sizes)).toBeNull();
});

test("a variable font with an italic face lists every hundred, upright then italic", () => {
  const faces = [
    { weight: "200 800", style: "normal" },
    { weight: "200 800", style: "italic" },
    { weight: "200 800", style: "normal" }, // another unicode range of the same face
  ];
  const list = styleList(faces, { weight: 400, italic: false });
  expect(labels(list).slice(0, 5)).toEqual([
    "ExtraLight",
    "ExtraLight Italic",
    "Light",
    "Light Italic",
    "Regular",
  ]);
  expect(labels(list)).toContain("Italic");
  expect(labels(list)).toContain("Bold Italic");
  expect(labels(list).at(-1)).toBe("ExtraBold Italic");
  expect(list).toHaveLength(14);
});

test("a weight between the hundreds shows as its number at the top", () => {
  const list = styleList([{ weight: "100 900", style: "normal" }], { weight: 550, italic: false });
  expect(labels(list).slice(0, 2)).toEqual(["550", "Thin"]);
  expect(labels(list)).not.toContain("Italic");
});

test("static faces list their own weights only", () => {
  const faces = [
    { weight: "normal", style: "normal" },
    { weight: "bold", style: "italic" },
  ];
  expect(labels(styleList(faces, { weight: 400, italic: false }))).toEqual([
    "Regular",
    "Bold Italic",
  ]);
});

test("a system font, with no face, offers Regular and Bold", () => {
  expect(labels(styleList([], { weight: 400, italic: false }))).toEqual(["Regular", "Bold"]);
});
