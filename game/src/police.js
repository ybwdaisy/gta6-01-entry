// Wanted system (0-5 stars) and the Serena Bay PD: patrol cars that chase
// and ram, foot officers at 3+ stars who shoot, busted / wasted endings.
import { WORLD, nearestRoadCoord } from './city.js';

export const WANTED_DECAY_SECONDS = 26;

export function addWanted(S, stars, reason) {
  const before = S.player.wanted;
  S.player.wanted = Math.min(5, S.player.wanted + stars);
  if (S.player.wanted > before) {
    S.toast(`${reason} — wanted level ${S.player.wanted}★`, 2.5);
    S.audio.setSiren(S.player.wanted >= 2);
  }
}

export function clearWanted(S, reason) {
  S.player.wanted = 0;
  S.player.wantedTimer = 0;
  S.audio.setSiren(false);
  if (reason) S.toast(reason, 2.5);
}

export function updateWanted(S, dt) {
  const p = S.player;
  if (p.wanted === 0) return;
  // Heat cools only while no cop can see the player.
  const seen = S.cops.some((c) => c.kind === 'car' && Math.hypot(c.x - p.x, c.y - p.y) < 420)
    || S.cops.some((c) => c.kind === 'officer' && Math.hypot(c.x - p.x, c.y - p.y) < 260);
  if (!seen) {
    p.wantedTimer += dt;
    if (p.wantedTimer >= WANTED_DECAY_SECONDS) {
      p.wantedTimer = 0;
      p.wanted -= 1;
      S.toast(p.wanted === 0 ? 'You lost them — heat is off.' : `Heat cooling… ${p.wanted}★ left`, 2);
      S.audio.setSiren(p.wanted >= 2);
    }
  } else {
    p.wantedTimer = 0;
  }
}

export function spawnCopCar(S, rng = Math.random) {
  const p = S.player;
  const angle = rng() * Math.PI * 2;
  const dist = 620 + rng() * 200;
  const x = Math.max(80, Math.min(WORLD - 80, p.x + Math.cos(angle) * dist));
  const y = Math.max(80, Math.min(WORLD - 80, p.y + Math.sin(angle) * dist));
  const car = {
    x, y, angle: Math.atan2(p.y - y, p.x - x),
    speed: 0, color: '#1c2733', name: 'SBPD Interceptor',
    traffic: false, parked: false, police: true,
    hp: 100, kind: 'car', ramCooldown: 0,
  };
  S.cops.push(car);
  S.cars.push(car);
  return car;
}

export function spawnOfficer(S, rng = Math.random) {
  const p = S.player;
  const angle = rng() * Math.PI * 2;
  const x = p.x + Math.cos(angle) * 200;
  const y = p.y + Math.sin(angle) * 200;
  const off = {
    x, y, angle: 0, speed: 0, hp: 100, kind: 'officer',
    shootCooldown: 1 + rng(), holdTime: 0, walkPhase: rng() * 6,
  };
  S.cops.push(off);
  return off;
}

function desiredCopCount(wanted) {
  return wanted === 0 ? 0 : wanted === 1 ? 1 : wanted === 2 ? 2 : wanted === 3 ? 3 : wanted === 4 ? 4 : 5;
}

export function updatePolice(S, dt) {
  const p = S.player;
  const want = desiredCopCount(p.wanted);
  const carCount = S.cops.filter((c) => c.kind === 'car').length;
  const offCount = S.cops.filter((c) => c.kind === 'officer').length;
  if (carCount < want && Math.random() < dt * 1.2) spawnCopCar(S);
  if (p.wanted >= 3 && offCount < p.wanted - 2 && Math.random() < dt * 0.8) spawnOfficer(S);

  for (const cop of [...S.cops]) {
    if (cop.kind === 'car') {
      cop.ramCooldown -= dt;
      const dx = p.x - cop.x, dy = p.y - cop.y;
      const dist = Math.hypot(dx, dy) || 1;
      const wantAngle = Math.atan2(dy, dx);
      let diff = wantAngle - cop.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cop.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
      const top = 260 + p.wanted * 42;
      cop.speed += (top - cop.speed) * Math.min(1, 1.4 * dt);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      // Ram the player's car.
      if (p.car && dist < 52 && cop.ramCooldown <= 0) {
        cop.ramCooldown = 1.2;
        p.car.hp -= 8;
        S.audio.crash();
        S.shake = Math.min(12, S.shake + 5);
        S.addSparks(p.car.x, p.car.y, 8);
        if (p.car.hp <= 0) S.explodeCar(p.car);
      }
      // Cop on foot contact: busted hold.
      if (!p.car && dist < 34) {
        cop.holdTime = (cop.holdTime || 0) + dt;
      } else cop.holdTime = 0;
      if (dist > 1400) { removeCop(S, cop); }
    } else {
      // Foot officer: run at the player, shoot at 3+ stars, hold to bust.
      const dx = p.x - cop.x, dy = p.y - cop.y;
      const dist = Math.hypot(dx, dy) || 1;
      cop.angle = Math.atan2(dy, dx);
      cop.walkPhase += dt * 10;
      const speed = dist > 60 ? 150 : 0;
      cop.x += Math.cos(cop.angle) * speed * dt;
      cop.y += Math.sin(cop.angle) * speed * dt;
      cop.shootCooldown -= dt;
      if (dist < 420 && cop.shootCooldown <= 0 && p.wanted >= 3) {
        cop.shootCooldown = 1.1 + Math.random() * 0.7;
        S.copShoot(cop, p);
      }
      if (dist < 30 && Math.abs(p.speed || 0) < 20) {
        cop.holdTime += dt;
        if (cop.holdTime > 2) { S.busted(); return; }
      } else cop.holdTime = 0;
      if (dist > 1200) removeCop(S, cop);
    }
  }
  // Drop extra cops when heat falls.
  while (S.cops.filter((c) => c.kind === 'car').length > want) {
    const c = S.cops.find((x) => x.kind === 'car');
    removeCop(S, c);
  }
  while (S.cops.filter((c) => c.kind === 'officer').length > Math.max(0, p.wanted - 2)) {
    const c = S.cops.find((x) => x.kind === 'officer');
    removeCop(S, c);
  }
}

export function removeCop(S, cop) {
  if (!cop) return;
  S.cops = S.cops.filter((c) => c !== cop);
  if (cop.kind === 'car') S.cars = S.cars.filter((c) => c !== cop);
}
