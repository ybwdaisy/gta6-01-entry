// missions.js — the story chain for Marta Vidal (6 missions), taxi fares,
// dialogue cards, rewards and failure handling.

import { addWanted } from './police.js';
import { makeCar } from './vehicles.js';
import { makePed } from './pedestrians.js';
import { saveGame } from './save.js';
import { WORLD, BEACH_X, collideCircle } from './city.js';

export const MISSIONS = [
  {
    name: 'First Run',
    reward: 500,
    brief: [
      'MARTA VIDAL: "Marco. You drive, I pay. Simple."',
      '"Take this package to the Marina before the tide turns. Ninety seconds. No sightseeing."',
      '"The car out front is yours to borrow. Try not to scratch it."',
    ],
    objective: 'Drive the package to Marina Serena before the timer runs out.',
  },
  {
    name: 'Loud Money',
    reward: 800,
    brief: [
      'MARTA VIDAL: "A gold coupe is parked by Market Square. Its owner owes me."',
      '"Take it. Bring it to Pipo\'s garage. If the police notice, that is your problem."',
      '"Do not scratch the paint. Pipo hates repainting gold."',
    ],
    objective: 'Steal the gold coupe at Market Square and deliver it to Talleres Pipo.',
  },
  {
    name: 'Beach Debts',
    reward: 900,
    brief: [
      'MARTA VIDAL: "Three men owe me money. They hide on the beach like crabs."',
      '"Walk up to each one and remind them. Press E when you are close. No shooting — I want them scared, not dead."',
      '"Come back when all three have paid up."',
    ],
    objective: 'Intimidate 3 debtors on Playa Serena (walk up and press E).',
  },
  {
    name: 'Hot Cargo',
    reward: 1200,
    brief: [
      'MARTA VIDAL: "A van full of cargo needs an escort across town, to the Marina."',
      '"Stay close to it. The police will be watching — I have already made sure of that."',
      '"If the van stops, you stop. If the van moves, you move."',
    ],
    objective: 'Escort the van to the Marina. Stay within range. 2-star heat from the start.',
  },
  {
    name: 'Sirens',
    reward: 1500,
    brief: [
      'MARTA VIDAL: "The police have your name now, Marco. Four stars."',
      '"Lose them. Hide, repaint at Pipo\'s, do whatever it takes — then come to the Safehouse."',
      '"Do not bring them to my door."',
    ],
    objective: 'Lose the 4-star wanted level, then reach the Safehouse.',
  },
  {
    name: 'Serena Goodbye',
    reward: 3000,
    brief: [
      'MARTA VIDAL: "One last run. The boat at the Lighthouse leaves with or without you."',
      '"Every cop in Serena Bay will be on your tail. Five stars. Two and a half minutes."',
      '"Make it to the boat, Marco — and do not look back."',
    ],
    objective: 'Reach the Lighthouse boat with 5 stars before the countdown ends.',
  },
];

const MISSION_STARTS = [
  'warehouse', 'warehouse', 'warehouse', 'warehouse', 'safehouse', 'warehouse',
];

function lm(G, key) {
  return G.city.landmarks[key];
}

/** Where the player goes to pick up the current mission (null when done). */
export function missionStartPoint(G) {
  const m = G.mission;
  if (m.index >= MISSIONS.length) return null;
  return lm(G, MISSION_STARTS[m.index]);
}

/** Where the minimap blip points right now. */
export function missionBlip(G) {
  const m = G.mission;
  if (m.index >= MISSIONS.length) return null;
  if (m.phase === 'idle') {
    const s = missionStartPoint(G);
    return { x: s.x, y: s.y, label: MISSIONS[m.index].name };
  }
  if (m.target) return { x: m.target.x, y: m.target.y, label: m.target.label };
  return null;
}

