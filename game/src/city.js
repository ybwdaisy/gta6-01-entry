// city.js — Serena Bay: layout, buildings, roads, collision, props.
// The world is a fixed 2560x2560 coastal city on a road grid, generated from a
// single seed so every load (and every screenshot) sees the same streets.

export const WORLD = 2560;
export const ROAD_W = 72;
export const ROAD_CENTERS = [160, 480, 800, 1120, 1440, 1760, 2080, 2400];
export const BEACH_X = 2436; // sand starts here; the sea laps the east edge
export const WATER_X = 2512; // past this line is open water (not walkable)

/** Small deterministic PRNG (mulberry32) so the city never changes shape. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BUILDING_NAMES = [
  'Cafe Alba', 'Hotel Serena', 'Bodega Sol', 'Banco Serena', 'Clinica del Mar',
  'Mercado Central', 'Torre Azul', 'Casa Verde', 'Pension Luna', 'Bar El Faro',
  'Farmacia Vida', 'Panaderia Oro', 'Taller Ruiz', 'Libreria Mar', 'Cine Playa',
  'Gimnasio Fuerte', 'Oficina Norte', 'Apartamentos Coral', 'Tienda Nube',
  'Restaurante Brisa', 'Hotel Miramar', 'Kiosko Sol', 'Dulceria Rosa',
  'Carniceria Toro', 'Pescaderia Ola', 'Ferreteria Clavo', 'Zapateria Paso',
  'Floreria Jazmin', 'Jugueteria Sol', 'Optica Clara', 'Lavanderia Espuma',
  'Peluqueria Rizo', 'Estudio Danza', 'Galeria Arena', 'Teatro Costa',
  'Hostal Brisa', 'Residencia Palma', 'Edificio Alba', 'Torre Coral',
  'Plaza Suites', 'Casa del Mar', 'Villa Serena', 'Apartamentos Brisa',
  'Oficinas Puerto', 'Bodega Marina', 'Taller Costa', 'Clinica Norte',
  'Mercado Sur', 'Cafe Mirada', 'Bar Marea', 'Hotel Costa Azul',
  'Pension Estrella', 'Tienda Ancla', 'Restaurante Faro', 'Panaderia Mar',
  'Farmacia Sol', 'Libreria Costa', 'Cine Mar', 'Gimnasio Playa',
];

const ROOF_COLORS = ['#c96f4a', '#b5533c', '#d9a441', '#7d9b76', '#5b7d9e', '#a85f7d', '#8a6d4b', '#6b8e7a'];

/** A plaza / park / special block the generator must leave open. */
const OPEN_BLOCKS = new Set([
  '3,3', // market square (plaza mayor)
  '2,2', // palm park
  '5,1', // marina yard (east, near the water)
]);

function blockCenter(bx, by) {
  return { x: ROAD_CENTERS[bx] + 160, y: ROAD_CENTERS[by] + 160 };
}

/** Landmark spots, fixed by hand so missions always find them. */
export function landmarks() {
  return {
    warehouse: { x: 1280, y: 2280, label: 'Vidal Warehouse' },
    marina: { x: 2320, y: 640, label: 'Marina Serena' },
    pipo: { x: 800, y: 1760, label: 'Talleres Pipo' },
    clinica: { x: 1760, y: 800, label: 'Clinica del Mar' },
    safehouse: { x: 480, y: 2080, label: 'Safehouse' },
    lighthouse: { x: 2480, y: 2400, label: 'Lighthouse Point' },
    market: { x: 1120, y: 1120, label: 'Market Square' },
    park: { x: 800, y: 800, label: 'Palm Park' },
    beach: { x: 2470, y: 1200, label: 'Playa Serena' },
    start: { x: 1120, y: 1440, label: 'Calle Mayor' },
  };
}

