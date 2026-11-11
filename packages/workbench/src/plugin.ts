// The Workbench's dev-only half of the app's dev server: its page at /__workbench/, the endpoint
// that writes the override file (ADR-002), and the one that copies a Google font into the repo
// (ADR-021). `apply: "serve"` keeps them all out of a build.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin, ViteDevServer } from "vite";
import {
  FONT_HOST,
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
import { isSelector } from "./selector.ts";
import { SPACING } from "./spacing.ts";
import { isType, TYPE, typeValue } from "./type.ts";

const OVERRIDES = fileURLToPath(new URL("../../catalog/src/overrides.css", import.meta.url));
const TOKENS = fileURLToPath(new URL("../../catalog/src/tokens.css", import.meta.url));
const CATALOG = fileURLToPath(new URL("../../catalog/src/", import.meta.url));
const FONTS = join(CATALOG, "fonts.css");
const PAGE = fileURLToPath(new URL("./page.ts", import.meta.url));
const ROOT = ":root";
const EDITABLE = ["--window-radius", "--font-text", "--font-display"];
const PX = /^\d{1,4}px$/;
const TRANSLATE = /^-?\d{1,4}px -?\d{1,4}px$/;

// One answer: its HTTP status, and a page as a string or anything else as JSON.
type Reply = { status: number; body: unknown };

const HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
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
): {
  tokens: Record<string, { baseline: string | null; override: string | null }>;
  saved: Record<string, Record<string, string>>;
} {
  const blocks = parseOverrides(overrides);
  const root = blocks.get(ROOT);
  return {
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
type Write = { selector: string; name: string; value: string | null; was: string | null };

// `:root` takes the editable tokens; an element, by a selector of the grammar its function
// makes, takes gap, the four paddings, a two-dimensional offset and the type properties.
function namesOf(selector: string): readonly string[] {
  if (selector === ROOT) return EDITABLE;
  return isSelector(selector) ? [...SPACING, "translate", ...TYPE] : [];
}
function isValue(v: unknown, name: string): v is string | null {
  if (v === null) return true;
  if (typeof v !== "string") return false;
  if (isType(name)) return typeValue(name, v);
  if (name.startsWith("--font-")) return isFamilyValue(v);
  return (name === "translate" ? TRANSLATE : PX).test(v);
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

function parseWrite(body: string): Write | string {
  const input = json(body); // string → unknown
  const [selector, name, value, was] = ["selector", "name", "value", "was"].map((key) =>
    field(input, key),
  );
  if (
    typeof selector !== "string" ||
    typeof name !== "string" ||
    !namesOf(selector).includes(name)
  ) {
    return `not an editable selector and name: ${JSON.stringify([selector, name])}`;
  }
  if (!isValue(value, name)) {
    return `not a value ${name} takes: ${JSON.stringify(value)}`;
  }
  if (!isWas(was)) return "was must be a string or null";
  return { selector, name, value, was };
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
 * Sets one editable value in the override file at `file`, or removes it when `value` is null,
 * through a temp file and a rename. Refuses, writing nothing, a foreign `origin` (403), a
 * selector off the grammar, a name it may not set or a value its name's check refuses (400),
 * and a `was` that is not the value now on disk (409).
 */
export function writeValue(file: string, request: Post): Reply {
  if (foreign(request)) return FOREIGN;
  const write = parseWrite(request.body);
  if (typeof write === "string") return { status: 400, body: { error: write } };
  const text = readFileSync(file, "utf8");
  const now = parseOverrides(text).get(write.selector)?.get(write.name) ?? null;
  if (now !== write.was) {
    return { status: 409, body: { error: "the override file changed since it was read", now } };
  }
  replace(file, setOverride(text, write.selector, write.name, write.value));
  return {
    status: 200,
    body: { selector: write.selector, name: write.name, override: write.value },
  };
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

/**
 * Copies the Google font with Fontsource ID `id` (the body's only field) into `catalog`: its
 * woff2 files and LICENSE into `fonts/ID/`, then its `@font-face` rules onto `fonts.css` under a
 * marker. A font already there fetches nothing. Refuses a foreign `origin` (403), an ID off the
 * grammar (400), and details Fontsource does not give for `id` or with an unsafe subset, a file
 * not over HTTPS from FONT_HOST, a redirect, or a file over MAX_FILE (502), writing nothing.
 */
export async function installFont(catalog: string, request: Post): Promise<Reply> {
  if (foreign(request)) return FOREIGN;
  const id: unknown = field(json(request.body), "id");
  if (!isFontId(id)) return { status: 400, body: { error: `not a Fontsource ID: ${String(id)}` } };
  const css = join(catalog, "fonts.css");
  const folder = join(catalog, "fonts", id);
  const saved = savedFamily(readFileSync(css, "utf8"), id);
  if (saved !== undefined && existsSync(folder))
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

  const temp = `${folder}.${process.pid}.tmp`;
  rmSync(temp, { recursive: true, force: true });
  mkdirSync(temp, { recursive: true });
  for (const [i, bytes] of fetched.entries()) {
    writeFileSync(join(temp, files[i]?.name ?? "LICENSE"), bytes);
  }
  rmSync(folder, { recursive: true, force: true });
  renameSync(temp, folder);
  const now = readFileSync(css, "utf8");
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
const WRITES: Record<string, { run: (post: Post) => Reply | Promise<Reply>; file: string }> = {
  "/__workbench/values": { run: (post) => writeValue(OVERRIDES, post), file: OVERRIDES },
  "/__workbench/fonts": { run: (post) => installFont(CATALOG, post), file: FONTS },
};

async function answer(server: ViteDevServer, req: IncomingMessage): Promise<Reply> {
  const path = req.url?.split("?")[0];
  if (path === "/__workbench/" || path === "/__workbench") {
    return { status: 200, body: await server.transformIndexHtml("/__workbench/", HTML) };
  }
  if (path === "/__workbench/values" && req.method === "GET") {
    return {
      status: 200,
      body: readValues(readFileSync(OVERRIDES, "utf8"), readFileSync(TOKENS, "utf8")),
    };
  }
  const write = WRITES[path ?? ""];
  if (write !== undefined && req.method === "POST") {
    const body = await read(req);
    const reply = await write.run({ origin: req.headers.origin, host: req.headers.host, body });
    if (reply.status === 200) await reload(server, write.file);
    return reply;
  }
  return { status: 404, body: { error: `no Workbench route ${req.method} ${path}` } };
}

/** The Workbench page and its values endpoint, on the dev server only. */
export function workbench(): Plugin {
  return {
    name: "workbench",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith("/__workbench") !== true) {
          next();
          return;
        }
        const send = ({ status, body }: Reply) => {
          const html = typeof body === "string";
          res.statusCode = status;
          res.setHeader("content-type", html ? "text/html" : "application/json");
          res.end(html ? body : JSON.stringify(body));
        };
        answer(server, req).then(send, (error: unknown) => {
          send({ status: 500, body: { error: String(error) } });
        });
      });
    },
  };
}
