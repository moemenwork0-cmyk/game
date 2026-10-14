export const GAME_TITLE = 'Glowtide';
export const VERSION = '0.1.0';

/** Ads are planned for Full Launch only. */
export const ADS_ENABLED = false;

function readDebugFlag(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1';
  } catch {
    return false;
  }
}

/** Debug overlay and cheat keys, enabled with `?debug=1`. */
export const DEBUG = typeof window !== 'undefined' && readDebugFlag();
