import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { readValues, writeValue } from "./plugin";

const HEADER = "/* Written by the Workbench. One design value per line. Do not edit by hand. */\n";
const SAVED = `${HEADER}:root {\n  --window-radius: 20px;\n}\n`;
const HOST = "localhost:5173";
const ORIGIN = `http://${HOST}`;
const CARD = "body > div:nth-child(4) > section:nth-child(2)";
const RADIUS = { selector: ":root", name: "--window-radius" };

// Each refusal: what it changes in a good request to the saved file, its origin, and its status.
const REFUSALS: [string, Record<string, unknown>, string | undefined, number][] = [
  ["a foreign origin", {}, "http://evil.test", 403],
  ["no origin", {}, undefined, 403],
  ["an opaque origin", {}, "null", 403],
  ["a lookalike origin", {}, `${ORIGIN}.evil.test`, 403],
  ["a name off the list", { name: "--space", was: null }, ORIGIN, 400],
  ["no selector", { selector: undefined }, ORIGIN, 400],
  ["a spacing name on :root", { name: "gap", was: null }, ORIGIN, 400],
  ["a token on an element", { selector: CARD, was: null }, ORIGIN, 400],
  ["a name off the element list", { selector: CARD, name: "margin", was: null }, ORIGIN, 400],
  [
    "a selector that closes the block",
    { selector: "body } * { color: red", name: "gap" },
    ORIGIN,
    400,
  ],
  ["a selector with a comma", { selector: `${CARD}, p`, name: "gap", was: null }, ORIGIN, 400],
  ["a selector with a class", { selector: "body > .card", name: "gap", was: null }, ORIGIN, 400],
  ["a fraction of a pixel", { value: "8.5px" }, ORIGIN, 400],
  ["a value that is not px", { value: "8em" }, ORIGIN, 400],
  ["a value that escapes", { value: "8px;}" }, ORIGIN, 400],
  ["a negative value", { value: "-8px" }, ORIGIN, 400],
  ["a stale was", { was: "12px" }, ORIGIN, 409],
  ["a was of null when a value is saved", { was: null }, ORIGIN, 409],
];

function overrideFile(text: string): string {
  const file = path.join(mkdtempSync(path.join(tmpdir(), "workbench-")), "overrides.css");
  writeFileSync(file, text);
  return file;
}

const post = (file: string, body: unknown, origin: string | undefined) =>
  writeValue(file, { origin, host: HOST, body: JSON.stringify(body) });

