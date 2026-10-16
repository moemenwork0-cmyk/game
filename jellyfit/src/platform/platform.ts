/**
 * Platform layer (spec 16). The game talks to portals only through this interface and never imports a
 * vendor SDK directly. `createPlatform()` picks the implementation chosen at build time
 * (`vite build --mode crazygames` sets VITE_PLATFORM=crazygames).
 */
import type { KeyValueStorage } from '../meta/save';
import { NonePlatform } from './none';
import { CrazyGamesPlatform } from './crazygames';

/** Ads stay off for the CrazyGames Basic Launch (no ad calls, no ad buttons). */
export const ADS_ENABLED = false;

export interface Platform {
  readonly name: string;
  /** Never throws, never blocks for more than ~3 s. */
  init(): Promise<void>;
  loadingStart(): void;
  loadingStop(): void;
  /** De-duplicated: the same event is never sent twice in a row. */
  gameplayStart(): void;
  gameplayStop(): void;
  /** Throttled to once per 60 s. */
  happytime(): void;
  isMuted(): boolean;
  onMuteChange(cb: (muted: boolean) => void): void;
  /** Resolves immediately while ads are disabled. */
  showMidgame(): Promise<void>;
  /** Resolves false while ads are disabled. */
  showRewarded(): Promise<boolean>;
  adsEnabled(): boolean;
  /** The player's locale from the portal (e.g. "en-US"), or null to use the game's default language. */
  locale(): string | null;
  /** Portal save storage (cloud/account saves), or null to use the browser's localStorage. */
  storage(): KeyValueStorage | null;
}

export function createPlatform(): Platform {
  return import.meta.env.VITE_PLATFORM === 'crazygames' ? new CrazyGamesPlatform() : new NonePlatform();
}
