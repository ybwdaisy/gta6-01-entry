// pedestrians.js — people on the sidewalks: strollers, panickers, taxi
// customers and mission debtors. They walk, flee danger, and scream.

import { WORLD, collideCircle, randomSidewalkPoint, isOnRoad } from './city.js';

const SHIRT_COLORS = ['#e0b13c', '#4fae62', '#c94f3d', '#5b7d9e', '#b03d6f', '#e8e2d4', '#8a5fb0', '#d97b3d'];
const PANTS_COLORS = ['#2e2e34', '#3d4a5c', '#5c463d', '#24402e'];

export function makePed(x, y, state = 'walk') {
  return {
    x, y,
    angle: Math.random() * Math.PI * 2,
    speed: 45 + Math.random() * 35,
    state, // 'walk' | 'flee' | 'panic' | 'down' | 'taxi' | 'debtor' | 'dead'
    health: 100,
    color: SHIRT_COLORS[Math.floor(Math.random() * SHIRT_COLORS.length)],
    pants: PANTS_COLORS[Math.floor(Math.random() * PANTS_COLORS.length)],
    timer: 0,
    downTimer: 0,
    screamCooldown: 2 + Math.random() * 4,
    targetX: x,
    targetY: y,
    bob: Math.random() * 10,
  };
}

export function seedPeds(G, rng, count = 26) {
  for (let i = 0; i < count; i++) {
    const p = randomSidewalkPoint(rng);
    G.peds.push(makePed(p.x, p.y, 'walk'));
  }
}

/** Peds near (x,y) within radius panic and run away from the danger. */
export function scarePeds(G, x, y, radius = 260) {
  for (const ped of G.peds) {
    if (ped.state === 'down' || ped.state === 'dead') continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) {
      ped.state = 'panic';
      ped.timer = 2.5 + Math.random() * 2;
      const away = Math.atan2(ped.y - y, ped.x - x);
      ped.targetX = ped.x + Math.cos(away) * 300;
      ped.targetY = ped.y + Math.sin(away) * 300;
    }
  }
}

function pickStrollTarget(ped) {
  const a = Math.random() * Math.PI * 2;
  const dist = 120 + Math.random() * 260;
  ped.targetX = Math.max(60, Math.min(WORLD - 60, ped.x + Math.cos(a) * dist));
  ped.targetY = Math.max(60, Math.min(WORLD - 60, ped.y + Math.sin(a) * dist));
}

export function updatePeds(G, dt) {
  const player = G.player;
  for (const ped of G.peds) {
    ped.bob += dt * 8;
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.state = 'flee';
        ped.timer = 3;
        ped.health = 50;
      }
      continue;
    }
    if (ped.state === 'dead') continue;

    // a speeding car right on top of a ped makes them dive away
    if (ped.state === 'walk' || ped.state === 'taxi') {
      for (const car of G.cars) {
        if (Math.abs(car.speed) < 120) continue;
        const d = Math.hypot(ped.x - car.x, ped.y - car.y);
        if (d < 70) {
          ped.state = 'panic';
          ped.timer = 2;
          const away = Math.atan2(ped.y - car.y, ped.x - car.x);
          ped.targetX = ped.x + Math.cos(away) * 260;
          ped.targetY = ped.y + Math.sin(away) * 260;
          break;
        }
      }
    }

    if (ped.state === 'panic' || ped.state === 'flee') {
      ped.timer -= dt;
      ped.screamCooldown -= dt;
      if (ped.screamCooldown <= 0 && Math.random() < 0.3) {
        G.audio.hit(); // short yelp through the hit blip
        ped.screamCooldown = 3 + Math.random() * 3;
      }
      const dx = ped.targetX - ped.x;
      const dy = ped.targetY - ped.y;
      const d = Math.hypot(dx, dy);
      if (d < 12 || ped.timer <= 0) {
        ped.state = 'walk';
        pickStrollTarget(ped);
        continue;
      }
      const speed = ped.state === 'panic' ? 210 : 170;
      ped.angle = Math.atan2(dy, dx);
      const nx = ped.x + Math.cos(ped.angle) * speed * dt;
      const ny = ped.y + Math.sin(ped.angle) * speed * dt;
      const res = collideCircle(G.city, nx, ny, 12);
      ped.x = res.x;
      ped.y = res.y;
      continue;
    }

    if (ped.state === 'taxi' || ped.state === 'debtor') {
      // waiting customers and debtors stand still (missions move them)
      continue;
    }

    // ordinary strolling: walk toward the target, pick a new one on arrival
    ped.timer -= dt;
    const dx = ped.targetX - ped.x;
    const dy = ped.targetY - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 14 || ped.timer <= 0) {
      pickStrollTarget(ped);
      ped.timer = 6 + Math.random() * 6;
      continue;
    }
    ped.angle = Math.atan2(dy, dx);
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    // peds avoid stepping onto the road unless they must cross: slow them there
    const speed = isOnRoad(nx, ny) ? ped.speed * 1.4 : ped.speed;
    const res = collideCircle(G.city, ped.x + Math.cos(ped.angle) * speed * dt, ped.y + Math.sin(ped.angle) * speed * dt, 12);
    ped.x = res.x;
    ped.y = res.y;
  }

  // keep the streets populated near the player
  const near = G.peds.filter((p) => Math.hypot(p.x - player.x, p.y - player.y) < 900).length;
  if (near < 14 && Math.random() < 0.02) {
    const p = randomSidewalkPoint(Math.random);
    const px = Math.max(60, Math.min(WORLD - 60, player.x + (Math.random() - 0.5) * 1200));
    const py = Math.max(60, Math.min(WORLD - 60, player.y + (Math.random() - 0.5) * 1200));
    void p;
    G.peds.push(makePed(px, py, 'walk'));
  }
}
