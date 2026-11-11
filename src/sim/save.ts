import type { GameState } from './types';

/** v2: the sector is generated per game and lives on the save. Older saves have no map and are left behind. */
const KEY = 'spacedude.save.v2';

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable (private windows); the game still plays without saves.
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    const state = raw ? (JSON.parse(raw) as GameState) : null;
    return state && Array.isArray(state.ports) && state.ports.length ? state : null;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
