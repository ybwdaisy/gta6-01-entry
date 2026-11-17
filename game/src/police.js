// police.js — the wanted system: stars, heat decay, patrol-car chases,
// foot officers, busted/wasted, and the Talleres Pipo repaint.

import { WORLD, randomRoadPoint, collideCircle } from './city.js';
import { makeCar, spawnSparks } from './vehicles.js';
import { damagePlayer } from './vehicles.js';

export const MAX_WANTED = 5;

/** How many patrol cars each star level puts on the street. */
function carsForStars(stars) {
  return [0, 1, 2, 2, 3, 4][stars] || 0;
}

/** How many foot officers each star level puts on the street. */
function officersForStars(stars) {
  return [0, 0, 0, 2, 3, 4][stars] || 0;
}

export function addWanted(G, stars, why) {
  const p = G.player;
  const before = p.wanted;
  p.wanted = Math.max(0, Math.min(MAX_WANTED, p.wanted + stars));
  if (p.wanted > before) {
    p.wantedFlash = 1;
    if (why) G.floaters.push({ x: p.x, y: p.y - 34, text: why, life: 1.6, color: '#ff5a4e' });
  }
  p.lastSeenTimer = 0;
}

export function clearWanted(G, why) {
  G.player.wanted = 0;
  G.player.wantedFlash = 0;
  if (why) G.floaters.push({ x: G.player.x, y: G.player.y - 34, text: why, life: 1.6, color: '#7ddb8a' });
}

function spawnPoliceCar(G, rng) {
  const p = G.player;
  // appear on a road a little off-screen from the player
  let x, y, tries = 0;
  do {
    const pt = randomRoadPoint(rng);
    x = pt.x; y = pt.y;
    tries++;
  } while (Math.hypot(x - p.x, y - p.y) < 420 && tries < 12);
  const car = makeCar(x, y, Math.atan2(p.y - y, p.x - x), 'sedan', 'police', '#1c2733');
  car.top = 620;
  car.accel = 420;
  car.chase = true;
  car.siren = true;
  car.speed = 260;
  G.cars.push(car);
  return car;
}

function spawnOfficer(G, rng) {
  const p = G.player;
  const a = rng() * Math.PI * 2;
  const x = Math.max(60, Math.min(WORLD - 60, p.x + Math.cos(a) * (320 + rng() * 160)));
  const y = Math.max(60, Math.min(WORLD - 60, p.y + Math.sin(a) * (320 + rng() * 160)));
  const officer = {
    x, y, angle: a, speed: 0,
    health: 100, shootCooldown: 1 + rng(), holdTimer: 0,
    color: '#1c2733',
  };
  G.officers.push(officer);
  return officer;
}

/** Drive one patrol car at the player; ram when close. */
function chaseCar(G, car, dt) {
  const p = G.player;
  const dx = p.x - car.x;
  const dy = p.y - car.y;
  const dist = Math.hypot(dx, dy);
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff * 5 * dt));
  const targetSpeed = dist > 320 ? car.top : Math.max(300, car.top * 0.8);
  car.speed = Math.min(car.speed + car.accel * dt, targetSpeed);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const res = collideCircle(G.city, nx, ny, car.len / 2 - 6);
  car.x = res.x;
  car.y = res.y;

  // ramming the player's car (or the player on foot)
  car.ramCooldown -= dt;
  const pd = Math.hypot(p.x - car.x, p.y - car.y);
  if (pd < 46 && car.ramCooldown <= 0) {
    car.ramCooldown = 0.9;
    car.speed *= 0.5;
    G.audio.crash();
    spawnSparks(G, (p.x + car.x) / 2, (p.y + car.y) / 2);
    G.shake = Math.min(12, G.shake + 6);
    if (p.inCar) {
      p.inCar.speed *= 0.5;
      damagePlayer(G, 4);
    } else {
      damagePlayer(G, 10);
    }
  }
}

