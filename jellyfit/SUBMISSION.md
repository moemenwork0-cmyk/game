# CrazyGames submission

## Build the upload

```bash
npm run zip:crazygames     # → jellyfit-crazygames.zip (build in dist-crazygames/)
npm run smoke:crazygames   # optional check: SDK events, mute, Data module, SDK blocked/hanging
npm run covers             # → covers/ (1920×1080, 800×1200, 800×800)
```

The CrazyGames build is the normal game plus their HTML5 SDK v3 script. The regular `npm run build`
(itch.io, the Android app) never loads it.

## What is integrated (spec 16)

| SDK feature | When |
|---|---|
| `init()` | At boot, in parallel with the fonts. Capped at 3 s; if the script is blocked or `init` hangs, the game runs without the SDK. |
| `loadingStart` / `loadingStop` | Boot, then the first frame. |
| `gameplayStart` | Play, Play again, Resume. |
| `gameplayStop` | Pause, home screen, game over. Never sent twice in a row. Not sent when the tab is hidden (the platform tracks focus itself); if the player comes back to the pause screen, the stop is sent then. |
| `happytime` | Beating your record (once per game) and perfect clears (empty board). At most once a minute. |
| `settings.muteAudio` + settings listener | Muted → all game audio off, and the in-game toggles can't turn it back on. |
| Data module | Saves (best score, game in progress, settings) go to `SDK.data` and to localStorage; reads prefer `SDK.data`. Only on the CrazyGames domain. |
| `user.systemInfo.locale` | Picks the language: Arabic for Arabic locales, otherwise English (CrazyGames requires English). Players can switch in Settings. |
| Ads | Off (`ADS_ENABLED = false`, Basic Launch). No ad calls, no ad buttons. |

Other requirements covered: relative paths, 8 files / ~190 KB, no external links, no fullscreen button,
no Escape key, Space/arrows never scroll the page, `user-select: none`, one click from load to play,
frame-rate independent physics, readable at 800×450 … 1920×1080 (short iframes use a wide layout with
the tray beside the board, and dialogs scale to fit).

## Submission form

- **Title:** Jelly Fit
- **Progress Save:** turn it **on** (the game uses the Data module).
- **Orientation:** both (landscape on desktop, portrait and landscape on phones).
- **Covers:** `covers/cover-landscape-1920x1080.png`, `covers/cover-portrait-800x1200.png`, `covers/cover-square-800x800.png`.
- **Controls:** Drag pieces onto the board with the mouse or your finger. Fill a row or a column to clear it. Drag a piece onto Jello to keep it for later, then drag it back out when you need it.
- **Short description:** A squishy 8×8 block puzzle with a jelly buddy who talks, cheers and holds a piece for you.
- **Description:** Drag jelly blocks onto the 8×8 board and fill rows and columns to clear them. Chain clears for combos, empty the whole board for a perfect clear, and beat your best score. Jello, your wobbly friend on the board, reacts to every move: he cheers, dances, gets nervous when space runs out, puts on sunglasses during big combos, and will hold one piece for you until you need it. Poke him, stretch him or pet him. No timer, no pressure: just one more round.
- **Tags:** puzzle, block, casual, relaxing, 2d, mouse, touch.

## Test before submitting

Upload the zip, then open the developer preview: the browser console shows the SDK's
"Requesting gameplay start / stop" logs while you play, pause and lose.
