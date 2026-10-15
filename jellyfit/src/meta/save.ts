/**
 * Persistence (spec 15): one JSON blob under one key, behind a Storage interface so other platforms
 * can swap the backend. Corrupt data is backed up and replaced; storage failures fall back to memory.
 */
import { SAVE_KEY, SAVE_VERSION } from '../config/config';
import { isValidSnapshot, type SessionSnapshot } from '../game/session';

export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export class MemoryStorage implements KeyValueStorage {
  private m = new Map<string, string>();
  get(key: string): string | null {
    return this.m.has(key) ? this.m.get(key)! : null;
  }
  set(key: string, value: string): void {
    this.m.set(key, value);
  }
}

/** localStorage with a silent in-memory fallback. */
export class LocalStorage implements KeyValueStorage {
  private fallback = new MemoryStorage();
  private ok: boolean;
  constructor() {
    this.ok = false;
    try {
      const k = '__jf_probe__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      this.ok = true;
    } catch {
      this.ok = false;
    }
  }
  get(key: string): string | null {
    if (this.ok) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        this.ok = false;
      }
    }
    return this.fallback.get(key);
  }
  set(key: string, value: string): void {
    this.fallback.set(key, value);
    if (!this.ok) return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      this.ok = false;
    }
  }
}

export interface Settings {
  sfx: boolean;
  music: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  /** Jello's speech bubbles and voice. */
  jello: boolean;
}

export interface SaveData {
  version: number;
  best: number;
  gamesPlayed: number;
  /** In-progress Classic game, if any. */
  current: SessionSnapshot | null;
  settings: Settings;
  /** One-time tips: `hold` = the player has given Jello a piece; `holdShown` = times the tip was shown. */
  tips: { hold: boolean; holdShown: number };
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    best: 0,
    gamesPlayed: 0,
    current: null,
    settings: { sfx: true, music: true, haptics: true, reducedMotion: false, jello: true },
    tips: { hold: false, holdShown: 0 },
  };
}

/** Brings any older save up to the current version. Unknown fields are dropped. */
export function migrate(raw: Record<string, unknown>): SaveData {
  const d = defaultSave();
  const num = (v: unknown, def: number): number => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : def);
  d.best = num(raw.best, 0);
  d.gamesPlayed = num(raw.gamesPlayed, 0);
  d.current = isValidSnapshot(raw.current) ? raw.current : null;
  const tips = (raw.tips ?? {}) as Partial<SaveData['tips']>;
  d.tips.hold = tips.hold === true;
  d.tips.holdShown = num(tips.holdShown, 0);
  const s = (raw.settings ?? {}) as Partial<Settings>;
  for (const k of Object.keys(d.settings) as (keyof Settings)[]) {
    if (typeof s[k] === 'boolean') d.settings[k] = s[k]!;
  }
  return d;
}

export class SaveStore {
  data: SaveData;

  constructor(private readonly kv: KeyValueStorage) {
    this.data = this.load();
  }

  private load(): SaveData {
    const raw = this.kv.get(SAVE_KEY);
    if (raw == null) return defaultSave();
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('bad save');
      return migrate(parsed as Record<string, unknown>);
    } catch {
      this.kv.set(`${SAVE_KEY}.corrupt`, raw);
      return defaultSave();
    }
  }

  save(): void {
    try {
      this.kv.set(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      /* never crash on save */
    }
  }
}
