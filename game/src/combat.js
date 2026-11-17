// combat.js — pistol combat: aim with the mouse, click to fire, 12-round
// magazine, R to reload, bullets, muzzle flash, shells, damage, pickups.

import { collideCircle } from './city.js';
import { scarePeds } from './pedestrians.js';

export const MAG_SIZE = 12;
export const BULLET_SPEED = 900;

/** Fire one shot from the player toward the mouse's world position. */
export function playerShoot(G, worldX, worldY) {
  const p = G.player;
  if (p.inCar || G.mode !== 'playing') return;
  if (p.reloadTimer > 0) return;
  if (p.ammo <= 0) {
    // dry click: remind the player to reload
    if (p.dryClickCooldown <= 0) {
      G.audio.reload();
      p.dryClickCooldown = 0.5;
    }
    return;
  }
  p.ammo -= 1;
  p.shootCooldown = 0.16;
  const angle = Math.atan2(worldY - p.y, worldX - p.x);
  p.angle = angle;
  G.bullets.push({
    x: p.x + Math.cos(angle) * 22,
    y: p.y + Math.sin(angle) * 22,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    life: 0.9, from: 'player', damage: 34,
  });
  // muzzle flash + a shell casing
  G.particles.push({
    x: p.x + Math.cos(angle) * 26, y: p.y + Math.sin(angle) * 26,
    vx: 0, vy: 0, life: 0.06, maxLife: 0.06, color: '#ffe9a3', size: 12, kind: 'flash',
  });
  G.particles.push({
    x: p.x, y: p.y,
    vx: Math.cos(angle + Math.PI / 2) * 90, vy: Math.sin(angle + Math.PI / 2) * 90,
    life: 0.5, maxLife: 0.5, color: '#d9b64a', size: 2, kind: 'shell',
  });
  G.audio.shot();
  G.shake = Math.min(6, G.shake + 1.5);
  scarePeds(G, p.x, p.y, 300);
  // gunfire in public draws heat (only when someone is near to witness it)
  const witness = G.peds.some((ped) => ped.state !== 'down' && Math.hypot(ped.x - p.x, ped.y - p.y) < 420)
    || G.officers.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < 500)
    || G.cars.some((c) => c.ai === 'police' && Math.hypot(c.x - p.x, c.y - p.y) < 500);
  if (witness) G.crimes.push({ stars: 1, why: 'SHOTS FIRED' });
}

/** An officer fires at the player (called from police's pendingShots). */
export function officerShoot(G, officer) {
  const p = G.player;
  const angle = Math.atan2(p.y - officer.y, p.x - officer.x) + (Math.random() - 0.5) * 0.14;
  G.bullets.push({
    x: officer.x + Math.cos(angle) * 20,
    y: officer.y + Math.sin(angle) * 20,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    life: 0.9, from: 'police', damage: 9,
  });
  G.particles.push({
    x: officer.x + Math.cos(angle) * 24, y: officer.y + Math.sin(angle) * 24,
    vx: 0, vy: 0, life: 0.06, maxLife: 0.06, color: '#ffe9a3', size: 10, kind: 'flash',
  });
  G.audio.shot();
}

function bulletHitsBuilding(G, b) {
  // step along the bullet's path so fast bullets can't tunnel through walls
  const steps = 3;
  for (let i = 1; i <= steps; i++) {
    const x = b.x + (b.vx * 0.016 * i) / steps;
    const y = b.y + (b.vy * 0.016 * i) / steps;
    for (const rect of G.city.colliders) {
      if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
        return { x, y };
      }
    }
  }
  return null;
}

