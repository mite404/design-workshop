import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  discardValues,
  installFont,
  listThemes,
  readValues,
  saveTheme,
  writeValue,
} from "./plugin";

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
  ["a malformed restoration position", { at: [1, -1] }, ORIGIN, 400],
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
  test("colour releases stay in their mode and reject non-opaque or non-colour values", () => {
    const file = overrideFile(SAVED);
    for (const [selector, value] of [
      [':root[data-theme="light"]', "#abcdef"],
      [':root[data-theme="dark"]', "#123456"],
    ]) {
      expect(post(file, { selector, name: "--paper", value, was: null }, ORIGIN).status).toBe(200);
    }
    const saved = readFileSync(file, "utf8");
    expect(saved).toContain("--paper: #abcdef;");
    expect(saved).toContain("--paper: #123456;");
    for (const [name, value] of [
      ["--paper", "#abcdef88"],
      ["--paper", "red"],
      ["--paper", "#abc"],
      ["--rule", "#abcdef"],
      ["--window-radius", "#abcdef"],
    ]) {
      expect(
        post(file, { selector: ':root[data-theme="dark"]', name, value, was: null }, ORIGIN).status,
      ).toBe(400);
      expect(readFileSync(file, "utf8")).toBe(saved);
    }
    expect(
      post(file, { selector: ":root", name: "--paper", value: "#abcdef", was: null }, ORIGIN)
        .status,
    ).toBe(400);
  });

  test("undoing a deletion restores its original position, not the end of the file", () => {
    const original = `${SAVED}${CARD} {\n  gap: 22px;\n  padding-left: 6px;\n}\nbody {\n  gap: 2px;\n}\n`;
    const file = overrideFile(original);
    expect(
      post(file, { selector: CARD, name: "gap", value: null, was: "22px" }, ORIGIN).status,
    ).toBe(200);
    expect(
      post(file, { selector: CARD, name: "gap", value: "22px", was: null, at: [1, 0] }, ORIGIN)
        .status,
    ).toBe(200);
    expect(readFileSync(file, "utf8")).toBe(original);
  });

  test("a multi-value release refuses a late conflict without writing earlier values", () => {
    const file = overrideFile(SAVED);
    const batch = [
      { ...RADIUS, value: "8px", was: "20px" },
      { selector: CARD, name: "padding-left", value: "6px", was: "2px" },
    ];
    expect(post(file, batch, ORIGIN).status).toBe(409);
    expect(readFileSync(file, "utf8")).toBe(SAVED);
    expect(
      post(
        file,
        [batch[0], { selector: CARD, name: "padding-left", value: "6px", was: null }],
        ORIGIN,
      ).status,
    ).toBe(200);
    expect(readFileSync(file, "utf8")).toBe(
      `${SAVED.replace("20px", "8px")}${CARD} {\n  padding-left: 6px;\n}\n`,
    );
  });

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
    ["text-align", "justify", "start"],
    ["align-content", "end", "space-between"],
    ["text-decoration-line", "line-through", "overline"],
    ["text-transform", "capitalize", "full-width"],
    ["font-variant-caps", "small-caps", "all-small-caps"],
    ["text-box", "trim-both cap alphabetic", "trim-both ex alphabetic"],
    ["list-style-type", "decimal", "circle"],
    ["list-style-position", "inside", "outside"],
    ["display", "list-item", "none"],
    ["margin-bottom", "0px", "-4px"],
    ["margin-bottom", "12px", "1.5px"],
    ["font-family", '"Newsreader", serif', '"Newsreader"; } body { color: red } a { b: "c", serif'],
    ["font-family", '"Inter Variable", sans-serif', '"Inter */ x", sans-serif'],
    ["font-family", '"Fira Code", monospace', '"Fira Code", cursive'],
    ["font-family", '"Fira Code", monospace', "Fira Code, monospace"],
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

  test("sets the Template's two fonts on :root", () => {
    const file = overrideFile(SAVED);
    const text = { selector: ":root", name: "--font-text", value: '"Lora", serif', was: null };
    expect(post(file, { ...text, value: "Lora; color: red" }, ORIGIN).status).toBe(400);
    expect(post(file, text, ORIGIN).status).toBe(200);
    expect(readFileSync(file, "utf8")).toBe(SAVED.replace("}", '  --font-text: "Lora", serif;\n}'));
    expect(post(file, { ...text, name: "--font-mono" }, ORIGIN).status).toBe(400);
  });

  // The type scale's three values on :root (ETH-109): one each saves, and those each refuses.
  test.each([
    ["--type-base", "14px", ["13px", "2px", "98px", "14.5px", "1.4rem", "Infinity"]],
    ["--type-ratio", "1.333", ["1", "0.8", "3.5", "1.2345", "NaN", "1.2; color: red"]],
    ["--type-leading", "1.35", ["0.95", "3.05", "1.333", "-1.3", "1.3px"]],
  ])("saves and resets %s %s on :root, and refuses %j", (name, value, refused) => {
    const file = overrideFile(SAVED);
    const scale = { selector: ":root", name, was: null };
    for (const v of refused) expect(post(file, { ...scale, value: v }, ORIGIN).status).toBe(400);
    expect(post(file, { ...scale, selector: CARD, value }, ORIGIN).status).toBe(400);
    expect(readFileSync(file, "utf8")).toBe(SAVED);
    expect(post(file, { ...scale, value }, ORIGIN).status).toBe(200);
    expect(readFileSync(file, "utf8")).toBe(SAVED.replace("}", `  ${name}: ${value};\n}`));
    expect(post(file, { ...scale, value: null, was: value }, ORIGIN).status).toBe(200);
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
    colours: {},
    tokens: {
      "--window-radius": { baseline: "12px", override: "20px" },
      "--font-text": { baseline: null, override: null },
      "--font-display": { baseline: null, override: null },
      "--type-base": { baseline: null, override: null },
      "--type-ratio": { baseline: null, override: null },
      "--type-leading": { baseline: null, override: null },
    },
    saved: { [CARD]: { gap: "22px" } },
  });
  const empty = readValues(`${HEADER}:root {\n}\n`, tokens);
  expect(empty.tokens["--window-radius"]?.override).toBeNull();
  expect(empty.saved).toEqual({});
});

