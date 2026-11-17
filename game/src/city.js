// Serena Bay city layout: 2560x2560 world, road grid every 320px, named
// buildings, beach on the east edge, a park block, lighthouse point.
export const WORLD = 2560;
export const ROAD_W = 96;
export const GRID = 320;

// Road center lines (both axes).
export const ROADS = [160, 480, 800, 1120, 1440, 1760, 2080, 2400];

export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = [
  'Cafe Alba', 'Hotel Serena', 'Marina Office', 'Bodega Sol', 'Talleres Pipo',
  'Clinica Serena', 'Banco Serena', 'Mercado Central', 'Torre Azul', 'Casa Verde',
  'Pizzeria Luna', 'Bar El Faro', 'Libreria Mar', 'Farmacia Sol', 'Gimnasio Titan',
  'Cine Bahia', 'Hotel Miramar', 'Oficinas Coral', 'Panaderia Oro', 'Taller Norte',
  'Residencia Palma', 'Apartamentos Brisa', 'Restaurante Ola', 'Tienda Coral',
  'Supermercado Sol', 'Lavanderia Azul', 'Floreria Rosa', 'Joyeria Perla',
  'Agencia Viajes', 'Estudio Danza', 'Clínica Dental', 'Veterinaria Amigo',
  'Café del Puerto', 'Hotel Vela', 'Bodega Norte', 'Torre Marina',
  'Apartamentos Sol', 'Casa del Mar', 'Bar La Ola', 'Restaurante Faro',
  'Tienda Bahia', 'Oficinas Puerto', 'Residencia Coral', 'Hotel Brisa',
  'Café Miramar', 'Pizzeria Sol', 'Mercado Norte', 'Farmacia Bahia',
  'Gimnasio Ola', 'Libreria Sol', 'Panaderia Mar', 'Taller Sur',
  'Apartamentos Vela', 'Casa Brisa', 'Bar Coral', 'Restaurante Palma',
  'Tienda Mar', 'Oficinas Sol', 'Residencia Bahia', 'Hotel Coral',
];

const PALETTE = [
  '#e8b04b', '#d97b4f', '#c96f5e', '#7fb069', '#5b8c5a', '#e6d5a8',
  '#b56576', '#6d6875', '#e07a5f', '#81b29a', '#f2cc8f', '#a3b18a',
];

