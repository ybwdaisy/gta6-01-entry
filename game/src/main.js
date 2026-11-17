// Serena Bay Heat — boot, game loop, state machine, and the shared
// helpers every system calls (toasts, particles, busted/wasted, camera).
import { buildCity, WORLD, clampWorld, resolveBuildingCollision } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  updateTraffic, updatePlayerCar, enterCar, exitCar,
  spawnTrafficCar, spawnParkedCar,
} from './vehicles.js';
import { updatePeds, scarePeds, spawnPed } from './pedestrians.js';
import { updateWanted, updatePolice, addWanted, clearWanted, removeCop } from './police.js';
import { updateCombat, createWeapon, damagePlayer } from './combat.js';
import { updateMissions, currentMarker, startTaxi, MISSIONS, SPOTS } from './missions.js';
import { updateHud, showBanner, hideBannerIfDue } from './hud.js';
import { render } from './render.js';
import { saveGame, loadSave, hasSave, clearSave } from './save.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

const S = {
  canvas, ctx,
  city: buildCity(20261117),
  input: createInput(canvas),
  audio: createAudio(),
  state: 'menu', // menu | playing | paused | dialogue | busted | wasted
  menuVisible: true,
  player: null,
  camera: { x: 1280, y: 1280 },
  cars: [],
  peds: [],
  cops: [],
  bullets: [],
  particles: [],
  shells: [],
  skids: [],
  floatTexts: [],
  pickups: [],
  mission: { index: 0, stage: 0, timer: 0, data: {}, active: false },
  storyDone: false,
  taxi: { active: false, candidate: null, dest: null, timer: 0 },
  taxiCount: 0,
  clockSec: 0,
  day: 1,
  shake: 0,
  hitFlash: 0,
  muzzle: 0,
  bannerUntil: 0,
  objective: 'Go to the Vidal Warehouse to start your first job.',
  toastUntil: 0,
  menuTimer: 0,
};

// ---- shared helpers (called by the systems) ----
S.toast = (text, secs = 2) => {
  const el = $('toast');
  el.textContent = text;
  S.toastUntil = performance.now() + secs * 1000;
};
S.banner = (title, sub) => showBanner(S, title, sub);
S.showBanner = S.banner;
S.floatText = (x, y, text, color) => {
  S.floatTexts.push({ x, y, text, color, life: 1.4 });
};
S.addSparks = (x, y, n) => {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 160;
    S.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.5, max: 0.5, size: 2 + Math.random() * 3,
      color: ['#ffd23e', '#ff7a3c', '#fff'][i % 3],
    });
  }
};
S.addExhaust = (x, y) => {
  S.particles.push({
    x, y, vx: (Math.random() - 0.5) * 20, vy: -20 - Math.random() * 20,
    life: 0.6, max: 0.6, size: 3 + Math.random() * 3, color: '#9aa0a6',
  });
};
S.addSkid = (x, y, angle) => {
  const px = Math.cos(angle + Math.PI / 2) * 12;
  const py = Math.sin(angle + Math.PI / 2) * 12;
  const bx = x - Math.cos(angle) * 10, by = y - Math.sin(angle) * 10;
  S.skids.push({ x1: bx + px, y1: by + py, x2: x + px, y2: y + py, life: 6 });
  S.skids.push({ x1: bx - px, y1: by - py, x2: x - px, y2: y - py, life: 6 });
};
S.addShell = (x, y, angle) => {
  S.shells.push({ x: x + Math.cos(angle + 1.2) * 10, y: y + Math.sin(angle + 1.2) * 10, life: 1.2 });
};
S.scarePeds = (x, y, r) => scarePeds(S, x, y, r);
S.addWanted = (stars, reason) => addWanted(S, stars, reason);
S.clearWanted = (reason) => clearWanted(S, reason);
S.removeCop = (cop) => removeCop(S, cop);
S.saveGame = () => saveGame(S);
S.currentMarker = () => currentMarker(S);
S.updateHud = () => updateHud(S);
S.render = () => render(S);
S.updateCamera = (dt) => updateCamera(dt);

S.explodeCar = (car) => {
  S.addSparks(car.x, car.y, 26);
  S.audio.crash();
  S.shake = 14;
  S.cars = S.cars.filter((c) => c !== car);
  if (S.player.car === car) {
    S.player.car = null;
    S.audio.setEngine(false, 0);
    damagePlayer(S, 25);
  }
  if (car.police) S.removeCop(car);
};

S.hitPed = (ped, car) => {
  ped.dead = true;
  ped.deadFor = 0;
  S.addSparks(ped.x, ped.y, 8);
  S.audio.crash();
  car.speed *= 0.55;
  S.addWanted(1, 'Hit and run');
  S.scarePeds(ped.x, ped.y, 350);
};

