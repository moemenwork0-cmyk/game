# Glowtide

Drag through same-colored sea creatures swimming toward your pearl to link and pop them. Longer chains
make bigger blasts.

An HTML5 action-puzzle game for the CrazyGames platform. Vite + TypeScript, a canvas world with a DOM
overlay, synthesized audio, and no runtime dependencies. The design is in
[`GLOWTIDE_GAME_SPEC.md`](GLOWTIDE_GAME_SPEC.md); progress is tracked in [`PLAN.md`](PLAN.md) and
[`DEVLOG.md`](DEVLOG.md).

## Commands

Run every command from this folder.

```sh
npm install
npm run dev        # local dev server
npm run typecheck  # tsc --noEmit
npm test           # vitest
npm run lint
npm run build      # production build into dist/
npm run preview    # serve dist/
npm run zip        # dist/ → glowtide-build.zip
```

Add `?debug=1` to the URL for the debug overlay and cheat keys:

| Key | Action |
|---|---|
| K | Kill all critters |
| I | Toggle invincibility |
| N | Skip a tide |
| S | Spawn 50 critters (stress test) |

## Controls

Drag through creatures of the same color to link them; release to pop. P pauses.