export function updateBullets(G, dt) {
  const p = G.player;
  for (const b of [...G.bullets]) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;

    // walls
    if (!dead) {
      const hit = bulletHitsBuilding(G, b);
      if (hit) {
        G.particles.push({ x: hit.x, y: hit.y, vx: 0, vy: 0, life: 0.25, maxLife: 0.25, color: '#ffb347', size: 4, kind: 'spark' });
        dead = true;
      }
    }

    // cars
    if (!dead && b.from === 'player') {
      for (const car of G.cars) {
        if (car.ai === 'player') continue;
        const dx = b.x - car.x;
        const dy = b.y - car.y;
        const along = Math.abs(dx * Math.cos(car.angle) + dy * Math.sin(car.angle));
        const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
        if (along < car.len / 2 && side < car.w / 2) {
          car.health -= b.damage;
          G.audio.hit();
          G.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.2, maxLife: 0.2, color: '#ffd76a', size: 3, kind: 'spark' });
          dead = true;
          if (car.health <= 0 && car.ai !== 'parked') {
            car.speed = 0;
            car.ai = 'parked';
          }
          break;
        }
      }
    }

    // pedestrians
    if (!dead && b.from === 'player') {
      for (const ped of G.peds) {
        if (ped.state === 'down' || ped.state === 'dead') continue;
        if (Math.hypot(b.x - ped.x, b.y - ped.y) < 16) {
          ped.health -= b.damage;
          G.audio.hit();
          G.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.3, maxLife: 0.3, color: '#ff5a4e', size: 4, kind: 'spark' });
          scarePeds(G, ped.x, ped.y, 200);
          if (ped.health <= 0) {
            ped.state = 'down';
            ped.downTimer = 999; // stays down; the world moves on
            G.crimes.push({ stars: 1, why: 'ASSAULT' });
          } else {
            ped.state = 'flee';
            ped.timer = 3;
          }
          dead = true;
          break;
        }
      }
    }

    // officers
    if (!dead && b.from === 'player') {
      for (const off of G.officers) {
        if (Math.hypot(b.x - off.x, b.y - off.y) < 16) {
          off.health -= b.damage;
          G.audio.hit();
          G.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.3, maxLife: 0.3, color: '#ff5a4e', size: 4, kind: 'spark' });
          if (off.health <= 0) {
            G.officers.splice(G.officers.indexOf(off), 1);
            G.crimes.push({ stars: 1, why: 'OFFICER DOWN' });
            G.floaters.push({ x: off.x, y: off.y - 20, text: 'OFFICER DOWN', life: 1.4, color: '#ff5a4e' });
          }
          dead = true;
          break;
        }
      }
    }

    // the player (police bullets)
    if (!dead && b.from === 'police') {
      const target = p.inCar ? p.inCar : p;
      const r = p.inCar ? 30 : 15;
      if (Math.hypot(b.x - target.x, b.y - target.y) < r) {
        if (p.inCar) {
          p.inCar.health -= b.damage;
          if (p.inCar.health <= 0) {
            G.floaters.push({ x: p.x, y: p.y - 30, text: 'CAR DISABLED', life: 1.4, color: '#ff5a4e' });
            p.inCar.ai = 'parked';
            p.inCar.speed = 0;
          }
        } else {
          // armor first, then health — reuse the same rule as damagePlayer
          const amount = b.damage;
          if (p.armor > 0) {
            const absorbed = Math.min(p.armor, amount);
            p.armor -= absorbed;
            p.health -= (amount - absorbed);
          } else {
            p.health -= amount;
          }
          G.flash = 0.35;
          if (p.health <= 0) {
            p.health = 0;
            G.mode = 'wasted';
            G.audio.fail();
          }
        }
        dead = true;
      }
    }

    if (dead) G.bullets.splice(G.bullets.indexOf(b), 1);
  }
}

/** Ammo / health / armor pickups scattered around the city. */
export function spawnPickup(G, x, y, kind) {
  G.pickups.push({ x, y, kind, bob: Math.random() * 6 });
}

export function seedPickups(G, rng) {
  const spots = [
    [1120, 640], [1760, 1440], [640, 1120], [2080, 1760], [480, 480],
    [2080, 480], [1440, 2080], [800, 2400],
  ];
  const kinds = ['ammo', 'health', 'armor', 'ammo', 'health', 'ammo', 'armor', 'health'];
  spots.forEach(([x, y], i) => spawnPickup(G, x + rng() * 40, y + rng() * 40, kinds[i]));
}

export function updatePickups(G, dt) {
  const p = G.player;
  for (const pk of [...G.pickups]) {
    pk.bob += dt * 3;
    const d = Math.hypot(p.x - pk.x, p.y - pk.y);
    if (d < 34 && !p.inCar) {
      if (pk.kind === 'ammo') {
        p.ammoReserve += 24;
        G.floaters.push({ x: p.x, y: p.y - 26, text: '+24 AMMO', life: 1.2, color: '#ffe9a3' });
      } else if (pk.kind === 'health') {
        p.health = Math.min(100, p.health + 40);
        G.floaters.push({ x: p.x, y: p.y - 26, text: '+40 HEALTH', life: 1.2, color: '#7ddb8a' });
      } else {
        p.armor = Math.min(100, p.armor + 50);
        G.floaters.push({ x: p.x, y: p.y - 26, text: '+50 ARMOR', life: 1.2, color: '#8ec9ff' });
      }
      G.audio.pickup();
      G.pickups.splice(G.pickups.indexOf(pk), 1);
    }
  }
}

/** R reload: refill the magazine from the reserve after a short delay. */
export function updateReload(G, dt) {
  const p = G.player;
  if (p.reloadTimer > 0) {
    p.reloadTimer -= dt;
    if (p.reloadTimer <= 0 && p.ammoReserve > 0) {
      const need = MAG_SIZE - p.ammo;
      const take = Math.min(need, p.ammoReserve);
      p.ammo += take;
      p.ammoReserve -= take;
    }
  }
  if (p.shootCooldown > 0) p.shootCooldown -= dt;
  if (p.dryClickCooldown > 0) p.dryClickCooldown -= dt;
}
