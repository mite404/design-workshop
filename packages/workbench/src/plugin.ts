// The Workbench's server half, run by `design-workshop dev` in its own Vite (ADR-043): its page
// at /__workbench/, the endpoint that writes the override file (ADR-002), and the one that copies
// a Google font into the repo (ADR-021). `apply: "serve"` keeps them all out of a build.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  watch,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin, ViteDevServer } from "vite";
import { commitLook, committing, previewCommit } from "./commit.ts";
import {
  FONT_HOST,
  FONTS_HEADER,
  fontFiles,
  fontRules,
  isFamilyValue,
  isFontId,
  licenseUrl,
  marker,
  MAX_FILE,
  parseDetails,
} from "./fonts.ts";
import { parseOverrides, setOverride } from "./overrides.ts";
import { isPosition, type Change } from "./history.ts";
import { isSelector } from "./selector.ts";
import { SPACING } from "./spacing.ts";
import { EASE, parseBezier } from "./motion.ts";
import { isScale, isType, SCALE, scaleValue, TYPE, typeValue } from "./type.ts";
import { COLOUR_ROOT, colourTokens, HEX } from "./colour.ts";
import { parseTheme, roleMapOf, TEMPLATE_MAP, type RoleMap, type Theme } from "./theme.ts";
import { exportProject, readSources } from "./project.ts";
import { parseConfig } from "./config.ts";

const BUNDLED_THEMES = fileURLToPath(new URL("../themes/", import.meta.url));

// The files the Workbench reads and writes: the override file, the tokens file its baselines
// come from (null for a host, which has none, ADR-044), the folder its fonts go in, and its
// theme folders, bundled first; it saves themes to the last.
type Files = {
  overrides: string;
  tokens: string | null;
  fonts: string;
  canvas: string;
  themes: string[];
  map: RoleMap;
};

/**
 * A host's files: under its `.workbench/` at `root`, and the tokens file its config names, if
 * any (PRD section 16, ADR-044, ADR-045).
 * @throws When `.workbench/config.json` is missing or refused.
 */
export function hostFiles(root: string): Files {
  const { tokens, fonts, canvas, roles, colourSelectors } = parseConfig(
    readFileSync(join(root, ".workbench", "config.json"), "utf8"),
  );
  const file = tokens === null ? null : join(root, tokens);
  // An app without `roles` has the Template's names, so its tokens file holds its palette.
  const palette = roles === null && file !== null ? colourTokens(readFileSync(file, "utf8")) : {};
  return {
    overrides: join(root, ".workbench", "overrides.css"),
    tokens: file,
    fonts: join(root, fonts ?? ".workbench"),
    canvas,
    themes: [BUNDLED_THEMES, join(root, ".workbench", "themes")],
    map: { ...roleMapOf(roles, colourSelectors), palette },
  };
}
const PAGE = fileURLToPath(new URL("./page.ts", import.meta.url));
const ROOT = ":root";
// The colour names `map` lets the Workbench write: its palette's editable ones and its roles'.
const colourNames = ({ palette = {}, colours }: RoleMap): string[] => [
  ...Object.keys(palette).filter((name) => palette[name]?.editable === true),
  ...Object.values(colours),
];
const EDITABLE = [
  "--window-radius",
  "--shell-side",
  "--motion-hover",
  EASE,
  "--font-text",
  "--font-display",
  ...SCALE,
];
const PX = /^\d{1,4}px$/;
const MS = /^\d{1,4}ms$/;
const TRANSLATE = /^-?\d{1,4}px -?\d{1,4}px$/;

// One answer: its HTTP status, and a page as a string or anything else as JSON.
type Reply = { status: number; body: unknown };

