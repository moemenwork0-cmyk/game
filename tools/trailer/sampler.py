"""A small orchestral sampler over VS Chamber Orchestra 2 CE (CC0) plus synthesized
trailer layers (braams, sub drops, risers, whooshes, impacts, oud).

Everything renders into stereo float buffers at 48 kHz; tools/trailer/score.py writes
the music for the «الطوفان» trailer with it.
"""
import functools
import glob
import os
import re

import numpy as np
import soundfile as sf
from scipy import signal

SR = 48000
VSCO = os.environ.get("VSCO", "/home/user/ext/vsco")
NOTE_RE = re.compile(r"(?<![A-Za-z])([A-G]#?)(-?\d)(?![A-Za-z#])")
NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def midi(name: str) -> int:
	m = re.match(r"([A-G]#?|[A-G]b)(-?\d)", name)
	n, o = m.group(1), int(m.group(2))
	if n.endswith("b"):
		n = NAMES[(NAMES.index(n[0]) - 1) % 12]
	return NAMES.index(n) + 12 * (o + 1)


@functools.lru_cache(maxsize=None)
def load(path: str) -> np.ndarray:
	d, sr = sf.read(path, always_2d=True, dtype="float32")
	if d.shape[1] == 1:
		d = np.repeat(d, 2, axis=1)
	d = d[:, :2]
	if sr != SR:
		d = signal.resample_poly(d, SR, sr, axis=0).astype(np.float32)
	return d


class Instrument:
	"""Samples of one articulation: note -> velocity layers -> round robins."""

	def __init__(self, folder: str, pattern: str, gain: float = 1.0, pan: float = 0.0, release: float = 0.35, note_of=None):
		self.gain = gain
		self.pan = pan
		self.release = release
		self.notes: dict[int, dict[int, list[str]]] = {}
		files = [f for f in glob.glob(os.path.join(VSCO, folder, "**", "*.wav"), recursive=True)
			if re.search(pattern, os.path.basename(f))]
		for f in files:
			b = os.path.basename(f)
			if note_of:
				n = note_of(b)
				if n is None:
					continue
			else:
				m = NOTE_RE.search(b.replace("_", " ").replace("-", " "))
				if not m:
					continue
				n = midi(m.group(1) + m.group(2))
			v = re.search(r"_v(\d)|dyn(\d)", b)
			v = (v.group(1) or v.group(2)) if v else None
			v = int(v) if v else 1
			self.notes.setdefault(n, {}).setdefault(v, []).append(f)
		if not self.notes:
			raise RuntimeError(f"no samples for {folder} / {pattern}")
		self._rr = 0

	def render(self, note: int, length: float, vel: float = 0.8) -> np.ndarray:
		near = min(self.notes, key=lambda k: abs(k - note))
		layers = self.notes[near]
		lv = sorted(layers)
		v = lv[min(len(lv) - 1, int(vel * len(lv)))]
		rr = layers[v]
		self._rr += 1
		d = load(rr[self._rr % len(rr)])
		shift = note - near
		if shift:
			ratio = 2 ** (shift / 12.0)
			n_out = int(len(d) / ratio)
			x = np.linspace(0, len(d) - 1, n_out)
			d = np.stack([np.interp(x, np.arange(len(d)), d[:, c]) for c in range(2)], 1).astype(np.float32)
		n = min(len(d), int((length + self.release) * SR))
		d = d[:n].copy()
		rel = int(self.release * SR)
		if n > rel and length * SR < len(d):
			d[-rel:] *= np.linspace(1, 0, rel)[:, None] ** 2
		g = self.gain * (0.35 + 0.65 * vel)
		l, r = np.cos((self.pan + 1) * np.pi / 4), np.sin((self.pan + 1) * np.pi / 4)
		return d * g * np.array([l, r], np.float32) * 1.41


