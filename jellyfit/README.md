# JELLYFIT

A casual 8×8 block puzzle with squishy jelly blocks, built for the web (CrazyGames first, mobile later). Vite + TypeScript, one 2D canvas, no engine, no backend.

```bash
npm install
npm run dev        # play at http://localhost:5173  (?debug=1 for the debug overlay)
npm test           # unit tests
npm run sim        # bot simulation of the piece generator
npm run build      # production build into dist/
npm run shots      # screenshots into screenshots/ (after build)
npm run smoke      # live smoke test in Chromium (after build)
npm run zip        # dist/ → jellyfit.zip
npm run zip:crazygames   # CrazyGames build (SDK v3) → jellyfit-crazygames.zip
npm run smoke:crazygames # SDK integration check (after zip:crazygames)
npm run covers     # CrazyGames cover images → covers/
```

- CrazyGames upload and form: [SUBMISSION.md](SUBMISSION.md)

- Spec: [JELLYFIT_GAME_SPEC.md](JELLYFIT_GAME_SPEC.md)
- Plan and milestones: [PLAN.md](PLAN.md)
- Progress, results, known issues: [DEVLOG.md](DEVLOG.md)
- Decisions and changed numbers: [DECISIONS.md](DECISIONS.md)
