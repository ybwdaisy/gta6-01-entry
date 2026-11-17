// vehicles.js — cars: player driving physics, traffic AI, parked cars,
// car theft, collisions and skid/exhaust juice.

import { WORLD, ROAD_CENTERS, ROAD_W, collideCircle, nearestRoadCoord, randomRoadPoint } from './city.js';

const CAR_COLORS = ['#c94f3d', '#3d6fc9', '#e0b13c', '#4fae62', '#8a5fb0', '#d8d8d8', '#2e2e34', '#c97b3d', '#5fb0a8', '#b03d6f'];
const CAR_TYPES = {
  sedan: { w: 44, len: 78, top: 520, accel: 340 },
  coupe: { w: 42, len: 72, top: 600, accel: 400 },
  van: { w: 48, len: 96, top: 420, accel: 260 },
  taxi: { w: 44, len: 78, top: 540, accel: 360 },
  truck: { w: 52, len: 110, top: 380, accel: 230 },
};

let carId = 1;

export function makeCar(x, y, angle, type, ai, color) {
  const spec = CAR_TYPES[type] || CAR_TYPES.sedan;
  return {
    id: carId++,
    x, y, angle, speed: 0,
    type, ai, // 'traffic' | 'parked' | 'player' | 'police' | 'escort' | 'mission'
    color: color || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    w: spec.w, len: spec.len, top: spec.top, accel: spec.accel,
    driver: ai === 'traffic',
    health: 100,
    stuck: 0,
    turnCooldown: 0,
    honkCooldown: 0,
    // traffic AI lane state
    laneDir: 0, // 0 = along +x, 1 = +y, 2 = -x, 3 = -y
    laneOffset: 0,
    stopped: false,
    siren: false,
    // police chase state
    chase: false,
    ramCooldown: 0,
  };
}

/** Fill the city with moving traffic and curb-parked cars. */
export function seedTraffic(G, rng, moving = 16, parked = 14) {
  for (let i = 0; i < moving; i++) {
    const p = randomRoadPoint(rng);
    const type = ['sedan', 'sedan', 'coupe', 'van', 'taxi', 'truck'][Math.floor(rng() * 6)];
    const car = makeCar(p.x, p.y, 0, type, 'traffic');
    car.laneDir = Math.floor(rng() * 4);
    car.angle = car.laneDir * Math.PI / 2;
    car.speed = 90 + rng() * 70;
    car.laneOffset = (rng() < 0.5 ? -1 : 1) * 16;
    G.cars.push(car);
  }
  for (let i = 0; i < parked; i++) {
    const c = ROAD_CENTERS[Math.floor(rng() * ROAD_CENTERS.length)];
    const along = 120 + rng() * (WORLD - 240);
    const side = rng() < 0.5 ? -1 : 1;
    const horizontal = rng() < 0.5;
    const type = ['sedan', 'coupe', 'van'][Math.floor(rng() * 3)];
    const car = makeCar(
      horizontal ? along : c + side * (ROAD_W / 2 + 14),
      horizontal ? c + side * (ROAD_W / 2 + 14) : along,
      horizontal ? (side > 0 ? Math.PI : 0) : (side > 0 ? Math.PI / 2 : -Math.PI / 2),
      type, 'parked');
    car.driver = false;
    G.cars.push(car);
  }
}

function aheadClear(G, car, dist) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  for (const other of G.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * fx + dy * fy;
    if (along > 0 && along < dist) {
      const side = Math.abs(dx * -fy + dy * fx);
      if (side < 34) return false;
    }
  }
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    const dx = ped.x - car.x;
    const dy = ped.y - car.y;
    const along = dx * fx + dy * fy;
    if (along > 0 && along < dist * 0.7) {
      const side = Math.abs(dx * -fy + dy * fx);
      if (side < 26) return false;
    }
  }
  return true;
}

function trafficSteer(G, car, dt) {
  // keep the car glued to its lane: pull toward the nearest road centre line
  const horizontal = car.laneDir === 0 || car.laneDir === 2;
  const targetAngle = car.laneDir * Math.PI / 2;
  let diff = targetAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff * 4 * dt));

  // lane-centring: drift back toward the road centre line
  const pos = horizontal ? car.y : car.x;
  const centre = nearestRoadCoord(pos) + car.laneOffset;
  const off = centre - pos;
  const steer = Math.max(-1, Math.min(1, off * 0.02));
  car.angle += steer * dt * (car.laneDir % 2 === 0 ? 1 : -1) * 0.6;

  // at an intersection, sometimes pick a new direction
  car.turnCooldown -= dt;
  const nearCentre = Math.abs(pos - nearestRoadCoord(pos)) < 26;
  const cross = horizontal
    ? Math.abs(car.x - nearestRoadCoord(car.x)) < 26
    : Math.abs(car.y - nearestRoadCoord(car.y)) < 26;
  if (nearCentre && cross && car.turnCooldown <= 0 && Math.random() < 0.25) {
    const options = [0, 1, 2, 3].filter((d) => d !== (car.laneDir + 2) % 4);
    car.laneDir = options[Math.floor(Math.random() * options.length)];
    car.laneOffset = (Math.random() < 0.5 ? -1 : 1) * 16;
    car.turnCooldown = 2.5;
  }
}

