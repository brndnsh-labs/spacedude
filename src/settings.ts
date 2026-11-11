/** Player preferences, kept apart from the save so a new game does not reset them. */
export interface Settings {
  /** Show the picture through the CRT filter. */
  crt: boolean;
}

const KEY = 'spacedude.settings.v1';
const DEFAULTS: Settings = { crt: false };

export function loadSettings(): Settings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage can be unavailable (private windows); the setting just lasts for this visit.
  }
}
