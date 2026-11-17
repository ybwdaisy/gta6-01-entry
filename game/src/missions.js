// Six-mission story chain for harbor boss Marta Vidal, plus taxi fares.
// Missions are marker-driven with dialogue cards and cash rewards.
import { WORLD } from './city.js';

export const MISSIONS = [
  { title: 'First Run', sub: 'Drive Marta’s package to the marina before the clock runs out.', reward: 400 },
  { title: 'Loud Money', sub: 'Steal the gold Coral GT at the market and bring it to Talleres Pipo.', reward: 600 },
  { title: 'Beach Debts', sub: 'Three debtors are hiding on the beach. Lean on each of them.', reward: 500 },
  { title: 'Hot Cargo', sub: 'Escort the warehouse van across town. The cops already know.', reward: 800 },
  { title: 'Sirens', sub: 'Lose a 4-star wanted level, then slip to the safehouse.', reward: 1000 },
  { title: 'Serena Goodbye', sub: 'Five stars. One boat at the lighthouse. Get out of Serena Bay.', reward: 1500 },
];

export const SPOTS = {
  warehouse: { x: 610, y: 2350, label: 'Vidal Warehouse' },
  marina: { x: 2345, y: 2130, label: 'Marina' },
  garage: { x: 1255, y: 1835, label: 'Talleres Pipo' },
  safehouse: { x: 300, y: 1300, label: 'Safehouse' },
  lighthouse: { x: 2430, y: 180, label: 'Lighthouse Boat' },
  market: { x: 890, y: 1515, label: 'Mercado Central' },
  beach: { x: 2400, y: 900, label: 'Playa Serena' },
};

const DIALOGUE = [
  [
    ['Marta Vidal', 'Marco. You run packages, you eat. First one is easy: a sealed case for the marina. The boat leaves soon — do not be late.'],
    ['Marco Reyes', 'On it, Marta. Keys in the ignition?'],
    ['Marta Vidal', 'Take any car you like. In this city, cars are… borrowed. Go.'],
  ],
  [
    ['Marta Vidal', 'A gold Coral GT is parked at the market. Its owner owes me. Bring it to Pipo — he will make it disappear.'],
    ['Marco Reyes', 'Stealing in daylight? The cops will notice.'],
    ['Marta Vidal', 'Then be quick. Pipo is waiting with the spray gun.'],
  ],
  [
    ['Marta Vidal', 'Three men owe the harbor money and think the beach hides them. Go remind them. A firm word is enough — mostly.'],
    ['Marco Reyes', 'And if a firm word is not enough?'],
    ['Marta Vidal', 'Then your pistol does the talking. Do not kill them. I need them alive to pay.'],
  ],
  [
    ['Marta Vidal', 'A van full of cargo has to cross town. Ride with it. The police have the route — expect company.'],
    ['Marco Reyes', 'Two stars before I even start?'],
    ['Marta Vidal', 'Consider it a compliment. Keep the van alive.'],
  ],
  [
    ['Marta Vidal', 'The department wants your head tonight. Four stars, Marco. Lose them, then come to the safehouse. Do not bring the sirens with you.'],
    ['Marco Reyes', 'Lose four stars and walk away clean. Sure. Easy.'],
  ],
  [
    ['Marta Vidal', 'This is the last one. The boat at the lighthouse leaves at dawn, and every cop in Serena Bay knows it. Five stars, one countdown.'],
    ['Marco Reyes', 'Then I had better not miss the boat.'],
    ['Marta Vidal', 'Marco — whatever happens tonight: thank you. Now go.'],
  ],
];

export function startMission(S, index) {
  const def = MISSIONS[index];
  S.mission = { index, stage: 0, timer: 0, data: {}, active: true };
  S.showDialogue(DIALOGUE[index], () => {
    S.banner(def.title, def.sub);
    S.audio.sting();
    setupMission(S);
  });
  S.objective = def.sub;
}