/** Current objective line for the HUD. */
export function missionObjective(G) {
  const m = G.mission;
  if (m.index >= MISSIONS.length) return 'Story complete — free roam. Take a taxi fare or enjoy Serena Bay.';
  if (m.phase === 'idle') return `Go to the M marker to start: ${MISSIONS[m.index].name}`;
  return MISSIONS[m.index].objective;
}

function openDialogue(G, title, lines, onDone) {
  G.dialogue = { title, lines, onDone };
  G.mode = 'dialogue';
  G.audio.dialogue();
}

function completeMission(G) {
  const m = G.mission;
  const def = MISSIONS[m.index];
  G.player.cash += def.reward;
  G.floaters.push({ x: G.player.x, y: G.player.y - 40, text: `+$${def.reward}`, life: 1.8, color: '#7ddb8a' });
  G.audio.sting();
  G.banner = { text: `MISSION COMPLETE — ${def.name}  (+$${def.reward})`, timer: 4 };
  m.index += 1;
  m.phase = 'idle';
  m.timer = 0;
  m.target = null;
  m.data = {};
  if (m.index >= MISSIONS.length) {
    m.storyDone = true;
    openDialogue(G, 'Serena Goodbye', [
      'The boat pulls away from the Lighthouse as the sirens fade behind you.',
      'Marta watches from the dock, smoking, smiling. "You did good, Marco."',
      'Serena Bay is yours now. Free roam continues — the city never sleeps.',
    ], null);
  }
  saveGame(G);
}

function failMission(G, reason) {
  const m = G.mission;
  const def = MISSIONS[m.index];
  G.audio.fail();
  m.phase = 'idle';
  m.timer = 0;
  m.target = null;
  m.data = {};
  openDialogue(G, 'MISSION FAILED', [
    `"${def.name}" — ${reason}`,
    'Marta is not angry. Marta is disappointed. Which is worse.',
    'Go back to the M marker when you are ready to try again.',
  ], null);
}

/** Begin the current mission: briefing card, then set up its world state. */
export function startMission(G) {
  const m = G.mission;
  const def = MISSIONS[m.index];
  if (!def) return;
  m.phase = 'brief';
  openDialogue(G, def.name, def.brief, () => {
    m.phase = 'active';
    m.data = {};
    const L = G.city.landmarks;
    if (m.index === 0) {
      m.timer = 90;
      m.target = { x: L.marina.x, y: L.marina.y, label: 'Marina Serena' };
      // Marta's borrowed car waits outside the warehouse
      const car = makeCar(L.warehouse.x + 90, L.warehouse.y + 40, 0, 'sedan', 'parked', '#e8e2d4');
      G.cars.push(car);
    } else if (m.index === 1) {
      m.timer = 0;
      m.target = { x: 1000, y: 1120, label: 'Gold Coupe' };
      const coupe = makeCar(1000, 1120, Math.PI, 'coupe', 'mission', '#e0b13c');
      G.cars.push(coupe);
      m.data.coupeId = coupe.id;
    } else if (m.index === 2) {
      m.timer = 0;
      const spots = [[BEACH_X + 30, 900], [BEACH_X + 30, 1200], [BEACH_X + 30, 1500]];
      m.data.debtors = spots.map(([x, y]) => {
        const ped = makePed(x, y, 'debtor');
        ped.color = '#c94f3d';
        G.peds.push(ped);
        return ped;
      });
      m.data.done = 0;
      m.target = { x: BEACH_X + 30, y: 1200, label: 'Beach Debtors' };
    } else if (m.index === 3) {
      m.timer = 0;
      const van = makeCar(L.warehouse.x + 60, L.warehouse.y - 60, -Math.PI / 2, 'van', 'escort', '#4fae62');
      van.health = 100;
      G.cars.push(van);
      m.data.van = van;
      m.data.waypoints = [
        { x: 1280, y: 1440 }, { x: 2080, y: 1440 }, { x: 2080, y: 640 }, { x: 2320, y: 640 },
      ];
      m.data.wp = 0;
      m.target = { x: 2320, y: 640, label: 'Escort the Van' };
      addWanted(G, 2, 'HOT CARGO');
    } else if (m.index === 4) {
      m.timer = 0;
      m.target = { x: L.safehouse.x, y: L.safehouse.y, label: 'Safehouse' };
      addWanted(G, 4, '4 STARS');
    } else if (m.index === 5) {
      m.timer = 150;
      m.target = { x: L.lighthouse.x, y: L.lighthouse.y, label: 'Lighthouse Boat' };
      addWanted(G, 5, '5 STARS');
    }
    G.banner = { text: `${def.name} — ${def.objective}`, timer: 5 };
  });
}

