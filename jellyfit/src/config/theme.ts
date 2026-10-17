/** Visual and feel tunables (spec 5, 9). */
export const THEME = {
  /**
   * Calm palette (player feedback, see DECISIONS.md): a deep indigo night that is easy on the eyes
   * and lets the jelly colours carry the screen.
   */
  palette: {
    // Midnight candy: deep indigo night, glass board, bright jelly.
    bgTop: '#2A1E78',
    bgMid: '#1B1554',
    bgBottom: '#120D3B',
    boardFill: '#100C34',
    boardBorder: '#241050',
    frameTop: '#3A3196',
    frameBottom: '#231C68',
    socket: '#1D1854',
    socketShadow: '#0B0828',
    socketHighlight: '#2A2470',
    gold: '#FFC93C',
    goldText: '#4A2A00',
    ink: '#241050',
    panel: 'rgba(34,28,100,0.96)',
    panelBorder: '#4A40A8',
    text: '#FFFFFF',
    textSecondary: '#CDC8FF',
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
    /**
     * Short landscape screens (CrazyGames' embedded iframe, phones held sideways): when the stacked
     * layout's board would be smaller than this, use the wide layout instead — score column | board |
     * tray column — which roughly doubles the board on a 900×500 iframe.
     */
    wideBelowBoard: 400,
    wideHeadroom: 0.15,
    wideTrayOfBoard: 0.4,
    wideScoreOfBoard: 0.36,
    wideGap: 16,
    boardMax: 620,
    trayOfBoard: 0.42,
    topBarPortrait: 132,
    topBarLandscape: 124,
    gapBoardTray: 14,
    bottomPad: 14,
    trayScale: 0.6,
    trayScaleDesktop: 0.65,
    /** Board frame padding as a fraction of board size. */
    framePad: 0.042,
    frameRadius: 18,
    maxDpr: 3,
  },

  drag: {
    /** Pickup: the piece grows from tray size and jumps above the finger in this time, then it is locked. */
    pickupMs: 80,
    pickupOvershoot: 1.08,
    /**
     * The piece is locked to the pointer (no smoothing, no lag): a fixed lift above the finger and one
     * constant, symmetric speed-up along the tray→board axis, so the finger–piece gap is predictable
     * and the top rows are reached with a short thumb move. Sideways is 1:1 for precise aiming.
     * See DECISIONS.md.
     */
    touchLiftCells: 1.5,
    mouseLiftCells: 0.4,
    gainToBoard: 1.35,
    /** Mouse/trackpad: the cursor is precise and hides nothing, so it gets a stronger boost. */
    mouseGainToBoard: 1.6,
    gainSide: 1.0,
    /** Keep the current target while the piece stays within this many cells of it (no flicker, no lift jitter). */
    stickyCells: 0.75,
    shadowOffset: 8,
    shadowAlpha: 0.35,
    maxTiltDeg: 6,
    maxStretch: 0.06,
    /** Velocity (CSS px/s) that produces the full tilt/stretch. */
    fullVelocity: 1600,
    tiltStiffness: 260,
    tiltDamping: 18,
    /** Extra snap reach beyond plain rounding, in cells. */
    snapTolerance: 0.45,
    snapMs: 55,
    returnMs: 170,
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
    dealStaggerMs: 35,
    dealPopMs: 210,
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

  bokeh: { count: 9, minAlpha: 0.03, maxAlpha: 0.07, minSpeed: 4, maxSpeed: 9 },
} as const;