function setupMission(S) {
  const m = S.mission;
  const i = m.index;
  if (i === 0) { m.timer = 150; m.data.target = SPOTS.marina; }
  if (i === 1) {
    const coupe = {
      x: SPOTS.market.x + 40, y: SPOTS.market.y + 10, angle: 0, speed: 0,
      color: '#f1c40f', name: 'Coral GT', traffic: false, parked: true,
      police: false, hp: 100, targetCar: true,
    };
    S.cars.push(coupe);
    m.data.coupe = coupe;
    m.data.target = SPOTS.market;
  }
  if (i === 2) {
    m.data.debtors = [];
    for (let k = 0; k < 3; k++) {
      const p = {
        x: 2380 + Math.random() * 60, y: 500 + k * 320 + Math.random() * 80,
        angle: 0, speed: 40, shirt: '#8e44ad', skin: '#e0ac69', hp: 100,
        flee: 0, panic: 0, walkPhase: 0, horizontal: false, road: 2400, dir: 1,
        changeIn: 5, taxi: false, dead: false, debtor: true,
      };
      S.peds.push(p);
      m.data.debtors.push(p);
    }
    m.data.target = SPOTS.beach;
  }
  if (i === 3) {
    const van = {
      x: SPOTS.warehouse.x + 120, y: SPOTS.warehouse.y, angle: 0, speed: 0,
      color: '#7f8c8d', name: 'Harbor Van', traffic: false, parked: false,
      police: false, hp: 200, escort: true, axis: 'h', lane: 1, along: SPOTS.warehouse.x,
    };
    S.cars.push(van);
    m.data.van = van;
    m.data.target = SPOTS.marina;
    S.addWanted(2, 'The escort is blown');
  }
  if (i === 4) {
    S.player.wanted = 4;
    S.audio.setSiren(true);
    m.data.target = SPOTS.safehouse;
  }
  if (i === 5) {
    S.player.wanted = 5;
    S.audio.setSiren(true);
    m.timer = 150;
    m.data.target = SPOTS.lighthouse;
  }
}

function reach(S, target, radius = 70) {
  return Math.hypot(S.player.x - target.x, S.player.y - target.y) < radius;
}

export function completeMission(S) {
  const m = S.mission;
  const def = MISSIONS[m.index];
  S.player.cash += def.reward;
  S.floatText(S.player.x, S.player.y, `+$${def.reward}`, '#7dff9a');
  S.audio.cash();
  S.audio.sting();
  S.banner('MISSION PASSED', `${def.title}  ·  +$${def.reward}`);
  S.mission = { index: m.index + 1, stage: 0, timer: 0, data: {}, active: false };
  S.storyDone = m.index + 1 >= MISSIONS.length;
  if (S.storyDone) {
    S.showEndcard('SERENA GOODBYE', 'The boat pulls away from the lighthouse as the sirens fade behind you. Marta’s last words echo over the water: “Whatever happens tonight — thank you.”\n\nFree roam continues. The city is yours, Marco.');
  }
  S.saveGame();
  if (S.storyDone) S.objective = 'Free roam — Serena Bay is yours.';
  else S.objective = `Next job: ${MISSIONS[m.index + 1].title} — go to the Vidal Warehouse.`;
}

export function failMission(S, reason) {
  const m = S.mission;
  if (!m || !m.active) return;
  S.audio.fail();
  S.banner('MISSION FAILED', reason);
  S.mission = { index: m.index, stage: 0, timer: 0, data: {}, active: false };
  S.objective = `Job failed: ${MISSIONS[m.index].title} — return to the Vidal Warehouse to retry.`;
}

export function currentMarker(S) {
  const m = S.mission;
  if (m && m.active) {
    if (m.index === 0) return m.data.target;
    if (m.index === 1) return m.stage === 0 ? m.data.target : SPOTS.garage;
    if (m.index === 2) {
      const left = m.data.debtors.filter((d) => !d.done);
      return left.length ? { x: left[0].x, y: left[0].y, label: 'Debtor' } : SPOTS.beach;
    }
    if (m.index === 3) return m.data.van ? { x: m.data.van.x, y: m.data.van.y, label: 'Harbor Van' } : SPOTS.marina;
    if (m.index === 4) return S.player.wanted > 0 ? { x: S.player.x, y: S.player.y, label: 'Lose the cops' } : SPOTS.safehouse;
    if (m.index === 5) return m.data.target;
  }
  // No active mission: point at the warehouse to start the next job.
  if (!S.storyDone) return SPOTS.warehouse;
  return null;
}

