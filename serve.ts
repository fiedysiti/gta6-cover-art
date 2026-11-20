// Vice Cover Studio — local static server for app/ (Node 22, stdlib only).
//
// Development convenience, not a server for the internet: `node serve.ts`
// serves app/ on http://localhost:8080 (or `--port <n>` and `--host <ip>`).
// It answers GET and HEAD, refuses anything outside app/ with 403, answers
// 404 for a missing file, and 405 for any other method. It sends the MIME
// types an offline web app needs and nothing else, and logs one line per
// request unless `--quiet` is passed.

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(fileURLToPath(new URL('./app', import.meta.url)));
const cliArgs = process.argv.slice(2);

/** Reads the value after a `--flag` on the command line, or null. */
function flagValue(flag: string): string | null {
  const at = cliArgs.indexOf(flag);
  return at === -1 ? null : (cliArgs[at + 1] ?? null);
}

if (cliArgs.includes('--help')) {
  console.log('usage: node serve.ts [--port <n>] [--host <ip>] [--quiet]');
  process.exit(0);
}

const wantedPort = Number(flagValue('--port') ?? 8080);
const listenPort = Number.isInteger(wantedPort) && wantedPort > 0 && wantedPort < 65536 ? wantedPort : 8080;
const listenHost = flagValue('--host') ?? '127.0.0.1';
const quiet = cliArgs.includes('--quiet');

const MEDIA_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};

createServer((req, res) => {
  /** Sends one status line and logs the request unless quiet. */
  function answer(status: number, headers: Record<string, string | number> = {}, body = '') {
    if (!quiet) console.log(`${req.method} ${req.url} -> ${status}`);
    res.writeHead(status, headers).end(body);
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    answer(405, { allow: 'GET, HEAD' }, 'method not allowed');
    return;
  }
  const url = new URL(req.url ?? '/', 'http://localhost');
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    answer(400, {}, 'bad request');
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const target = resolve(join(appRoot, normalize(pathname)));
  if (target !== appRoot && !target.startsWith(appRoot + sep)) {
    answer(403, {}, 'forbidden');
    return;
  }
  let byteSize: number;
  let mtime: Date;
  try {
    const info = statSync(target);
    if (!info.isFile()) throw new Error('not a file');
    byteSize = info.size;
    mtime = info.mtime;
  } catch {
    answer(404, {}, 'not found');
    return;
  }
  if (!quiet) console.log(`${req.method} ${req.url} -> 200`);
  res.writeHead(200, {
    'content-type': MEDIA_TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream',
    'content-length': byteSize,
    'last-modified': mtime.toUTCString(),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(target).pipe(res);
}).listen(listenPort, listenHost, () => {
  console.log(`Vice Cover Studio is on http://${listenHost}:${listenPort}`);
});
