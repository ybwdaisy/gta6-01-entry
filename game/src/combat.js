// Pistol combat: mouse aim, 12-round magazine, reload, bullets, damage,
// ammo pickups, muzzle flash and shell casings.
export const MAG_SIZE = 12;

export function createWeapon() {
  return { name: 'PISTOL', ammo: MAG_SIZE, reserve: 48, reloading: 0 };
}

export function updateCombat(S, dt) {
  const p = S.player;
  const w = p.weapon;
  if (w.reloading > 0) {
    w.reloading -= dt;
    if (w.reloading <= 0) {
      const need = MAG_SIZE - w.ammo;
      const take = Math.min(need, w.reserve);
      w.ammo += take;
      w.reserve -= take;
      S.audio.reload();
    }
  }
  // Fire while the mouse is held (semi-auto: one shot per click is nicer,
  // but holding works at a capped rate).
  p.fireCooldown = Math.max(0, (p.fireCooldown || 0) - dt);
  if (S.input.mouse.clicked && !p.car && S.state === 'playing') {
    if (w.reloading <= 0 && p.fireCooldown <= 0) {
      if (w.ammo > 0) {
        w.ammo -= 1;
        p.fireCooldown = 0.22;
        fireBullet(S);
      } else {
        S.audio.empty();
        p.fireCooldown = 0.3;
      }
    }
  }
  if (S.input.hit('KeyR') && w.ammo < MAG_SIZE && w.reserve > 0 && w.reloading <= 0) {
    w.reloading = 0.9;
  }
  // Bullets.
  for (const b of S.bullets) {
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    // Hit peds / officers.
    for (const t of [...S.peds, ...S.cops.filter((c) => c.kind === 'officer')]) {
      if (t.dead) continue;
      if (Math.hypot(t.x - b.x, t.y - b.y) < 16) {
        b.life = 0;
        damageTarget(S, t, 34, b.fromCop);
        break;
      }
    }
    // Hit the player (cop bullets only).
    if (b.life > 0 && b.fromCop && !S.player.car) {
      if (Math.hypot(S.player.x - b.x, S.player.y - b.y) < 16) {
        b.life = 0;
        damagePlayer(S, 9);
      }
    }
    // Hit cars.
    if (b.life > 0) {
      for (const c of S.cars) {
        if (Math.hypot(c.x - b.x, c.y - b.y) < 26) {
          b.life = 0;
          c.hp -= 10;
          S.addSparks(b.x, b.y, 5);
          if (c.hp <= 0 && !c.police) S.explodeCar(c);
          break;
        }
      }
    }
    // Hit buildings.
    if (b.life > 0 && S.city.buildings.some((bd) => b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h)) {
      b.life = 0;
      S.addSparks(b.x, b.y, 4);
    }
  }
  S.bullets = S.bullets.filter((b) => b.life > 0);
  // Ammo pickups.
  for (const pk of S.pickups) {
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 30) {
      pk.taken = true;
      if (pk.kind === 'ammo') {
        p.weapon.reserve += 24;
        S.toast('Picked up ammo (+24)', 1.6);
      } else if (pk.kind === 'health') {
        p.hp = Math.min(100, p.hp + 40);
        S.toast('Picked up a medkit (+40 HP)', 1.6);
      } else if (pk.kind === 'armor') {
        p.armor = Math.min(100, p.armor + 50);
        S.toast('Picked up body armor (+50)', 1.6);
      }
      S.audio.pickup();
    }
  }
  S.pickups = S.pickups.filter((pk) => !pk.taken);
}

export function fireBullet(S) {
  const p = S.player;
  const aim = Math.atan2(S.input.mouse.wy - p.y, S.input.mouse.wx - p.x);
  p.aimAngle = aim;
  const mx = p.x + Math.cos(aim) * 22;
  const my = p.y + Math.sin(aim) * 22;
  S.bullets.push({ x: mx, y: my, angle: aim + (Math.random() - 0.5) * 0.05, speed: 900, life: 0.9, fromCop: false });
  S.muzzle = 0.06;
  S.audio.gunshot();
  S.addShell(p.x, p.y, aim);
  S.scarePeds(p.x, p.y, 380);
  if (S.player.wanted < 1) S.addWanted(1, 'Shots fired');
}

export function damageTarget(S, t, dmg, fromCop) {
  t.hp -= dmg;
  S.audio.hit();
  S.addSparks(t.x, t.y, 6);
  if (t.hp <= 0) {
    t.dead = true;
    t.deadFor = 0;
    if (t.kind === 'officer') {
      S.addWanted(2, 'Officer down');
      S.toast('Officer down — the whole department is coming.', 2.5);
      S.removeCop(t);
      if (Math.random() < 0.5) S.pickups.push({ x: t.x, y: t.y, kind: 'ammo' });
    } else {
      // Civilian casualty: heat, and the mission system notices.
      S.addWanted(1, 'Civilian hit');
      S.scarePeds(t.x, t.y, 400);
      if (Math.random() < 0.35) S.pickups.push({ x: t.x, y: t.y, kind: 'health' });
    }
  } else if (!fromCop && t.kind !== 'officer') {
    t.flee = 3; t.fleeX = S.player.x; t.fleeY = S.player.y;
  }
}

// Player takes damage (from cop bullets). Armor absorbs first.
export function damagePlayer(S, dmg) {
  const p = S.player;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, dmg * 0.7);
    p.armor -= absorbed;
    dmg -= absorbed;
  }
  p.hp -= dmg;
  S.hitFlash = 0.25;
  S.shake = Math.min(10, S.shake + 3);
  S.audio.hit();
  if (p.hp <= 0) S.wasted();
}
