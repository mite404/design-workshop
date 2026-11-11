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