S.copShoot = (cop, player) => {
  const a = Math.atan2(player.y - cop.y, player.x - cop.x) + (Math.random() - 0.5) * 0.22;
  S.bullets.push({ x: cop.x, y: cop.y, angle: a, speed: 780, life: 0.8, fromCop: true });
  S.audio.gunshot();
};

S.busted = () => {
  if (S.state !== 'playing') return;
  S.state = 'busted';
  S.audio.busted();
  S.audio.setSiren(false);
  S.audio.setEngine(false, 0);
  const lost = Math.floor(S.player.cash * 0.1);
  S.player.cash -= lost;
  S.player.wanted = 0;
  S.cops = [];
  S.showEndcard('BUSTED', `The SBPD hauled you in. Bail and fines cost you $${lost}.\nYou wake up at Clinica Serena, a little lighter and a lot wiser.`, respawnAtClinic);
};

S.wasted = () => {
  if (S.state !== 'playing') return;
  S.state = 'wasted';
  S.audio.fail();
  S.audio.setSiren(false);
  S.audio.setEngine(false, 0);
  const lost = Math.floor(S.player.cash * 0.15);
  S.player.cash -= lost;
  S.player.wanted = 0;
  S.cops = [];
  S.showEndcard('WASTED', `You flatlined on a Serena Bay sidewalk — and woke up at Clinica Serena, $${lost} lighter.\nThe city does not wait. Neither should you.`, respawnAtClinic);
};

function respawnAtClinic() {
  const p = S.player;
  p.hp = 100; p.armor = 0;
  p.x = 1840; p.y = 885;
  p.car = null;
  p.weapon.ammo = 12; p.weapon.reserve = 48;
  S.camera.x = p.x; S.camera.y = p.y;
  S.state = 'playing';
  S.saveGame();
}

S.showDialogue = (lines, onDone) => {
  S.state = 'dialogue';
  const dlg = $('dialogue');
  let i = 0;
  const show = () => {
    $('dialogue-speaker').textContent = lines[i][0].toUpperCase();
    $('dialogue-text').textContent = lines[i][1];
    $('dialogue-next').textContent = i === lines.length - 1 ? 'Start ▸' : 'Continue ▸';
  };
  show();
  dlg.classList.remove('hidden');
  const next = () => {
    i++;
    if (i >= lines.length) {
      dlg.classList.add('hidden');
      $('dialogue-next').removeEventListener('click', next);
      S.state = 'playing';
      if (onDone) onDone();
    } else show();
  };
  $('dialogue-next').addEventListener('click', next);
};

S.showEndcard = (title, text, onContinue) => {
  $('endcard-title').textContent = title;
  $('endcard-text').textContent = text;
  $('endcard').classList.remove('hidden');
  const btn = $('btn-endcard');
  const go = () => {
    $('endcard').classList.add('hidden');
    btn.removeEventListener('click', go);
    if (onContinue) onContinue();
    else if (S.state === 'busted' || S.state === 'wasted') S.state = 'playing';
  };
  btn.addEventListener('click', go);
};

// ---- player ----
function newPlayer(x = 610, y = 2200) {
  return {
    x, y, angle: 0, aimAngle: 0, speed: 0,
    hp: 100, armor: 0, cash: 250, wanted: 0, wantedTimer: 0,
    weapon: createWeapon(), car: null, fireCooldown: 0, walkPhase: 0,
  };
}

function resetWorld() {
  S.cars = [];
  S.peds = [];
  S.cops = [];
  S.bullets = [];
  S.particles = [];
  S.shells = [];
  S.skids = [];
  S.floatTexts = [];
  S.pickups = [
    { x: 950, y: 1560, kind: 'ammo' },
    { x: 1500, y: 900, kind: 'health' },
    { x: 620, y: 2200, kind: 'armor' },
  ];
  for (let i = 0; i < 10; i++) {
    const c = spawnTrafficCar(Math.random, S.player);
    if (c) S.cars.push(c);
  }
  for (let i = 0; i < 12; i++) {
    const c = spawnParkedCar(Math.random, S.city, S.player);
    if (c) S.cars.push(c);
  }
  for (let i = 0; i < 20; i++) {
    const p = spawnPed(Math.random, S.player, S.city);
    if (p) S.peds.push(p);
  }
}

function updateCamera(dt) {
  const p = S.player;
  let tx = p.x, ty = p.y;
  if (p.car) {
    tx += Math.cos(p.car.angle) * Math.abs(p.car.speed) * 0.35;
    ty += Math.sin(p.car.angle) * Math.abs(p.car.speed) * 0.35;
  } else if (p.speed > 10) {
    tx += Math.cos(p.aimAngle || 0) * 40;
    ty += Math.sin(p.aimAngle || 0) * 40;
  }
  const k = dt === 0 ? 1 : Math.min(1, 5 * dt);
  S.camera.x += (tx - S.camera.x) * k;
  S.camera.y += (ty - S.camera.y) * k;
  S.camera.x = Math.max(640, Math.min(WORLD - 640, S.camera.x));
  S.camera.y = Math.max(400, Math.min(WORLD - 400, S.camera.y));
}