class Mix:
	"""Stereo timeline; adds clips at times in seconds."""

	def __init__(self, seconds: float):
		self.buf = np.zeros((int(seconds * SR) + SR * 8, 2), np.float32)

	def add(self, t: float, clip: np.ndarray, gain: float = 1.0) -> None:
		i = int(t * SR)
		if i < 0:
			clip = clip[-i:]
			i = 0
		j = min(len(self.buf), i + len(clip))
		self.buf[i:j] += clip[: j - i] * gain


# --------------------------------------------------------------------- synth layers
def _t(sec: float) -> np.ndarray:
	return np.arange(int(sec * SR)) / SR


def stereo(x: np.ndarray, width: float = 0.0) -> np.ndarray:
	if width <= 0:
		return np.stack([x, x], 1).astype(np.float32)
	d = int(0.011 * SR * width)
	l = x
	r = np.concatenate([np.zeros(d), x[:-d]]) if d else x
	return np.stack([l, r], 1).astype(np.float32)


def lowpass(x: np.ndarray, hz: float, order: int = 4) -> np.ndarray:
	b, a = signal.butter(order, hz / (SR / 2), "low")
	return signal.lfilter(b, a, x, axis=0).astype(np.float32)


def highpass(x: np.ndarray, hz: float, order: int = 2) -> np.ndarray:
	b, a = signal.butter(order, hz / (SR / 2), "high")
	return signal.lfilter(b, a, x, axis=0).astype(np.float32)


def braam(note: int = 26, sec: float = 4.0, bright: float = 1.0) -> np.ndarray:
	"""The trailer horn blast: detuned saws + square sub, overdriven, filter opening then closing."""
	t = _t(sec)
	f = 440 * 2 ** ((note - 69) / 12)
	x = np.zeros_like(t)
	for k, det in enumerate([-0.12, -0.05, 0.0, 0.06, 0.13]):
		ph = 2 * np.pi * f * (1 + det / 100) * t + k
		x += signal.sawtooth(ph) * 0.3
	x += np.sign(np.sin(2 * np.pi * f / 2 * t)) * 0.35
	x += signal.sawtooth(2 * np.pi * f * 1.5 * t) * 0.12  # fifth
	env = np.minimum(1, t / 0.04) * np.exp(-t / (sec * 0.55))
	x = np.tanh(x * 2.2) * env
	# filter sweep: bright attack, closing
	out = np.zeros_like(x)
	seg = int(0.05 * SR)
	for i in range(0, len(x), seg):
		cut = 200 + 2600 * bright * np.exp(-(i / SR) / 0.9)
		b, a = signal.butter(2, min(0.99, cut / (SR / 2)), "low")
		out[i:i + seg] = signal.lfilter(b, a, x[i:i + seg])
	return stereo(out * 0.9, 1.0)


def sub_drop(sec: float = 2.5, f0: float = 90, f1: float = 28) -> np.ndarray:
	t = _t(sec)
	f = f1 + (f0 - f1) * np.exp(-t * 3.0)
	ph = 2 * np.pi * np.cumsum(f) / SR
	x = np.sin(ph) * np.exp(-t / (sec * 0.45)) * np.minimum(1, t / 0.005)
	return stereo(np.tanh(x * 1.5) * 0.9)


def noise(sec: float, seed: int = 0) -> np.ndarray:
	return np.random.default_rng(seed).standard_normal(int(sec * SR)).astype(np.float32)


def riser(sec: float = 4.0, seed: int = 1) -> np.ndarray:
	"""Noise + rising tone sweep that swells into a hit."""
	t = _t(sec)
	u = t / sec
	n = noise(sec, seed)
	out = np.zeros_like(n)
	seg = int(0.03 * SR)
	for i in range(0, len(n), seg):
		c = 300 + 9000 * (i / len(n)) ** 2
		b, a = signal.butter(2, [max(20, c * 0.5) / (SR / 2), min(0.99, c * 1.6 / (SR / 2))], "band")
		out[i:i + seg] = signal.lfilter(b, a, n[i:i + seg])
	f = 120 * 2 ** (u * 4.5)
	tone = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR) * 0.15
	x = (out * 0.8 + tone) * u ** 2.2
	return stereo(x, 0.8)


