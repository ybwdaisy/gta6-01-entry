// HUD updates (DOM) and the circular minimap (canvas, north-up).
import { WORLD, ROADS, districtAt } from './city.js';

const $ = (id) => document.getElementById(id);

export function updateHud(S) {
  const p = S.player;
  // Wanted stars.
  const stars = $('stars');
  let html = '';
  for (let i = 0; i < 5; i++) html += i < p.wanted ? '★' : '<span class="dim">★</span>';
  stars.innerHTML = html;
  // Clock: one game hour per 90 real seconds, starting 08:00.
  const totalMin = 8 * 60 + Math.floor(S.clockSec / 90 * 60);
  const hh = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
  const mm = String(totalMin % 60).padStart(2, '0');
  $('clock').textContent = `${hh}:${mm} · Day ${S.day}`;
  $('cash').textContent = `$${Math.floor(p.cash).toLocaleString('en-US')}`;
  const w = p.weapon;
  $('weapon').textContent = `${w.name} · ${w.ammo} / ${w.reserve}${w.reloading > 0 ? ' — reloading…' : ''}`;
  $('hp-fill').style.width = `${Math.max(0, p.hp)}%`;
  $('armor-fill').style.width = `${Math.max(0, p.armor)}%`;
  const mph = p.car ? Math.round(Math.abs(p.car.speed) * 0.12) : Math.round((p.speed || 0) * 0.12);
  $('speed').textContent = p.car ? `${mph} mph · ${p.car.name}` : 'On foot';
  $('objective').textContent = S.objective || '';
  $('zone').textContent = districtAt(p.x, p.y);
  drawMinimap(S);
}

export function drawMinimap(S) {
  const c = $('minimap');
  const ctx = c.getContext('2d');
  const size = c.width;
  const scale = size / WORLD;
  ctx.clearRect(0, 0, size, size);
  // Sea + land.
  ctx.fillStyle = '#1d4e5f';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#2c4a34';
  ctx.fillRect(0, 0, size - 26 * scale * 4, size);
  // Park.
  ctx.fillStyle = '#3f7a44';
  ctx.fillRect(848 * scale, 848 * scale, 208 * scale, 208 * scale);
  // Roads.
  ctx.strokeStyle = '#5a5f66';
  ctx.lineWidth = 5;
  for (const r of ROADS) {
    ctx.beginPath(); ctx.moveTo(r * scale, 0); ctx.lineTo(r * scale, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, r * scale); ctx.lineTo(size, r * scale); ctx.stroke();
  }
  // Beach.
  ctx.fillStyle = '#d9c27a';
  ctx.fillRect(2320 * scale, 0, size - 2320 * scale, size);
  // Mission blip.
  const marker = S.currentMarker();
  if (marker) {
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(marker.x * scale, marker.y * scale, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Police blips.
  ctx.fillStyle = '#4db2ff';
  for (const cop of S.cops) {
    ctx.beginPath();
    ctx.arc(cop.x * scale, cop.y * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow (north-up).
  const p = S.player;
  ctx.save();
  ctx.translate(p.x * scale, p.y * scale);
  ctx.rotate(p.car ? p.car.angle : (p.aimAngle || 0));
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(9, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6); ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function showBanner(S, title, sub) {
  const el = $('mission-banner');
  el.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
  el.classList.remove('hidden');
  S.bannerUntil = performance.now() + 2800;
}

export function hideBannerIfDue(S) {
  if (S.bannerUntil && performance.now() > S.bannerUntil) {
    $('mission-banner').classList.add('hidden');
    S.bannerUntil = 0;
  }
}