test("discard restores HEAD rather than the index, and old-commit writes are refused", () => {
  const file = overrideFile(SAVED);
  const cwd = path.dirname(file);
  const git = (...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" });
  git("init", "--quiet");
  git("add", "overrides.css");
  git(
    "-c",
    "user.name=Workbench test",
    "-c",
    "user.email=test@example.test",
    "commit",
    "--quiet",
    "-m",
    "baseline",
  );
  const head = git("rev-parse", "HEAD").trim();
  writeFileSync(file, SAVED.replace("20px", "8px"));
  git("add", "overrides.css");
  const index = git("show", ":overrides.css");
  const request = { origin: ORIGIN, host: HOST, body: "" };
  expect(discardValues(file, { ...request, origin: "http://evil.test" }).status).toBe(403);
  expect(readFileSync(file, "utf8")).toBe(index);
  expect(
    writeValue(file, {
      ...request,
      body: JSON.stringify({
        head: "outdated",
        changes: [{ ...RADIUS, value: "4px", was: "8px" }],
      }),
    }).status,
  ).toBe(409);
  expect(readFileSync(file, "utf8")).toBe(index);
  expect(
    writeValue(file, {
      ...request,
      body: JSON.stringify({ head, changes: [{ ...RADIUS, value: "4px", was: "8px" }] }),
    }).status,
  ).toBe(200);
  expect(discardValues(file, request).status).toBe(200);
  expect(readFileSync(file, "utf8")).toBe(SAVED);
  expect(git("show", ":overrides.css")).toBe(index);
  expect(readdirSync(cwd).toSorted()).toEqual([".git", "overrides.css"]);
});

const CDN = "https://cdn.jsdelivr.net";
const API = "https://api.fontsource.org/v1";
const latin = (url: string) => ({
  latin: { url: { woff2: url } },
  "latin-ext": { url: { woff2: "x" } },
});
const NEWSREADER = {
  id: "newsreader",
  family: "Newsreader",
  category: "serif",
  variable: true,
  weights: [200, 400, 800],
  styles: ["italic", "normal"],
  defSubset: "latin",
  npmVersion: "5.3.0",
  variants: {},
};
const ABEEZEE = {
  ...NEWSREADER,
  id: "abeezee",
  family: "ABeeZee",
  category: "sans-serif",
  variable: false,
  weights: [400],
  variants: {
    "400": {
      italic: latin(`${CDN}/fontsource/fonts/abeezee@5.3.0/latin-400-italic.woff2`),
      normal: latin(`${CDN}/fontsource/fonts/abeezee@5.3.0/latin-400-normal.woff2`),
    },
  },
};
const FONTS_HEADER = "/* the Workbench's fonts */\n";

// Stubs fetch with Fontsource's API for the two fonts and a file for every other address,
// `size` bytes long, and returns the addresses fetched. A font answers at its `at`, else its ID.
// An address under /redirect/ redirects as a real fetch would: it follows unless told not to.
function fontsource(fonts: Record<string, unknown>[], size = 8): string[] {
  const asked: string[] = [];
  const reply = (url: string): Response => {
    const font = fonts.find((f) => url === `${API}/fonts/${String(f.at ?? f.id)}`);
    if (font !== undefined) return Response.json(font);
    if (url.startsWith(`${API}/variable/`)) {
      return Response.json({ axes: { wght: { min: "200", max: "800" } } });
    }
    if (url.startsWith(API)) return new Response("{}", { status: 404 });
    return new Response(new Uint8Array(size).fill(65));
  };
  vi.stubGlobal("fetch", (to: string | URL, init?: RequestInit) => {
    const url = String(to);
    asked.push(url);
    if (url.includes("/redirect/") && init?.redirect === "error") {
      return Promise.reject(new TypeError("fetch failed: unexpected redirect"));
    }
    return Promise.resolve(reply(url));
  });
  return asked;
}

function catalog(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "catalog-"));
  writeFileSync(path.join(dir, "fonts.css"), FONTS_HEADER);
  return dir;
}

