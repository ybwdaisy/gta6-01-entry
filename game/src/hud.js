// hud.js — the heads-up display: bars, cash, stars, weapon, mission banner,
// objective, clock, and the minimap canvas.

import { WORLD, ROAD_CENTERS, ROAD_W, BEACH_X } from './city.js';
import { missionObjective, missionBlip } from './missions.js';

/** Grab every HUD element once; returns a handle main.js keeps. */
export function createHud() {
  const $ = (id) => document.getElementById(id);
  return {
    healthFill: $('health-fill'),
    armorFill: $('armor-fill'),
    healthText: $('health-text'),
    cashText: $('cash-text'),
    starsEl: $('stars'),
    weaponText: $('weapon-text'),
    missionBanner: $('mission-banner'),
    objectiveText: $('objective-text'),
    clockText: $('clock-text'),
    interactText: $('interact-text'),
    taxiText: $('taxi-text'),
    dialogueCard: $('dialogue-card'),
    dialogueTitle: $('dialogue-title'),
    dialogueBody: $('dialogue-body'),
    minimap: $('minimap'),
    flash: $('flash'),
  };
}

function fmtClock(clockMinutes, day) {
  const h = Math.floor(clockMinutes / 60) % 24;
  const m = Math.floor(clockMinutes % 60);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `Day ${day}  ${hh}:${mm}`;
}

export function updateHud(G, hud) {
  const p = G.player;
  hud.healthFill.style.width = `${Math.max(0, p.health)}%`;
  hud.armorFill.style.width = `${Math.max(0, p.armor)}%`;
  hud.healthText.textContent = `${Math.round(p.health)}`;
  hud.cashText.textContent = `$${Math.round(p.cash).toLocaleString('en-US')}`;
  const stars = '★'.repeat(p.wanted) + '☆'.repeat(5 - p.wanted);
  hud.starsEl.textContent = stars;
  hud.starsEl.classList.toggle('hot', p.wanted > 0);
  hud.weaponText.textContent = p.inCar
    ? 'DRIVING'
    : `PISTOL  ${p.ammo}/${p.ammoReserve}  ${p.reloadTimer > 0 ? '(RELOADING…)' : ''}`;
  hud.objectiveText.textContent = missionObjective(G);
  hud.clockText.textContent = fmtClock(G.clock, G.day);

  // mission banner (fades on its own timer)
  if (G.banner && G.banner.timer > 0) {
    hud.missionBanner.textContent = G.banner.text;
    hud.missionBanner.classList.add('show');
  } else {
    hud.missionBanner.classList.remove('show');
  }

  // taxi fare readout
  if (G.taxi) {
    hud.taxiText.textContent = `TAXI → ${G.taxi.dest.label}  $${G.taxi.fare}  ${Math.ceil(G.taxi.timer)}s`;
    hud.taxiText.classList.add('show');
  } else {
    hud.taxiText.classList.remove('show');
  }

  // context prompt (E to …)
  hud.interactText.textContent = G.interactHint || '';
  hud.interactText.classList.toggle('show', !!G.interactHint);

  // hit flash
  hud.flash.style.opacity = G.flash > 0 ? String(Math.min(0.55, G.flash)) : '0';

  // dialogue card
  if (G.dialogue) {
    hud.dialogueTitle.textContent = G.dialogue.title;
    hud.dialogueBody.innerHTML = G.dialogue.lines.map((l) => `<p>${l}</p>`).join('');
    hud.dialogueCard.classList.add('show');
  } else {
    hud.dialogueCard.classList.remove('show');
  }

  drawMinimap(G, hud.minimap);
}

function drawMinimap(G, canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const S = canvas.width; // square, e.g. 180
  const scale = S / WORLD;
  ctx.clearRect(0, 0, S, S);
  // rounded background
  ctx.fillStyle = 'rgba(12, 20, 26, 0.82)';
  ctx.fillRect(0, 0, S, S);
  // beach + water
  ctx.fillStyle = '#d9c27a';
  ctx.fillRect(BEACH_X * scale, 0, (WORLD - BEACH_X) * scale, S);
  ctx.fillStyle = '#2e6f8e';
  ctx.fillRect(2512 * scale, 0, (WORLD - 2512) * scale, S);
  // park + plaza
  ctx.fillStyle = '#4a7a4f';
  ctx.fillRect(640 * scale, 640 * scale, 320 * scale, 320 * scale);
  ctx.fillStyle = '#c9b489';
  ctx.fillRect(960 * scale, 960 * scale, 320 * scale, 320 * scale);
  // roads
  ctx.strokeStyle = '#5a5f66';
  ctx.lineWidth = ROAD_W * scale;
  for (const c of ROAD_CENTERS) {
    ctx.beginPath(); ctx.moveTo(0, c * scale); ctx.lineTo(S, c * scale); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c * scale, 0); ctx.lineTo(c * scale, S); ctx.stroke();
  }
  // buildings
  ctx.fillStyle = '#8a7a68';
  for (const b of G.city.buildings) {
    ctx.fillRect((b.x - b.w / 2) * scale, (b.y - b.h / 2) * scale, Math.max(1.5, b.w * scale), Math.max(1.5, b.h * scale));
  }
  // mission blip (pulsing)
  const blip = missionBlip(G);
  if (blip) {
    const pulse = 3 + Math.sin(G.time * 5) * 1.5;
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(blip.x * scale, blip.y * scale, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1c2733';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // taxi destination
  if (G.taxi) {
    ctx.fillStyle = '#7ddb8a';
    ctx.beginPath();
    ctx.arc(G.taxi.dest.x * scale, G.taxi.dest.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // police blips
  ctx.fillStyle = '#ff5a4e';
  for (const c of G.cars) {
    if (c.ai !== 'police') continue;
    ctx.beginPath();
    ctx.arc(c.x * scale, c.y * scale, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ff8a7a';
  for (const o of G.officers) {
    ctx.beginPath();
    ctx.arc(o.x * scale, o.y * scale, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // traffic dots (subtle)
  ctx.fillStyle = 'rgba(220, 220, 220, 0.5)';
  for (const c of G.cars) {
    if (c.ai === 'traffic') {
      ctx.fillRect(c.x * scale - 1, c.y * scale - 1, 2, 2);
    }
  }
  // player arrow (north-up)
  const p = G.player;
  ctx.save();
  ctx.translate(p.x * scale, p.y * scale);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -4.5);
  ctx.lineTo(-5, 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#1c2733';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  // border
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, S - 1, S - 1);
}