export function updatePolice(G, dt, rng) {
  const p = G.player;

  // drain the crime queue other systems filled this frame
  while (G.crimes.length > 0) {
    const c = G.crimes.shift();
    addWanted(G, c.stars, c.why);
  }

  const stars = p.wanted;

  // --- spawn / despawn patrol cars ---
  const policeCars = G.cars.filter((c) => c.ai === 'police');
  const wantCars = carsForStars(stars);
  if (policeCars.length < wantCars && Math.random() < dt * 1.2) {
    spawnPoliceCar(G, rng);
  }
  for (const car of [...policeCars]) {
    if (stars === 0) {
      // heat gone: the car gives up and drives off as traffic
      car.ai = 'traffic';
      car.siren = false;
      car.chase = false;
      car.laneDir = Math.floor(Math.random() * 4);
      car.angle = car.laneDir * Math.PI / 2;
      car.speed = 140;
      continue;
    }
    chaseCar(G, car, dt);
  }

  // --- foot officers at 3+ stars ---
  const wantOfficers = officersForStars(stars);
  if (G.officers.length < wantOfficers && Math.random() < dt * 0.8) {
    spawnOfficer(G, rng);
  }
  if (stars < 3) {
    // officers stand down when the heat drops
    G.officers.length = 0;
  }
  for (const off of [...G.officers]) {
    const dx = p.x - off.x;
    const dy = p.y - off.y;
    const dist = Math.hypot(dx, dy);
    off.angle = Math.atan2(dy, dx);
    if (dist > 34) {
      const speed = 195;
      const nx = off.x + Math.cos(off.angle) * speed * dt;
      const ny = off.y + Math.sin(off.angle) * speed * dt;
      const res = collideCircle(G.city, nx, ny, 12);
      off.x = res.x;
      off.y = res.y;
      off.holdTimer = 0;
    } else {
      // officer has a grip on the player: hold still 2s to bust them
      const playerSpeed = p.inCar ? Math.abs(p.inCar.speed) : 0;
      if (playerSpeed < 40 && !p.inCar) {
        off.holdTimer += dt;
        if (off.holdTimer > 2) {
          G.mode = 'busted';
          G.audio.fail();
        }
      } else {
        off.holdTimer = 0;
      }
    }
    // officers shoot when in range (3+ stars) — the bullet comes from combat
    off.shootCooldown -= dt;
    if (dist < 420 && dist > 60 && off.shootCooldown <= 0 && stars >= 3) {
      off.shootCooldown = 1.1 + Math.random() * 0.8;
      G.pendingShots.push({ from: off, target: 'player' });
    }
  }

  // --- heat decay: out of every cop's sight, stars bleed away ---
  const nearestCop = Math.min(
    ...G.cars.filter((c) => c.ai === 'police').map((c) => Math.hypot(c.x - p.x, c.y - p.y)),
    ...G.officers.map((o) => Math.hypot(o.x - p.x, o.y - p.y)),
    Infinity,
  );
  if (stars > 0) {
    if (nearestCop > 700) {
      p.lastSeenTimer += dt;
      if (p.lastSeenTimer > 9) {
        p.wanted -= 1;
        p.lastSeenTimer = 0;
        p.wantedFlash = 0.6;
      }
    } else {
      p.lastSeenTimer = 0;
    }
  }

  // siren audio while any patrol car is close
  const anyNear = G.cars.some((c) => c.ai === 'police' && Math.hypot(c.x - p.x, c.y - p.y) < 800);
  if (anyNear) G.audio.siren(dt);
}

/** Repaint at Talleres Pipo: clears the wanted level for $150. */
export function tryRepaint(G) {
  const p = G.player;
  const lm = G.city.landmarks.pipo;
  const d = Math.hypot(p.x - lm.x, p.y - lm.y);
  if (d > 110) return false;
  if (p.wanted === 0) {
    G.floaters.push({ x: p.x, y: p.y - 30, text: 'NO HEAT TO CLEAR', life: 1.2, color: '#cfc8b8' });
    return false;
  }
  if (p.cash < 150) {
    G.floaters.push({ x: p.x, y: p.y - 30, text: 'NEED $150', life: 1.2, color: '#ff5a4e' });
    return false;
  }
  p.cash -= 150;
  clearWanted(G, 'REPAINTED -$150');
  if (p.inCar) {
    p.inCar.color = ['#c94f3d', '#3d6fc9', '#e0b13c', '#4fae62', '#8a5fb0'][Math.floor(Math.random() * 5)];
  }
  G.audio.cash();
  return true;
}