const install = (dir: string, id: unknown, origin = ORIGIN) =>
  installFont(dir, { origin, host: HOST, body: JSON.stringify({ id }) });

describe("installFont", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("copies a variable font's axis files, its licence and its rules", async () => {
    const asked = fontsource([NEWSREADER]);
    const dir = catalog();
    const reply = await install(dir, "newsreader");
    expect(reply).toEqual({ status: 200, body: { id: "newsreader", family: "Newsreader" } });
    expect(readdirSync(path.join(dir, "fonts/newsreader")).toSorted()).toEqual([
      "LICENSE",
      "latin-wght-italic.woff2",
      "latin-wght-normal.woff2",
    ]);
    expect(asked).toContain(`${CDN}/fontsource/fonts/newsreader:vf@5.3.0/latin-wght-italic.woff2`);
    expect(asked).toContain(`${CDN}/npm/@fontsource/newsreader@5.3.0/LICENSE`);
    const css = readFileSync(path.join(dir, "fonts.css"), "utf8");
    expect(css.startsWith(`${FONTS_HEADER}/* fontsource: newsreader */\n@font-face {`)).toBe(true);
    expect(css).toContain(
      '  font-family: "Newsreader";\n  font-style: normal;\n  font-display: swap;\n' +
        '  font-weight: 200 800;\n  src: url("./fonts/newsreader/latin-wght-normal.woff2") format("woff2");\n',
    );
    expect(css.match(/@font-face/g)).toHaveLength(2);
  });

  test("copies one file per weight and style of a font with separate weights", async () => {
    fontsource([ABEEZEE]);
    const dir = catalog();
    expect((await install(dir, "abeezee")).status).toBe(200);
    expect(readdirSync(path.join(dir, "fonts/abeezee")).toSorted()).toEqual([
      "LICENSE",
      "latin-400-italic.woff2",
      "latin-400-normal.woff2",
    ]);
    const css = readFileSync(path.join(dir, "fonts.css"), "utf8");
    expect(css).toContain(
      'font-weight: 400;\n  src: url("./fonts/abeezee/latin-400-italic.woff2")',
    );
    expect(css).not.toContain("latin-ext");
  });

  test("a second request for the same font fetches and changes nothing", async () => {
    fontsource([ABEEZEE]);
    const dir = catalog();
    await install(dir, "abeezee");
    const css = readFileSync(path.join(dir, "fonts.css"), "utf8");
    const asked = fontsource([ABEEZEE]);
    expect(await install(dir, "abeezee")).toEqual({
      status: 200,
      body: { id: "abeezee", family: "ABeeZee" },
    });
    expect(asked).toEqual([]);
    expect(readFileSync(path.join(dir, "fonts.css"), "utf8")).toBe(css);
  });

  test.each([["../etc"], ["Inter"], ["a--b"], ["-a"], ["a".repeat(65)], [7], [null]])(
    "refuses the ID %s without fetching",
    async (id) => {
      const asked = fontsource([ABEEZEE]);
      const dir = catalog();
      expect((await install(dir, id)).status).toBe(400);
      expect(asked).toEqual([]);
      expect(readdirSync(dir)).toEqual(["fonts.css"]);
    },
  );

  test("refuses a foreign origin", async () => {
    const asked = fontsource([ABEEZEE]);
    expect((await install(catalog(), "abeezee", "http://evil.test")).status).toBe(403);
    expect(asked).toEqual([]);
  });

  test("refuses a file on another host and writes nothing", async () => {
    const evil = structuredClone(ABEEZEE);
    evil.variants["400"].normal = latin("https://evil.test/latin-400-normal.woff2");
    const asked = fontsource([evil]);
    const dir = catalog();
    const reply = await install(dir, "abeezee");
    expect(reply.status).toBe(502);
    expect(asked.some((u) => u.startsWith("https://evil.test"))).toBe(false);
    expect(readdirSync(dir)).toEqual(["fonts.css"]);
    expect(readFileSync(path.join(dir, "fonts.css"), "utf8")).toBe(FONTS_HEADER);
  });

  // Each unsafe upstream reply for abeezee: its default subset, the ID it names, and its file.
  const FILE = `${CDN}/fontsource/fonts/abeezee@5.3.0/latin-400-normal.woff2`;
  test.each([
    ["a subset that climbs out of the folder", "../escaped", "abeezee", FILE],
    ["details for another ID", "latin", "probe", FILE],
    ["a file over plain HTTP", "latin", "abeezee", FILE.replace("https:", "http:")],
    ["a file that redirects", "latin", "abeezee", `${CDN}/redirect/latin-400-normal.woff2`],
  ])("refuses %s and writes nothing", async (_, defSubset, id, file) => {
    const font = {
      ...ABEEZEE,
      id,
      at: "abeezee",
      defSubset,
      variants: { "400": { normal: { [defSubset]: { url: { woff2: file } } } } },
    };
    const asked = fontsource([font]);
    const dir = catalog();
    expect((await install(dir, "abeezee")).status).toBe(502);
    expect(readdirSync(dir)).toEqual(["fonts.css"]);
    expect(readFileSync(path.join(dir, "fonts.css"), "utf8")).toBe(FONTS_HEADER);
    expect(asked.some((u) => u.startsWith("http://"))).toBe(false);
  });

  test("refuses a file over 5 MB and writes nothing", async () => {
    fontsource([ABEEZEE], 5 * 1024 * 1024 + 1);
    const dir = catalog();
    expect((await install(dir, "abeezee")).status).toBe(502);
    expect(existsSync(path.join(dir, "fonts"))).toBe(false);
    expect(readFileSync(path.join(dir, "fonts.css"), "utf8")).toBe(FONTS_HEADER);
  });

  test("refuses a font Fontsource does not have", async () => {
    fontsource([]);
    const dir = catalog();
    mkdirSync(path.join(dir, "fonts"));
    expect((await install(dir, "nope")).status).toBe(502);
    expect(readdirSync(path.join(dir, "fonts"))).toEqual([]);
  });
});

