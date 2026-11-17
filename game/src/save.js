// localStorage save: serena-save-v1 {cash, missionIndex, storyDone,
// player position, taxi count, day}. Autosaves on mission complete.
export const SAVE_KEY = 'serena-save-v1';

export function saveGame(S) {
  try {
    const data = {
      cash: Math.floor(S.player.cash),
      missionIndex: S.mission ? S.mission.index : 0,
      storyDone: !!S.storyDone,
      x: Math.round(S.player.x),
      y: Math.round(S.player.y),
      taxiCount: S.taxiCount || 0,
      day: S.day,
      clockSec: Math.floor(S.clockSec),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
}