// The page, telling its script which app page the canvas opens on.
const pageHtml = (canvas: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="workbench-canvas" content="${canvas.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}" />
    <title>Workbench</title>
    <script type="module" src="/@fs${PAGE}"></script>
  </head>
  <body></body>
</html>
`;

function baseline(tokens: string, name: string): string | null {
  return new RegExp(`^\\s*${name}: ([^;]+);`, "m").exec(tokens)?.[1] ?? null; // → "12px"
}

/**
 * Each editable `:root` name's baseline (tokens.css) and override values, and every element's
 * saved values by selector, so the page can list those that match no element.
 */
export function readValues(
  overrides: string,
  tokens: string,
  map: RoleMap = TEMPLATE_MAP,
): {
  tokens: Record<string, { baseline: string | null; override: string | null }>;
  colours: ReturnType<typeof colourTokens>;
  saved: Record<string, Record<string, string>>;
} {
  const blocks = parseOverrides(overrides);
  const root = blocks.get(ROOT);
  return {
    // The Template's colours, else the app's role colours (PRD section 13).
    colours: Object.fromEntries(
      Object.entries(colourTokens(tokens)).filter(
        ([name]) =>
          Object.hasOwn(map.palette ?? {}, name) || Object.values(map.colours).includes(name),
      ),
    ),
    tokens: Object.fromEntries(
      EDITABLE.map((n) => [n, { baseline: baseline(tokens, n), override: root?.get(n) ?? null }]),
    ),
    saved: Object.fromEntries(
      [...blocks].filter(([s]) => s !== ROOT).map(([s, v]) => [s, Object.fromEntries(v)]),
    ),
  };
}

// A POST body, checked: a selector, one name it may set, the new value or null, and the value
// last read.
type Write = {
  selector: string;
  name: string;
  value: string | null;
  was: string | null;
  at?: Change["at"];
};

// `:root` takes the editable tokens; an element, by a selector of the grammar its function
// makes, takes gap, the four paddings, a two-dimensional offset and the type properties.
// The app's role map adds its own names: type roles on `:root`, colour roles in its light and
// dark selectors, which may be `:root` itself, as shadcn's light one is.
function namesOf(selector: string, map: RoleMap = TEMPLATE_MAP): readonly string[] {
  const colours = colourNames(map);
  const names = [
    ...(selector === ROOT ? [...EDITABLE, ...Object.values(map.type)] : []),
    ...([COLOUR_ROOT.light, COLOUR_ROOT.dark, map.light, map.dark].includes(selector)
      ? colours
      : []),
  ];
  if (names.length > 0) return [...new Set(names)];
  return isSelector(selector) ? [...SPACING, "translate", ...TYPE] : [];
}
// The keyword and motion tokens' checks: the shell's side, left or right only (ADR-041); a
// duration in whole ms and an easing as a cubic-bezier (ADR-038, ADR-039).
const ROOT_CHECKS: Record<string, (v: string) => boolean> = {
  "--shell-side": (v) => v === "left" || v === "right",
  "--motion-hover": (v) => MS.test(v),
  [EASE]: (v) => parseBezier(v) !== null,
};
// The check a value of `name` must pass: a hex for any colour, the Template's or the app's.
function checkOf(name: string, map: RoleMap): (v: string) => boolean {
  if (colourNames(map).includes(name)) return (v) => HEX.test(v);
  if (isType(name)) return (v) => typeValue(name, v);
  if (isScale(name)) return (v) => scaleValue(name, v);
  if (name.startsWith("--font-")) return isFamilyValue;
  return ROOT_CHECKS[name] ?? ((v) => (name === "translate" ? TRANSLATE : PX).test(v));
}
function isValue(v: unknown, name: string, map: RoleMap): v is string | null {
  return v === null || (typeof v === "string" && checkOf(name, map)(v));
}
const isWas = (v: unknown): v is string | null => v === null || typeof v === "string";

function json(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const field = (input: unknown, key: string): unknown =>
  typeof input === "object" && input !== null ? Reflect.get(input, key) : undefined;

function parseWrite(input: unknown, map: RoleMap): Write | string {
  const [selector, name, value, was] = ["selector", "name", "value", "was"].map((key) =>
    field(input, key),
  );
  if (
    typeof selector !== "string" ||
    typeof name !== "string" ||
    !namesOf(selector, map).includes(name)
  ) {
    return `not an editable selector and name: ${JSON.stringify([selector, name])}`;
  }
  if (!isValue(value, name, map)) {
    return `not a value ${name} takes: ${JSON.stringify(value)}`;
  }
  if (!isWas(was)) return "was must be a string or null";
  const at = field(input, "at");
  if (at !== undefined && !isPosition(at)) return "invalid declaration position";
  return { selector, name, value, was, ...(at === undefined ? {} : { at }) };
}

function parseRelease(input: unknown, map: RoleMap): Write[] | string {
  const release = field(input, "changes") ?? input;
  const batch: unknown[] = Array.isArray(release) ? release : [release];
  if (batch.length === 0) return "empty release";
  const writes: Write[] = [];
  for (const item of batch) {
    const write = parseWrite(item, map);
    if (typeof write === "string") return write;
    writes.push(write);
  }
  return writes;
}

// A POST to an endpoint: its Origin and Host headers and its body.
type Post = { origin: string | undefined; host: string | undefined; body: string };

const FOREIGN: Reply = {
  status: 403,
  body: { error: "only the Workbench's own origin may write" },
};
const foreign = ({ origin, host }: Post): boolean =>
  host === undefined || URL.parse(origin ?? "")?.host !== host;

/**
 * Sets one editable value or an entire release atomically in the override file at `file`.
 * A null removes a value. Refuses, writing nothing, a foreign `origin` (403), a
 * selector off the grammar, a name it may not set or a value its name's check refuses (400),
 * and a `was` that is not the value now on disk (409).
 * @throws When the override file cannot be read, parsed or replaced, or Git cannot read HEAD.
 */
export function writeValue(file: string, request: Post, map: RoleMap = TEMPLATE_MAP): Reply {
  if (foreign(request)) return FOREIGN;
  return writeValues(file, json(request.body), map);
}

/**
 * Saves a validated release without HTTP origin handling, for the route and command line.
 * Refuses invalid input (400) and stale values or revisions (409), writing nothing.
 * @throws When the override file cannot be read, parsed or replaced, or Git cannot read HEAD.
 */
export function writeValues(file: string, input: unknown, map: RoleMap = TEMPLATE_MAP): Reply {
  const head = field(input, "head");
  if (head !== undefined && head !== revision(file)) {
    return { status: 409, body: { error: "the last commit changed; history was cleared" } };
  }
  const writes = parseRelease(input, map);
  if (typeof writes === "string") return { status: 400, body: { error: writes } };
  let text = readFileSync(file, "utf8");
  const changes: Change[] = [];
  for (const write of writes) {
    const blocks = parseOverrides(text);
    const now = blocks.get(write.selector)?.get(write.name) ?? null;
    if (now !== write.was) {
      return { status: 409, body: { error: "the override file changed since it was read", now } };
    }
    const at: Change["at"] =
      now === null
        ? undefined
        : [
            [...blocks.keys()].indexOf(write.selector),
            [...(blocks.get(write.selector)?.keys() ?? [])].indexOf(write.name),
          ];
    changes.push({
      selector: write.selector,
      name: write.name,
      before: now,
      after: write.value,
      ...(at === undefined ? {} : { at }),
    });
    text = setOverride(text, write.selector, write.name, write.value, write.at);
  }
  replace(file, text);
  return { status: 200, body: { changes } };
}

/**
 * Checks file shape and the route's selector, name and value rules without writing.
 * @throws With the offending line when a block or value is not writable by the Workbench.
 */
export function checkValues(text: string, map: RoleMap = TEMPLATE_MAP): void {
  const blocks = parseOverrides(text);
  const lines = text.split("\n");
  for (const [selector, values] of blocks) {
    const open = lines.indexOf(`${selector} {`);
    if (namesOf(selector, map).length === 0) {
      throw new Error(`override file line ${open + 1}: not an editable selector: ${selector}`);
    }
    for (const [name, value] of values) {
      const checked = parseWrite({ selector, name, value, was: null }, map);
      if (typeof checked === "string") {
        const at = lines.indexOf(`  ${name}: ${value};`, open);
        throw new Error(`override file line ${at + 1}: ${checked}`);
      }
    }
  }
}

function listedBaseline(
  values: ReturnType<typeof readValues>,
  selector: string,
  name: string,
): string | null {
  if (selector === ROOT) return values.tokens[name]?.baseline ?? null;
  const colour = values.colours[name];
  if (colour === undefined) return null;
  if (selector === COLOUR_ROOT.light) return colour.light;
  if (selector === COLOUR_ROOT.dark) return colour.dark;
  return null;
}

/**
 * Lists editable root tokens, mode colours and each saved element selector's editable names.
 * Element baselines are null because their cascade needs a browser.
 * @throws When the override file is malformed.
 */
export function listValues(
  overrides: string,
  tokens: string,
  map: RoleMap = TEMPLATE_MAP,
): {
  selector: string;
  name: string;
  baseline: string | null;
  saved: string | null;
}[] {
  const blocks = parseOverrides(overrides);
  const values = readValues(overrides, tokens, map);
  const selectors = new Set([ROOT, ...Object.values(COLOUR_ROOT), ...blocks.keys()]);
  return [...selectors].flatMap((selector) =>
    namesOf(selector, map).map((name) => ({
      selector,
      name,
      baseline: listedBaseline(values, selector, name),
      saved: blocks.get(selector)?.get(name) ?? null,
    })),
  );
}

function committed(file: string): string {
  return execFileSync("git", ["show", `HEAD:./${basename(file)}`], {
    cwd: dirname(file),
    encoding: "utf8",
  });
}

function revision(file: string): string {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: dirname(file),
    encoding: "utf8",
  }).trim();
}

function historyStatus(file: string): { head: string; dirty: boolean } {
  return {
    head: revision(file),
    dirty: readFileSync(file, "utf8") !== committed(file),
  };
}

/**
 * Restores only the override file from HEAD, without changing the index. Refuses foreign origins.
 * @throws When Git cannot read the committed file, or the file cannot be replaced.
 */
export function discardValues(file: string, request: Post): Reply {
  if (foreign(request)) return FOREIGN;
  replace(file, committed(file));
  return { status: 200, body: { discarded: true } };
}

// Writes `text` to `file` through a temp file and a rename.
function replace(file: string, text: string | Buffer): void {
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, text);
  renameSync(temp, file);
}

// The family a saved font's rules name, read back from fonts.css under its marker.
const savedFamily = (css: string, id: string): string | undefined =>
  css.split(marker(id))[1]?.match(/font-family: "([^"]+)"/)?.[1];

// Every upstream fetch refuses a redirect, so a URL's host is the host that answers.
async function fetchJson(url: string): Promise<unknown> {
  try {
    const response = await fetch(url, { redirect: "error" });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

// The body of `response`, read until it passes MAX_FILE bytes, or null past it.
async function capped(response: Response): Promise<Buffer | null> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body ?? []) {
    size += chunk.length;
    if (size > MAX_FILE) {
      await response.body?.cancel();
      return null;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// A font file or licence over HTTPS from FONT_HOST, refused over MAX_FILE or on a redirect.
async function fetchFile(url: string): Promise<Buffer | string> {
  const parsed = URL.parse(url);
  if (parsed?.protocol !== "https:" || parsed.host !== FONT_HOST) {
    return `refused a file from another host: ${url}`;
  }
  try {
    const response = await fetch(parsed, { redirect: "error" });
    if (!response.ok) return `${response.status} for ${url}`;
    return (await capped(response)) ?? `too large: ${url}`;
  } catch (error) {
    return `${String(error)} for ${url}`;
  }
}

/** Every theme file in `folders` that parses, in folder then name order; others are skipped. */
export function listThemes(folders: string[]): Theme[] {
  return folders.flatMap((folder) =>
    existsSync(folder)
      ? readdirSync(folder)
          .filter((file) => file.endsWith(".theme.json"))
          .toSorted()
          .flatMap((file) => {
            const theme = parseTheme(readFileSync(join(folder, file), "utf8"));
            return typeof theme === "string" ? [] : [theme];
          })
      : [],
  );
}

/**
 * Saves the body, a theme file, as a new `<name>.theme.json` in the last of `folders`. Refuses a
 * foreign origin (403), a theme parseTheme refuses (400) and a name any folder already has
 * (409), writing nothing. Never replaces a file.
 * @throws When the folder cannot be created or written.
 */
export function saveTheme(folders: string[], request: Post): Reply {
  if (foreign(request)) return FOREIGN;
  const theme = parseTheme(request.body);
  if (typeof theme === "string") return { status: 400, body: { error: theme } };
  if (listThemes(folders).some((t) => t.name === theme.name))
    return { status: 409, body: { error: `A theme named ${theme.name} already exists.` } };
  const folder = folders.at(-1) ?? "";
  mkdirSync(folder, { recursive: true });
  const file = join(folder, `${theme.name}.theme.json`);
  writeFileSync(file, `${JSON.stringify(theme, null, 2)}\n`, { flag: "wx" });
  return { status: 200, body: { name: theme.name } };
}

/**
 * Copies the Google font with Fontsource ID `id` (the body's only field) into `folder`: its
 * woff2 files and LICENSE into `fonts/ID/`, then its `@font-face` rules onto `fonts.css` under a
 * marker, starting that file when it is not there yet. A font already there fetches nothing. Refuses a foreign `origin` (403), an ID off the
 * grammar (400), and details Fontsource does not give for `id` or with an unsafe subset, a file
 * not over HTTPS from FONT_HOST, a redirect, or a file over MAX_FILE (502), writing nothing.
 */
export async function installFont(folder: string, request: Post): Promise<Reply> {
  if (foreign(request)) return FOREIGN;
  const id: unknown = field(json(request.body), "id");
  if (!isFontId(id)) return { status: 400, body: { error: `not a Fontsource ID: ${String(id)}` } };
  const css = join(folder, "fonts.css");
  const target = join(folder, "fonts", id);
  const fontsCss = () => (existsSync(css) ? readFileSync(css, "utf8") : FONTS_HEADER);
  const saved = savedFamily(fontsCss(), id);
  if (saved !== undefined && existsSync(target))
    return { status: 200, body: { id, family: saved } };

  const api = `https://api.fontsource.org/v1`;
  const details = await fetchJson(`${api}/fonts/${id}`);
  const variable = field(details, "variable") === true;
  const font = parseDetails(details, variable ? await fetchJson(`${api}/variable/${id}`) : null);
  if (font?.id !== id) return { status: 502, body: { error: `Fontsource has no font ${id}` } };
  const files = fontFiles(font);
  const fetched = await Promise.all(
    [...files.map((f) => f.url), licenseUrl(font)].map((url) => fetchFile(url)),
  );
  const failed = fetched.find((f) => typeof f === "string");
  if (failed !== undefined || files.length === 0) {
    return { status: 502, body: { error: failed ?? `${id} has no woff2 files` } };
  }

  const temp = `${target}.${process.pid}.tmp`;
  rmSync(temp, { recursive: true, force: true });
  mkdirSync(temp, { recursive: true });
  for (const [i, bytes] of fetched.entries()) {
    writeFileSync(join(temp, files[i]?.name ?? "LICENSE"), bytes);
  }
  rmSync(target, { recursive: true, force: true });
  renameSync(temp, target);
  const now = fontsCss();
  if (savedFamily(now, id) === undefined) replace(css, `${now}${fontRules(font, files)}`);
  return { status: 200, body: { id, family: font.family } };
}

async function read(req: IncomingMessage): Promise<string> {
  let body = "";
  for await (const chunk of req) body += String(chunk);
  return body;
}

async function reload(server: ViteDevServer, file: string): Promise<void> {
  // The filesystem watcher drops changes within 50ms. Each accepted write still needs HMR.
  const client = server.environments.client;
  if (client === undefined) return;
  client.moduleGraph.onFileChange(file);
  await Promise.all(
    [...(client.moduleGraph.getModulesByFile(file) ?? [])].map((m) => client.reloadModule(m)),
  );
}

// Each writing endpoint: what it does with a POST, and the file it changes for hot reload.
type Writes = Record<string, { run: (post: Post) => Reply | Promise<Reply>; file: string }>;
const writesOf = ({ overrides, fonts, themes, map }: Files): Writes => ({
  "/__workbench/values": {
    run: (post) => {
      const reply = writeValue(overrides, post, map);
      return reply.status === 200
        ? {
            status: 200,
            body: { changes: field(reply.body, "changes"), ...historyStatus(overrides) },
          }
        : reply;
    },
    file: overrides,
  },
  "/__workbench/discard": { run: (post) => discardValues(overrides, post), file: overrides },
  "/__workbench/fonts": {
    run: (post) => installFont(fonts, post),
    file: join(fonts, "fonts.css"),
  },
  "/__workbench/themes": { run: (post) => saveTheme(themes, post), file: themes.at(-1) ?? "" },
});

// Each reading endpoint and the JSON it answers a GET with.
const readsOf = ({ overrides, tokens, themes, map }: Files): Record<string, () => unknown> => ({
  // Runs `storybook index`, so it takes seconds; asynchronously, so the dev server keeps serving.
  "/__workbench/project": exportProject,
  "/__workbench/values": () => ({
    ...readValues(
      readFileSync(overrides, "utf8"),
      tokens === null ? "" : readFileSync(tokens, "utf8"),
      map,
    ),
    ...historyStatus(overrides),
    roleMap: { roles: { ...map.colours, ...map.type }, light: map.light, dark: map.dark },
  }),
  "/__workbench/themes": () => ({ themes: listThemes(themes) }),
  "/__workbench/sources": readSources,
});

const PAGE_PATHS = new Set(["/__workbench", "/__workbench/"]);

// A Workbench route's reply, or null for any other path or method, which the next middleware
// serves: the Workbench's own Vite when it runs under /__workbench/ (ADR-043).
async function answer(
  server: ViteDevServer,
  req: IncomingMessage,
  routes: { reads: Record<string, () => unknown>; writes: Writes; file: string; page: string },
): Promise<Reply | null> {
  const path = (req.url ?? "").split("?")[0] ?? "";
  if (PAGE_PATHS.has(path))
    return { status: 200, body: await server.transformIndexHtml("/__workbench/", routes.page) };
  const reader = req.method === "GET" ? routes.reads[path] : undefined;
  if (reader !== undefined) return { status: 200, body: await reader() };
  const write = req.method === "POST" ? routes.writes[path] : undefined;
  return write === undefined ? null : answerWrite(server, req, write, routes.file);
}

async function answerWrite(
  server: ViteDevServer,
  req: IncomingMessage,
  write: Writes[string],
  overrides: string,
): Promise<Reply> {
  const body = await read(req);
  if (committing(overrides))
    return { status: 409, body: { error: "A commit is running. Cancel it before editing." } };
  const reply = await write.run({ origin: req.headers.origin, host: req.headers.host, body });
  if (reply.status === 200) await reload(server, write.file);
  return reply;
}

function sendReply(res: ServerResponse, { status, body }: Reply): void {
  const html = typeof body === "string";
  res.statusCode = status;
  res.setHeader("content-type", html ? "text/html" : "application/json");
  res.end(html ? body : JSON.stringify(body));
}

async function startCommit(
  server: ViteDevServer,
  req: IncomingMessage,
  res: ServerResponse,
  active: { controller: AbortController | null; file: string },
): Promise<void> {
  const input = json(await read(req));
  const head = field(input, "head");
  const source = field(input, "source");
  if (typeof head !== "string" || typeof source !== "string") {
    sendReply(res, { status: 400, body: { error: "Review the diff before committing." } });
    return;
  }
  if (committing(active.file)) {
    sendReply(res, { status: 409, body: { error: "A commit is already running." } });
    return;
  }
  const controller = new AbortController();
  active.controller = controller;
  res.on("close", () => {
    controller.abort();
  });
  res.writeHead(200, { "content-type": "application/x-ndjson", "cache-control": "no-store" });
  try {
    await commitLook(
      active.file,
      { head, source },
      (event) => {
        res.write(`${JSON.stringify(event)}\n`);
        if (event.kind === "success") server.ws.send({ type: "custom", event: "workbench:values" });
      },
      controller.signal,
    );
  } finally {
    active.controller = null;
  }
  res.end();
}

async function commitRoute(
  server: ViteDevServer,
  req: IncomingMessage,
  res: ServerResponse,
  active: { controller: AbortController | null; file: string },
): Promise<void> {
  if (req.method !== "POST") {
    sendReply(res, { status: 405, body: { error: "Use POST for commit actions." } });
    return;
  }
  if (foreign({ origin: req.headers.origin, host: req.headers.host, body: "" })) {
    sendReply(res, FOREIGN);
    return;
  }
  switch (req.url?.split("?")[0] ?? "") {
    case "/__workbench/commit/preview":
      sendReply(res, { status: 200, body: previewCommit(active.file) });
      return;
    case "/__workbench/commit/cancel":
      active.controller?.abort();
      sendReply(res, { status: 200, body: { requested: active.controller !== null } });
      return;
    case "/__workbench/commit":
      await startCommit(server, req, res, active);
      return;
    default:
      sendReply(res, { status: 404, body: { error: "Unknown commit action." } });
  }
}

// Answers a Workbench route, or hands the request on when the path is not one.
async function route(
  server: ViteDevServer,
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
  routes: Parameters<typeof answer>[2],
): Promise<void> {
  try {
    const reply = await answer(server, req, routes);
    if (reply === null) next();
    else sendReply(res, reply);
  } catch (error: unknown) {
    sendReply(res, { status: 500, body: { error: String(error) } });
  }
}

/**
 * The Workbench page and its endpoints, on the dev server only, editing `files`: this repo's own
 * by default, or another host's from `hostFiles`.
 */
export function workbench(files: Files): Plugin {
  let watcher: ReturnType<typeof watch> | undefined;
  const active = { controller: null as AbortController | null, file: files.overrides };
  const routes = {
    reads: readsOf(files),
    writes: writesOf(files),
    file: files.overrides,
    page: pageHtml(files.canvas),
  };
  return {
    name: "workbench",
    apply: "serve",
    closeBundle() {
      watcher?.close();
    },
    configureServer(server) {
      // Vite suppresses rapid changes. Watch the directory to also survive atomic file replacement.
      watcher = watch(dirname(files.overrides), (_event, file) => {
        if (file === basename(files.overrides))
          server.ws.send({ type: "custom", event: "workbench:values" });
      });
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith("/__workbench") !== true) {
          next();
          return;
        }
        if (req.url.startsWith("/__workbench/commit")) {
          void commitRoute(server, req, res, active).catch((error: unknown) => {
            if (res.headersSent) res.end();
            else sendReply(res, { status: 500, body: { error: String(error) } });
          });
          return;
        }
        void route(server, req, res, next, routes);
      });
    },
  };
}
