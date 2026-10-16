# CrazyGames submission

## Build the upload

```bash
npm run zip:crazygames     # → jellyfit-crazygames.zip (build in dist-crazygames/)
npm run smoke:crazygames   # optional check: SDK events, mute, Data module, SDK blocked/hanging
npm run covers             # → covers/ (1920×1080, 800×1200, 800×800)
npm run build && npm run trailer   # → videos/ (1920×1080 and 1080×1620, 10 s, no sound)
```

The videos are recorded from the real game (scripted run, 30 fps, H.264): they open on the cover,
crossfade into play, and show a 2-column clear, a combo, a piece handed to Jello, a 3-column clear
with a new record, and a perfect clear with the piece from Jello's hand. CrazyGames rules followed:
landscape 1080p 16:9 + portrait 1080p 2:3, ≤ 20 s, ≤ 50 MB, no sound, no promo text, no default
mouse cursor (a cartoon hand carries the pieces), no black bars, first frame = cover.

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

| Field | Value |
|---|---|
| Title | Jelly Fit |
| Category | Puzzle |
| Tags | Block, Puzzle, Casual, Relaxing, Cute, Logic, 1 Player, Mouse, Touchscreen, 2D |
| Platforms | Desktop and mobile |
| Orientation | Both (landscape on desktop, portrait or landscape on phones) |
| Languages | English, Arabic |
| Multiplayer | No |
| Ads | None (Basic Launch) |
| In-game purchases | No |
| Account / user module | Not used |
| Progress Save (Data module) | **On** |
| Game file | `jellyfit-crazygames.zip` |
| Covers | `covers/cover-landscape-1920x1080.png`, `covers/cover-portrait-800x1200.png`, `covers/cover-square-800x800.png` |
| Videos | `videos/jellyfit-landscape-1920x1080.mp4`, `videos/jellyfit-portrait-1080x1620.mp4` |

**Short description**

> Fit squishy jelly blocks on an 8×8 board, clear rows and columns, and play with Jello, the cute buddy who holds a piece for you!

**Description**

> Jelly Fit is a relaxing block puzzle with squishy jelly blocks and a cute buddy named Jello. Drag pieces onto the 8×8 board, fill complete rows or columns to clear them, and keep the board open for as long as you can. Clear several lines at once for big points, chain clears for combos, and empty the whole board for a Perfect clear!
>
> Jello sits on the board and reacts to everything you do: he cheers when you clear lines, dances during combos, puts on sunglasses when you're on fire, gets nervous when space runs out, and wears a crown when you beat your record. Need to save a piece for later? Drag it to Jello and he'll hold it in his hand until you need it. You can poke him, stretch him and pet him too.
>
> Features:
> - Satisfying, squishy jelly blocks with smooth animations
> - Hold a piece with Jello and use it at the perfect moment
> - Combos, multi-line clears and Perfect clears
> - No timer: play at your own pace
> - Your best score and your game in progress are saved
> - Play in English or Arabic

**Controls**

> Mouse: click and drag a piece onto the board, release to place it.
> Touch: drag a piece with your finger.
> Fill a full row or column to clear it.
> Drag a piece onto Jello to keep it for later, then drag it from his hand onto the board when you need it.

## Test before submitting

Upload the zip, then open the developer preview: the browser console shows the SDK's
"Requesting gameplay start / stop" logs while you play, pause and lose.
