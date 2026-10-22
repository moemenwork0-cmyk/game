#!/usr/bin/env python3
"""«الطوفان» — the trailer score. 100 BPM, D hijaz (D Eb F# G A Bb C).

    python3 tools/trailer/score.py <out.wav> [beats.json]

Sections (seconds; one bar = 2.4 s):
  0.0  hook      underwater drone, heartbeat, solo oud in hijaz
  7.2  flood     three braams, string tremolo, riser
 14.4  storm     spiccato ostinato, war drums, brass stabs, snare roll
 26.4  crash     impact, gong, then silence
 28.8  wake      high strings, piano, oud echo, reverse swell into dead silence
 36.0  DROP      the big hit; driving montage, horn melody, a hit on every bar
 55.2  hero      half-time, the whole orchestra on sustained chords
 64.8  title     the slam
 69.0  stinger   near silence, one last low hit at 72.0
"""
import json
import sys

import numpy as np
import pyloudnorm as pyln
import soundfile as sf

import sampler as S

BPM = 100
BEAT = 60 / BPM
BAR = BEAT * 4
LEN = 76.0
D = 62  # D4

vln_spic = S.Instrument("Strings/Violin Section", r"Spic", 0.55, -0.35, 0.08)
vla_spic = S.Instrument("Strings/Viola Section", r"spic", 0.5, 0.2, 0.08)
vc_spic = S.Instrument("Strings/Cello Section", r"spic", 0.6, 0.35, 0.1)
vln_sus = S.Instrument("Strings/Violin Section", r"susVib", 0.5, -0.4, 0.8)
vla_sus = S.Instrument("Strings/Viola Section", r"susvib", 0.5, 0.1, 0.8)
vc_sus = S.Instrument("Strings/Cello Section", r"susvib", 0.6, 0.3, 0.8)
vc_trem = S.Instrument("Strings/Cello Section", r"trem", 0.55, 0.3, 0.5)
vln_trem = S.Instrument("Strings/Violin Section", r"Trem", 0.45, -0.3, 0.5)
cb_sus = S.Instrument("Strings/Solo Contrabass", r"SusNV|SusVib", 0.8, 0.0, 0.8)
cb_spic = S.Instrument("Strings/Solo Contrabass", r"Spic", 0.8, 0.0, 0.1)
hn_sus = S.Instrument("Brass/F Horn", r"_sus", 0.65, -0.15, 0.6)
hn_stac = S.Instrument("Brass/F Horn", r"_stac", 0.7, -0.15, 0.2)
tbn_sus = S.Instrument("Brass/Tenor Trombone", r"_sus", 0.6, 0.2, 0.6)
tbn_stac = S.Instrument("Brass/Tenor Trombone", r"_stac", 0.7, 0.2, 0.2)
tuba = S.Instrument("Brass/Tuba", r"_sus|_stac", 0.8, 0.0, 0.5)
tpt_sus = S.Instrument("Brass/Trumpet", r"_sus_|_susvib", 0.5, -0.05, 0.6)
def _piano_note(b):
	m = __import__("re").search(r"_(\d{3})\.wav$", b)
	return 21 + 2 * int(m.group(1)) if m else None


piano = S.Instrument("Keys/Upright Piano", r"Player_dyn", 0.5, 0.0, 1.5, _piano_note)

PERC = S.VSCO + "/"
def perc(name: str) -> np.ndarray:
	return S.load(PERC + name)


bd = [perc(f"VSCO 1 Percussion/drums/bass/bdrum_fff_{i}.wav") for i in (1, 2)]
bd2 = [perc(f"VSCO 1 Percussion/drums/bdrum2_ff_{i}.wav") for i in (1, 2)] if False else bd
toms = sorted(__import__("glob").glob(PERC + "VSCO 1 Percussion/drums/tenor/*/tenor_ff*.wav"))
snares = sorted(__import__("glob").glob(PERC + "VSCO 1 Percussion/drums/snare/drum1/snare1_f*.wav"))
timp = sorted(__import__("glob").glob(PERC + "Percussion/Timpani/*Hit_v4*.wav")) or sorted(__import__("glob").glob(PERC + "Percussion/Timpani/*.wav"))
gong = perc("Percussion/gongHit_fff.wav")
crash = perc("Percussion/cymbal-crash1_ff_rr1.wav")
swell = perc("Percussion/susCymb1-cresc-Long_v1.wav") if __import__("os").path.exists(PERC + "Percussion/susCymb1-cresc-Long_v1.wav") else None
snare_roll = sorted(__import__("glob").glob(PERC + "Percussion/Snare2-rollNS*.wav"))
anvil = sorted(__import__("glob").glob(PERC + "Percussion/Anvil_Hit1*.wav"))

