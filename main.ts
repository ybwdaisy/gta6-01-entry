// Serena Bay Heat — entry program for make.fun's gta6-01 bounty.
//
// It hands the game in: copies this repository's game/ (the playable static
// files) and screenshots/ (four renders of the game itself) into the output
// directory and writes /output/dossier.json with the vendored make.fun
// library's buildDossier, so the scorer can rebuild the same dossier byte
// for byte. Node 22, standard library only; no install, no network.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The grader caps /output at 1000 entries and 64 MiB; game/ (993 entries at
// most), screenshots/ (4 files) and dossier.json share that budget, so the
// program refuses an input the scorer would refuse instead of handing in a
// dossier the gate rejects.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function mustExist(path, what) {
  if (!existsSync(path)) throw new Error(`Serena Bay Heat: missing ${what} at ${path}`);
}

function copyEntry() {
  const gameDir = join(here, 'game');
  const shotsDir = join(here, 'screenshots');
  mustExist(join(gameDir, 'index.html'), 'game/index.html');
  mustExist(shotsDir, 'screenshots/');

  mkdirSync(out, { recursive: true });
  // start from a clean output so a stale file can never ride along
  rmSync(join(out, 'game'), { recursive: true, force: true });
  rmSync(join(out, 'screenshots'), { recursive: true, force: true });
  cpSync(gameDir, join(out, 'game'), { recursive: true });
  cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });
}

function writeDossier() {
  const dossier = buildDossier(out, DOSSIER_CAPS);
  writeFileSync(join(out, 'dossier.json'), dossier);
  return dossier.length;
}

copyEntry();
const dossierBytes = writeDossier();
console.log(`Serena Bay Heat: game/ copied, dossier.json written (${dossierBytes} bytes).`);
