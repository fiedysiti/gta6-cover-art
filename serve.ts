// Vice Cover Studio — local static server for app/ (Node 22, stdlib only).
//
// Development convenience, not a server for the internet: `node serve.ts`
// serves app/ on http://localhost:8080 (or `--port <n>`). It answers GET
// and HEAD, refuses anything outside app/ with 403, answers 404 for a
// missing file, and 405 for any other method. It sends the MIME types an
// offline web app needs and nothing else.

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(fileURLToPath(new URL('./app', import.meta.url)));
const cliArgs = process.argv.slice(2);
const portFlag = cliArgs.indexOf('--port');
const wanted = portFlag === -1 ? 8080 : Number(cliArgs[portFlag + 1]);
const listenPort = Number.isInteger(wanted) && wanted > 0 && wanted < 65536 ? wanted : 8080;

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
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' }).end('method not allowed');
    return;
  }
  const url = new URL(req.url ?? '/', 'http://localhost');
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end('bad request');
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const target = resolve(join(appRoot, normalize(pathname)));
  if (target !== appRoot && !target.startsWith(appRoot + sep)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  let byteSize: number;
  try {
    const info = statSync(target);
    if (!info.isFile()) throw new Error('not a file');
    byteSize = info.size;
  } catch {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, {
    'content-type': MEDIA_TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream',
    'content-length': byteSize,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(target).pipe(res);
}).listen(listenPort, '127.0.0.1', () => {
  console.log(`Vice Cover Studio is on http://localhost:${listenPort}`);
});
