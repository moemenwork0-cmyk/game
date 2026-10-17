/** Local dev, the Android app and any other host: no portal; calls are no-ops, the language is the device's. */
import type { Platform } from './platform';
import type { KeyValueStorage } from '../meta/save';

export class NonePlatform implements Platform {
  readonly name = 'none';
  async init(): Promise<void> {}
  loadingStart(): void {}
  loadingStop(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}
  happytime(): void {}
  isMuted(): boolean {
    return false;
  }
  onMuteChange(): void {}
  async showMidgame(): Promise<void> {}
  async showRewarded(): Promise<boolean> {
    return false;
  }
  adsEnabled(): boolean {
    return false;
  }
  /** The device language (the phone's language in the Android app). */
  locale(): string | null {
    return typeof navigator !== 'undefined' ? navigator.language || null : null;
  }
  storage(): KeyValueStorage | null {
    return null;
  }
}
