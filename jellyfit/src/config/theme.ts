/** Visual and feel tunables (spec 5, 9). */
export const THEME = {
  palette: {
    bgTop: '#2B1660',
    bgMid: '#5B2A86',
    bgBottom: '#B4457F',
    boardFill: '#1C0F3D',
    boardBorder: '#3A2470',
    socket: '#2A1856',
    socketShadow: '#1A0D38',
    socketHighlight: '#3B2575',
    gold: '#FFC93C',
    goldText: '#4A2A00',
    panel: 'rgba(36,18,79,0.92)',
    panelBorder: '#4B2E8F',
    text: '#FFFFFF',
    textSecondary: '#C9B8F2',
    coin: '#FFD54A',
  },

  /** Classic Jelly: Strawberry, Tangerine, Lemon, Lime, Ocean, Grape, Aqua. */
  jelly: ['#FF3D6E', '#FF8C2B', '#FFD23F', '#45D65C', '#2E8CFF', '#A35CFF', '#14D2C8'],

  layout: {
    columnMax: 520,
    sidePad: 16,
    /** Aspect (w/h) above which the desktop/landscape layout is used. */
    landscapeAspect: 1.1,
    landscapeBoardOfHeight: 0.62,
    boardMax: 620,
    trayOfBoard: 0.42,
    topBarPortrait: 118,
    topBarLandscape: 104,
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
    ringLifeMs: 380,
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

  bokeh: { count: 12, minAlpha: 0.04, maxAlpha: 0.08, minSpeed: 4, maxSpeed: 10 },
} as const;
