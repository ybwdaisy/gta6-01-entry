// Car physics, traffic AI and spawning. Traffic cars follow road lanes,
// stop for cars and pedestrians ahead, and turn at intersections.
import { ROADS, ROAD_W, WORLD, nearestRoadCoord, collideBuildings, clampWorld } from './city.js';

const CAR_COLORS = [
  '#e74c3c', '#3498db', '#f1c40f', '#ecf0f1', '#2ecc71', '#9b59b6',
  '#e67e22', '#1abc9c', '#fd79a8', '#636e72', '#d63031', '#00cec9',
  '#6c5ce7', '#fdcb6e', '#0984e3', '#00b894',
];
const CAR_NAMES = [
  'Cometa', 'Brisa', 'Coral GT', 'Vela', 'Tornado', 'Palmera',
  'Onda', 'Faro', 'Marlin', 'Solana', 'Brisa LX', 'Coral S',
];

export function makeCar(x, y, angle, opts = {}) {
  return {
    x, y, angle,
    speed: 0,
    color: opts.color || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    name: opts.name || CAR_NAMES[Math.floor(Math.random() * CAR_NAMES.length)],
    traffic: !!opts.traffic,
    parked: !!opts.parked,
    police: !!opts.police,
    target: opts.target || null,
    lane: opts.lane ?? 1,
    axis: opts.axis || 'h',
    along: opts.along ?? x,
    turnCooldown: 0,
    driver: opts.driver !== false,
    hp: 100,
    stuck: 0,
  };
}

function laneOffset(car) {
  return (car.lane === 1 ? 1 : -1) * 22;
}

// Snap a traffic car onto its road and drive along it.
export function spawnTrafficCar(rng, player) {
  const horizontal = rng() > 0.5;
  const road = ROADS[Math.floor(rng() * ROADS.length)];
  const along = 120 + rng() * (WORLD - 240);
  const lane = rng() > 0.5 ? 1 : -1;
  const angle = horizontal ? (lane === 1 ? 0 : Math.PI) : (lane === 1 ? Math.PI / 2 : -Math.PI / 2);
  const x = horizontal ? along : road + laneOffset({ lane });
  const y = horizontal ? road + laneOffset({ lane }) : along;
  const car = makeCar(x, y, angle, { traffic: true, lane, axis: horizontal ? 'h' : 'v', along });
  // Keep traffic away from the player's immediate view at spawn.
  if (Math.hypot(car.x - player.x, car.y - player.y) < 500) return null;
  return car;
}

export function spawnParkedCar(rng, city, player) {
  for (let tries = 0; tries < 12; tries++) {
    const horizontal = rng() > 0.5;
    const road = ROADS[Math.floor(rng() * ROADS.length)];
    const along = 200 + rng() * (WORLD - 400);
    const side = rng() > 0.5 ? 1 : -1;
    const off = ROAD_W / 2 - 14;
    const x = horizontal ? along : road + side * off;
    const y = horizontal ? road + side * off : along;
    if (Math.hypot(x - player.x, y - player.y) < 260) continue;
    if (collideBuildings(x, y, 26, city.buildings)) continue;
    const angle = horizontal ? (side === 1 ? 0 : Math.PI) : (side === 1 ? Math.PI / 2 : -Math.PI / 2);
    return makeCar(x, y, angle, { parked: true });
  }
  return null;
}

function carAhead(S, car, dist) {
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  let best = null, bestD = dist;
  for (const o of S.cars) {
    if (o === car) continue;
    const dx = o.x - car.x, dy = o.y - car.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(-dx * fy + dy * fx);
    if (along > 0 && along < bestD && side < 30) { best = o; bestD = along; }
  }
  for (const p of S.peds) {
    const dx = p.x - car.x, dy = p.y - car.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(-dx * fy + dy * fx);
    if (along > 0 && along < bestD && side < 26) { best = p; bestD = along; }
  }
  return best;
}