/** Build the whole city once. Returns { buildings, colliders, palms, lamps, landmarks, rng }. */
export function buildCity(seed = 1337) {
  const rng = mulberry32(seed);
  const lm = landmarks();
  const buildings = [];
  const colliders = [];
  const palms = [];
  const lamps = [];
  let nameIdx = 0;

  // --- special buildings (fixed, named, mission-relevant) ---
  const special = [
    { x: 1216, y: 2224, w: 128, h: 112, name: 'Vidal Warehouse', color: '#8a5a3b' },
    { x: 2240, y: 576, w: 110, h: 90, name: 'Marina Serena', color: '#5b7d9e' },
    { x: 736, y: 1696, w: 128, h: 128, name: 'Talleres Pipo', color: '#b5533c' },
    { x: 1696, y: 736, w: 128, h: 96, name: 'Clinica del Mar', color: '#e8e2d4' },
    { x: 416, y: 2016, w: 96, h: 96, name: 'Safehouse', color: '#7d9b76' },
    { x: 2400, y: 2336, w: 64, h: 64, name: 'Lighthouse', color: '#e8e2d4' },
  ];
  for (const b of special) {
    buildings.push({ ...b, roof: b.color });
    colliders.push({ x: b.x, y: b.y, w: b.w, h: b.h });
  }

  // --- one or two named buildings per ordinary block ---
  for (let bx = 0; bx < 7; bx++) {
    for (let by = 0; by < 7; by++) {
      const key = `${bx},${by}`;
      if (OPEN_BLOCKS.has(key)) continue;
      const c = blockCenter(bx, by);
      const two = rng() < 0.45;
      if (two) {
        const w1 = 84 + rng() * 40;
        const h1 = 84 + rng() * 40;
        const w2 = 84 + rng() * 40;
        const h2 = 84 + rng() * 40;
        const b1 = { x: c.x - 62, y: c.y - 62, w: w1, h: h1 };
        const b2 = { x: c.x + 62 - w2 / 2 + 20, y: c.y + 62 - h2 / 2, w: w2, h: h2 };
        for (const b of [b1, b2]) {
          const name = BUILDING_NAMES[nameIdx++ % BUILDING_NAMES.length];
          const roof = ROOF_COLORS[Math.floor(rng() * ROOF_COLORS.length)];
          buildings.push({ ...b, name, roof });
          colliders.push({ x: b.x - b.w / 2, y: b.y - b.h / 2, w: b.w, h: b.h });
        }
      } else {
        const w = 130 + rng() * 60;
        const h = 130 + rng() * 60;
        const name = BUILDING_NAMES[nameIdx++ % BUILDING_NAMES.length];
        const roof = ROOF_COLORS[Math.floor(rng() * ROOF_COLORS.length)];
        buildings.push({ x: c.x, y: c.y, w, h, name, roof });
        colliders.push({ x: c.x - w / 2, y: c.y - h / 2, w, h });
      }
    }
  }

  // --- palm trees: beach strip, park block, plaza edges ---
  for (let y = 320; y < 2400; y += 96) {
    palms.push({ x: BEACH_X + 18 + rng() * 30, y: y + rng() * 40 });
    if (rng() < 0.5) palms.push({ x: BEACH_X + 55 + rng() * 20, y: y + 48 + rng() * 40 });
  }
  for (let i = 0; i < 26; i++) {
    palms.push({ x: 700 + rng() * 200, y: 700 + rng() * 200 });
  }
  for (let i = 0; i < 8; i++) {
    palms.push({ x: 1000 + rng() * 240, y: 1000 + rng() * 240 });
  }

  // --- street lamps along every road, both sides ---
  for (const cx of ROAD_CENTERS) {
    for (let y = 200; y < WORLD; y += 320) {
      lamps.push({ x: cx - ROAD_W / 2 - 10, y });
      lamps.push({ x: cx + ROAD_W / 2 + 10, y: y + 160 });
    }
  }
  for (const cy of ROAD_CENTERS) {
    for (let x = 200; x < WORLD; x += 320) {
      lamps.push({ x, y: cy - ROAD_W / 2 - 10 });
      lamps.push({ x: x + 160, y: cy + ROAD_W / 2 + 10 });
    }
  }

  // --- water is a solid wall at the east edge ---
  colliders.push({ x: WATER_X, y: 0, w: WORLD - WATER_X, h: WORLD });

  return { buildings, colliders, palms, lamps, landmarks: lm, rng };
}

/** True when (x,y) sits on asphalt (not sidewalk, not block). */
export function isOnRoad(x, y) {
  for (const c of ROAD_CENTERS) {
    if (Math.abs(x - c) < ROAD_W / 2) return true;
    if (Math.abs(y - c) < ROAD_W / 2) return true;
  }
  return false;
}

/** True when (x,y) is on a sidewalk strip (beside a road, inside a block edge). */
export function isOnSidewalk(x, y) {
  const S = 16;
  for (const c of ROAD_CENTERS) {
    const dx = Math.abs(x - c);
    if (dx >= ROAD_W / 2 && dx < ROAD_W / 2 + S) return true;
    const dy = Math.abs(y - c);
    if (dy >= ROAD_W / 2 && dy < ROAD_W / 2 + S) return true;
  }
  return false;
}

/** Nearest road-center coordinate on the given axis (for lane driving). */
export function nearestRoadCoord(v) {
  let best = ROAD_CENTERS[0];
  for (const c of ROAD_CENTERS) if (Math.abs(v - c) < Math.abs(v - best)) best = c;
  return best;
}

/** Push a circle out of every building/water rect. Returns true if it hit something. */
export function collideCircle(city, x, y, r) {
  let hit = false;
  for (const b of city.colliders) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        x += dx * push;
        y += dy * push;
      } else {
        // centre inside the rect: shove out along the smallest overlap
        const left = x - b.x;
        const right = b.x + b.w - x;
        const top = y - b.y;
        const bottom = b.y + b.h - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = b.x - r;
        else if (m === right) x = b.x + b.w + r;
        else if (m === top) y = b.y - r;
        else y = b.y + b.h + r;
      }
    }
  }
  // world border
  if (x < r) { x = r; hit = true; }
  if (y < r) { y = r; hit = true; }
  if (x > WORLD - r) { x = WORLD - r; hit = true; }
  if (y > WORLD - r) { y = WORLD - r; hit = true; }
  return { x, y, hit };
}

/** A random point on a road, for spawning traffic and police. */
export function randomRoadPoint(rng) {
  const horizontal = rng() < 0.5;
  const c = ROAD_CENTERS[Math.floor(rng() * ROAD_CENTERS.length)];
  const along = 80 + rng() * (WORLD - 160);
  return horizontal ? { x: along, y: c } : { x: c, y: along };
}

/** A random sidewalk point, for spawning pedestrians. */
export function randomSidewalkPoint(rng) {
  const c = ROAD_CENTERS[Math.floor(rng() * ROAD_CENTERS.length)];
  const along = 80 + rng() * (WORLD - 160);
  const off = ROAD_W / 2 + 8;
  return rng() < 0.5
    ? { x: along, y: c + (rng() < 0.5 ? off : -off) }
    : { x: c + (rng() < 0.5 ? off : -off), y: along };
}