/** Drive one car forward with collision. Slides along walls on glancing
 *  hits (axis-separated retry) instead of dead-stopping. Returns true only
 *  when the car is properly blocked. */
function moveCar(G, car, dt) {
  const dx = Math.cos(car.angle) * car.speed * dt;
  const dy = Math.sin(car.angle) * car.speed * dt;
  const r = car.len / 2 - 6;
  let res = collideCircle(G.city, car.x + dx, car.y + dy, r);
  let bumped = res.hit;
  if (bumped) {
    const rx = collideCircle(G.city, car.x + dx, car.y, r);
    const ry = collideCircle(G.city, car.x, car.y + dy, r);
    const mx = Math.hypot(rx.x - car.x, rx.y - car.y);
    const my = Math.hypot(ry.x - car.x, ry.y - car.y);
    if (mx >= my && mx > 0.5) { res = rx; bumped = false; }
    else if (my > 0.5) { res = ry; bumped = false; }
  }
  car.x = res.x;
  car.y = res.y;
  return bumped;
}

function carHitsCar(G, car) {
  for (const other of G.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const d = Math.hypot(dx, dy);
    const min = (car.len + other.len) / 2 - 14;
    if (d > 0.01 && d < min) {
      const push = (min - d) / 2;
      const ux = dx / d;
      const uy = dy / d;
      car.x -= ux * push;
      car.y -= uy * push;
      other.x += ux * push;
      other.y += uy * push;
      if (Math.abs(car.speed) > 60 || Math.abs(other.speed) > 60) {
        car.speed *= 0.6;
        other.speed *= 0.6;
        spawnSparks(G, car.x + ux * 20, car.y + uy * 20);
      }
      return other;
    }
  }
  return null;
}

export function spawnSparks(G, x, y) {
  for (let i = 0; i < 8; i++) {
    G.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 260,
      vy: (Math.random() - 0.5) * 260,
      life: 0.35, maxLife: 0.35,
      color: '#ffd76a', size: 2.5, kind: 'spark',
    });
  }
}

export function spawnExhaust(G, car) {
  const bx = car.x - Math.cos(car.angle) * car.len / 2;
  const by = car.y - Math.sin(car.angle) * car.len / 2;
  G.particles.push({
    x: bx, y: by,
    vx: -Math.cos(car.angle) * 30 + (Math.random() - 0.5) * 30,
    vy: -Math.sin(car.angle) * 30 + (Math.random() - 0.5) * 30,
    life: 0.6, maxLife: 0.6,
    color: '#9a9a9a', size: 5, kind: 'smoke',
  });
}

export function addSkid(G, x, y, angle) {
  G.skids.push({ x, y, angle, life: 6 });
  if (G.skids.length > 220) G.skids.shift();
}

/** Player driving: arcade handling with drift, skid marks and exhaust. */
function updatePlayerCar(G, car, dt, input) {
  const fwd = (input.keys.has('up') ? 1 : 0) - (input.keys.has('down') ? 0.7 : 0);
  const steer = (input.keys.has('left') ? -1 : 0) + (input.keys.has('right') ? 1 : 0);
  const braking = input.keys.has('brake');

  if (fwd > 0) car.speed += car.accel * fwd * dt;
  else if (fwd < 0) car.speed += car.accel * fwd * dt * 0.8;
  else car.speed *= Math.max(0, 1 - 0.7 * dt);
  if (braking) car.speed *= Math.max(0, 1 - 3.2 * dt);
  car.speed = Math.max(-160, Math.min(car.top, car.speed));

  const speedFactor = Math.max(0.25, Math.min(1, Math.abs(car.speed) / 220));
  car.angle += steer * 1.9 * speedFactor * dt * (car.speed >= 0 ? 1 : -1);

  const drifting = Math.abs(steer) > 0 && Math.abs(car.speed) > 300;
  if (drifting && Math.random() < 0.6) {
    addSkid(G, car.x, car.y, car.angle);
    if (Math.random() < 0.25) G.audio.skid();
  }
  if (Math.abs(car.speed) > 40 && Math.random() < 0.3) spawnExhaust(G, car);

  const bumped = moveCar(G, car, dt);
  if (bumped && Math.abs(car.speed) > 120) {
    G.audio.crash();
    spawnSparks(G, car.x, car.y);
    G.shake = Math.min(10, G.shake + 5);
    car.speed *= 0.55;
    // a hard wall hit can hurt the driver
    if (Math.abs(car.speed) > 200) damagePlayer(G, 6);
  }
  carHitsCar(G, car);
  // running over pedestrians: hit-and-run heat, ped goes down
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.x - car.x, ped.y - car.y);
    if (d < 30 && Math.abs(car.speed) > 60) {
      ped.state = 'down';
      ped.downTimer = 3;
      ped.health = 0;
      G.audio.hit();
      spawnSparks(G, ped.x, ped.y);
      G.floaters.push({ x: ped.x, y: ped.y - 20, text: 'HIT AND RUN', life: 1.4, color: '#ff5a4e' });
      // queue the crime; police.js drains G.crimes each frame (no import cycle)
      G.crimes.push({ stars: 1, why: 'hit-and-run' });
    }
  }
}