export function updateTraffic(S, dt) {
  for (const car of S.cars) {
    if (!car.traffic) continue;
    car.turnCooldown -= dt;
    const ahead = carAhead(S, car, 90);
    const targetSpeed = ahead ? 0 : 95;
    car.speed += Math.sign(targetSpeed - car.speed) * 140 * dt;
    if (Math.abs(car.speed) < 2) car.speed = targetSpeed === 0 ? 0 : car.speed;
    car.speed = Math.max(0, Math.min(110, car.speed));

    // Move along its axis; turn at intersections.
    const step = car.speed * dt;
    if (car.axis === 'h') {
      car.x += Math.cos(car.angle) * step;
      car.y = nearestRoadCoord(car.y) + laneOffset(car);
    } else {
      car.y += Math.sin(car.angle) * step;
      car.x = nearestRoadCoord(car.x) + laneOffset(car);
    }
    // Intersection: chance to turn 90 degrees.
    const along = car.axis === 'h' ? car.x : car.y;
    const near = ROADS.some((r) => Math.abs(along - r) < 26);
    if (near && car.turnCooldown <= 0 && Math.random() < 0.35) {
      car.turnCooldown = 4;
      const turnLeft = Math.random() > 0.5;
      const newAngle = car.angle + (turnLeft ? -Math.PI / 2 : Math.PI / 2);
      car.angle = newAngle;
      car.axis = car.axis === 'h' ? 'v' : 'h';
      if (car.axis === 'h') car.y = nearestRoadCoord(car.y) + laneOffset(car);
      else car.x = nearestRoadCoord(car.x) + laneOffset(car);
    }
    // Wrap around the world edge instead of despawning mid-screen.
    if (car.x < -80) car.x = WORLD + 60;
    if (car.x > WORLD + 80) car.x = -60;
    if (car.y < -80) car.y = WORLD + 60;
    if (car.y > WORLD + 80) car.y = -60;
  }
  // Keep traffic density up near the player.
  const nearCount = S.cars.filter((c) => c.traffic && Math.hypot(c.x - S.player.x, c.y - S.player.y) < 900).length;
  if (nearCount < 7 && Math.random() < dt * 0.8) {
    const c = spawnTrafficCar(Math.random, S.player);
    if (c) S.cars.push(c);
  }
  const parkedCount = S.cars.filter((c) => c.parked).length;
  if (parkedCount < 10 && Math.random() < dt * 0.5) {
    const c = spawnParkedCar(Math.random, S.city, S.player);
    if (c) S.cars.push(c);
  }
}

// Player-driven car physics: arcade handling, drift, skid marks.
export function updatePlayerCar(S, dt) {
  const car = S.player.car;
  if (!car) return;
  const input = S.input;
  const forward = input.down('KeyW', 'ArrowUp');
  const back = input.down('KeyS', 'ArrowDown');
  const left = input.down('KeyA', 'ArrowLeft');
  const right = input.down('KeyD', 'ArrowRight');
  const brake = input.down('Space');

  const accel = forward ? 320 : back ? -220 : 0;
  const prevSpeed = car.speed;
  car.speed += accel * dt;
  if (brake) car.speed *= Math.max(0, 1 - 3.2 * dt);
  car.speed *= Math.max(0, 1 - 0.35 * dt);
  car.speed = Math.max(-160, Math.min(430, car.speed));

  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const grip = Math.min(1, Math.abs(car.speed) / 120);
  car.angle += steer * 2.1 * grip * dt * Math.sign(car.speed || 1);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hit = collideBuildings(nx, ny, 22, S.city.buildings);
  if (hit) {
    if (Math.abs(car.speed) > 180) {
      S.audio.crash();
      S.shake = Math.min(14, Math.abs(car.speed) / 30);
      S.addSparks(car.x, car.y, 10);
      car.hp -= 12;
      if (car.hp <= 0) { S.explodeCar(car); }
    }
    car.speed *= -0.25;
  } else {
    car.x = nx; car.y = ny;
  }
  clampWorld(car, 30);

  // Skid marks + sound on hard turns at speed.
  if (Math.abs(steer) > 0 && Math.abs(car.speed) > 240) {
    S.addSkid(car.x, car.y, car.angle);
    if (Math.random() < dt * 6) S.audio.skid();
  }
  // Exhaust puffs.
  if (Math.abs(car.speed) > 60 && Math.random() < dt * 8) {
    S.addExhaust(car.x - Math.cos(car.angle) * 26, car.y - Math.sin(car.angle) * 26);
  }
  // Bumping traffic / peds.
  for (const o of S.cars) {
    if (o === car || o.police) continue;
    const d = Math.hypot(o.x - car.x, o.y - car.y);
    if (d < 44 && Math.abs(car.speed) > 60) {
      o.speed = car.speed * 0.4;
      o.x += Math.cos(car.angle) * 14; o.y += Math.sin(car.angle) * 14;
      if (Math.abs(car.speed) > 200) { S.audio.crash(); S.addSparks(o.x, o.y, 8); }
    }
  }
  for (const p of S.peds) {
    const d = Math.hypot(p.x - car.x, p.y - car.y);
    if (d < 30 && Math.abs(car.speed) > 40) {
      S.hitPed(p, car);
    }
  }
  S.audio.setEngine(true, Math.abs(car.speed) / 430);
  S.player.speed = Math.abs(car.speed);
  S.player.x = car.x; S.player.y = car.y;
  void prevSpeed;
}

export function enterCar(S, car) {
  S.player.car = car;
  car.traffic = false;
  car.parked = false;
  S.player.x = car.x; S.player.y = car.y;
}

export function exitCar(S) {
  const car = S.player.car;
  if (!car) return;
  car.speed = 0;
  const side = car.angle + Math.PI / 2;
  S.player.x = car.x + Math.cos(side) * 34;
  S.player.y = car.y + Math.sin(side) * 34;
  S.player.car = null;
  S.audio.setEngine(false, 0);
}
