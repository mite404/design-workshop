// `design-workshop dev` (ETH-147, ADR-043): one server in front of a host's own dev server. The
// Workbench's own Vite, with its plugin, answers everything under /__workbench/; every other
// request and websocket goes to the host untouched, so both share an origin.
import {
  createServer as createHttpServer,
  request,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { connect } from "node:net";
import type { Duplex } from "node:stream";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { hostFiles, workbench } from "./plugin.ts";

const BASE = "/__workbench/";
const ROOT = fileURLToPath(new URL("../", import.meta.url));

const STYLESHEET = `${BASE}overrides.css`;
const LINK = `<link rel="stylesheet" href="${STYLESHEET}" data-workbench-overrides>`;

/** `html` with the override stylesheet linked last in its head, so the host needs no import. */
export const withOverrides = (html: string): string =>
  /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${LINK}$&`) : `${LINK}${html}`;

const ours = (url: string | undefined) => url === "/__workbench" || url?.startsWith(BASE) === true;

// The request's head as the host should see it: its own Host, so a host's host check passes, and
// no compression, so HTML can be rewritten. ponytail: uncompressed, fine for a local dev server.
const headersFor = (req: IncomingMessage, target: URL) => {
  const { "accept-encoding": _, ...headers } = req.headers;
  return { ...headers, host: target.host };
};

// Sends one request to the host and streams its answer back unchanged.
function forward(req: IncomingMessage, res: ServerResponse, target: URL) {
  const out = request(
    {
      host: target.hostname,
      port: target.port,
      method: req.method,
      path: req.url,
      headers: headersFor(req, target),
    },
    (answer) => {
      if (answer.headers["content-type"]?.startsWith("text/html") !== true) {
        res.writeHead(answer.statusCode ?? 502, answer.headers);
        answer.pipe(res);
        return;
      }
      let html = "";
      answer.setEncoding("utf8");
      answer.on("data", (chunk: string) => (html += chunk));
      answer.on("end", () => {
        const body = withOverrides(html);
        const { "content-length": _, ...headers } = answer.headers;
        res.writeHead(answer.statusCode ?? 502, {
          ...headers,
          "content-length": Buffer.byteLength(body),
        });
        res.end(body);
      });
    },
  );
  out.on("error", (error) => {
    res.writeHead(502, { "content-type": "text/plain" });
    res.end(`The app's dev server at ${target.origin} did not answer: ${error.message}\n`);
  });
  req.pipe(out);
}

// Hands a websocket upgrade (the host's hot reload) to the host as raw bytes, both ways.
function forwardUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer, target: URL) {
  const upstream = connect(Number(target.port), target.hostname, () => {
    const lines = Object.entries(headersFor(req, target)).flatMap(([name, value]) =>
      (Array.isArray(value) ? value : [value ?? ""]).map((v) => `${name}: ${v}`),
    );
    upstream.write(
      `${req.method ?? "GET"} ${req.url ?? "/"} HTTP/1.1\r\n${lines.join("\r\n")}\r\n\r\n`,
    );
    upstream.write(head);
    upstream.pipe(socket).pipe(upstream);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
}

// The override file as a stylesheet, never cached, so a changed file is read again.
async function serveStylesheet(res: ServerResponse, file: string): Promise<void> {
  try {
    const css = await readFile(file, "utf8");
    res.writeHead(200, { "content-type": "text/css", "cache-control": "no-store" });
    res.end(css);
  } catch (error: unknown) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end(String(error));
  }
}

/**
 * Starts the Workbench at `port` in front of the dev server at `target`, editing the files in
 * `root`'s `.workbench/`, and resolves with the address it serves once it listens.
 * @throws When `target` is not an http URL with a port, `root` has no `.workbench/overrides.css`,
 * or the port is taken.
 */
export async function startDev(target: string, port: number, root: string): Promise<string> {
  const host = new URL(target);
  if (host.protocol !== "http:" || host.port === "")
    throw new Error(`The target must be http://host:port, not ${target}.`);
  const files = hostFiles(root);
  if (!existsSync(files.overrides))
    throw new Error(`No ${files.overrides}. Run design-workshop init in ${root} first.`);
  const server = createHttpServer();
  const vite = await createServer({
    root: ROOT,
    base: BASE,
    configFile: false,
    appType: "custom",
    plugins: [workbench(files)],
    server: { middlewareMode: true, hmr: { server } },
  });
  server.on("request", (req, res) => {
    if (req.url?.split("?")[0] === STYLESHEET) void serveStylesheet(res, files.overrides);
    else if (ours(req.url)) vite.middlewares(req, res);
    else forward(req, res, host);
  });
  // Vite's own socket listener takes the Workbench's hot reload; every other upgrade is the host's.
  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (!ours(req.url)) forwardUpgrade(req, socket, head, host);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, resolve);
  });
  return `http://localhost:${port}${BASE}`;
}
