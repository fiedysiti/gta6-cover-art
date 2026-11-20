// Vice Cover Studio — make.fun entrypoint (Node 22, standard library only).
//
// The app itself is plain static files under app/ (index.html plus its ES
// modules, the bundled font and the two sample photos) that any static
// server can host with no build step and no network request. This program
// hands that app in: it copies app/ and screenshots/ from beside this file
// into the output directory, checks both against the scorer's own limits,
// and writes /output/dossier.json with the vendored make.fun library,
// which is the summary the judge reads.
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for
// /output, twice, and the two runs must be byte-identical:
//   mkdir -p out out2 && MAKEFUN_OUTPUT_DIR=out node main.ts \
//     && MAKEFUN_OUTPUT_DIR=out2 node main.ts && diff -r out out2

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The caps mirror the scorer's own limits (reference/gate.json): the text
// cap shapes the dossier's bytes, the rest refuse an entry the scorer
// would refuse anyway — at most 4 screenshots, none over 256 KiB; app/
// at most 993 files and 48 MiB in all, no path under it over 1000 bytes.
const LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

/** Walks a directory tree and returns every file path under it. */
function walkFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walkFiles(full));
    else if (entry.isFile()) found.push(full);
  }
  return found;
}

/**
 * Fails the run before any dossier is written when the staged app or
 * screenshots already break a scorer limit, so a bad entry is caught here
 * instead of being refused by the judge.
 */
function checkStagedApp(appDir: string, shotsDir: string): { appFiles: number; appBytes: number; shots: number } {
  const appFiles = walkFiles(appDir);
  let appBytes = 0;
  for (const file of appFiles) {
    const rel = file.slice(appDir.length + 1);
    if (Buffer.byteLength(rel) > LIMITS.app_path_max_bytes) {
      throw new Error(`app path too long for the scorer: ${rel}`);
    }
    appBytes += statSync(file).size;
  }
  if (appFiles.length > LIMITS.app_max_files) throw new Error(`too many app files: ${appFiles.length}`);
  if (appBytes > LIMITS.app_max_bytes) throw new Error(`app too large: ${appBytes} bytes`);
  const shots = existsSync(shotsDir) ? readdirSync(shotsDir).filter((name) => statSync(join(shotsDir, name)).isFile()) : [];
  if (shots.length > LIMITS.screenshots.max) throw new Error(`too many screenshots: ${shots.length}`);
  for (const name of shots) {
    const size = statSync(join(shotsDir, name)).size;
    if (size > LIMITS.screenshots.max_bytes) throw new Error(`screenshot over the limit: ${name} (${size} bytes)`);
  }
  return { appFiles: appFiles.length, appBytes, shots: shots.length };
}

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

const staged = checkStagedApp(join(outputDir, 'app'), join(outputDir, 'screenshots'));

const dossierPath = join(outputDir, 'dossier.json');
writeFileSync(
  dossierPath,
  buildDossier(outputDir, LIMITS),
);
// Read the dossier back and prove it parses, so a truncated or corrupt
// write fails this run instead of reaching the judge.
const dossier = JSON.parse(readFileSync(dossierPath, 'utf8')) as Record<string, unknown>;
if (!dossier || typeof dossier !== 'object') throw new Error('dossier.json did not parse');
console.log(
  `Vice Cover Studio entry written to ${outputDir} (dossier.json + app/ + screenshots/) — ` +
  `${staged.appFiles} app files, ${staged.appBytes} bytes, ${staged.shots} screenshots`,
);
