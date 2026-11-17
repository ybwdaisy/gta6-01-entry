// Pedestrian AI: walk the sidewalks, cross at intersections, flee gunfire
// and runaway cars, panic screams (visual), wander the beach and market.
import { ROADS, ROAD_W, WORLD, nearestRoadCoord, resolveBuildingCollision, clampWorld } from './city.js';

const SHIRTS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#fd79a8', '#dfe6e9', '#fdcb6e'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

export function makePed(x, y, rng) {
  const horizontal = rng() > 0.5;
  const road = ROADS[Math.floor(rng() * ROADS.length)];
  return {
    x, y,
    angle: rng() * Math.PI * 2,
    speed: 28 + rng() * 30,
    shirt: SHIRTS[Math.floor(rng() * SHIRTS.length)],
    skin: SKINS[Math.floor(rng() * SKINS.length)],
    hp: 100,
    flee: 0,
    panic: 0,
    walkPhase: rng() * Math.PI * 2,
    horizontal,
    road,
    dir: rng() > 0.5 ? 1 : -1,
    changeIn: 2 + rng() * 5,
    taxi: false,
    dead: false,
  };
}

export function spawnPed(rng, player, city) {
  for (let tries = 0; tries < 8; tries++) {
    const x = 120 + rng() * (WORLD - 240);
    const y = 120 + rng() * (WORLD - 240);
    if (Math.hypot(x - player.x, y - player.y) < 320) continue;
    if (Math.hypot(x - player.x, y - player.y) > 1100) continue;
    return makePed(x, y, rng);
  }
  return null;
}

export function updatePeds(S, dt) {
  for (const p of S.peds) {
    if (p.dead) continue;
    p.walkPhase += dt * (p.flee > 0 ? 14 : 7);
    p.changeIn -= dt;
    if (p.flee > 0) {
      p.flee -= dt;
      p.panic = Math.max(p.panic, 1.2);
      // Run away from the danger point.
      const dx = p.x - p.fleeX, dy = p.y - p.fleeY;
      const d = Math.hypot(dx, dy) || 1;
      p.angle = Math.atan2(dy / d, dx / d);
      p.x += Math.cos(p.angle) * 130 * dt;
      p.y += Math.sin(p.angle) * 130 * dt;
    } else {
      p.panic = Math.max(0, p.panic - dt);
      // Stroll along a sidewalk: offset from a road line.
      if (p.changeIn <= 0) {
        p.changeIn = 3 + Math.random() * 6;
        if (Math.random() < 0.4) p.dir *= -1;
        if (Math.random() < 0.25) {
          p.horizontal = !p.horizontal;
          p.road = ROADS[Math.floor(Math.random() * ROADS.length)];
        }
      }
      const off = ROAD_W / 2 + 14;
      if (p.horizontal) {
        p.y = p.road + off;
        p.x += p.dir * p.speed * dt;
        p.angle = p.dir > 0 ? 0 : Math.PI;
      } else {
        p.x = p.road + off;
        p.y += p.dir * p.speed * dt;
        p.angle = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      // Turn around at the world edge.
      if (p.x < 80 || p.x > WORLD - 80 || p.y < 80 || p.y > WORLD - 80) p.dir *= -1;
    }
    resolveBuildingCollision(p, 12, S.city.buildings);
    clampWorld(p, 16);
  }
  // Keep the streets populated near the player.
  const near = S.peds.filter((p) => !p.dead && Math.hypot(p.x - S.player.x, p.y - S.player.y) < 1000).length;
  if (near < 16 && Math.random() < dt * 1.5) {
    const p = spawnPed(Math.random, S.player, S.city);
    if (p) S.peds.push(p);
  }
  S.peds = S.peds.filter((p) => !p.dead || p.deadFor < 4);
}

// Flee from a danger point (gunshot, explosion, speeding car).
export function scarePeds(S, x, y, radius = 320) {
  for (const p of S.peds) {
    if (p.dead) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < radius) {
      p.flee = 2.5 + Math.random();
      p.fleeX = x; p.fleeY = y;
    }
  }
}