M = S.Mix(LEN)          # orchestra (gets the hall)
P = S.Mix(LEN)          # percussion and hybrid layers (drier)
beats: dict = {"bpm": BPM, "sections": {}, "hits": [], "montage_beats": []}


def sec(name, t):
	beats["sections"][name] = round(t, 3)


def chord(inst, t, notes, length, vel=0.8, gain=1.0):
	for n in notes:
		M.add(t, inst.render(n, length, vel), gain)


def hit(t, big=1.0, with_gong=False, with_braam=None):
	P.add(t, S.impact(big, int(t * 10)), 0.9 * big)
	P.add(t, bd[0], 1.2 * big)
	if timp:
		P.add(t, S.load(timp[0]), 1.0)
	if with_gong:
		P.add(t, gong, 0.9)
		P.add(t, crash, 0.5)
	if with_braam is not None:
		P.add(t, S.braam(with_braam, 4.0), 0.55)
	beats["hits"].append(round(t, 3))


# ------------------------------------------------------------------ 0.0 hook
sec("hook", 0.0)
M.add(0.0, cb_sus.render(D - 24, 7.0, 0.3), 0.35)
M.add(0.3, vc_sus.render(D - 12, 6.6, 0.25), 0.25)
P.add(0.6, S.heartbeat(6, 60), 0.9)
P.add(0.0, S.lowpass(S.stereo(S.noise(7.2, 9)), 300) * 0.05)   # underwater rumble
phrase = [(1.2, 0, 0.9), (2.1, 1, 0.45), (2.55, 4, 0.45), (3.0, 5, 1.2), (4.3, 4, 0.5), (4.8, 1, 0.5), (5.3, 0, 1.6)]
for t, step, ln in phrase:
	P.add(t, S.hall(S.oud(D + step, ln + 1.2, 0.9, int(t * 10)), 2.5, 0.5), 0.22)
P.add(6.6, S.sub_drop(1.5, 70, 30), 0.8)

# ------------------------------------------------------------------ 7.2 flood
sec("flood", 7.2)
for i, (t, n) in enumerate(((7.2, 26), (9.6, 26), (12.0, 27))):
	P.add(t, S.braam(n, 3.2, 0.8 + 0.2 * i), 0.8 + 0.15 * i)
	P.add(t, S.sub_drop(2.2, 80, 30), 0.6)
	beats["hits"].append(t)
	chord(vc_trem, t, [D - 12, D - 5], BAR, 0.5 + 0.15 * i, 0.6)
	chord(vln_trem, t + 1.2, [D, D + 7], BAR - 1.2, 0.4 + 0.15 * i, 0.4)
P.add(10.4, S.riser(4.0, 5), 0.5)
if swell is not None:
	P.add(14.4 - len(swell) / S.SR, swell, 0.6)

