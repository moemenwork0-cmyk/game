"""Synthesised sound effects for the trailer (all procedural, 48 kHz stereo)."""
import numpy as np
from scipy import signal

import sampler as S

SR = S.SR


def _env(n, a=0.01, r=0.3):
	t = np.arange(n) / SR
	e = np.minimum(1, t / max(a, 1e-4))
	tail = int(r * SR)
	if tail and n > tail:
		e[-tail:] *= np.linspace(1, 0, tail) ** 2
	return e


def band(x, lo, hi, order=2):
	b, a = signal.butter(order, [lo / (SR / 2), min(0.99, hi / (SR / 2))], "band")
	return signal.lfilter(b, a, x, axis=0).astype(np.float32)


def lfo(n, hz, depth, seed=0):
	"""Slow random gusting envelope."""
	rng = np.random.default_rng(seed)
	k = max(4, int(n / SR * hz) + 4)
	pts = rng.uniform(1 - depth, 1, k)
	return np.interp(np.arange(n), np.linspace(0, n, k), pts).astype(np.float32)


def rain(sec, heavy=1.0, seed=11):
	n = int(sec * SR)
	x = np.stack([S.noise(sec, seed), S.noise(sec, seed + 1)], 1)
	x = band(x, 900, 9000) * 0.35 + S.highpass(x, 5000) * 0.25
	drops = np.zeros((n, 2), np.float32)
	rng = np.random.default_rng(seed)
	for i in rng.integers(0, n - 400, int(sec * 260 * heavy)):
		drops[i:i + 200] += (rng.standard_normal((200, 2)) * np.exp(-np.arange(200) / 30)[:, None]) * 0.25
	return (x + S.highpass(drops, 1500)) * heavy * _env(n, 0.3, 0.3)[:, None]


def wind(sec, strength=1.0, seed=21):
	n = int(sec * SR)
	x = np.stack([S.noise(sec, seed), S.noise(sec, seed + 7)], 1)
	g = lfo(n, 0.8, 0.7, seed)
	lo = band(x, 120, 700) * 1.2
	howl = band(x, 500 + 300 * strength, 900 + 500 * strength, 4) * 0.8
	return (lo + howl) * (g ** 2)[:, None] * strength * _env(n, 0.5, 0.5)[:, None]


def thunder(dist=1.0, seed=31):
	sec = 5.0
	n = int(sec * SR)
	t = np.arange(n) / SR
	crack = S.highpass(S.noise(sec, seed), 800) * np.exp(-t * (18 if dist < 0.5 else 8)) * (1.2 - dist)
	roll = S.lowpass(S.noise(sec, seed + 1), 160, 2) * (np.exp(-t * 0.9) * (0.6 + 0.4 * np.sin(t * 7 + seed) ** 2)) * 3.0
	x = (np.maximum(crack, -2) + roll) * np.minimum(1, t / (0.01 + dist * 0.2))
	return S.stereo(np.tanh(x * 0.9), 1.0)


def wave_crash(sec=3.0, size=1.0, seed=41):
	n = int(sec * SR)
	t = np.arange(n) / SR
	x = S.noise(sec, seed)
	body = S.lowpass(x, 900) * 1.6 + band(x, 1500, 7000) * 0.7
	env = np.minimum(1, t / 0.05) * np.exp(-t / (sec * 0.35))
	return S.stereo(body * env * size, 0.9)


def roar(sec, seed=51):
	"""The tsunami: a vast rising roar with sub weight."""
	n = int(sec * SR)
	t = np.arange(n) / SR
	x = S.noise(sec, seed)
	r = S.lowpass(x, 400) * 2.4 + band(x, 400, 2500) * 0.6
	sub = np.sin(2 * np.pi * np.cumsum(28 + 6 * t / sec) / SR) * 0.6
	env = (t / sec) ** 1.6
	return S.stereo(np.tanh((r + sub) * env * 1.4), 1.0)


def siren(sec, seed=61):
	t = np.arange(int(sec * SR)) / SR
	f = 700 + 350 * (0.5 + 0.5 * np.sin(2 * np.pi * t / 2.6))
	x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(4 * np.pi * np.cumsum(f) / SR)
	x = S.lowpass(x, 2200) * 0.25 * _env(len(t), 0.5, 0.5)
	return S.hall(S.stereo(x, 1.0), 2.5, 0.6, 0.08)