/** Press E near the mission start marker. Returns true if it started something. */
export function tryMissionInteract(G) {
  const m = G.mission;
  const p = G.player;
  if (m.index >= MISSIONS.length) return false;
  if (m.phase === 'idle') {
    const s = missionStartPoint(G);
    if (Math.hypot(p.x - s.x, p.y - s.y) < 110) {
      startMission(G);
      return true;
    }
    return false;
  }
  if (m.phase === 'active' && m.index === 2) {
    // intimidate a nearby debtor
    for (const debtor of m.data.debtors || []) {
      if (debtor.state !== 'debtor') continue;
      if (Math.hypot(p.x - debtor.x, p.y - debtor.y) < 70) {
        debtor.state = 'flee';
        debtor.timer = 4;
        debtor.targetX = debtor.x - 300;
        debtor.targetY = debtor.y;
        m.data.done += 1;
        G.audio.hit();
        G.floaters.push({ x: debtor.x, y: debtor.y - 26, text: 'PAID UP', life: 1.4, color: '#7ddb8a' });
        if (m.data.done >= 3) completeMission(G);
        else m.target = { x: BEACH_X + 30, y: 1200, label: `${3 - m.data.done} debtors left` };
        return true;
      }
    }
  }
  return false;
}

/** Drive the escort van along its waypoints; it waits when Marco strays. */
function updateEscortVan(G, dt) {
  const m = G.mission;
  const van = m.data.van;
  if (!van) return;
  const p = G.player;
  const distToPlayer = Math.hypot(p.x - van.x, p.y - van.y);
  const wps = m.data.waypoints;
  const wp = wps[m.data.wp];
  if (!wp) return;
  if (distToPlayer > 320) {
    van.speed = Math.max(0, van.speed - 200 * dt);
    m.target = { x: van.x, y: van.y, label: 'Get back to the van!' };
    return;
  }
  m.target = { x: 2320, y: 640, label: 'Escort the Van' };
  const dx = wp.x - van.x;
  const dy = wp.y - van.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 40) {
    m.data.wp += 1;
    if (m.data.wp >= wps.length) {
      completeMission(G);
      return;
    }
    return;
  }
  const want = Math.atan2(dy, dx);
  let diff = want - van.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  van.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff * 4 * dt));
  van.speed = Math.min(van.speed + 120 * dt, 150);
  const nx = van.x + Math.cos(van.angle) * van.speed * dt;
  const ny = van.y + Math.sin(van.angle) * van.speed * dt;
  const res = collideCircle(G.city, nx, ny, van.len / 2 - 6);
  van.x = res.x;
  van.y = res.y;
}

