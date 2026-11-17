// main.js — boot, game loop and state machine for Serena Bay Heat.
// Wires every module together: city, input, audio, vehicles, pedestrians,
// police, combat, missions, HUD, rendering, saves and screenshot scenes.

import { buildCity, mulberry32, collideCircle, WORLD } from './city.js';
import { createInput, held, wasPressed, endFrame } from './input.js';
import { createAudio } from './audio.js';
import { seedTraffic, updateVehicles, nearestCar, enterCar, exitCar } from './vehicles.js';
import { seedPeds, updatePeds } from './pedestrians.js';
import { updatePolice, tryRepaint } from './police.js';
import { playerShoot, officerShoot, updateBullets, updatePickups, updateReload, seedPickups, MAG_SIZE } from './combat.js';
import { updateMissions, updateTaxi, tryMissionInteract, tryTaxiInteract, spawnTaxiCustomer, MISSIONS } from './missions.js';
import { createHud, updateHud } from './hud.js';
import { renderWorld } from './render.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';
import { setupShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const G = {
  canvas, ctx,
  time: 0,
  clock: 8 * 60, // 08:00 on day one
  day: 1,
  mode: 'menu', // 'menu' | 'playing' | 'paused' | 'dialogue' | 'busted' | 'wasted'
  city: buildCity(1337),
  player: {
    x: 1120, y: 1440, angle: 0,
    vx: 0, vy: 0,
    health: 100, armor: 0, cash: 250,
    wanted: 0, wantedFlash: 0, lastSeenTimer: 0,
    inCar: null,
    ammo: MAG_SIZE, ammoReserve: 48,
    reloadTimer: 0, shootCooldown: 0, dryClickCooldown: 0,
  },
  cars: [], peds: [], officers: [], bullets: [],
  particles: [], floaters: [], skids: [], pickups: [],
  crimes: [], pendingShots: [],
  mission: { index: 0, phase: 'idle', timer: 0, target: null, data: {}, storyDone: false },
  taxi: null, taxiPed: null, taxiCount: 0, taxiSpawnTimer: 18,
  camera: { x: 1120, y: 1440 },
  shake: 0, flash: 0,
  banner: null, dialogue: null, interactHint: '',
  audio: createAudio(),
  input: createInput(canvas),
  hud: null,
  rng: mulberry32(20261117),
  shotMode: null, shotFrames: 0,
  viewW: 1280, viewH: 800,
};

// test / debug hooks (the playthrough script uses these; harmless in play)
window.__game = G;
window.__shotReady = false;
window.__saveNow = () => saveGame(G);
window.__loadSave = () => loadGame();

// ------------------------------------------------------------------ setup

function resetWorld() {
  G.cars.length = 0;
  G.peds.length = 0;
  G.officers.length = 0;
  G.bullets.length = 0;
  G.particles.length = 0;
  G.floaters.length = 0;
  G.skids.length = 0;
  G.pickups.length = 0;
  G.crimes.length = 0;
  G.pendingShots.length = 0;
  const p = G.player;
  p.x = 1120; p.y = 1440; p.angle = 0;
  p.health = 100; p.armor = 0; p.cash = 250;
  p.wanted = 0; p.inCar = null;
  p.ammo = MAG_SIZE; p.ammoReserve = 48;
  p.reloadTimer = 0; p.shootCooldown = 0;
  G.mission = { index: 0, phase: 'idle', timer: 0, target: null, data: {}, storyDone: false };
  G.taxi = null; G.taxiPed = null; G.taxiCount = 0; G.taxiSpawnTimer = 18;
  G.clock = 8 * 60; G.day = 1;
  G.banner = null; G.dialogue = null;
  G.camera.x = p.x; G.camera.y = p.y;
  seedTraffic(G, G.rng, 16, 14);
  seedPeds(G, G.rng, 26);
  seedPickups(G, G.rng);
}

function applySave(data) {
  resetWorld();
  const p = G.player;
  p.cash = data.cash;
  p.health = data.health ?? 100;
  p.armor = data.armor ?? 0;
  p.x = data.x ?? 1120;
  p.y = data.y ?? 1440;
  G.mission.index = Math.min(data.missionIndex, MISSIONS.length);
  G.mission.storyDone = !!data.storyDone;
  G.taxiCount = data.taxiCount || 0;
  G.day = data.day || 1;
  G.clock = data.clock ?? 8 * 60;
  G.camera.x = p.x;
  G.camera.y = p.y;
  G.banner = { text: 'Welcome back to Serena Bay', timer: 4 };
}

function newGame() {
  clearSave();
  resetWorld();
  G.mode = 'playing';
  G.banner = { text: 'Welcome to Serena Bay — find the M marker', timer: 5 };
  showScreen(null);
}

function continueGame() {
  const data = loadGame();
  if (!data) return;
  applySave(data);
  G.mode = 'playing';
  showScreen(null);
}

// ------------------------------------------------------------------ screens

function showScreen(name) {
  for (const id of ['start-screen', 'pause-screen', 'end-screen', 'how-panel']) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('show', id === name);
  }
  // the start screen is the only one that keeps the menu visible
  document.getElementById('start-screen').classList.toggle('show', name === 'start-screen');
}

