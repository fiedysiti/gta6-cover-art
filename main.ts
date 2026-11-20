// Vice Cover Studio — make.fun gta6-cover-art-01 entry point.
//
// Node 22+, standard library only. The app is plain static files in app/
// (index.html plus ES modules — no dependencies, no network requests), so
// this program's only job is to hand it in: stage app/ and screenshots/
// beside this file into the output directory, then write dossier.json —
// the summary the judge reads — with the vendored make.fun library.
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
// dossier's text budget; the remaining caps refuse an entry the scorer
// would refuse anyway: more than 4 screenshots or one over 256 KiB; more
// than 993 files in app/ or 48 MiB of app files in total; or an app/ path
// over 1000 bytes (app/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
const DOSSIER_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

// Copies one directory tree into the output, creating it first. Missing
// sources are skipped silently — an entry without screenshots is still an
// entry, just a weaker one.
function copyTree(source, target) {
  if (!existsSync(source)) return;
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
}

// Builds the dossier for everything staged in `outDir` and writes it
// there as dossier.json.
function writeDossier(outDir) {
  const dossier = buildDossier(outDir, DOSSIER_LIMITS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

mkdirSync(OUTPUT_DIR, { recursive: true });
copyTree(join(REPO_ROOT, 'app'), join(OUTPUT_DIR, 'app'));
copyTree(join(REPO_ROOT, 'screenshots'), join(OUTPUT_DIR, 'screenshots'));
writeDossier(OUTPUT_DIR);