export function updateMissions(G, dt) {
  const m = G.mission;
  const p = G.player;
  if (m.index >= MISSIONS.length || m.phase !== 'active') return;

  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      if (m.index === 0) failMission(G, 'The package arrived too late. The tide turned.');
      else if (m.index === 5) failMission(G, 'The boat left without you.');
      return;
    }
  }

  if (m.index === 0) {
    const L = G.city.landmarks.marina;
    if (p.inCar && Math.hypot(p.x - L.x, p.y - L.y) < 110) completeMission(G);
  } else if (m.index === 1) {
    const coupe = G.cars.find((c) => c.id === m.data.coupeId);
    const L = G.city.landmarks.pipo;
    if (coupe && p.inCar === coupe && Math.hypot(p.x - L.x, p.y - L.y) < 110) {
      completeMission(G);
    } else if (coupe && p.inCar === coupe) {
      m.target = { x: L.x, y: L.y, label: 'Deliver to Talleres Pipo' };
    }
  } else if (m.index === 3) {
    updateEscortVan(G, dt);
  } else if (m.index === 4) {
    const L = G.city.landmarks.safehouse;
    if (p.wanted === 0 && Math.hypot(p.x - L.x, p.y - L.y) < 110) completeMission(G);
  } else if (m.index === 5) {
    const L = G.city.landmarks.lighthouse;
    if (Math.hypot(p.x - L.x, p.y - L.y) < 110) completeMission(G);
  }
}

// ---------------------------------------------------------------- taxi fares

/** Spawn a glowing taxi customer on a sidewalk near the player. */
export function spawnTaxiCustomer(G, rng) {
  const p = G.player;
  const a = rng() * Math.PI * 2;
  const x = Math.max(80, Math.min(WORLD - 80, p.x + Math.cos(a) * (200 + rng() * 300)));
  const y = Math.max(80, Math.min(WORLD - 80, p.y + Math.sin(a) * (200 + rng() * 300)));
  const ped = makePed(x, y, 'taxi');
  ped.color = '#7ddb8a';
  G.peds.push(ped);
  G.taxiPed = ped;
}

/** Press E near the waiting taxi customer to take the fare. */
export function tryTaxiInteract(G) {
  const p = G.player;
  if (G.taxi || !G.taxiPed) return false;
  if (G.taxiPed.state !== 'taxi') return false;
  if (Math.hypot(p.x - G.taxiPed.x, p.y - G.taxiPed.y) > 70) return false;
  if (!p.inCar) {
    G.floaters.push({ x: p.x, y: p.y - 30, text: 'NEED A CAR FOR THE FARE', life: 1.4, color: '#cfc8b8' });
    return true;
  }
  const dests = Object.values(G.city.landmarks).filter((l) => l.label !== 'Lighthouse Point');
  const dest = dests[Math.floor(Math.random() * dests.length)];
  const dist = Math.hypot(dest.x - p.x, dest.y - p.y);
  const fare = 40;
  G.taxi = {
    ped: G.taxiPed,
    dest: { x: dest.x, y: dest.y, label: dest.label },
    timer: Math.max(35, dist / 260 + 15),
    totalTime: Math.max(35, dist / 260 + 15),
    fare,
  };
  G.taxiPed.state = 'walk'; // they hop in (abstracted): they vanish into the car
  G.taxiPed.x = -100;
  G.taxiPed.y = -100;
  G.taxiPed = null;
  G.banner = { text: `TAXI FARE — take the customer to ${dest.label}`, timer: 4 };
  G.audio.dialogue();
  return true;
}

export function updateTaxi(G, dt) {
  const t = G.taxi;
  if (!t) return;
  const p = G.player;
  t.timer -= dt;
  if (t.timer <= 0) {
    G.taxi = null;
    G.floaters.push({ x: p.x, y: p.y - 30, text: 'FARE CANCELLED — TOO SLOW', life: 1.6, color: '#ff5a4e' });
    G.audio.fail();
    return;
  }
  if (p.inCar && Math.hypot(p.x - t.dest.x, p.y - t.dest.y) < 110) {
    const tip = Math.round((t.timer / t.totalTime) * 60);
    const total = t.fare + tip;
    p.cash += total;
    G.taxiCount = (G.taxiCount || 0) + 1;
    G.floaters.push({ x: p.x, y: p.y - 40, text: `FARE +$${total} (TIP $${tip})`, life: 1.8, color: '#7ddb8a' });
    G.audio.cash();
    G.taxi = null;
  }
}