function showEndScreen(title, lines, buttonLabel) {
  document.getElementById('end-title').textContent = title;
  document.getElementById('end-body').innerHTML = lines.map((l) => `<p>${l}</p>`).join('');
  document.getElementById('btn-respawn').textContent = buttonLabel;
  showScreen('end-screen');
}

function respawnAtClinica(lostPercent) {
  const p = G.player;
  const lost = Math.round(p.cash * lostPercent);
  p.cash -= lost;
  p.health = 100;
  p.armor = 0;
  p.wanted = 0;
  p.ammo = MAG_SIZE;
  p.ammoReserve = Math.max(p.ammoReserve, 24);
  if (p.inCar) {
    p.inCar.ai = 'parked';
    p.inCar.speed = 0;
    p.inCar = null;
  }
  const c = G.city.landmarks.clinica;
  p.x = c.x;
  p.y = c.y + 90;
  p.angle = Math.PI / 2;
  G.officers.length = 0;
  G.bullets.length = 0;
  G.camera.x = p.x;
  G.camera.y = p.y;
  G.banner = { text: `You wake up at Clinica del Mar. Lost $${lost}.`, timer: 5 };
  G.mode = 'playing';
  showScreen(null);
  saveGame(G);
}

// ------------------------------------------------------------------ player

function mouseWorld() {
  const input = G.input;
  return {
    x: G.camera.x - G.viewW / 2 + input.mouseX,
    y: G.camera.y - G.viewH / 2 + input.mouseY,
  };
}

function updatePlayer(dt) {
  const p = G.player;
  const input = G.input;

  if (p.inCar) {
    const car = p.inCar;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.vx = Math.cos(car.angle) * car.speed;
    p.vy = Math.sin(car.angle) * car.speed;
    return;
  }

  // on foot: WASD/arrows, Shift to sprint, face the mouse (twin-stick aim)
  let dx = (held(input, 'right') ? 1 : 0) - (held(input, 'left') ? 1 : 0);
  let dy = (held(input, 'down') ? 1 : 0) - (held(input, 'up') ? 1 : 0);
  const len = Math.hypot(dx, dy);
  if (len > 0) { dx /= len; dy /= len; }
  const speed = held(input, 'sprint') ? 340 : 220;
  p.vx = dx * speed;
  p.vy = dy * speed;
  // axis-separated slide so walking along a wall feels right
  let res = collideCircle(G.city, p.x + p.vx * dt, p.y + p.vy * dt, 15);
  if (res.hit) {
    const rx = collideCircle(G.city, p.x + p.vx * dt, p.y, 15);
    const ry = collideCircle(G.city, p.x, p.y + p.vy * dt, 15);
    const mx = Math.hypot(rx.x - p.x, rx.y - p.y);
    const my = Math.hypot(ry.x - p.x, ry.y - p.y);
    res = mx >= my ? rx : ry;
  }
  p.x = res.x;
  p.y = res.y;

  const mw = mouseWorld();
  p.angle = Math.atan2(mw.y - p.y, mw.x - p.x);

  // shooting (hold to fire)
  if (input.mouseDown && p.shootCooldown <= 0) {
    playerShoot(G, mw.x, mw.y);
  }
  if (wasPressed(input, 'reload') && p.ammo < MAG_SIZE && p.ammoReserve > 0 && p.reloadTimer <= 0) {
    p.reloadTimer = 0.8;
    G.audio.reload();
  }
}

/** What E does right now, in priority order. */
function doInteract() {
  const p = G.player;
  if (tryMissionInteract(G)) return;
  if (tryTaxiInteract(G)) return;
  if (p.inCar && tryRepaint(G)) return;
  if (!p.inCar) {
    const car = nearestCar(G, 70);
    if (car) {
      const res = enterCar(G, car);
      if (res.stolen) {
        G.crimes.push({ stars: 1, why: 'CAR THEFT' });
        G.audio.horn();
        if (res.hadDriver) {
          G.floaters.push({ x: p.x, y: p.y - 30, text: 'DRIVER PULLED OUT', life: 1.4, color: '#ff5a4e' });
        }
      }
    }
  }
}

