// "Abyssal Circuit": a 3.6 km loop from a sunken city through a shallow reef, a kelp forest, a jump over
// a canyon, past a galleon wreck and down into a hydrothermal trench before climbing back to the light.
// Control points: [x, z, y]. Surface of the sea is y = 0.
export const TRACK_POINTS = [
  [0, 0, -30],          // 0 sunken city avenue
  [120, 0, -30],
  [240, 4, -29],
  [330, 22, -27],       // braking zone
  [395, 85, -25],       // T1 long right, reef
  [418, 175, -22],
  [392, 252, -21],      // T2 tightening left
  [318, 282, -23],
  [248, 300, -26],      // esses into the kelp
  [214, 360, -29],
  [236, 430, -32],
  [190, 500, -34],
  [90, 528, -36],       // kelp exit, run to the jump
  [-20, 520, -36],
  [-100, 498, -34],     // kicker
  [-160, 476, -40],     // landing beyond the canyon
  [-232, 430, -45],     // wreck
  [-290, 352, -50],
  [-300, 262, -56],
  [-262, 190, -63],     // drop into the trench
  [-300, 118, -73],
  [-372, 50, -82],
  [-398, -40, -88],     // abyss hairpin
  [-350, -118, -88],
  [-262, -150, -80],    // climb
  [-170, -136, -67],
  [-100, -88, -52],
  [-62, -36, -40],
  [-40, -8, -33],
];

// Zones by fraction of total track length (filled after the spline is measured, see Track).
// Each zone: id, from/to as control-point indices (inclusive start).
export const ZONES = [
  { id: 'city', from: 26.5, to: 3.4 },
  { id: 'reef', from: 3.4, to: 8.2 },
  { id: 'kelp', from: 8.2, to: 13.2 },
  { id: 'canyon', from: 13.2, to: 15.6 },
  { id: 'wreck', from: 15.6, to: 18.6 },
  { id: 'trench', from: 18.6, to: 24.3 },
  { id: 'climb', from: 24.3, to: 26.5 },
];

export const TRACK = {
  halfWidth: 9.0,       // asphalt half width (m)
  shoulder: 3.2,        // gravel run-off before the barrier
  jump: { at: 14.15, gap: 30 },   // control-point index of the kicker lip, gap length (m)
  laps: 3,
  startOffset: 95,      // start/finish line this far after control point 0 (grid sits on the straight)
};