def whoosh(sec: float = 0.8, seed: int = 2) -> np.ndarray:
	t = _t(sec)
	n = noise(sec, seed)
	env = np.sin(np.pi * np.clip(t / sec, 0, 1)) ** 2
	c = 400 + 3000 * np.sin(np.pi * t / sec)
	out = np.zeros_like(n)
	seg = int(0.02 * SR)
	for i in range(0, len(n), seg):
		b, a = signal.butter(2, [c[i] * 0.4 / (SR / 2), min(0.99, c[i] * 1.8 / (SR / 2))], "band")
		out[i:i + seg] = signal.lfilter(b, a, n[i:i + seg])
	return stereo(out * env * 1.6, 1.2)


def impact(big: float = 1.0, seed: int = 3) -> np.ndarray:
	"""Cinematic hit: sub boom + body thump + noise crack + metallic ring."""
	sec = 4.0
	t = _t(sec)
	boom = sub_drop(sec, 110, 32)[:, 0] * 1.1
	thump = np.sin(2 * np.pi * 70 * t) * np.exp(-t * 9) * 0.9
	crack = highpass(noise(sec, seed), 1500) * np.exp(-t * 28) * 0.7
	ring = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, d in ((523, 3.0), (797, 4.0), (1249, 5.5))) * 0.06
	x = np.tanh((boom + thump + crack + ring) * 1.4 * big)
	return stereo(x, 0.6)


def heartbeat(n: int = 4, bpm: float = 62) -> np.ndarray:
	sec = n * 60 / bpm + 1
	out = np.zeros(int(sec * SR), np.float32)
	beat = _t(0.35)
	thud = np.sin(2 * np.pi * 48 * beat) * np.exp(-beat * 14)
	for i in range(n):
		for off, g in ((0.0, 1.0), (0.24, 0.7)):
			j = int((i * 60 / bpm + off) * SR)
			out[j:j + len(thud)] += thud * g
	return stereo(lowpass(out, 180) * 1.4)


def oud(note: int, sec: float, vel: float = 0.8, seed: int = 0) -> np.ndarray:
	"""Karplus-Strong plucked course with a fretless slide and a wooden body."""
	f = 440 * 2 ** ((note - 69) / 12)
	n = int(sec * SR)
	period = SR / f
	p = int(period)
	rng = np.random.default_rng(seed + note)
	buf = rng.uniform(-1, 1, p) * vel
	out = np.zeros(n, np.float32)
	frac = period - p
	for i in range(n):
		j = i % p
		nxt = buf[(j + 1) % p]
		v = 0.996 * (buf[j] * (1 - frac * 0.5) + nxt * (frac * 0.5) + buf[j]) * 0.5
		buf[j] = v
		out[i] = v
	b, a = signal.butter(2, [110 / (SR / 2), 3200 / (SR / 2)], "band")
	body = signal.lfilter(b, a, out)
	out = out * 0.6 + body * 0.8
	env = np.minimum(1, _t(sec) / 0.002)
	return stereo(out * env * 0.9, 0.4)


def hall(x: np.ndarray, seconds: float = 3.2, wet: float = 0.3, predelay: float = 0.03) -> np.ndarray:
	"""Big convolution hall from a decaying, decorrelated noise impulse."""
	n = int(seconds * SR)
	t = _t(seconds)
	ir = np.zeros((n, 2), np.float32)
	for c in range(2):
		r = np.random.default_rng(40 + c).standard_normal(n).astype(np.float32)
		r = lowpass(r, 7000, 2)
		ir[:, c] = r * np.exp(-t * 6.9 / seconds)
	pd = int(predelay * SR)
	ir = np.concatenate([np.zeros((pd, 2), np.float32), ir])
	ir /= np.sqrt((ir ** 2).sum(axis=0, keepdims=True))
	y = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1)
	return (x * (1 - wet) + y * wet * 1.2).astype(np.float32)