// A theme file setting only the accent.
const theme = (name: string, light = "#112233") =>
  JSON.stringify({
    format: "design-workshop/theme",
    version: 1,
    name,
    colours: { accent: { light, dark: "#445566" } },
  });

test("saveTheme writes a new theme file only, refusing taken names and bad themes", () => {
  const root = mkdtempSync(path.join(tmpdir(), "themes-"));
  const [bundled, saved] = [path.join(root, "bundled"), path.join(root, "saved")];
  mkdirSync(bundled);
  writeFileSync(path.join(bundled, "house.theme.json"), theme("house"));
  const save = (body: string, origin = ORIGIN) =>
    saveTheme([bundled, saved], { origin, host: HOST, body });

  expect(save(theme("mine")).status).toBe(200);
  expect(listThemes([bundled, saved]).map((t) => t.name)).toEqual(["house", "mine"]);
  expect(listThemes([saved])[0]?.colours?.accent).toEqual({ light: "#112233", dark: "#445566" });
  // Neither a bundled nor a saved name is replaced.
  expect(save(theme("house", "#000000")).status).toBe(409);
  expect(save(theme("mine", "#000000")).status).toBe(409);
  expect(listThemes([saved])[0]?.colours?.accent?.light).toBe("#112233");
  expect(save(theme("../escape")).status).toBe(400);
  expect(save(theme("other"), "http://evil.test").status).toBe(403);
  expect(readdirSync(saved)).toEqual(["mine.theme.json"]);
});
