/** Visual and feel tunables (spec 5, 9). */
export const THEME = {
  /**
   * Calm palette (player feedback replaced the spec's purple → pink gradient, see DECISIONS.md):
   * a soft deep-blue background that is easy on the eyes and lets the jelly colours carry the screen.
   */
  palette: {
    bgTop: '#1A2547',
    bgMid: '#22305A',
    bgBottom: '#2A3B6B',
    boardFill: '#131C38',
    boardBorder: '#2B3B6A',
    socket: '#1C2749',
    socketShadow: '#111933',
    socketHighlight: '#28365F',
    gold: '#FFC93C',
    goldText: '#4A2A00',
    panel: 'rgba(23,33,64,0.96)',
    panelBorder: '#33467C',
    text: '#FFFFFF',
    textSecondary: '#A9B8DE',
    coin: '#FFD54A',
  },

  /** Classic Jelly, slightly softened: Strawberry, Tangerine, Lemon, Lime, Ocean, Grape, Aqua. */
  jelly: ['#F4517A', '#F7953F', '#F6CD4C', '#55CC6B', '#4891F2', '#9C6BF2', '#2BC8BF'],

  layout: {
    columnMax: 520,
    sidePad: 16,
    /** Aspect (w/h) above which the desktop/landscape layout is used. */
    landscapeAspect: 1.1,
    landscapeBoardOfHeight: 0.62,
    boardMax: 620,
    trayOfBoard: 0.42,
    topBarPortrait: 132,
    topBarLandscape: 124,
    gapBoardTray: 14,
    bottomPad: 14,
    trayScale: 0.6,
    trayScaleDesktop: 0.65,
    /** Board frame padding as a fraction of board size. */
    framePad: 0.028,
    frameRadius: 18,
    maxDpr: 3,
  },

  drag: {
    pickupMs: 120,
    pickupOvershoot: 1.15,
    touchLiftCells: 1.4,
    /** Touch drag speed-up (piece moves this much faster than the finger). See DECISIONS.md. */
    touchGainX: 1.2,
    touchGainUp: 1.6,
    touchGainDown: 1.0,
    mouseLiftCells: 0.25,
    shadowOffset: 8,
    shadowAlpha: 0.35,
    follow: 0.55,
    maxTiltDeg: 6,
    maxStretch: 0.06,
    /** Velocity (CSS px/s) that produces the full tilt/stretch. */
    fullVelocity: 1600,
    tiltStiffness: 260,
    tiltDamping: 18,
    /** Extra snap reach beyond plain rounding, in cells. */
    snapTolerance: 0.45,
    snapMs: 70,
    returnMs: 220,
    ghostAlpha: 0.35,
    previewPulseMs: 600,
    previewPulseScale: 0.05,
  },

  jellyPhys: {
    stiffness: 320,
    damping: 15,
    squashY: 0.82,
    squashX: 1.14,
    neighborAmp: 0.3,
    neighborDelayMs: 35,
    breatheAmp: 0.006,
    breatheMinS: 2.4,
    breatheMaxS: 3.2,
  },

  tray: {
    unfitAlpha: 0.45,
    dealStaggerMs: 60,
    dealPopMs: 320,
  },

  clear: {
    staggerMs: 16,
    growMs: 60,
    growScale: 1.18,
    dropletsMin: 6,
    dropletsMax: 9,
    dropletLifeMs: 450,
    ringLifeMs: 300,
    sweepMs: 260,
    shake: [0, 0, 0, 3, 5, 8] as readonly number[],
    shakeMs: 250,
    popupRise: 40,
    popupMs: 700,
    maxParticles: 500,
  },

  words: {
    inMs: 260,
    holdMs: 620,
    outMs: 240,
  },

  gameOver: {
    textDelayMs: 250,
    desatStaggerMs: 8,
    panelDelayMs: 900,
  },

  bokeh: { count: 10, minAlpha: 0.025, maxAlpha: 0.05, minSpeed: 4, maxSpeed: 9 },
} as const;