describe("writeValue", () => {
  test("sets, replaces and resets a value, leaving only the override file", () => {
    const file = overrideFile(`${HEADER}:root {\n}\n`);
    expect(post(file, { ...RADIUS, value: "20px", was: null }, ORIGIN).status).toBe(200);
    expect(readFileSync(file, "utf8")).toBe(SAVED);
    expect(post(file, { ...RADIUS, value: "8px", was: "20px" }, ORIGIN).status).toBe(200);
    expect(readFileSync(file, "utf8")).toBe(SAVED.replace("20px", "8px"));
    expect(post(file, { ...RADIUS, value: null, was: "8px" }, ORIGIN).status).toBe(200);
    expect(readFileSync(file, "utf8")).toBe(`${HEADER}:root {\n}\n`);
    expect(readdirSync(path.dirname(file))).toEqual(["overrides.css"]);
  });

  test("sets and removes an element's spacing in its own block", () => {
    const file = overrideFile(SAVED);
    expect(
      post(file, { selector: CARD, name: "gap", value: "22px", was: null }, ORIGIN).status,
    ).toBe(200);
    expect(
      post(file, { selector: CARD, name: "padding-left", value: "0px", was: null }, ORIGIN).status,
    ).toBe(200);
    expect(readFileSync(file, "utf8")).toBe(
      `${SAVED}${CARD} {\n  gap: 22px;\n  padding-left: 0px;\n}\n`,
    );
    expect(
      post(file, { selector: CARD, name: "gap", value: "8px", was: null }, ORIGIN).status,
    ).toBe(409);
    post(file, { selector: CARD, name: "gap", value: null, was: "22px" }, ORIGIN);
    post(file, { selector: CARD, name: "padding-left", value: null, was: "0px" }, ORIGIN);
    expect(readFileSync(file, "utf8")).toBe(SAVED);
  });

  test("accepts only two signed whole pixel lengths for an element's translate and removes it", () => {
    const file = overrideFile(SAVED);
    const offset = { selector: CARD, name: "translate", was: null };
    for (const value of [
      "2px",
      "2px 3px 4px",
      "2.5px 0px",
      "2em 0px",
      "0px; color: red",
      "10000px 0px",
      2,
    ]) {
      expect(post(file, { ...offset, value }, ORIGIN).status).toBe(400);
      expect(readFileSync(file, "utf8")).toBe(SAVED);
    }
    expect(post(file, { ...offset, value: "-7px 13px" }, ORIGIN).status).toBe(200);
    expect(readValues(readFileSync(file, "utf8"), "").saved[CARD]).toEqual({
      translate: "-7px 13px",
    });
    expect(post(file, { ...offset, value: null, was: "-7px 13px" }, ORIGIN).status).toBe(200);
    expect(readFileSync(file, "utf8")).toBe(SAVED);
    expect(post(file, { ...offset, selector: ":root", value: "0px 0px" }, ORIGIN).status).toBe(400);
  });

  // Each type property: one value it saves, and one it refuses.
  test.each([
    ["font-weight", "550", "1001"],
    ["font-style", "italic", "oblique"],
    ["font-size", "var(--text-lg)", "var(--text-5xl)"],
    ["font-size", "15px", "15.5px"],
    ["font-size", "var(--text-lg)", "var(--text-lg); color: red"],
    ["line-height", "28px", "0px"],
    ["letter-spacing", "-0.005em", "-0.0005em"],
    ["letter-spacing", "2em", "2.5em"],
    ["text-align", "center", "justify"],
    ["align-content", "end", "space-between"],
  ])("saves and resets %s %s, and refuses %s", (name, value, refused) => {
    const file = overrideFile(SAVED);
    const type = { selector: CARD, name, was: null };
    expect(post(file, { ...type, value: refused }, ORIGIN).status).toBe(400);
    expect(readFileSync(file, "utf8")).toBe(SAVED);
    expect(post(file, { ...type, value }, ORIGIN).status).toBe(200);
    expect(readFileSync(file, "utf8")).toBe(`${SAVED}${CARD} {\n  ${name}: ${value};\n}\n`);
    expect(post(file, { ...type, value: null, was: value }, ORIGIN).status).toBe(200);
    expect(readFileSync(file, "utf8")).toBe(SAVED);
  });

  test("refuses a type property on :root and a property off the list", () => {
    const file = overrideFile(SAVED);
    expect(post(file, { ...RADIUS, name: "font-size", value: "15px" }, ORIGIN).status).toBe(400);
    const color = { selector: CARD, name: "color", value: "red", was: null };
    expect(post(file, color, ORIGIN).status).toBe(400);
    expect(readFileSync(file, "utf8")).toBe(SAVED);
  });

  test.each(REFUSALS)("refuses %s and writes nothing", (_, change, origin, status) => {
    const file = overrideFile(SAVED);
    const body = { ...RADIUS, value: "8px", was: "20px", ...change };
    expect(post(file, body, origin).status).toBe(status);
    expect(readFileSync(file, "utf8")).toBe(SAVED);
  });

  test("refuses a body that is not JSON", () => {
    const file = overrideFile(SAVED);
    expect(writeValue(file, { origin: ORIGIN, host: HOST, body: "{" }).status).toBe(400);
    expect(readFileSync(file, "utf8")).toBe(SAVED);
  });
});

test("readValues reads each token's baseline and override, and each element's values", () => {
  const tokens = ":root {\n  --btn-radius: 4px;\n  --window-radius: 12px; /* the window */\n}\n";
  expect(readValues(`${SAVED}${CARD} {\n  gap: 22px;\n}\n`, tokens)).toEqual({
    tokens: { "--window-radius": { baseline: "12px", override: "20px" } },
    saved: { [CARD]: { gap: "22px" } },
  });
  const empty = readValues(`${HEADER}:root {\n}\n`, tokens);
  expect(empty.tokens["--window-radius"]?.override).toBeNull();
  expect(empty.saved).toEqual({});
});
