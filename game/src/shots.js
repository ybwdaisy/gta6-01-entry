// Deterministic screenshot scenes: ?shot=cover|drive|foot|chase&seed=7.
// Stages a busy, readable scene, then sets window.__shotReady so the
// headless capture knows the frame is staged.
import { makeRng } from './city.js';

export function stageShot(S, mode, seed) {
  const rng = makeRng(seed);
  const p = S.player;
  // A known-good vantage: downtown, on the main north-south road.
  p.x = 1120; p.y = 1560;
  p.hp = 100; p.armor = 60;
  p.cash = 2450;
  p.weapon.ammo = 9; p.weapon.reserve = 36;
  S.day = 1;
  S.clockSec = 2 * 90; // 10:00, bright morning light (1 game hour = 90s).
  S.state = 'playing';
  S.menuVisible = false;

  if (mode === 'cover') {
    // Chase + mission HUD: 3-star heat, cop cars closing in, mission 5 banner.
    p.wanted = 3;
    S.mission = { index: 4, stage: 0, timer: 0, data: {}, active: true };
    S.objective = 'Lose a 4-star wanted level, then slip to the safehouse.';
    S.showBanner('SIRENS', 'Lose the heat — then reach the safehouse');
    const car = {
      x: 1120, y: 1560, angle: -Math.PI / 2, speed: 300, color: '#e74c3c',
      name: 'Coral GT', traffic: false, parked: false, police: false, hp: 100,
    };
    S.cars.push(car);
    S.player.car = car;
    for (let i = 0; i < 2; i++) {
      const a = rng() * Math.PI * 2;
      S.cops.push({
        x: p.x + Math.cos(a) * 260, y: p.y + Math.sin(a) * 260,
        angle: a, speed: 280, color: '#1c2733', name: 'SBPD Interceptor',
        traffic: false, parked: false, police: true, hp: 100, kind: 'car', ramCooldown: 0,
      });
    }
    for (const c of S.cops) S.cars.push(c);
    for (let i = 0; i < 8; i++) {
      const car2 = {
        x: 700 + rng() * 700, y: 1300 + rng() * 500,
        angle: Math.floor(rng() * 4) * Math.PI / 2, speed: 60 + rng() * 40,
        color: ['#3498db', '#f1c40f', '#2ecc71', '#e67e22'][i % 4],
        name: 'Traffic', traffic: true, parked: false, police: false, hp: 100,
        lane: 1, axis: rng() > 0.5 ? 'h' : 'v', along: 0, turnCooldown: 0, driver: true,
      };
      S.cars.push(car2);
    }
    for (let i = 0; i < 6; i++) {
      S.peds.push({
        x: 760 + rng() * 520, y: 1380 + rng() * 380, angle: rng() * 6.28,
        speed: 40, shirt: '#3498db', skin: '#e0ac69', hp: 100, flee: 1.5,
        fleeX: p.x, fleeY: p.y, panic: 1, walkPhase: rng() * 6, horizontal: true,
        road: 1440, dir: 1, changeIn: 5, taxi: false, dead: false,
      });
    }
  } else if (mode === 'drive') {
    // Clean driving shot: player in a car on a main road, traffic around.
    p.wanted = 0;
    S.mission = { index: 0, stage: 0, timer: 150, data: {}, active: true };
    S.objective = 'Drive Marta’s package to the marina before the clock runs out.';
    const car = {
      x: 1120, y: 1560, angle: -Math.PI / 2, speed: 220, color: '#3498db',
      name: 'Cometa', traffic: false, parked: false, police: false, hp: 100,
    };
    S.cars.push(car);
    S.player.car = car;
    for (let i = 0; i < 7; i++) {
      S.cars.push({
        x: 700 + rng() * 700, y: 1100 + rng() * 800,
        angle: Math.floor(rng() * 4) * Math.PI / 2, speed: 70 + rng() * 30,
        color: ['#e74c3c', '#f1c40f', '#2ecc71', '#9b59b6', '#ecf0f1'][i % 5],
        name: 'Traffic', traffic: true, parked: false, police: false, hp: 100,
        lane: 1, axis: rng() > 0.5 ? 'h' : 'v', along: 0, turnCooldown: 0, driver: true,
      });
    }
    for (let i = 0; i < 8; i++) {
      S.peds.push({
        x: 760 + rng() * 520, y: 1200 + rng() * 600, angle: rng() * 6.28,
        speed: 35, shirt: '#f1c40f', skin: '#c68642', hp: 100, flee: 0,
        panic: 0, walkPhase: rng() * 6, horizontal: true, road: 1440, dir: 1,
        changeIn: 5, taxi: false, dead: false,
      });
    }
  } else if (mode === 'foot') {
    // On-foot market shot: Marco on the sidewalk, debtors/market crowd, taxi fare.
    p.wanted = 0;
    p.x = 890; p.y = 1515;
    S.mission = { index: 2, stage: 0, timer: 0, data: { debtors: [] }, active: true };
    S.objective = 'Three debtors are hiding on the beach. Lean on each of them.';
    p.aimAngle = Math.PI / 4;
    for (let i = 0; i < 10; i++) {
      S.peds.push({
        x: 820 + rng() * 260, y: 1440 + rng() * 220, angle: rng() * 6.28,
        speed: 30 + rng() * 20, shirt: ['#e74c3c', '#2ecc71', '#9b59b6', '#fdcb6e'][i % 4],
        skin: '#f1c27d', hp: 100, flee: 0, panic: 0, walkPhase: rng() * 6,
        horizontal: rng() > 0.5, road: 1440, dir: rng() > 0.5 ? 1 : -1,
        changeIn: 5, taxi: i === 2, dead: false,
      });
    }
    S.pickups.push({ x: 950, y: 1560, kind: 'ammo' });
    S.pickups.push({ x: 830, y: 1480, kind: 'health' });
  } else if (mode === 'chase') {
    // Police shootout: 5 stars, officers on foot firing, cop cars, sparks.
    p.wanted = 5;
    p.x = 1120; p.y = 1120;
    p.aimAngle = -Math.PI / 3;
    S.mission = { index: 5, stage: 0, timer: 120, data: {}, active: true };
    S.objective = 'Five stars. One boat at the lighthouse. Get out of Serena Bay.';
    S.showBanner('SERENA GOODBYE', 'Reach the lighthouse boat — 5 stars, 2:00 left');
    for (let i = 0; i < 3; i++) {
      const a = rng() * Math.PI * 2;
      const cop = {
        x: p.x + Math.cos(a) * 240, y: p.y + Math.sin(a) * 240,
        angle: a, speed: 300, color: '#1c2733', name: 'SBPD Interceptor',
        traffic: false, parked: false, police: true, hp: 100, kind: 'car', ramCooldown: 0,
      };
      S.cops.push(cop);
      S.cars.push(cop);
    }
    for (let i = 0; i < 3; i++) {
      const a = rng() * Math.PI * 2;
      S.cops.push({
        x: p.x + Math.cos(a) * 170, y: p.y + Math.sin(a) * 170,
        angle: 0, speed: 0, hp: 100, kind: 'officer', shootCooldown: 0.5,
        holdTime: 0, walkPhase: rng() * 6,
      });
    }
    S.addSparks(p.x + 60, p.y - 40, 12);
    S.bullets.push({ x: p.x + 20, y: p.y - 10, angle: -Math.PI / 3, speed: 900, life: 0.4, fromCop: false });
  }

  // Camera on the player, HUD visible.
  S.camera.x = p.x; S.camera.y = p.y;
  S.updateCamera(0);
  S.updateHud();
  // Let one frame render, then flag ready.
  requestAnimationFrame(() => {
    S.render();
    S.updateHud();
    window.__shotReady = true;
  });
}