/** The E-prompt line under the HUD. */
function computeInteractHint() {
  const p = G.player;
  const m = G.mission;
  if (m.index < MISSIONS.length && m.phase === 'idle') {
    const s = G.city.landmarks[['warehouse', 'warehouse', 'warehouse', 'warehouse', 'safehouse', 'warehouse'][m.index]];
    if (Math.hypot(p.x - s.x, p.y - s.y) < 110) {
      G.interactHint = `E — Talk to Marta (${MISSIONS[m.index].name})`;
      return;
    }
  }
  if (m.phase === 'active' && m.index === 2) {
    for (const d of m.data.debtors || []) {
      if (d.state === 'debtor' && Math.hypot(p.x - d.x, p.y - d.y) < 70) {
        G.interactHint = 'E — Intimidate the debtor';
        return;
      }
    }
  }
  if (G.taxiPed && G.taxiPed.state === 'taxi' && Math.hypot(p.x - G.taxiPed.x, p.y - G.taxiPed.y) < 70) {
    G.interactHint = p.inCar ? 'E — Take the taxi fare' : 'E — Taxi fare (need a car)';
    return;
  }
  if (p.inCar && p.wanted > 0 && Math.hypot(p.x - G.city.landmarks.pipo.x, p.y - G.city.landmarks.pipo.y) < 110) {
    G.interactHint = 'E — Repaint at Talleres Pipo ($150, clears wanted)';
    return;
  }
  if (!p.inCar) {
    const car = nearestCar(G, 70);
    if (car) {
      G.interactHint = car.ai === 'parked' ? 'E — Steal this car' : 'E — Pull the driver out';
      return;
    }
  }
  G.interactHint = '';
}

// ------------------------------------------------------------------ effects

function updateEffects(dt) {
  for (const pt of [...G.particles]) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= Math.max(0, 1 - 2 * dt);
    pt.vy *= Math.max(0, 1 - 2 * dt);
    pt.life -= dt;
    if (pt.life <= 0) G.particles.splice(G.particles.indexOf(pt), 1);
  }
  for (const f of [...G.floaters]) {
    f.y -= 26 * dt;
    f.life -= dt;
    if (f.life <= 0) G.floaters.splice(G.floaters.indexOf(f), 1);
  }
  for (const s of [...G.skids]) {
    s.life -= dt;
    if (s.life <= 0) G.skids.splice(G.skids.indexOf(s), 1);
  }
  G.shake = Math.max(0, G.shake - 26 * dt);
  G.flash = Math.max(0, G.flash - dt * 1.6);
  if (G.banner) {
    G.banner.timer -= dt;
    if (G.banner.timer <= 0) G.banner = null;
  }
  const p = G.player;
  if (p.wantedFlash > 0) p.wantedFlash -= dt;
}

// ------------------------------------------------------------------ loop

function update(dt) {
  G.time += dt;
  const input = G.input;

  if (wasPressed(input, 'mute')) {
    G.audio.setMuted(!G.audio.muted);
  }

  if (G.mode === 'menu') {
    // slow attract-mode pan over the market square
    G.camera.x = 1120 + Math.sin(G.time * 0.08) * 120;
    G.camera.y = 1120 + Math.cos(G.time * 0.06) * 120;
    return;
  }

  if (G.mode === 'paused') {
    if (wasPressed(input, 'pause')) {
      G.mode = 'playing';
      showScreen(null);
    }
    return;
  }

  if (G.mode === 'dialogue') {
    if (wasPressed(input, 'confirm') || input.mouseClicked) {
      const d = G.dialogue;
      G.dialogue = null;
      G.mode = 'playing';
      if (d && d.onDone) d.onDone();
    }
    return;
  }

  if (G.mode === 'busted' || G.mode === 'wasted') {
    return; // waiting on the respawn button
  }

  // --- playing ---
  G.clock += dt * 0.8; // one game hour per 75 real seconds
  if (G.clock >= 24 * 60) {
    G.clock -= 24 * 60;
    G.day += 1;
  }

  if (wasPressed(input, 'pause')) {
    G.mode = 'paused';
    showScreen('pause-screen');
    return;
  }
  if (wasPressed(input, 'interact')) doInteract();
  if (wasPressed(input, 'exit') && G.player.inCar) exitCar(G);

  updatePlayer(dt);
  updateVehicles(G, dt, input);
  updatePeds(G, dt);
  updatePolice(G, dt, G.rng);
  updateBullets(G, dt);
  updatePickups(G, dt);
  updateReload(G, dt);
  updateMissions(G, dt);
  updateTaxi(G, dt);
  updateEffects(dt);
  computeInteractHint();

  // officer shots queued by police.js
  while (G.pendingShots.length > 0) {
    const s = G.pendingShots.shift();
    officerShoot(G, s.from);
  }

  // taxi customers drift in over time
  if (!G.taxi && !G.taxiPed) {
    G.taxiSpawnTimer -= dt;
    if (G.taxiSpawnTimer <= 0) {
      spawnTaxiCustomer(G, G.rng);
      G.taxiSpawnTimer = 28 + Math.random() * 20;
    }
  }

  // engine hum follows the player's car
  const car = G.player.inCar;
  G.audio.engine(car ? Math.abs(car.speed) / car.top : 0, !!car);

  // camera: follow with speed lookahead + shake
  const p = G.player;
  const lookX = p.x + (p.vx || 0) * 0.22;
  const lookY = p.y + (p.vy || 0) * 0.22;
  const k = 1 - Math.exp(-6 * dt);
  G.camera.x += (lookX - G.camera.x) * k;
  G.camera.y += (lookY - G.camera.y) * k;
}