/** The player takes damage (armor absorbs first). */
export function damagePlayer(G, amount) {
  if (G.player.armor > 0) {
    const absorbed = Math.min(G.player.armor, amount);
    G.player.armor -= absorbed;
    amount -= absorbed;
  }
  G.player.health -= amount;
  G.flash = 0.35;
  if (G.player.health <= 0) {
    G.player.health = 0;
    G.mode = 'wasted';
    G.audio.fail();
  }
}

export function updateVehicles(G, dt, input) {
  const player = G.player;
  for (const car of G.cars) {
    if (car.ai === 'player') {
      updatePlayerCar(G, car, dt, input);
      continue;
    }
    if (car.ai === 'parked' || car.ai === 'mission') continue;
    if (car.ai === 'police') continue; // police.js drives its own cars
    if (car.ai === 'escort') continue; // missions.js drives the escort van
    // traffic
    const clear = aheadClear(G, car, 90);
    if (!clear) {
      car.speed = Math.max(0, car.speed - 300 * dt);
      car.honkCooldown -= dt;
      if (car.honkCooldown <= 0 && Math.random() < 0.01) {
        G.audio.horn();
        car.honkCooldown = 4;
      }
    } else {
      car.speed = Math.min(car.speed + 60 * dt, 150);
    }
    trafficSteer(G, car, dt);
    moveCar(G, car, dt);
    carHitsCar(G, car);
    // recycle far-away traffic near the player so streets stay alive
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d > 1600) {
      car.x = Math.max(80, Math.min(WORLD - 80, player.x + (Math.random() - 0.5) * 1400));
      car.y = Math.max(80, Math.min(WORLD - 80, player.y + (Math.random() - 0.5) * 1400));
      car.laneDir = Math.floor(Math.random() * 4);
      car.angle = car.laneDir * Math.PI / 2;
    }
  }
}

/** Nearest car within reach of the player (for E to enter / steal). */
export function nearestCar(G, maxDist = 70) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    const d = Math.hypot(car.x - G.player.x, car.y - G.player.y);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

/** Put the player into a car (stealing adds heat when it has a driver). */
export function enterCar(G, car) {
  const player = G.player;
  if (car.ai === 'parked' || car.ai === 'mission') {
    // a parked car — or a mission target like the gold coupe — is there for the taking
    car.ai = 'player';
    player.inCar = car;
    player.x = car.x;
    player.y = car.y;
    return { stolen: true, hadDriver: false };
  }
  if (car.ai === 'traffic' && car.driver) {
    // yank the driver out onto the sidewalk
    car.driver = false;
    car.ai = 'player';
    player.inCar = car;
    player.x = car.x;
    player.y = car.y;
    G.peds.push({
      x: car.x + 30, y: car.y + 30, angle: 0, speed: 0,
      state: 'flee', health: 100, color: '#e0b13c', timer: 0, downTimer: 0,
    });
    return { stolen: true, hadDriver: true };
  }
  if (car.ai === 'traffic' && !car.driver) {
    car.ai = 'player';
    player.inCar = car;
    player.x = car.x;
    player.y = car.y;
    return { stolen: true, hadDriver: false };
  }
  return { stolen: false, hadDriver: false };
}

/** Step out of the car onto the road beside it. */
export function exitCar(G) {
  const player = G.player;
  const car = player.inCar;
  if (!car) return;
  car.ai = 'parked';
  car.speed = 0;
  player.inCar = null;
  const side = Math.cos(car.angle + Math.PI / 2);
  const sideY = Math.sin(car.angle + Math.PI / 2);
  player.x = car.x + side * 42;
  player.y = car.y + sideY * 42;
  player.angle = car.angle;
  const res = collideCircle(G.city, player.x, player.y, 16);
  player.x = res.x;
  player.y = res.y;
}
