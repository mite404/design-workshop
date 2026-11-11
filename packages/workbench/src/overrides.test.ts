import { describe, expect, test } from "vitest";
import { parseOverrides, setOverride } from "./overrides";

const SECTION = "main > section:nth-child(2) > div";
const HEADER = "/* Written by the Workbench. One design value per line. Do not edit by hand. */\n";
const EMPTY = `${HEADER}:root {\n}\n`;
const FULL = `${HEADER}:root {
  --window-radius: 20px;
  --space: 24px;
}
${SECTION} {
  gap: 12px;
  padding-top: 16px;
}
aside {
  gap: 4px;
}
`;

describe("setOverride", () => {
  test("a write with no change returns the same bytes", () => {
    expect(setOverride(FULL, SECTION, "gap", "12px")).toBe(FULL);
    expect(setOverride(FULL, "aside", "padding", null)).toBe(FULL);
    expect(setOverride(FULL, "nav", "gap", null)).toBe(FULL);
  });

  test("sets a new value last in its block", () => {
    expect(setOverride(EMPTY, ":root", "--window-radius", "20px")).toBe(
      `${HEADER}:root {\n  --window-radius: 20px;\n}\n`,
    );
    expect(setOverride(FULL, SECTION, "margin", "0 auto")).toBe(
      FULL.replace("padding-top: 16px;\n", "padding-top: 16px;\n  margin: 0 auto;\n"),
    );
  });

  test("replaces a value in place", () => {
    expect(setOverride(FULL, ":root", "--window-radius", "8px")).toBe(
      FULL.replace("--window-radius: 20px", "--window-radius: 8px"),
    );
  });

  test("removes a value", () => {
    expect(setOverride(FULL, SECTION, "gap", null)).toBe(FULL.replace("  gap: 12px;\n", ""));
  });

  test("removing the last :root value leaves the empty :root block", () => {
    const one = setOverride(EMPTY, ":root", "--space", "24px");
    expect(setOverride(one, ":root", "--space", null)).toBe(EMPTY);
  });

  test("sets a value under a new selector in a new block at the end", () => {
    expect(setOverride(FULL, "footer", "padding", "8px 16px")).toBe(
      `${FULL}footer {\n  padding: 8px 16px;\n}\n`,
    );
  });

  test("removing the last value under a selector removes its block", () => {
    expect(setOverride(FULL, "aside", "gap", null)).toBe(
      FULL.replace("aside {\n  gap: 4px;\n}\n", ""),
    );
    const added = setOverride(EMPTY, SECTION, "gap", "12px");
    expect(setOverride(added, SECTION, "gap", null)).toBe(EMPTY);
  });

  test("refuses a value or selector that would break the shape", () => {
    expect(() => setOverride(EMPTY, ":root", "--a", "1px; color: red")).toThrow(/^override file/);
    expect(() => setOverride(EMPTY, ":root", "--a", "1px\n}")).toThrow(/^override file/);
    expect(() => setOverride(EMPTY, "a { b", "gap", "1px")).toThrow(/^override file/);
    expect(() => setOverride(EMPTY, ":root", "--a", "")).toThrow(/^override file/);
  });
});

describe("parseOverrides", () => {
  test("reads values by selector then name, in file order", () => {
    const values = parseOverrides(FULL);
    expect([...values.keys()]).toEqual([":root", SECTION, "aside"]);
    expect(Object.fromEntries(values.get(SECTION) ?? [])).toEqual({
      gap: "12px",
      "padding-top": "16px",
    });
    expect(parseOverrides(EMPTY)).toEqual(new Map([[":root", new Map()]]));
  });

  test.each([
    ["no final newline", FULL.slice(0, -1)],
    ["no :root block", `${HEADER}aside {\n  gap: 4px;\n}\n`],
    [":root not first", `aside {\n  gap: 4px;\n}\n:root {\n}\n`],
    ["an unclosed block", `:root {\n  --a: 1px;\n`],
    ["a repeated selector", `${FULL}aside {\n  margin: 0;\n}\n`],
    ["a repeated name", `:root {\n  --a: 1px;\n  --a: 2px;\n}\n`],
    ["a four-space indent", `:root {\n    --a: 1px;\n}\n`],
    ["a missing semicolon", `:root {\n  --a: 1px\n}\n`],
    ["two values on a line", `:root {\n  --a: 1px; --b: 2px;\n}\n`],
    ["an empty element block", `:root {\n}\naside {\n}\n`],
    ["a blank line", `:root {\n\n}\n`],
    ["a comment after the first block", `:root {\n}\n/* note */\n`],
    ["Windows line endings", `:root {\r\n}\r\n`],
  ])("throws on a file with %s", (_, text) => {
    expect(() => parseOverrides(text)).toThrow(/^override file/);
    expect(() => setOverride(text, ":root", "--a", "1px")).toThrow(/^override file/);
  });
});
