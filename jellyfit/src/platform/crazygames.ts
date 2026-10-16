/**
 * CrazyGames HTML5 SDK v3 (spec 16.2). The SDK script is added to index.html only in the CrazyGames
 * build. Every call is guarded: if the script fails to load, init times out, or the environment is
 * "disabled" (any non-CrazyGames domain), this behaves exactly like NonePlatform.
 * The game never waits on, or breaks because of, the SDK.
 */
import type { Platform } from './platform';
import type { KeyValueStorage } from '../meta/save';

interface CgSettings {
  muteAudio?: boolean;
}

interface CgSdk {
  init(): Promise<void>;
  environment: 'local' | 'crazygames' | 'disabled' | string;
  game: {
    loadingStart(): void;
    loadingStop(): void;
    gameplayStart(): void;
    gameplayStop(): void;
    happytime(): void;
    settings?: CgSettings;
    addSettingsChangeListener?(cb: (s: CgSettings) => void): void;
  };
  user?: { systemInfo?: { locale?: string } };
  data?: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
  };
}

declare global {
  interface Window {
    CrazyGames?: { SDK?: CgSdk };
    __cgSdkFailed?: boolean;
  }
}

const INIT_TIMEOUT_MS = 3000;
const HAPPY_GAP_MS = 60_000;

export class CrazyGamesPlatform implements Platform {
  readonly name = 'crazygames';
  private sdk: CgSdk | null = null;
  private state: 'start' | 'stop' | null = null;
  private lastHappy = -Infinity;
  private muted = false;
  private muteCbs: ((m: boolean) => void)[] = [];

  async init(): Promise<void> {
    const deadline = Date.now() + INIT_TIMEOUT_MS;
    try {
      // The script tag is async: wait for it (or its onerror) without blocking the game for long.
      while (!window.CrazyGames?.SDK && !window.__cgSdkFailed && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 50));
      }
      const sdk = window.CrazyGames?.SDK;
      if (!sdk) return;
      const left = Math.max(200, deadline - Date.now());
      const ok = await Promise.race([
        sdk.init().then(
          () => true,
          () => false,
        ),
        new Promise<boolean>((r) => setTimeout(() => r(false), left)),
      ]);
      if (!ok) return;
      // "disabled" (other domains): every SDK method throws, so don't use it at all.
      if (sdk.environment !== 'crazygames' && sdk.environment !== 'local') return;
      this.sdk = sdk;
      this.muted = !!sdk.game.settings?.muteAudio;
      sdk.game.addSettingsChangeListener?.((s) => {
        const m = !!s?.muteAudio;
        if (m === this.muted) return;
        this.muted = m;
        for (const cb of this.muteCbs) cb(m);
      });
    } catch {
      this.sdk = null;
    }
  }

  private call(fn: (sdk: CgSdk) => void): void {
    const sdk = this.sdk;
    if (!sdk) return;
    try {
      fn(sdk);
    } catch {
      /* the SDK must never break the game */
    }
  }

  loadingStart(): void {
    this.call((s) => s.game.loadingStart());
  }

  loadingStop(): void {
    this.call((s) => s.game.loadingStop());
  }

  gameplayStart(): void {
    if (this.state === 'start') return;
    this.state = 'start';
    this.call((s) => s.game.gameplayStart());
  }

  gameplayStop(): void {
    // Nothing to stop before the first start.
    if (this.state !== 'start') return;
    this.state = 'stop';
    this.call((s) => s.game.gameplayStop());
  }

  happytime(): void {
    const now = Date.now();
    if (now - this.lastHappy < HAPPY_GAP_MS) return;
    this.lastHappy = now;
    this.call((s) => s.game.happytime());
  }

  isMuted(): boolean {
    return this.muted;
  }

  onMuteChange(cb: (muted: boolean) => void): void {
    this.muteCbs.push(cb);
  }

  async showMidgame(): Promise<void> {}

  async showRewarded(): Promise<boolean> {
    return false;
  }

  adsEnabled(): boolean {
    return false;
  }

  /** SDK system info locale, else the browser's language. CrazyGames requires English as the fallback. */
  locale(): string | null {
    try {
      const l = this.sdk?.user?.systemInfo?.locale;
      if (l) return l;
    } catch {
      /* ignore */
    }
    return typeof navigator !== 'undefined' ? navigator.language || null : null;
  }

  /**
   * On CrazyGames the Data module keeps progress for guests and signed-in players (it syncs to the
   * account). Reads prefer it and fall back to the browser save (first run, or the module is off);
   * writes go to both, so progress is never lost whichever one is working.
   */
  storage(): KeyValueStorage | null {
    const sdk = this.sdk;
    if (!sdk || sdk.environment !== 'crazygames' || !sdk.data) return null;
    const data = sdk.data;
    const local = (): Storage | null => {
      try {
        return window.localStorage;
      } catch {
        return null;
      }
    };
    return {
      get(key) {
        try {
          const v = data.getItem(key);
          if (v != null) return v;
        } catch {
          /* fall back to the browser save */
        }
        try {
          return local()?.getItem(key) ?? null;
        } catch {
          return null;
        }
      },
      set(key, value) {
        try {
          data.setItem(key, value);
        } catch {
          /* best effort */
        }
        try {
          local()?.setItem(key, value);
        } catch {
          /* best effort */
        }
      },
    };
  }
}
