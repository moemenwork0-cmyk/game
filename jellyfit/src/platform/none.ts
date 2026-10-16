/** Local dev, the Android app and any other host: no portal, every call is a no-op. */
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
  locale(): string | null {
    return null;
  }
  storage(): KeyValueStorage | null {
    return null;
  }
}