export function updateMissions(S, dt) {
  const m = S.mission;
  const p = S.player;

  // Start a mission by walking into the warehouse marker.
  if ((!m || !m.active) && !S.storyDone && S.state === 'playing') {
    if (reach(S, SPOTS.warehouse, 90)) startMission(S, m ? m.index : 0);
  }

  // Taxi fares: glowing ped near the player, E to accept (handled in main).
  if (!S.taxi.active && Math.random() < dt * 0.02 && !p.car) {
    const near = S.peds.filter((x) => !x.dead && !x.debtor && Math.hypot(x.x - p.x, x.y - p.y) < 220);
    if (near.length) {
      const ped = near[0];
      ped.taxi = true;
      S.taxi.candidate = ped;
      S.toast('A fare is waving you down — press E to pick them up', 3);
    }
  }
  if (S.taxi.active) {
    S.taxi.timer -= dt;
    if (reach(S, S.taxi.dest, 80)) {
      const pay = 25 + Math.round(S.taxi.timer);
      p.cash += pay;
      S.floatText(p.x, p.y, `+$${pay}`, '#7dff9a');
      S.audio.cash();
      S.toast(`Fare complete — +$${pay}`, 2);
      S.taxiCount = (S.taxiCount || 0) + 1;
      S.taxi = { active: false, candidate: null, dest: null, timer: 0 };
      S.saveGame();
    } else if (S.taxi.timer <= 0) {
      S.toast('The fare gave up waiting.', 2);
      S.taxi = { active: false, candidate: null, dest: null, timer: 0 };
    }
  }

  if (!m || !m.active) return;

  // Mission timers.
  if (m.index === 0 || m.index === 5) {
    m.timer -= dt;
    if (m.timer <= 0) { failMission(S, 'Out of time.'); return; }
  }

  if (m.index === 0) {
    if (reach(S, SPOTS.marina, 80)) completeMission(S);
  } else if (m.index === 1) {
    if (m.stage === 0) {
      if (p.car === m.data.coupe) { m.stage = 1; S.toast('Got the Coral GT — take it to Talleres Pipo', 2.5); }
    } else if (reach(S, SPOTS.garage, 90) && p.car === m.data.coupe) {
      S.cars = S.cars.filter((c) => c !== m.data.coupe);
      p.car = null;
      completeMission(S);
    }
  } else if (m.index === 2) {
    for (const d of m.data.debtors) {
      if (!d.done && Math.hypot(p.x - d.x, p.y - d.y) < 46) {
        d.done = true;
        d.flee = 4; d.fleeX = p.x; d.fleeY = p.y;
        S.audio.sting();
        const left = m.data.debtors.filter((x) => !x.done).length;
        S.toast(left ? `Debtor leaned on — ${left} to go` : 'All three debtors leaned on', 2.5);
        if (left === 0) completeMission(S);
      }
    }
  } else if (m.index === 3) {
    const van = m.data.van;
    if (!van || van.hp <= 0) { failMission(S, 'The van was destroyed.'); return; }
    // Van crawls along the south road toward the marina.
    if (van.x < SPOTS.marina.x - 40) {
      van.angle = 0;
      van.x += 62 * dt;
      van.y = 2400 + 22;
    } else if (van.y > SPOTS.marina.y + 40) {
      van.angle = -Math.PI / 2;
      van.y -= 62 * dt;
      van.x = 2400 + 22;
    }
    if (Math.hypot(van.x - SPOTS.marina.x, van.y - SPOTS.marina.y) < 120) {
      S.cars = S.cars.filter((c) => c !== van);
      completeMission(S);
    }
  } else if (m.index === 4) {
    if (p.wanted === 0 && reach(S, SPOTS.safehouse, 90)) completeMission(S);
  } else if (m.index === 5) {
    if (reach(S, SPOTS.lighthouse, 80) && p.wanted >= 1) completeMission(S);
  }
}

// Start a taxi fare: the waving ped climbs in and names a destination.
export function startTaxi(S) {
  const ped = S.taxi.candidate;
  if (!ped || ped.dead) return false;
  const spots = [
    { x: 300, y: 300, label: 'North Serena' },
    { x: 890, y: 1515, label: 'Mercado Central' },
    { x: 2345, y: 2130, label: 'Marina' },
    { x: 610, y: 2350, label: 'Harbor South' },
    { x: 1500, y: 300, label: 'Hotel Serena' },
    { x: 2400, y: 900, label: 'Playa Serena' },
  ];
  const dest = spots[Math.floor(Math.random() * spots.length)];
  ped.taxi = false;
  ped.dead = true; // They "get in" — removed from the street.
  S.taxi = { active: true, candidate: null, dest, timer: 90 };
  S.toast(`Fare to ${dest.label} — 90 seconds, drive safe`, 2.5);
  S.audio.pickup();
  return true;
}