def fire(sec, seed=71):
	n = int(sec * SR)
	rng = np.random.default_rng(seed)
	x = S.lowpass(S.noise(sec, seed), 500) * 0.5 * lfo(n, 3, 0.5, seed)
	pops = np.zeros(n, np.float32)
	for i in rng.integers(0, n - 600, int(sec * 18)):
		ln = rng.integers(80, 500)
		pops[i:i + ln] += rng.standard_normal(ln) * np.exp(-np.arange(ln) / (ln / 5)) * rng.uniform(0.2, 1.0)
	return S.stereo(x + S.highpass(pops, 1200) * 0.8, 0.5) * _env(n, 0.1, 0.2)[:, None]


def ignite():
	sec = 1.5
	t = np.arange(int(sec * SR)) / SR
	x = band(S.noise(sec, 5), 200, 4000) * np.minimum(1, t / 0.3) * np.exp(-t * 1.5) * 1.8
	return S.stereo(x, 0.6)


def bubbles(sec, rate=12, seed=81):
	n = int(sec * SR)
	rng = np.random.default_rng(seed)
	out = np.zeros(n, np.float32)
	for i in rng.integers(0, n - 4000, int(sec * rate)):
		ln = rng.integers(800, 3000)
		f0 = rng.uniform(300, 1400)
		tt = np.arange(ln) / SR
		out[i:i + ln] += np.sin(2 * np.pi * f0 * tt * (1 + tt * 8)) * np.exp(-tt * 40) * rng.uniform(0.1, 0.5)
	return S.stereo(out, 0.7)


def underwater(sec, seed=91):
	n = int(sec * SR)
	x = S.lowpass(S.noise(sec, seed), 220, 4) * 2.0 * lfo(n, 0.3, 0.4, seed)
	return S.stereo(x, 1.0) * _env(n, 0.5, 0.5)[:, None]


def surf(sec, seed=101):
	"""Small waves washing up the sand, every few seconds."""
	n = int(sec * SR)
	t = np.arange(n) / SR
	x = S.noise(sec, seed)
	w = 0.25 + 0.75 * np.clip(np.sin(2 * np.pi * t / 4.5 + seed), 0, 1) ** 3
	return S.stereo(band(x, 200, 6000) * w * 0.6, 1.0) * _env(n, 0.5, 0.5)[:, None]


def creak_fall():
	sec = 3.5
	t = np.arange(int(sec * SR)) / SR
	f = 90 + 40 * np.sin(t * 13) + 20 * np.random.default_rng(3).standard_normal(len(t)).cumsum() / SR
	creak = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR) * np.exp(-((t - 0.6) / 0.5) ** 2) * 0.3
	crash = np.zeros_like(t)
	i = int(1.15 * SR)
	crash[i:] = (S.noise(sec, 4)[: len(t) - i] * np.exp(-t[: len(t) - i] * 3.0)) * 1.2
	crash = S.lowpass(crash, 2500)
	return S.stereo(creak + crash, 0.8)


def wood_crash(seed=111):
	sec = 3.0
	t = np.arange(int(sec * SR)) / SR
	splinter = band(S.noise(sec, seed), 600, 6000) * np.exp(-t * 4) * 1.4
	boom = S.sub_drop(sec, 70, 30)[:, 0] * 1.2
	return S.stereo(np.tanh(splinter + boom), 0.8)


def ring(sec=4.0):
	"""Tinnitus after the impact."""
	t = np.arange(int(sec * SR)) / SR
	x = np.sin(2 * np.pi * 3800 * t) * 0.05 * np.minimum(1, t / 0.1) * np.exp(-t / 2.0)
	return S.stereo(x)


def hammer(sec, seed=121):
	n = int(sec * SR)
	out = np.zeros(n, np.float32)
	rng = np.random.default_rng(seed)
	t = 0.1
	while t < sec - 0.3:
		i = int(t * SR)
		ln = int(0.18 * SR)
		tt = np.arange(ln) / SR
		k = np.sin(2 * np.pi * rng.uniform(380, 700) * tt) * np.exp(-tt * 40) + rng.standard_normal(ln) * np.exp(-tt * 90) * 0.5
		out[i:i + ln] += k * rng.uniform(0.3, 0.8)
		t += rng.uniform(0.09, 0.3)
	return S.hall(S.stereo(out, 0.5), 1.0, 0.25)
