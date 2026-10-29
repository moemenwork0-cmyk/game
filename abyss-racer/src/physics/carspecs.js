// Performance data for the three cars. Torque curves in N·m against rpm.
export const CAR_SPECS = {
  marlin: {
    name: 'MARLIN GT-R', tagline: 'All-wheel-drive grand tourer. Balanced, forgiving, brutal out of corners.',
    mass: 1380, cg: 0.40, drive: 'AWD', frontSplit: 0.38,
    torque: [[800, 360], [2000, 470], [3500, 620], [5000, 700], [6500, 690], [7600, 640], [8400, 560]],
    idle: 900, redline: 8200, limiter: 8400,
    gears: [3.25, 2.30, 1.80, 1.48, 1.26, 1.10, 0.98], final: 3.55,
    brake: 3400, brakeBias: 0.62, handbrake: 2600,
    spring: [72000, 76000], damp: [[3600, 5200], [3900, 5600]], arb: [22000, 15000], rest: 0.17, travel: 0.13,
    mu: 1.38, steerMax: 0.58,
    drag: 0.80, downforce: [0.70, 0.95],
    durability: 1.0, color: 0xd8dde3,
    stats: { speed: 0.82, accel: 0.86, grip: 0.84, armor: 0.75 },
  },
  orca: {
    name: 'ORCA V12', tagline: 'Heavy rear-drive brute. Huge top speed, built like a submarine.',
    mass: 1620, cg: 0.43, drive: 'RWD', frontSplit: 0,
    torque: [[800, 450], [2000, 600], [3500, 780], [5000, 850], [6200, 820], [7200, 760], [7800, 670]],
    idle: 850, redline: 7500, limiter: 7700,
    gears: [3.10, 2.15, 1.66, 1.35, 1.14, 0.98, 0.86], final: 3.60,
    brake: 3600, brakeBias: 0.6, handbrake: 2800,
    spring: [80000, 85000], damp: [[4200, 6000], [4500, 6400]], arb: [26000, 16000], rest: 0.18, travel: 0.14,
    mu: 1.36, steerMax: 0.55,
    drag: 0.76, downforce: [0.55, 0.80],
    durability: 1.45, color: 0x0a3d91,
    stats: { speed: 0.92, accel: 0.78, grip: 0.72, armor: 0.98 },
  },
  barracuda: {
    name: 'BARRACUDA LMP', tagline: 'Featherweight prototype. Ferocious grip, paper-thin bodywork.',
    mass: 1120, cg: 0.36, drive: 'RWD', frontSplit: 0,
    torque: [[1000, 300], [2500, 420], [4000, 540], [5500, 600], [7000, 610], [8300, 580], [9200, 500]],
    idle: 1100, redline: 9000, limiter: 9200,
    gears: [3.30, 2.40, 1.88, 1.55, 1.31, 1.14, 1.01], final: 3.42,
    brake: 3300, brakeBias: 0.6, handbrake: 2200,
    spring: [78000, 82000], damp: [[3600, 5000], [3800, 5400]], arb: [20000, 14000], rest: 0.15, travel: 0.11,
    mu: 1.50, steerMax: 0.58,
    drag: 0.72, downforce: [1.05, 1.35],
    durability: 0.72, color: 0xc4161c,
    stats: { speed: 0.88, accel: 0.92, grip: 0.97, armor: 0.48 },
  },
};

export function torqueAt(spec, rpm) {
  const c = spec.torque;
  if (rpm <= c[0][0]) return c[0][1] * Math.max(0, rpm / c[0][0]);
  for (let i = 1; i < c.length; i++) {
    if (rpm <= c[i][0]) {
      const t = (rpm - c[i - 1][0]) / (c[i][0] - c[i - 1][0]);
      return c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t;
    }
  }
  return c[c.length - 1][1];
}
