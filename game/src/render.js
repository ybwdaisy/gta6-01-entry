// render.js — draws the world: ground, roads, beach, buildings, props,
// entities, particles and the day tint. All art is drawn shapes — no images.

import { WORLD, ROAD_CENTERS, ROAD_W, BEACH_X, WATER_X } from './city.js';
import { missionBlip } from './missions.js';

/** Day tint by game clock: warm noon, gold dusk, blue night. */
export function dayTint(clockMinutes) {
  const h = (clockMinutes / 60) % 24;
  if (h >= 6 && h < 9) return { color: '255, 190, 110', alpha: 0.10 }; // dawn
  if (h >= 9 && h < 17) return { color: '255, 240, 200', alpha: 0.04 }; // midday
  if (h >= 17 && h < 20) return { color: '255, 150, 60', alpha: 0.14 }; // golden hour
  if (h >= 20 || h < 5) return { color: '20, 40, 90', alpha: 0.28 }; // night
  return { color: '255, 190, 110', alpha: 0.08 }; // pre-dawn
}

function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const halfL = car.len / 2;
  const halfW = car.w / 2;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(-halfL + 3, -halfW + 4, car.len, car.w);
  // wheels
  ctx.fillStyle = '#141414';
  const wy = halfW - 3;
  ctx.fillRect(-halfL + 8, -wy - 5, 16, 7);
  ctx.fillRect(-halfL + 8, wy - 2, 16, 7);
  ctx.fillRect(halfL - 24, -wy - 5, 16, 7);
  ctx.fillRect(halfL - 24, wy - 2, 16, 7);
  // body
  ctx.fillStyle = car.color;
  roundRect(ctx, -halfL, -halfW, car.len, car.w, 9);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // cabin + windshield
  ctx.fillStyle = 'rgba(20, 30, 40, 0.85)';
  roundRect(ctx, -halfL + 20, -halfW + 7, car.len - 42, car.w - 14, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(140, 200, 230, 0.5)';
  ctx.fillRect(halfL - 26, -halfW + 8, 8, car.w - 16);
  // headlights
  ctx.fillStyle = '#ffe9a3';
  ctx.fillRect(halfL - 3, -halfW + 5, 3, 6);
  ctx.fillRect(halfL - 3, halfW - 11, 3, 6);
  // taxi checker / police livery
  if (car.type === 'taxi') {
    ctx.fillStyle = '#1c2733';
    for (let i = 0; i < 5; i++) ctx.fillRect(-halfL + 12 + i * 11, -2, 6, 4);
  }
  if (car.ai === 'police') {
    ctx.fillStyle = '#e8e2d4';
    ctx.fillRect(-halfL + 4, -halfW + 2, car.len - 8, 8);
    ctx.fillStyle = '#c94f3d';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SBPD', 0, 3);
    // light bar
    const blink = Math.floor(Date.now() / 300) % 2 === 0;
    ctx.fillStyle = blink ? '#ff3b30' : '#2f7bff';
    ctx.fillRect(-8, -halfW - 2, 7, 5);
    ctx.fillStyle = blink ? '#2f7bff' : '#ff3b30';
    ctx.fillRect(1, -halfW - 2, 7, 5);
  }
  ctx.restore();
}

function drawPed(ctx, ped, time) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.state === 'down') {
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  // shadow + bob
  const bob = Math.sin(ped.bob) * 1.5;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 6, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(ped.angle);
  // legs
  ctx.fillStyle = ped.pants;
  ctx.fillRect(-4, -4 + bob, 8, 3);
  ctx.fillRect(-4, 1 - bob, 8, 3);
  // body
  ctx.fillStyle = ped.color;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  // head
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(7, 0, 5.5, 0, Math.PI * 2);
  ctx.fill();
  // taxi customer glow
  if (ped.state === 'taxi') {
    ctx.rotate(-ped.angle);
    ctx.strokeStyle = '#7ddb8a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 15 + Math.sin(time * 4) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (ped.state === 'debtor') {
    ctx.rotate(-ped.angle);
    ctx.fillStyle = '#ff5a4e';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, -16);
  }
  ctx.restore();
}

