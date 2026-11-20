// Vice Cover Studio — make.fun entrypoint (Node 22, standard library only).
//
// The app itself is plain static files under app/ (index.html plus its ES
// modules, the bundled font and the two sample photos) that any static
// server can host with no build step and no network request. This program
// hands that app in: it copies app/ and screenshots/ from beside this file
// into the output directory and writes /output/dossier.json with the
// vendored make.fun library, which is the summary the judge reads.
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for
// /output, twice, and the two runs must be byte-identical:
//   mkdir -p out out2 && MAKEFUN_OUTPUT_DIR=out node main.ts \
//     && MAKEFUN_OUTPUT_DIR=out2 node main.ts && diff -r out out2

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The caps mirror the scorer's own limits (reference/gate.json): the text
// cap shapes the dossier's bytes, the rest refuse an entry the scorer
// would refuse anyway — at most 4 screenshots, none over 256 KiB; app/
// at most 993 files and 48 MiB in all, no path under it over 1000 bytes.
const dossierPath = join(outputDir, 'dossier.json');
writeFileSync(
  dossierPath,
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
console.log(`Vice Cover Studio entry written to ${outputDir} (dossier.json + app/ + screenshots/)`);
