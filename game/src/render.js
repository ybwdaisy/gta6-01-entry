// World rendering: ground, roads, beach, park, buildings, props, entities,
// effects (skid marks, exhaust, sparks, shells, floating text) and day tint.
import { WORLD, ROADS, ROAD_W, GRID } from './city.js';

export function render(S) {
  const ctx = S.ctx;
  const cam = S.camera;
  ctx.save();
  // Screen shake.
  if (S.shake > 0.2) ctx.translate((Math.random() - 0.5) * S.shake, (Math.random() - 0.5) * S.shake);
  ctx.clearRect(-20, -20, 1320, 840);
  // Camera: world coordinates are drawn relative to the viewport origin.
  const vx = cam.x - 640, vy = cam.y - 400;
  ctx.translate(-vx, -vy);
  const x0 = Math.max(0, vx - 60), y0 = Math.max(0, vy - 60);
  const x1 = Math.min(WORLD, vx + 1340), y1 = Math.min(WORLD, vy + 860);

  drawGround(S, ctx, x0, y0, x1, y1);
  drawSkids(S, ctx);
  drawBuildings(S, ctx, x0, y0, x1, y1);
  drawProps(S, ctx, x0, y0, x1, y1);
  drawPickups(S, ctx);
  drawPeds(S, ctx);
  drawCars(S, ctx);
  drawPlayer(S, ctx);
  drawBullets(S, ctx);
  drawParticles(S, ctx);
  drawFloatTexts(S, ctx);
  drawMarker(S, ctx);

  ctx.restore();

  // Day tint: dawn gold, noon clear, dusk orange, night blue.
  const tint = dayTint(S.clockSec);
  if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, 1280, 800); }
  // Hit flash.
  if (S.hitFlash > 0) {
    ctx.fillStyle = `rgba(255,40,30,${S.hitFlash * 0.5})`;
    ctx.fillRect(0, 0, 1280, 800);
  }
  // Vignette.
  const g = ctx.createRadialGradient(640, 400, 380, 640, 400, 780);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1280, 800);
}

function dayTint(clockSec) {
  const hour = (8 + clockSec / 90) % 24;
  if (hour >= 6 && hour < 8) return 'rgba(255,170,80,0.10)';
  if (hour >= 17 && hour < 19) return 'rgba(255,120,50,0.12)';
  if (hour >= 19 || hour < 6) return 'rgba(20,40,120,0.16)';
  return null;
}

function drawGround(S, ctx, x0, y0, x1, y1) {
  // Grass base.
  ctx.fillStyle = '#3d6b35';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // City blocks (sidewalk grey-green).
  ctx.fillStyle = '#7d8a6a';
  for (let bx = 0; bx < 7; bx++) {
    for (let by = 0; by < 7; by++) {
      const x = ROADS[bx] + ROAD_W / 2;
      const y = ROADS[by] + ROAD_W / 2;
      ctx.fillRect(x, y, GRID - ROAD_W, GRID - ROAD_W);
    }
  }
  // Park.
  ctx.fillStyle = '#4c8a3f';
  ctx.fillRect(848, 848, 208, 208);
  ctx.fillStyle = '#6fae5f';
  ctx.beginPath(); ctx.arc(952, 952, 46, 0, Math.PI * 2); ctx.fill();
  // Beach sand + sea on the east edge.
  ctx.fillStyle = '#e3cd8a';
  ctx.fillRect(2320, 0, 120, WORLD);
  ctx.fillStyle = '#2a7fa8';
  ctx.fillRect(2440, 0, WORLD - 2440, WORLD);
  ctx.fillStyle = '#5fb3d9';
  for (let y = 0; y < WORLD; y += 130) {
    ctx.fillRect(2440, y, 8, 46);
  }
  // Roads.
  ctx.fillStyle = '#3a3f45';
  for (const r of ROADS) {
    ctx.fillRect(r - ROAD_W / 2, 0, ROAD_W, WORLD);
    ctx.fillRect(0, r - ROAD_W / 2, WORLD, ROAD_W);
  }
  // Lane dashes.
  ctx.fillStyle = '#e8d44d';
  for (const r of ROADS) {
    for (let d = 40; d < WORLD; d += 80) {
      ctx.fillRect(r - 2, d, 4, 34);
      ctx.fillRect(d, r - 2, 34, 4);
    }
  }
  // Crosswalk stripes at intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const rx of ROADS) for (const ry of ROADS) {
    for (let i = -3; i <= 3; i++) {
      ctx.fillRect(rx - ROAD_W / 2 + 6, ry + i * 12 - 3, ROAD_W - 12, 5);
    }
  }
}

