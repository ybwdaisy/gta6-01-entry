// shots.js — deterministic screenshot scenes (?shot=cover|drive|foot|chase
// &seed=7). Each stages the world so the cover shows a chase with the
// mission HUD, and the others show driving, on-foot play and a shootout.
// main.js sets window.__shotReady after a few frames have rendered.

import { mulberry32 } from './city.js';
import { makeCar } from './vehicles.js';
import { makePed } from './pedestrians.js';
import { addWanted } from './police.js';

/** Place a few traffic cars around a point, on the roads. */
function stageTraffic(G, rng, cx, cy, count) {
  for (let i = 0; i < count; i++) {
    const x = cx + (rng() - 0.5) * 700;
    const y = cy + (rng() - 0.5) * 500;
    const car = makeCar(x, y, Math.floor(rng() * 4) * Math.PI / 2, ['sedan', 'coupe', 'van', 'taxi'][Math.floor(rng() * 4)], 'traffic');
    car.speed = 100 + rng() * 60;
    G.cars.push(car);
  }
}

/** Scatter pedestrians on the sidewalks around a point. */
function stagePeds(G, rng, cx, cy, count) {
  for (let i = 0; i < count; i++) {
    const ped = makePed(cx + (rng() - 0.5) * 600, cy + (rng() - 0.5) * 400, 'walk');
    G.peds.push(ped);
  }
}

/** Put the player in a car at (x,y) heading `angle`. */
function stagePlayerCar(G, x, y, angle, color) {
  const car = makeCar(x, y, angle, 'sedan', 'player', color || '#c94f3d');
  car.speed = 320;
  G.cars.push(car);
  const p = G.player;
  p.inCar = car;
  p.x = x;
  p.y = y;
  p.angle = angle;
  return car;
}

/** A patrol car chasing the player from behind. */
function stageChaser(G, x, y, angle) {
  const car = makeCar(x, y, angle, 'sedan', 'police', '#1c2733');
  car.top = 620;
  car.speed = 300;
  car.siren = true;
  G.cars.push(car);
  return car;
}

export function setupShot(G, mode, seed = 7) {
  const rng = mulberry32(seed);
  const p = G.player;
  const L = G.city.landmarks;
  G.shotMode = mode;

  if (mode === 'cover') {
    // The cover: a chase with the mission HUD — Marco fleeing down Calle Mayor
    // in Marta's borrowed sedan, two SBPD cruisers on his tail, First Run live.
    stagePlayerCar(G, 1200, 1120, 0, '#c94f3d');
    stageChaser(G, 1020, 1136, 0);
    stageChaser(G, 960, 1088, 0);
    stageTraffic(G, rng, 1400, 1120, 4);
    stagePeds(G, rng, 1200, 1120, 8);
    addWanted(G, 3, 'CHASE');
    G.mission.index = 0;
    G.mission.phase = 'active';
    G.mission.timer = 62;
    G.mission.target = { x: L.marina.x, y: L.marina.y, label: 'Marina Serena' };
    G.banner = { text: 'First Run — Drive the package to Marina Serena', timer: 999 };
    p.cash = 1250;
    p.health = 82;
    p.armor = 40;
    p.ammo = 9;
  } else if (mode === 'drive') {
    // Driving through downtown with traffic and the gold-coupe job on the HUD.
    stagePlayerCar(G, 1440, 1760, -Math.PI / 2, '#3d6fc9');
    stageTraffic(G, rng, 1440, 1500, 6);
    stagePeds(G, rng, 1440, 1600, 7);
    G.mission.index = 1;
    G.mission.phase = 'active';
    G.mission.target = { x: 1000, y: 1120, label: 'Gold Coupe' };
    const coupe = makeCar(1000, 1120, Math.PI, 'coupe', 'mission', '#e0b13c');
    G.cars.push(coupe);
    G.banner = { text: 'Loud Money — Steal the gold coupe at Market Square', timer: 999 };
    p.cash = 1750;
  } else if (mode === 'foot') {
    // On foot in Market Square, peds strolling, the gold coupe waiting.
    p.inCar = null;
    p.x = 1120;
    p.y = 1180;
    p.angle = Math.PI / 2;
    stagePeds(G, rng, 1120, 1120, 12);
    stageTraffic(G, rng, 1120, 800, 3);
    const coupe = makeCar(1000, 1120, Math.PI, 'coupe', 'mission', '#e0b13c');
    G.cars.push(coupe);
    G.mission.index = 1;
    G.mission.phase = 'active';
    G.mission.target = { x: 1000, y: 1120, label: 'Gold Coupe' };
    G.banner = { text: 'Loud Money — Steal the gold coupe at Market Square', timer: 999 };
    p.cash = 1750;
    p.health = 100;
    p.armor = 25;
  } else if (mode === 'chase') {
    // Police shootout on the beach: 4 stars, officers closing in, boat run live.
    p.inCar = null;
    p.x = 2440;
    p.y = 1500;
    p.angle = -Math.PI / 2;
    p.health = 64;
    p.armor = 10;
    p.ammo = 7;
    addWanted(G, 4, '4 STARS');
    stageChaser(G, 2320, 1440, 0.4);
    stageChaser(G, 2280, 1600, -0.3);
    for (let i = 0; i < 3; i++) {
      const a = rng() * Math.PI * 2;
      G.officers.push({
        x: p.x + Math.cos(a) * (180 + rng() * 120),
        y: p.y + Math.sin(a) * (180 + rng() * 120),
        angle: a, speed: 0, health: 100,
        shootCooldown: 0.2 + rng() * 0.5, holdTimer: 0, color: '#1c2733',
      });
    }
    stagePeds(G, rng, 2440, 1300, 5);
    // a couple of tracer rounds already in the air
    G.bullets.push({
      x: p.x - 120, y: p.y - 60, vx: 700, vy: 260, life: 0.6, from: 'police', damage: 9,
    });
    G.mission.index = 5;
    G.mission.phase = 'active';
    G.mission.timer = 118;
    G.mission.target = { x: L.lighthouse.x, y: L.lighthouse.y, label: 'Lighthouse Boat' };
    G.banner = { text: 'Serena Goodbye — Reach the Lighthouse boat', timer: 999 };
    p.cash = 4300;
  }

  // camera snaps to the player; the sun is high for the shots
  G.camera.x = p.x;
  G.camera.y = p.y;
  G.clock = 10 * 60 + 25; // 10:25, bright morning light
}