export function buildCity(seed = 20261117) {
  const rng = makeRng(seed);
  const buildings = [];
  const palms = [];
  const lamps = [];
  let nameIdx = 0;

  // Park block: between roads 800 and 1120 on both axes (block index 2,2).
  const park = { x: 800 + ROAD_W / 2 + 8, y: 800 + ROAD_W / 2 + 8, w: GRID - ROAD_W - 16, h: GRID - ROAD_W - 16 };

  for (let bx = 0; bx < 7; bx++) {
    for (let by = 0; by < 7; by++) {
      const x0 = ROADS[bx] + ROAD_W / 2 + 8;
      const y0 = ROADS[by] + ROAD_W / 2 + 8;
      const bw = GRID - ROAD_W - 16;
      const bh = GRID - ROAD_W - 16;
      // Beach strip: last column is sand, no buildings.
      if (bx === 6) continue;
      // Park block stays green.
      if (bx === 2 && by === 2) continue;
      // 1-3 buildings per block, split along the longer side.
      const count = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < count; i++) {
        let b;
        if (count === 1) {
          b = { x: x0 + 14, y: y0 + 14, w: bw - 28, h: bh - 28 };
        } else if (bw >= bh) {
          const w = (bw - 12 * (count + 1)) / count;
          b = { x: x0 + 12 + i * (w + 12), y: y0 + 12, w, h: bh - 24 };
        } else {
          const h = (bh - 12 * (count + 1)) / count;
          b = { x: x0 + 12, y: y0 + 12 + i * (h + 12), w: bw - 24, h };
        }
        if (b.w < 40 || b.h < 40) continue;
        const name = NAMES[nameIdx % NAMES.length];
        nameIdx++;
        buildings.push({
          ...b,
          name,
          color: PALETTE[Math.floor(rng() * PALETTE.length)],
          roof: rng() > 0.5,
        });
      }
    }
  }

  // Landmark buildings (named, placed at fixed spots, overriding generic ones nearby).
  const landmarks = [
    { name: 'Vidal Warehouse', x: 500, y: 2280, w: 220, h: 140, color: '#8d6e63', roof: false, landmark: 'warehouse' },
    { name: 'Talleres Pipo', x: 1120 + 60, y: 1760 + 60, w: 150, h: 110, color: '#e07a5f', roof: false, landmark: 'garage' },
    { name: 'Clinica Serena', x: 1760 + 60, y: 800 + 60, w: 150, h: 120, color: '#f2f2f2', roof: true, landmark: 'clinic' },
    { name: 'Banco Serena', x: 480 + 60, y: 480 + 60, w: 140, h: 110, color: '#d9c9a3', roof: true, landmark: 'bank' },
    { name: 'Mercado Central', x: 800 + 56, y: 1440 + 56, w: 180, h: 150, color: '#e8b04b', roof: false, landmark: 'market' },
    { name: 'Hotel Serena', x: 1440 + 56, y: 240 + 56, w: 170, h: 130, color: '#f2cc8f', roof: true, landmark: 'hotel' },
    { name: 'Lighthouse', x: 2410, y: 120, w: 46, h: 46, color: '#f5f0e6', roof: false, landmark: 'lighthouse' },
    { name: 'Marina Office', x: 2280, y: 2080, w: 130, h: 100, color: '#81b29a', roof: true, landmark: 'marina' },
  ];
  for (const lm of landmarks) {
    // Remove generic buildings that overlap the landmark footprint.
    for (let i = buildings.length - 1; i >= 0; i--) {
      const b = buildings[i];
      if (b.x < lm.x + lm.w + 8 && b.x + b.w > lm.x - 8 && b.y < lm.y + lm.h + 8 && b.y + b.h > lm.y - 8) buildings.splice(i, 1);
    }
    buildings.push(lm);
  }

  // Palms: along the beach strip and scattered in the park.
  for (let y = 120; y < WORLD - 120; y += 90) {
    palms.push({ x: 2430 + rng() * 60, y: y + rng() * 40 });
    if (rng() > 0.6) palms.push({ x: 2360 + rng() * 40, y: y + 30 });
  }
  for (let i = 0; i < 26; i++) {
    palms.push({ x: park.x + 16 + rng() * (park.w - 32), y: park.y + 16 + rng() * (park.h - 32) });
  }
  // Lamps at intersections.
  for (const rx of ROADS) for (const ry of ROADS) {
    if (rx < 2400) lamps.push({ x: rx + ROAD_W / 2 + 6, y: ry - ROAD_W / 2 - 6 });
  }

  return { buildings, palms, lamps, park };
}

export function isRoad(x, y) {
  for (const r of ROADS) if (Math.abs(x - r) < ROAD_W / 2) return true;
  for (const r of ROADS) if (Math.abs(y - r) < ROAD_W / 2) return true;
  return false;
}

export function nearestRoadCoord(v) {
  let best = ROADS[0], bd = 1e9;
  for (const r of ROADS) { const d = Math.abs(v - r); if (d < bd) { bd = d; best = r; } }
  return best;
}

// Circle vs building AABBs. Returns the building hit, or null.
export function collideBuildings(x, y, r, buildings) {
  for (const b of buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

// Push a circle out of buildings; returns true if a collision happened.
export function resolveBuildingCollision(p, r, buildings) {
  let hit = false;
  for (const b of buildings) {
    const cx = Math.max(b.x, Math.min(p.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(p.y, b.y + b.h));
    let dx = p.x - cx, dy = p.y - cy;
    let d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 < 0.01) { dx = 0; dy = -1; d2 = 1; }
      const d = Math.sqrt(d2);
      const push = (r - d) / d;
      p.x += dx * push;
      p.y += dy * push;
    }
  }
  return hit;
}

export function clampWorld(p, m = 24) {
  p.x = Math.max(m, Math.min(WORLD - m, p.x));
  p.y = Math.max(m, Math.min(WORLD - m, p.y));
}

// Named district for the HUD zone label.
export function districtAt(x, y) {
  if (x > 2320) return 'Playa Serena';
  if (x > 2080 && y < 480) return 'Lighthouse Point';
  if (x > 2080 && y > 2080) return 'Marina District';
  if (x < 480 && y > 2080) return 'Harbor South';
  if (x > 800 && x < 1120 && y > 800 && y < 1120) return 'Parque Central';
  if (x > 800 && x < 1120 && y > 1440 && y < 1760) return 'Mercado Central';
  if (y < 480) return 'North Serena';
  if (y > 2080) return 'South Serena';
  if (x < 800) return 'Old Town';
  if (x > 1760) return 'East Serena';
  return 'Downtown Serena';
}
