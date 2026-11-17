// save.js — localStorage persistence for Serena Bay Heat.
// One key, one small object: cash, story progress, position, taxi count.

export const SAVE_KEY = 'serena-save-v1';

/** Write the current run into localStorage. Returns true on success. */
export function saveGame(G) {
  try {
    const data = {
      cash: Math.round(G.player.cash),
      health: Math.round(G.player.health),
      armor: Math.round(G.player.armor),
      missionIndex: G.mission.index,
      storyDone: G.mission.storyDone,
      taxiCount: G.taxiCount || 0,
      x: Math.round(G.player.x),
      y: Math.round(G.player.y),
      day: G.day,
      clock: Math.round(G.clock),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

/** Read a saved run, or null when there is none / it is corrupt. */
export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

/** True when a save exists (drives the Continue button). */
export function hasSave() {
  return loadGame() !== null;
}

/** Wipe the save (used after the story is finished and replayed, or by tests). */
export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage unavailable */ }
}