# ------------------------------------------------------------------ 14.4 storm
sec("storm", 14.4)
hit(14.4, 1.0, True, 26)
ost = [0, 0, 7, 0, 1, 0, 7, 0, 0, 0, 7, 0, 1, 3, 1, 0]          # D D A D Eb D A D ...
roots = [D, D, D + 1, D + 1, D]                                     # bar roots (D, D, Eb, Eb, D)
for b in range(5):
	t0 = 14.4 + b * BAR
	r = roots[b] - D
	for s in range(16):
		t = t0 + s * BEAT / 4
		n = D + ost[s] + r
		v = 0.55 + 0.35 * (s % 4 == 0) + 0.05 * b
		M.add(t, vln_spic.render(n + 12 if b >= 3 else n, 0.12, v), 0.6)
		if s % 2 == 0:
			M.add(t, vla_spic.render(n - 5 if ost[s] else n, 0.15, v), 0.45)
			M.add(t, vc_spic.render(D - 12 + r + (7 if s % 8 == 4 else 0), 0.2, v), 0.6)
			M.add(t, cb_spic.render(D - 24 + r, 0.2, v), 0.6)
	# war drums: kick on 1 and 3, toms galloping, building
	for s in range(16):
		t = t0 + s * BEAT / 4
		if s in (0, 8) or (b >= 3 and s in (4, 12)):
			P.add(t, bd[s % 2], 1.0)
		if toms and (s in (3, 6, 10, 11, 14) or (b >= 2 and s % 2 == 1)):
			P.add(t, S.load(toms[(s + b) % len(toms)]), 0.45 + 0.08 * b)
	# brass stabs on the downbeat and the "and of 3"
	stab = [D - 12 + r, D - 5 + r, D + 6 + r if r == 0 else D + 7 + r]
	for tt in (t0, t0 + BEAT * 2.5):
		chord(tbn_stac, tt, stab[:2], 0.4, 0.9, 0.7)
		chord(hn_stac, tt, [D + r, D + 6 + r if r == 0 else D + 7 + r], 0.4, 0.9, 0.6)
		M.add(tt, tuba.render(D - 24 + r, 0.5, 0.9), 0.7)
	if timp:
		P.add(t0, S.load(timp[b % len(timp)]), 0.8)
if snare_roll:
	P.add(26.4 - 2.4, S.load(snare_roll[0])[: int(2.4 * S.SR)], 0.6)
P.add(24.0, S.riser(2.4, 7), 0.6)

# ------------------------------------------------------------------ 26.4 crash
sec("crash", 26.4)
hit(26.4, 1.3, True, 26)
P.add(26.4, S.sub_drop(3.0, 100, 24), 0.9)

# ------------------------------------------------------------------ 28.8 wake
sec("wake", 28.8)
chord(vln_sus, 29.2, [D + 19, D + 24], 6.0, 0.3, 0.45)
chord(vla_sus, 29.6, [D + 12], 5.6, 0.3, 0.4)
for t, n in ((30.0, D + 12), (31.2, D + 7), (32.4, D + 16), (33.6, D + 12)):
	M.add(t, piano.render(n, 2.0, 0.45), 0.5)
P.add(32.0, S.hall(S.oud(D + 7, 2.0, 0.6, 3), 3.0, 0.6), 0.35)
if swell is not None:
	P.add(35.7 - len(swell) / S.SR, swell[::-1].copy() if False else swell, 0.8)
P.add(34.8, S.whoosh(0.9, 11), 0.7)
# dead silence 35.7 -> 36.0 is the drop

# ------------------------------------------------------------------ 36.0 DROP / montage
sec("drop", 36.0)
hit(36.0, 1.5, True, 26)
P.add(36.0, S.sub_drop(3.5, 120, 22), 1.0)
melody = [(0, 0, 1.0), (1.5, 1, 0.5), (2.0, 4, 0.5), (2.5, 5, 1.5), (4.0, 7, 1.0), (5.0, 5, 0.5), (5.5, 4, 0.5),
	(6.0, 5, 1.0), (7.0, 4, 0.5), (7.5, 1, 0.5)]  # in beats over two bars
for b in range(8):
	t0 = 36.0 + b * BAR
	r = [0, 0, 1, 0, 0, 0, 1, 0][b]
	beats["montage_beats"] += [round(t0 + k * BEAT, 3) for k in range(4)]
	for s in range(16):
		t = t0 + s * BEAT / 4
		n = D + ost[s] + r
		v = 0.65 + 0.3 * (s % 4 == 0)
		M.add(t, vln_spic.render(n + 12, 0.12, v), 0.65)
		M.add(t, vla_spic.render(n, 0.12, v), 0.5)
		if s % 2 == 0:
			M.add(t, vc_spic.render(D - 12 + r, 0.2, v), 0.7)
			M.add(t, cb_spic.render(D - 24 + r, 0.2, v), 0.7)
	for k in range(4):
		P.add(t0 + k * BEAT, bd[k % 2], 1.1)
		if toms:
			P.add(t0 + k * BEAT + BEAT / 2, S.load(toms[(k + b) % len(toms)]), 0.6)
		if snares and k in (1, 3):
			P.add(t0 + k * BEAT, S.load(snares[k % len(snares)]), 0.45)
	if b % 2 == 0:
		base = t0
		for bt, step, ln in melody:
			n = D + step
			tt = base + bt * BEAT
			M.add(tt, hn_sus.render(n, ln * BEAT, 0.9), 0.8)
			M.add(tt, tbn_sus.render(n - 12, ln * BEAT, 0.85), 0.6)
			if b >= 4:
				M.add(tt, tpt_sus.render(n + 12, ln * BEAT, 0.9), 0.5)
	if b in (2, 4, 6):
		hit(t0, 0.8, b == 4)
	M.add(t0, tuba.render(D - 24 + r, BAR * 0.9, 0.9), 0.6)
