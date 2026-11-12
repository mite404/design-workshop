// `design-workshop dev` (ETH-147, ADR-043): one server in front of a host's own dev server. The
// Workbench's own Vite, with its plugin, answers everything under /__workbench/; every other
// request and websocket goes to the host untouched, so both share an origin.
import {
  createServer as createHttpServer,
  request,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { connect } from "node:net";
import type { Duplex } from "node:stream";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { workbench } from "./plugin.ts";

const BASE = "/__workbench/";
const ROOT = fileURLToPath(new URL("../", import.meta.url));

const ours = (url: string | undefined) => url === "/__workbench" || url?.startsWith(BASE) === true;

// The request's head as the host should see it: its own Host, so a host's host check passes.
const headersFor = (req: IncomingMessage, target: URL) => ({ ...req.headers, host: target.host });

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
      res.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(res);
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

/**
 * Starts the Workbench at `port` in front of the dev server at `target`, and resolves with the
 * address it serves once it listens.
 * @throws When `target` is not an http URL with a port, or the port is taken.
 */
export async function startDev(target: string, port: number): Promise<string> {
  const host = new URL(target);
  if (host.protocol !== "http:" || host.port === "")
    throw new Error(`The target must be http://host:port, not ${target}.`);
  const server = createHttpServer();
  const vite = await createServer({
    root: ROOT,
    base: BASE,
    configFile: false,
    appType: "custom",
    plugins: [workbench()],
    server: { middlewareMode: true, hmr: { server } },
  });
  server.on("request", (req, res) => {
    if (ours(req.url)) vite.middlewares(req, res);
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