function render() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }
  G.viewW = w;
  G.viewH = h;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const shX = (Math.random() - 0.5) * G.shake;
  const shY = (Math.random() - 0.5) * G.shake;
  const camX = Math.max(w / 2 - 60, Math.min(WORLD - w / 2 + 60, G.camera.x + shX));
  const camY = Math.max(h / 2 - 60, Math.min(WORLD - h / 2 + 60, G.camera.y + shY));
  ctx.clearRect(0, 0, w, h);
  // the world is drawn in world coordinates: shift the canvas so the
  // camera point lands in the middle of the screen
  ctx.save();
  ctx.translate(w / 2 - camX, h / 2 - camY);
  renderWorld(G, ctx, w, h, camX, camY);
  ctx.restore();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  updateHud(G, G.hud);
  if (G.shotMode) {
    G.shotFrames += 1;
    if (G.shotFrames >= 3) window.__shotReady = true;
  }
  endFrame(G.input);
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ wiring

function wireButtons() {
  document.getElementById('btn-new').addEventListener('click', () => {
    G.audio.ensure();
    newGame();
  });
  document.getElementById('btn-continue').addEventListener('click', () => {
    G.audio.ensure();
    continueGame();
  });
  document.getElementById('btn-how').addEventListener('click', () => {
    document.getElementById('how-panel').classList.toggle('show');
  });
  document.getElementById('btn-resume').addEventListener('click', () => {
    G.mode = 'playing';
    showScreen(null);
  });
  document.getElementById('btn-quit-menu').addEventListener('click', () => {
    saveGame(G);
    G.mode = 'menu';
    showScreen('start-screen');
  });
  document.getElementById('btn-respawn').addEventListener('click', () => {
    const lost = G.mode === 'busted' ? 0.10 : 0.15;
    respawnAtClinica(lost);
  });
  document.getElementById('dialogue-card').addEventListener('click', () => {
    if (G.mode !== 'dialogue') return;
    const d = G.dialogue;
    G.dialogue = null;
    G.mode = 'playing';
    if (d && d.onDone) d.onDone();
  });
  // first gesture anywhere unlocks audio
  window.addEventListener('pointerdown', () => G.audio.ensure(), { once: true });
  window.addEventListener('keydown', () => G.audio.ensure(), { once: true });
}

function boot() {
  G.hud = createHud();
  resetWorld();
  wireButtons();
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) {
    // screenshot mode: skip the menu, stage the scene, play it live
    document.getElementById('start-screen').classList.remove('show');
    G.mode = 'playing';
    setupShot(G, shot, Number(params.get('seed') || 7));
  } else {
    G.mode = 'menu';
    showScreen('start-screen');
    const cont = document.getElementById('btn-continue');
    cont.disabled = !hasSave();
    cont.textContent = hasSave() ? 'Continue' : 'Continue (no save yet)';
  }
  // busted / wasted cards are driven from the loop by watching mode changes
  setInterval(() => {
    if (G.mode === 'busted') {
      showEndScreen('BUSTED', [
        'The SBPD haul you in. Marta bails you out — for a price.',
        'You wake up at Clinica del Mar, lighter in the pocket.',
      ], 'Wake up at the Clinica (−10% cash)');
    } else if (G.mode === 'wasted') {
      showEndScreen('WASTED', [
        'Serena Bay chews up another courier.',
        'You wake up at Clinica del Mar, patched up and poorer.',
      ], 'Wake up at the Clinica (−15% cash)');
    }
  }, 200);
  requestAnimationFrame(frame);
}

boot();