if snare_roll:
	P.add(52.8, S.load(snare_roll[0])[: int(2.4 * S.SR)], 0.8)
P.add(51.6, S.riser(3.6, 13), 0.7)

# ------------------------------------------------------------------ 55.2 hero
sec("hero", 55.2)
hit(55.2, 1.4, True, 26)
prog = [[D - 12, D - 5, D + 6 - 12, D], [D - 11, D - 4, D + 7 - 12, D + 1 - 12 + 12], [D - 14, D - 9, D - 2, D + 3 - 12],
	[D - 12, D - 5, D + 6 - 12, D]]  # D  Eb  Cm  D (hijaz cadence)
lead = [D + 9, D + 8, D + 5, D + 9]
for b in range(4):
	t0 = 55.2 + b * BAR
	ch = prog[b]
	chord(tbn_sus, t0, [n - 12 for n in ch[:2]], BAR, 1.0, 0.7)
	chord(hn_sus, t0, ch[1:], BAR, 1.0, 0.8)
	chord(vc_sus, t0, ch[:2], BAR, 0.95, 0.7)
	chord(vla_sus, t0, ch[2:], BAR, 0.95, 0.6)
	chord(vln_sus, t0, [lead[b], lead[b] + 12], BAR, 1.0, 0.7)
	M.add(t0, tpt_sus.render(lead[b], BAR, 1.0), 0.6)
	M.add(t0, cb_sus.render(ch[0] - 12, BAR, 1.0), 0.8)
	M.add(t0, tuba.render(ch[0] - 12, BAR, 1.0), 0.7)
	for k in (0, 2):
		P.add(t0 + k * BEAT, bd[k // 2], 1.2)
		if timp:
			P.add(t0 + k * BEAT, S.load(timp[(b + k) % len(timp)]), 1.0)
	if b == 3:
		P.add(t0, S.riser(BAR, 17), 0.8)
		if snare_roll:
			P.add(t0, S.load(snare_roll[0])[: int(BAR * S.SR)], 0.9)

# ------------------------------------------------------------------ 64.8 title
sec("title", 64.8)
hit(64.8, 1.8, True, 26)
P.add(64.8, S.sub_drop(4.0, 130, 20), 1.1)
chord(tbn_sus, 64.8, [D - 24, D - 12], 3.5, 1.0, 0.7)
chord(hn_sus, 64.8, [D - 12, D - 5, D], 3.5, 1.0, 0.8)
if anvil:
	P.add(64.8, S.load(anvil[-1]), 0.5)

# ------------------------------------------------------------------ 69.0 stinger
sec("stinger", 69.0)
P.add(69.0, S.lowpass(S.stereo(S.noise(5.0, 21)), 400) * 0.04)
hit(72.0, 1.0, False, 26)
sec("end", 75.0)

# ------------------------------------------------------------------ mix
orch = S.hall(M.buf, 3.4, 0.38)
perc_bus = S.hall(P.buf, 2.0, 0.16)
mix = orch * 0.9 + perc_bus
mix = mix[: int(LEN * S.SR)]
# glue: gentle bus compression via soft clip, then loudness to -14 LUFS, peak -1 dBFS
mix = np.tanh(mix * 0.9) / 0.9
meter = pyln.Meter(S.SR)
loud = meter.integrated_loudness(mix)
mix = pyln.normalize.loudness(mix, loud, -14.0)
peak = np.abs(mix).max()
if peak > 0.89:
	mix *= 0.89 / peak
out = sys.argv[1] if len(sys.argv) > 1 else "score.wav"
sf.write(out, mix.astype(np.float32), S.SR, subtype="PCM_24")
if len(sys.argv) > 2:
	json.dump(beats, open(sys.argv[2], "w"), indent=1)
print("wrote", out, f"{len(mix) / S.SR:.1f}s", f"from {loud:.1f} LUFS")