function nearestCar(maxDist = 60) {
  let best = null, bd = maxDist;
  for (const c of S.cars) {
    if (c.police || c.hp <= 0) continue;
    const d = Math.hypot(c.x - S.player.x, c.y - S.player.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function updatePlayerOnFoot(dt) {
  const p = S.player;
  const input = S.input;
  const axis = input.moveAxis();
  const len = Math.hypot(axis.x, axis.y) || 1;
  const speed = input.sprint() ? 265 : 170;
  p.speed = (axis.x || axis.y) ? speed : 0;
  if (axis.x || axis.y) {
    p.x += (axis.x / len) * speed * dt;
    p.y += (axis.y / len) * speed * dt;
    p.walkPhase += dt * 11;
  }
  resolveBuildingCollision(p, 13, S.city.buildings);
  clampWorld(p, 16);
  // Aim at the mouse.
  const cam = S.camera;
  const wx = input.mouse.x + cam.x - 640;
  const wy = input.mouse.y + cam.y - 400;
  input.mouse.wx = wx; input.mouse.wy = wy;
  p.aimAngle = Math.atan2(wy - p.y, wx - p.x);
}

function handleActions(dt) {
  const input = S.input;
  const p = S.player;

  if (input.hit('KeyM')) {
    const m = S.audio.toggleMute();
    S.toast(m ? 'Sound muted' : 'Sound on', 1.2);
  }
  if (input.hit('Escape', 'KeyP')) {
    if (S.state === 'playing') pauseGame();
    else if (S.state === 'paused') resumeGame();
  }
  if (S.state !== 'playing') return;

  // Enter / exit cars, steal, repaint, taxi.
  if (input.hit('KeyE')) {
    if (p.car) {
      // Repaint at Talleres Pipo clears heat for $150.
      if (p.wanted > 0 && Math.hypot(p.x - SPOTS.garage.x, p.y - SPOTS.garage.y) < 110) {
        if (p.cash >= 150) {
          p.cash -= 150;
          S.clearWanted('Repaint at Talleres Pipo — clean plates, clean record.');
          S.audio.cash();
        } else S.toast('Repaint costs $150 — you are short.', 2);
      }
      return;
    }
    const car = nearestCar(62);
    if (car) {
      if (car.parked) {
        enterCar(S, car);
        S.audio.pickup();
        S.toast(`You took the ${car.name}`, 1.5);
      } else if (car.traffic && Math.abs(car.speed) < 30) {
        enterCar(S, car);
        S.addWanted(1, 'Carjacking');
        S.audio.horn();
        S.scarePeds(car.x, car.y, 200);
      } else {
        S.toast('Too fast — wait for it to slow down', 1.5);
      }
      return;
    }
    // Taxi fare.
    if (S.taxi.candidate && Math.hypot(p.x - S.taxi.candidate.x, p.y - S.taxi.candidate.y) < 50) {
      startTaxi(S);
    }
  }
  if (input.hit('KeyF') && p.car) exitCar(S);
  if (input.hit('KeyH') && p.car) S.audio.horn();
}

function update(dt) {
  const p = S.player;
  S.clockSec += dt;
  if (S.clockSec >= 24 * 90) { S.clockSec -= 24 * 90; S.day += 1; }

  handleActions(dt);
  if (S.state !== 'playing') return;

  if (p.car) updatePlayerCar(S, dt);
  else updatePlayerOnFoot(dt);
  updateTraffic(S, dt);
  updatePeds(S, dt);
  updateWanted(S, dt);
  updatePolice(S, dt);
  updateCombat(S, dt);
  updateMissions(S, dt);

  // Particles / shells / skids / float texts.
  for (const pt of S.particles) {
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vx *= 0.96; pt.vy *= 0.96;
    pt.life -= dt;
  }
  S.particles = S.particles.filter((pt) => pt.life > 0);
  for (const sh of S.shells) sh.life -= dt;
  S.shells = S.shells.filter((sh) => sh.life > 0);
  for (const s of S.skids) s.life -= dt;
  S.skids = S.skids.filter((s) => s.life > 0);
  for (const ft of S.floatTexts) { ft.y -= 34 * dt; ft.life -= dt; }
  S.floatTexts = S.floatTexts.filter((ft) => ft.life > 0);
  for (const ped of S.peds) if (ped.dead) ped.deadFor = (ped.deadFor || 0) + dt;

  S.shake = Math.max(0, S.shake - dt * 26);
  S.hitFlash = Math.max(0, S.hitFlash - dt);
  S.muzzle = Math.max(0, S.muzzle - dt);
  if (S.toastUntil && performance.now() > S.toastUntil) {
    $('toast').textContent = '';
    S.toastUntil = 0;
  }
  hideBannerIfDue(S);
  updateCamera(dt);
  updateHud(S);
}

// ---- menu / pause ----
function showMenu() {
  S.state = 'menu';
  S.menuVisible = true;
  $('menu').classList.remove('hidden');
  $('hud').classList.add('hidden');
  $('btn-continue').classList.toggle('hidden', !hasSave());
}
function hideMenu() {
  S.menuVisible = false;
  $('menu').classList.add('hidden');
  $('hud').classList.remove('hidden');
}
function startNewGame() {
  clearSave();
  S.player = newPlayer();
  S.mission = { index: 0, stage: 0, timer: 0, data: {}, active: false };
  S.storyDone = false;
  S.taxi = { active: false, candidate: null, dest: null, timer: 0 };
  S.taxiCount = 0;
  S.clockSec = 0;
  S.day = 1;
  resetWorld();
  S.camera.x = S.player.x; S.camera.y = S.player.y;
  S.objective = 'Go to the Vidal Warehouse to start your first job.';
  S.audio.ensure();
  hideMenu();
  S.state = 'playing';
  S.banner('SERENA BAY HEAT', 'Marco Reyes — courier for the harbor');
}
function continueGame() {
  const save = loadSave();
  if (!save) return;
  S.player = newPlayer(save.x, save.y);
  S.player.cash = save.cash;
  S.mission = { index: save.missionIndex, stage: 0, timer: 0, data: {}, active: false };
  S.storyDone = !!save.storyDone;
  S.taxiCount = save.taxiCount || 0;
  S.day = save.day || 1;
  S.clockSec = save.clockSec || 0;
  resetWorld();
  S.camera.x = S.player.x; S.camera.y = S.player.y;
  S.objective = S.storyDone ? 'Free roam — Serena Bay is yours.' : `Next job: ${MISSIONS[save.missionIndex].title} — go to the Vidal Warehouse.`;
  S.audio.ensure();
  hideMenu();
  S.state = 'playing';
  S.toast('Welcome back, Marco.', 2.5);
}
function pauseGame() {
  S.state = 'paused';
  S.audio.setEngine(false, 0);
  $('pause-stats').innerHTML =
    `Cash $${Math.floor(S.player.cash).toLocaleString('en-US')} · Day ${S.day}<br>` +
    `Job ${Math.min(S.mission.index + 1, MISSIONS.length)} of ${MISSIONS.length} — ${MISSIONS[Math.min(S.mission.index, MISSIONS.length - 1)].title}<br>` +
    `Wanted ${S.player.wanted}★ · Fares completed ${S.taxiCount}`;
  $('pause').classList.remove('hidden');
}
function resumeGame() {
  S.state = 'playing';
  $('pause').classList.add('hidden');
}

$('btn-new').addEventListener('click', startNewGame);
$('btn-continue').addEventListener('click', continueGame);
$('btn-how').addEventListener('click', () => $('howto').classList.toggle('hidden'));
$('btn-resume').addEventListener('click', resumeGame);
$('btn-quit').addEventListener('click', () => {
  saveGame(S);
  $('pause').classList.add('hidden');
  showMenu();
});
window.addEventListener('pointerdown', () => S.audio.ensure(), { once: true });

// ---- main loop ----
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (S.state === 'menu') {
    // Slow cinematic pan over the city behind the menu.
    S.menuTimer += dt;
    S.camera.x = 1280 + Math.cos(S.menuTimer * 0.05) * 500;
    S.camera.y = 1280 + Math.sin(S.menuTimer * 0.07) * 400;
    render(S);
  } else if (S.state === 'paused') {
    // Still read input so Esc / P can resume the game.
    handleActions(0);
  } else if (S.state !== 'paused') {
    update(dt);
    if (S.state === 'playing' || S.state === 'dialogue' || S.state === 'busted' || S.state === 'wasted') render(S);
  }
  S.input.endFrame();
  requestAnimationFrame(frame);
}

// ---- boot ----
S.player = newPlayer();
resetWorld();
S.camera.x = S.player.x; S.camera.y = S.player.y;
window.__game = S;
window.__shotReady = false;

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  // Screenshot mode: skip the menu, stage a deterministic scene.
  hideMenu();
  S.audio.ensure();
  stageShot(S, shot, Number(params.get('seed') || 7));
} else {
  showMenu();
}
requestAnimationFrame(frame);
