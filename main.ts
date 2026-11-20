// Vice Cover Studio — make.fun gta6-cover-art-01 entry point.
//
// Node 22, standard library only. The app itself is plain static files in
// app/ (index.html plus ES modules, no dependencies, no network requests),
// so this program's only job is to hand it in: copy app/ and screenshots/
// from beside this file into the output directory and write
// dossier.json there — the summary the judge reads — using the vendored
// make.fun library in vendor/.
//
//   Serve it locally:  node serve.ts        -> http://localhost:8080
//   Run the entry:     mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const REPO_ROOT = fileURLToPath(new URL('.', import.meta.url));
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps (reference/gate.json). text_max_bytes shapes the
// dossier's text budget; the rest refuse an entry the scorer would refuse
// anyway: more than 4 screenshots or one over 256 KiB; more than 993 files
// in app/ or 48 MiB of app files in total; or an app/ path over 1000 bytes
// (app/ counts beside /output's own 1000-entry cap, its screenshots/ and
// dossier.json).
const DOSSIER_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

function copyTree(from, to) {
  if (!existsSync(from)) return;
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

function writeDossier(outDir) {
  const dossier = buildDossier(outDir, DOSSIER_LIMITS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

mkdirSync(OUTPUT_DIR, { recursive: true });
copyTree(join(REPO_ROOT, 'app'), join(OUTPUT_DIR, 'app'));
copyTree(join(REPO_ROOT, 'screenshots'), join(OUTPUT_DIR, 'screenshots'));
writeDossier(OUTPUT_DIR);
