// Offline render of the engine worklet: rpm sweeps for each preset -> WAV + level / pitch report.
import fs from 'fs';
globalThis.sampleRate = 48000;
let Proc = null;
globalThis.AudioWorkletProcessor = class { constructor() { this.port = { onmessage: null, postMessage() {} }; } };
globalThis.registerProcessor = (n, c) => { Proc = c; };
await import('../src/audio/engine-worklet.js');
const out = process.argv[2] || '.';
function wav(name, data) {
  const b = Buffer.alloc(44 + data.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + data.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(48000, 24); b.writeUInt32LE(96000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(data[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(`${out}/${name}.wav`, b);
}
for (const preset of ['v8cross', 'v12', 'v10']) {
  const p = new Proc({ processorOptions: { preset } });
  const send = (m) => p.port.onmessage({ data: m });
  const N = 48000 * 8, data = new Float32Array(N);
  const block = [[new Float32Array(128)]];
  let nan = 0;
  for (let i = 0; i < N; i += 128) {
    const t = i / 48000;
    // idle 1.5 s, rev up under load to redline, lift (pops), cruise
    let rpm = 900, load = 0.05;
    if (t > 1.5 && t < 5) { rpm = 900 + (t - 1.5) / 3.5 * 7600; load = 1; }
    else if (t >= 5 && t < 6) { rpm = 8500 - (t - 5) * 3000; load = 0.0; }
    else if (t >= 6) { rpm = 4500; load = 0.5; }
    send({ rpm, load, gain: 0.6, turbo: load });
    p.process([], block);
    for (let j = 0; j < 128; j++) { const v = block[0][0][j]; if (!Number.isFinite(v)) nan++; data[i + j] = v; }
  }
  wav('engine_' + preset, data);
  const seg = (a, b) => { let s = 0, pk = 0; for (let i = a * 48000; i < b * 48000; i++) { s += data[i] * data[i]; pk = Math.max(pk, Math.abs(data[i])); } return [Math.sqrt(s / ((b - a) * 48000)).toFixed(3), pk.toFixed(2)]; };
  console.log(preset, 'NaN', nan, 'idle rms/peak', seg(0.5, 1.5), 'full rms/peak', seg(4, 5), 'liftoff', seg(5, 6), 'cruise', seg(6, 8));
}
