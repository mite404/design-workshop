import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { readValues, writeValue } from "./plugin";

const HEADER = "/* Written by the Workbench. One design value per line. Do not edit by hand. */\n";
const SAVED = `${HEADER}:root {\n  --window-radius: 20px;\n}\n`;
const HOST = "localhost:5173";
const ORIGIN = `http://${HOST}`;

// Each refusal: what it changes in a good request to the saved file, its origin, and its status.
const REFUSALS: [string, Record<string, unknown>, string | undefined, number][] = [
  ["a foreign origin", {}, "http://evil.test", 403],
  ["no origin", {}, undefined, 403],
  ["an opaque origin", {}, "null", 403],
  ["a lookalike origin", {}, `${ORIGIN}.evil.test`, 403],
  ["a name off the list", { name: "--space", was: null }, ORIGIN, 400],
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
    expect(post(file, { name: "--window-radius", value: "20px", was: null }, ORIGIN).status).toBe(
      200,
    );
    expect(readFileSync(file, "utf8")).toBe(SAVED);
    expect(post(file, { name: "--window-radius", value: "8px", was: "20px" }, ORIGIN).status).toBe(
      200,
    );
    expect(readFileSync(file, "utf8")).toBe(SAVED.replace("20px", "8px"));
    expect(post(file, { name: "--window-radius", value: null, was: "8px" }, ORIGIN).status).toBe(
      200,
    );
    expect(readFileSync(file, "utf8")).toBe(`${HEADER}:root {\n}\n`);
    expect(readdirSync(path.dirname(file))).toEqual(["overrides.css"]);
  });

  test.each(REFUSALS)("refuses %s and writes nothing", (_, change, origin, status) => {
    const file = overrideFile(SAVED);
    const body = { name: "--window-radius", value: "8px", was: "20px", ...change };
    expect(post(file, body, origin).status).toBe(status);
    expect(readFileSync(file, "utf8")).toBe(SAVED);
  });

  test("refuses a body that is not JSON", () => {
    const file = overrideFile(SAVED);
    expect(writeValue(file, { origin: ORIGIN, host: HOST, body: "{" }).status).toBe(400);
    expect(readFileSync(file, "utf8")).toBe(SAVED);
  });
});

test("readValues reads each editable name's baseline and override", () => {
  const tokens = ":root {\n  --btn-radius: 4px;\n  --window-radius: 12px; /* the window */\n}\n";
  expect(readValues(SAVED, tokens)).toEqual({
    "--window-radius": { baseline: "12px", override: "20px" },
  });
  expect(readValues(`${HEADER}:root {\n}\n`, tokens)["--window-radius"]?.override).toBeNull();
});
