// The Workbench's dev-only half of the app's dev server: its page at /__workbench/ and the one
// endpoint that writes the override file (ADR-002). `apply: "serve"` keeps both out of a build.
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import { fileURLToPath } from "node:url";
import type { Plugin, ViteDevServer } from "vite";
import { parseOverrides, setOverride } from "./overrides.ts";

const OVERRIDES = fileURLToPath(new URL("../../catalog/src/overrides.css", import.meta.url));
const TOKENS = fileURLToPath(new URL("../../catalog/src/tokens.css", import.meta.url));
const PAGE = fileURLToPath(new URL("./page.ts", import.meta.url));
const EDITABLE = ["--window-radius"];
const PX = /^\d{1,4}px$/;

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

/** Each editable name's baseline (tokens.css) and override (the override file) values. */
export function readValues(
  overrides: string,
  tokens: string,
): Record<string, { baseline: string | null; override: string | null }> {
  const root = parseOverrides(overrides).get(":root");
  return Object.fromEntries(
    EDITABLE.map((n) => [n, { baseline: baseline(tokens, n), override: root?.get(n) ?? null }]),
  );
}

// A POST body, checked: one editable name, its new px value or null, and the value last read.
type Write = { name: string; value: string | null; was: string | null };

const isName = (v: unknown): v is string => typeof v === "string" && EDITABLE.includes(v);
const isPx = (v: unknown): v is string | null =>
  v === null || (typeof v === "string" && PX.test(v));
const isWas = (v: unknown): v is string | null => v === null || typeof v === "string";

function json(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function parseWrite(body: string): Write | string {
  const input = json(body); // string → unknown
  const field = (key: string): unknown =>
    typeof input === "object" && input !== null ? Reflect.get(input, key) : undefined;
  const [name, value, was] = [field("name"), field("value"), field("was")];
  if (!isName(name)) return `not an editable name: ${JSON.stringify(name)}`;
  if (!isPx(value)) return `not a pixel length: ${JSON.stringify(value)}`;
  if (!isWas(was)) return "was must be a string or null";
  return { name, value, was };
}

/**
 * Sets one editable value in the override file at `file`, or removes it when `value` is null,
 * through a temp file and a rename. Refuses, writing nothing, a foreign `origin` (403), a name
 * off the editable list or a value that is not a pixel length (400), and a `was` that is not the
 * value now on disk (409).
 */
export function writeValue(
  file: string,
  request: { origin: string | undefined; host: string | undefined; body: string },
): Reply {
  if (request.host === undefined || URL.parse(request.origin ?? "")?.host !== request.host) {
    return { status: 403, body: { error: "only the Workbench's own origin may write" } };
  }
  const write = parseWrite(request.body);
  if (typeof write === "string") return { status: 400, body: { error: write } };
  const text = readFileSync(file, "utf8");
  const now = parseOverrides(text).get(":root")?.get(write.name) ?? null;
  if (now !== write.was) {
    return { status: 409, body: { error: "the override file changed since it was read", now } };
  }
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, setOverride(text, ":root", write.name, write.value));
  renameSync(temp, file);
  return { status: 200, body: { name: write.name, override: write.value } };
}

async function read(req: IncomingMessage): Promise<string> {
  let body = "";
  for await (const chunk of req) body += String(chunk);
  return body;
}

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
  if (path === "/__workbench/values" && req.method === "POST") {
    const body = await read(req);
    return writeValue(OVERRIDES, { origin: req.headers.origin, host: req.headers.host, body });
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