function drawPlayer(ctx, G) {
  const p = G.player;
  if (p.inCar) return; // the car is drawn instead
  ctx.save();
  ctx.translate(p.x, p.y);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 7, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(p.angle);
  const moving = Math.hypot(p.vx || 0, p.vy || 0) > 30;
  const bob = moving ? Math.sin(G.time * 14) * 2 : 0;
  // legs
  ctx.fillStyle = '#2e3a4a';
  ctx.fillRect(-5, -5 + bob, 9, 3.5);
  ctx.fillRect(-5, 1.5 - bob, 9, 3.5);
  // jacket (Marco's teal)
  ctx.fillStyle = '#2f7d6e';
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  // head + cap
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(8, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c94f3d';
  ctx.beginPath();
  ctx.arc(8, 0, 6, Math.PI * 0.9, Math.PI * 2.1);
  ctx.fill();
  // pistol in hand
  ctx.fillStyle = '#1c1c1c';
  ctx.fillRect(6, -2, 12, 3);
  // aim line (subtle)
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(46, 0);
  ctx.stroke();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The full world render, camera-centred on (camX, camY). */
export function renderWorld(G, ctx, viewW, viewH, camX, camY) {
  const city = G.city;
  const x0 = camX - viewW / 2;
  const y0 = camY - viewH / 2;
  const x1 = camX + viewW / 2;
  const y1 = camY + viewH / 2;

  // --- ground ---
  ctx.fillStyle = '#7a9a58';
  ctx.fillRect(x0, y0, viewW, viewH);
  // beach sand
  ctx.fillStyle = '#d9c27a';
  ctx.fillRect(Math.max(x0, BEACH_X), y0, Math.min(x1, WORLD) - Math.max(x0, BEACH_X), viewH);
  // water with moving waves
  ctx.fillStyle = '#2e6f8e';
  ctx.fillRect(Math.max(x0, WATER_X), y0, Math.min(x1, WORLD) - Math.max(x0, WATER_X), viewH);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let y = 80; y < WORLD; y += 140) {
    if (y < y0 - 20 || y > y1 + 20) continue;
    const off = Math.sin(G.time * 1.4 + y * 0.05) * 6;
    ctx.beginPath();
    ctx.moveTo(WATER_X + 6 + off, y);
    ctx.quadraticCurveTo(WATER_X + 26, y + 8, WATER_X + 46 + off, y);
    ctx.stroke();
  }

  // --- park + plaza ---
  ctx.fillStyle = '#4a7a4f';
  ctx.fillRect(640, 640, 320, 320);
  ctx.fillStyle = '#8a9a6a';
  ctx.beginPath();
  ctx.arc(800, 800, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c9b489';
  ctx.fillRect(960, 960, 320, 320);
  ctx.fillStyle = '#b39a6a';
  ctx.beginPath();
  ctx.arc(1120, 1120, 46, 0, Math.PI * 2);
  ctx.fill();

  // --- roads + sidewalks + lane dashes ---
  for (const c of ROAD_CENTERS) {
    // sidewalks
    ctx.fillStyle = '#b9b3a4';
    ctx.fillRect(x0, c - ROAD_W / 2 - 14, viewW, 14);
    ctx.fillRect(x0, c + ROAD_W / 2, viewW, 14);
    ctx.fillRect(c - ROAD_W / 2 - 14, y0, 14, viewH);
    ctx.fillRect(c + ROAD_W / 2, y0, 14, viewH);
    // asphalt
    ctx.fillStyle = '#3a3f45';
    ctx.fillRect(x0, c - ROAD_W / 2, viewW, ROAD_W);
    ctx.fillRect(c - ROAD_W / 2, y0, ROAD_W, viewH);
  }
  // centre dashes
  ctx.strokeStyle = '#d9c25a';
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 22]);
  for (const c of ROAD_CENTERS) {
    ctx.beginPath(); ctx.moveTo(x0, c); ctx.lineTo(x1, c); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c, y0); ctx.lineTo(c, y1); ctx.stroke();
  }
  ctx.setLineDash([]);
  // crosswalks at intersections
  ctx.fillStyle = 'rgba(232, 226, 212, 0.75)';
  for (const cx of ROAD_CENTERS) {
    for (const cy of ROAD_CENTERS) {
      if (cx < x0 - 80 || cx > x1 + 80 || cy < y0 - 80 || cy > y1 + 80) continue;
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(cx - ROAD_W / 2 + 4 + i * 10, cy - ROAD_W / 2 - 12, 5, 10);
        ctx.fillRect(cx - ROAD_W / 2 + 4 + i * 10, cy + ROAD_W / 2 + 2, 5, 10);
      }
    }
  }

  // --- skid marks ---
  ctx.strokeStyle = 'rgba(20,20,20,0.5)';
  ctx.lineWidth = 4;
  for (const s of G.skids) {
    if (s.x < x0 - 40 || s.x > x1 + 40 || s.y < y0 - 40 || s.y > y1 + 40) continue;
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.angle) * 12, s.y - Math.sin(s.angle) * 12);
    ctx.lineTo(s.x + Math.cos(s.angle) * 12, s.y + Math.sin(s.angle) * 12);
    ctx.stroke();
  }

  // --- buildings (with name labels) ---
  ctx.textAlign = 'center';
  for (const b of city.buildings) {
    if (b.x + b.w / 2 < x0 - 40 || b.x - b.w / 2 > x1 + 40 || b.y + b.h / 2 < y0 - 40 || b.y - b.h / 2 > y1 + 40) continue;
    const bx = b.x - b.w / 2;
    const by = b.y - b.h / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(bx + 4, by + 5, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(bx, by, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, b.w, b.h);
    // roof detail
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(bx + 8, by + 8, b.w - 16, b.h / 3);
    // name label
    ctx.fillStyle = 'rgba(20,20,20,0.65)';
    const tw = ctx.measureText(b.name).width;
    ctx.font = '11px sans-serif';
    const tw2 = ctx.measureText(b.name).width;
    void tw;
    ctx.fillRect(b.x - tw2 / 2 - 4, b.y - 7, tw2 + 8, 14);
    ctx.fillStyle = '#f2ead8';
    ctx.fillText(b.name, b.x, b.y + 3);
  }

  // --- palms + lamps ---
  for (const palm of city.palms) {
    if (palm.x < x0 - 30 || palm.x > x1 + 30 || palm.y < y0 - 30 || palm.y > y1 + 30) continue;
    ctx.strokeStyle = '#6b4a2f';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(palm.x, palm.y); ctx.lineTo(palm.x + 3, palm.y - 14); ctx.stroke();
    ctx.fillStyle = '#3f7a3a';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.ellipse(palm.x + 3 + Math.cos(a) * 9, palm.y - 14 + Math.sin(a) * 5, 9, 3.5, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const lamp of city.lamps) {
    if (lamp.x < x0 - 20 || lamp.x > x1 + 20 || lamp.y < y0 - 20 || lamp.y > y1 + 20) continue;
    ctx.fillStyle = '#2e2e34';
    ctx.fillRect(lamp.x - 1, lamp.y - 10, 2, 10);
    ctx.fillStyle = '#ffe9a3';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y - 11, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- lighthouse ---
  const lh = city.landmarks.lighthouse;
  ctx.fillStyle = '#e8e2d4';
  ctx.fillRect(lh.x - 10, lh.y - 34, 20, 40);
  ctx.fillStyle = '#c94f3d';
  ctx.fillRect(lh.x - 10, lh.y - 20, 20, 8);
  ctx.fillStyle = '#ffe9a3';
  ctx.beginPath();
  ctx.arc(lh.x, lh.y - 38, 6, 0, Math.PI * 2);
  ctx.fill();
  // light beam sweep
  const beamA = G.time * 0.7;
  ctx.fillStyle = 'rgba(255, 233, 163, 0.10)';
  ctx.beginPath();
  ctx.moveTo(lh.x, lh.y - 38);
  ctx.lineTo(lh.x + Math.cos(beamA) * 260, lh.y - 38 + Math.sin(beamA) * 260);
  ctx.lineTo(lh.x + Math.cos(beamA + 0.25) * 260, lh.y - 38 + Math.sin(beamA + 0.25) * 260);
  ctx.closePath();
  ctx.fill();

  // --- pickups ---
  for (const pk of G.pickups) {
    if (pk.x < x0 - 30 || pk.x > x1 + 30 || pk.y < y0 - 30 || pk.y > y1 + 30) continue;
    const bobY = Math.sin(pk.bob) * 3;
    ctx.fillStyle = pk.kind === 'ammo' ? '#ffe9a3' : pk.kind === 'health' ? '#7ddb8a' : '#8ec9ff';
    ctx.beginPath();
    ctx.arc(pk.x, pk.y + bobY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#1c2733';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(pk.kind === 'ammo' ? 'A' : pk.kind === 'health' ? '+' : 'S', pk.x, pk.y + bobY + 4);
  }

  // --- mission marker (big M + target ring) ---
  const blip = missionBlip(G);
  if (blip && G.mode === 'playing') {
    const pulse = 1 + Math.sin(G.time * 4) * 0.12;
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(blip.x, blip.y, 26 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('M', blip.x, blip.y + 8);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(20,20,20,0.7)';
    const lw = ctx.measureText(blip.label).width;
    ctx.fillRect(blip.x - lw / 2 - 4, blip.y + 30, lw + 8, 15);
    ctx.fillStyle = '#ffd23e';
    ctx.fillText(blip.label, blip.x, blip.y + 41);
  }

  // --- cars, peds, officers, player (painter's order) ---
  for (const car of G.cars) drawCar(ctx, car);
  for (const ped of G.peds) drawPed(ctx, ped, G.time);
  for (const off of G.officers) {
    ctx.save();
    ctx.translate(off.x, off.y);
    ctx.rotate(off.angle);
    ctx.fillStyle = '#1c2733';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(7, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2f7bff';
    ctx.fillRect(6, -2, 12, 3);
    ctx.restore();
    // health pip
    if (off.health < 100) {
      ctx.fillStyle = '#ff5a4e';
      ctx.fillRect(off.x - 12, off.y - 22, 24 * (off.health / 100), 3);
    }
  }
  drawPlayer(ctx, G);

  // --- bullets ---
  ctx.fillStyle = '#ffe9a3';
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- particles ---
  for (const pt of G.particles) {
    const a = Math.max(0, pt.life / pt.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * (pt.kind === 'smoke' ? (1.6 - a * 0.6) : 1), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // --- floating texts ---
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  for (const f of G.floaters) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  // --- day tint + vignette ---
  const tint = dayTint(G.clock);
  ctx.fillStyle = `rgba(${tint.color}, ${tint.alpha})`;
  ctx.fillRect(x0, y0, viewW, viewH);
  const grad = ctx.createRadialGradient(camX, camY, Math.min(viewW, viewH) * 0.45, camX, camY, Math.max(viewW, viewH) * 0.75);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = grad;
  ctx.fillRect(x0, y0, viewW, viewH);
}
