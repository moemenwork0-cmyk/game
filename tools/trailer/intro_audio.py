#!/usr/bin/env python3
"""Sound for the game-opening capture (play_intro): loading music, black and a
heartbeat, waking breath, surf opening up, getting up, footsteps on sand, a quiet
exploration theme.   python3 tools/trailer/intro_audio.py <out.wav>"""
import sys

import numpy as np
import pyloudnorm as pyln
import soundfile as sf

import sampler as S
import sfx as X

LEN = 46.0
LOAD_END, BLACK_END, EYES_END, STAND_END = 8.0, 9.6, 16.5, 20.5
D = 62
M = S.Mix(LEN)
vc = S.Instrument("Strings/Cello Section", r"susvib", 0.5, 0.3, 1.2)
vla = S.Instrument("Strings/Viola Section", r"susvib", 0.45, 0.0, 1.2)
vln = S.Instrument("Strings/Violin Section", r"susVib", 0.35, -0.3, 1.2)


def pad(t, notes, ln, g=0.5):
	for inst, n in zip((vc, vla, vln), notes):
		M.add(t, S.hall(inst.render(n, ln, 0.35), 3.0, 0.45), g)


# loading: a slow D minor pad and an oud line in hijaz
pad(0.3, [D - 12, D - 3, D + 5], 7.5, 0.5)
for t, step, ln in [(1.5, 0, 1.2), (2.4, 1, 0.5), (2.9, 4, 0.5), (3.4, 5, 1.4), (5.0, 4, 0.6), (5.6, 1, 0.6), (6.2, 0, 1.8)]:
	M.add(t, S.hall(S.oud(D + step, ln + 1.0, 0.8, int(t * 10)), 2.5, 0.5), 0.18)
# black: heartbeat and a muffled sea
M.add(LOAD_END - 0.2, S.heartbeat(5, 56), 0.9)
M.add(LOAD_END, S.lowpass(X.surf(EYES_END - LOAD_END + 1.0), 350), 0.9)
# eyes: a sharp breath in, then a cough-like gasp
for t, g in ((BLACK_END + 0.1, 0.5), (BLACK_END + 1.9, 0.35), (BLACK_END + 3.7, 0.6)):
	n = int(0.9 * S.SR)
	tt = np.arange(n) / S.SR
	breath = X.band(S.noise(0.9, int(t * 7)), 500, 3500) * np.sin(np.pi * tt / 0.9) ** 2
	M.add(t, S.stereo(breath, 0.3), g)
# the sea opens up as she wakes, and stays
M.add(BLACK_END + 3.0, X.surf(LEN - BLACK_END), 0.9)
M.add(STAND_END - 2.0, X.wind(LEN - STAND_END + 2.0, 0.35), 0.35)
# getting up: cloth and sand
M.add(EYES_END + 0.4, S.stereo(X.band(S.noise(1.6, 3), 300, 5000) * np.hanning(int(1.6 * S.SR)), 0.5), 0.35)
# footsteps while walking (g 3..21 s at ~0.55 s a step)
t = STAND_END + 3.0
i = 0
while t < STAND_END + 21.0:
	n = int(0.18 * S.SR)
	tt = np.arange(n) / S.SR
	step = S.lowpass(S.noise(0.18, 100 + i), 900) * np.exp(-tt * 25) + X.band(S.noise(0.18, 300 + i), 2000, 7000) * np.exp(-tt * 40) * 0.3
	M.add(t, S.stereo(step, 0.2), 0.45 * (0.85 + 0.3 * (i % 2)))
	t += 0.55 + 0.03 * np.sin(i)
	i += 1
# control: a quiet exploration theme
pad(STAND_END, [D - 12, D - 5, D + 2], 12.0, 0.35)
pad(STAND_END + 12.0, [D - 14, D - 7, D + 3], 13.0, 0.35)
for t, step, ln in [(23.0, 0, 1.4), (24.2, 5, 0.6), (24.9, 4, 0.6), (25.6, 1, 1.6), (31.0, 7, 1.2), (32.0, 5, 0.6), (32.6, 4, 0.6), (33.3, 0, 2.0)]:
	M.add(t, S.hall(S.oud(D + step, ln + 1.0, 0.75, int(t * 10)), 2.5, 0.5), 0.14)
mix = M.buf[: int(LEN * S.SR)]
fade = int(1.5 * S.SR)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
meter = pyln.Meter(S.SR)
mix = pyln.normalize.loudness(mix, meter.integrated_loudness(mix), -16.0)
mix = np.clip(mix, -0.97, 0.97)
sf.write(sys.argv[1], mix, S.SR, subtype="PCM_24")
print("wrote", sys.argv[1])