function drawSkids(S, ctx) {
  ctx.strokeStyle = 'rgba(20,20,20,0.55)';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (const s of S.skids) {
    ctx.globalAlpha = Math.max(0, s.life / 6);
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawBuildings(S, ctx, x0, y0, x1, y1) {
  for (const b of S.city.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    // Drop shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // Roof detail.
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 10);
    if (b.roof) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + 10, b.y + 22, b.w - 20, b.h - 32);
    }
    // Windows.
    ctx.fillStyle = 'rgba(30,50,80,0.55)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      ctx.fillRect(b.x + 10 + i * 34, b.y + 12 + j * 34, 18, 14);
    }
    // Landmark labels.
    if (b.landmark) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px Trebuchet MS, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2 + 4);
      ctx.textAlign = 'left';
    } else if (b.w > 110 && b.h > 70) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '11px Trebuchet MS, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h - 8);
      ctx.textAlign = 'left';
    }
  }
}

function drawProps(S, ctx, x0, y0, x1, y1) {
  // Palms.
  for (const palm of S.city.palms) {
    if (palm.x < x0 || palm.x > x1 || palm.y < y0 || palm.y > y1) continue;
    ctx.strokeStyle = '#7a5230';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(palm.x, palm.y); ctx.lineTo(palm.x + 3, palm.y - 14); ctx.stroke();
    ctx.fillStyle = '#2f8f3a';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(palm.x + 3 + Math.cos(a) * 9, palm.y - 15 + Math.sin(a) * 7, 11, 4, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Lamps.
  ctx.fillStyle = '#2c2c2c';
  for (const lamp of S.city.lamps) {
    if (lamp.x < x0 || lamp.x > x1 || lamp.y < y0 || lamp.y > y1) continue;
    ctx.beginPath(); ctx.arc(lamp.x, lamp.y, 3, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPickups(S, ctx) {
  for (const pk of S.pickups) {
    const bob = Math.sin(performance.now() / 300 + pk.x) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'ammo') { ctx.fillStyle = '#ffd23e'; ctx.fillRect(-9, -6, 18, 12); ctx.fillStyle = '#7a2d00'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('AMMO', 0, 3); }
    if (pk.kind === 'health') { ctx.fillStyle = '#fff'; ctx.fillRect(-10, -10, 20, 20); ctx.fillStyle = '#e74c3c'; ctx.fillRect(-3, -8, 6, 16); ctx.fillRect(-8, -3, 16, 6); }
    if (pk.kind === 'armor') { ctx.fillStyle = '#4db2ff'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('A', 0, 4); }
    ctx.restore();
  }
  ctx.textAlign = 'left';
}

function drawPeds(S, ctx) {
  for (const p of S.peds) {
    if (p.dead) continue;
    const bob = Math.sin(p.walkPhase) * 1.5;
    ctx.save();
    ctx.translate(p.x, p.y);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 8, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    // Body.
    ctx.fillStyle = p.shirt;
    ctx.beginPath(); ctx.arc(0, bob * 0.3, 8, 0, Math.PI * 2); ctx.fill();
    // Head.
    ctx.fillStyle = p.skin;
    ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 3, Math.sin(p.angle) * 3 - 2, 5, 0, Math.PI * 2); ctx.fill();
    // Panic marker.
    if (p.panic > 0) {
      ctx.fillStyle = '#ff3b30';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, -18);
    }
    // Taxi wave.
    if (p.taxi) {
      ctx.fillStyle = '#ffd23e';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$ TAXI $', 0, -20);
    }
    // Debtor marker.
    if (p.debtor && !p.done) {
      ctx.fillStyle = '#ff5a3c';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▼', 0, -18);
    }
    ctx.restore();
  }
  ctx.textAlign = 'left';
}

function drawCarShape(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-22, -11, 46, 26);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -24, -13, 48, 26, 7);
  ctx.fill();
  // Cabin.
  ctx.fillStyle = 'rgba(20,40,60,0.85)';
  roundRect(ctx, -8, -10, 20, 20, 4);
  ctx.fill();
  // Windshield shine.
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(6, -9, 4, 18);
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(22, -11, 3, 5);
  ctx.fillRect(22, 6, 3, 5);
  // Police livery.
  if (car.police) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-14, -13, 12, 26);
    ctx.fillStyle = '#1c2733';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SBPD', -8, 3);
    // Light bar.
    const flash = Math.floor(performance.now() / 220) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2d2d' : '#2d7dff';
    ctx.fillRect(-4, -15, 8, 5);
    ctx.fillStyle = flash ? '#2d7dff' : '#ff2d2d';
    ctx.fillRect(-4, 10, 8, 5);
  }
  // Target car marker (gold coupe for mission 2).
  if (car.targetCar) {
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▼', 0, -24);
  }
  ctx.restore();
  ctx.textAlign = 'left';
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCars(S, ctx) {
  for (const car of S.cars) {
    if (car.hp <= 0) continue;
    drawCarShape(ctx, car);
  }
  // Foot officers.
  for (const cop of S.cops) {
    if (cop.kind !== 'officer') continue;
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 8, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1c2733';
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath(); ctx.arc(Math.cos(cop.angle) * 3, Math.sin(cop.angle) * 3 - 2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SBPD', 0, -14);
    ctx.restore();
  }
  ctx.textAlign = 'left';
}

function drawPlayer(S, ctx) {
  const p = S.player;
  if (p.car) return; // Player is inside the drawn car.
  ctx.save();
  ctx.translate(p.x, p.y);
  const bob = Math.sin(p.walkPhase || 0) * 1.5;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 8, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
  // Marco: teal jacket, dark jeans.
  ctx.fillStyle = '#0e7c86';
  ctx.beginPath(); ctx.arc(0, bob * 0.3, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath(); ctx.arc(Math.cos(p.aimAngle || 0) * 3, Math.sin(p.aimAngle || 0) * 3 - 2, 5.5, 0, Math.PI * 2); ctx.fill();
  // Pistol.
  if (p.weapon) {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(p.aimAngle || 0) * 16, Math.sin(p.aimAngle || 0) * 16);
    ctx.stroke();
  }
  // Muzzle flash.
  if (S.muzzle > 0) {
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(Math.cos(p.aimAngle || 0) * 22, Math.sin(p.aimAngle || 0) * 22, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBullets(S, ctx) {
  ctx.fillStyle = '#ffe9a8';
  for (const b of S.bullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.fillRect(-6, -1.5, 12, 3);
    ctx.restore();
  }
}

function drawParticles(S, ctx) {
  for (const pt of S.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Shell casings.
  ctx.fillStyle = '#d4af37';
  for (const sh of S.shells) {
    ctx.fillRect(sh.x - 2, sh.y - 1, 4, 2);
  }
}

function drawFloatTexts(S, ctx) {
  ctx.font = 'bold 17px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  for (const ft of S.floatTexts) {
    ctx.globalAlpha = Math.max(0, ft.life / 1.4);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function drawMarker(S, ctx) {
  const marker = S.currentMarker();
  if (!marker) return;
  const pulse = 1 + Math.sin(performance.now() / 280) * 0.15;
  ctx.save();
  ctx.translate(marker.x, marker.y);
  ctx.scale(pulse, pulse);
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.font = 'bold 14px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.fillText(marker.label || 'OBJECTIVE', 0, -36);
  ctx.restore();
  ctx.textAlign = 'left';
}
