#!/usr/bin/env python3
"""Cuts «الطوفان» together: rendered clips on the score's beat map, grade, 2.39 letterbox,
grain, flash frames, the score plus synthesised sound design, mastered to -14 LUFS.

    python3 tools/trailer/edit.py <clips_dir> <score.wav> <out.mp4> [--res 1920x1080]

Missing clips are filled with a labelled slate, so the cut can be watched as an
animatic before every shot is rendered.
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
import pyloudnorm as pyln
import soundfile as sf

sys.path.insert(0, os.path.dirname(__file__))
import sampler as S
import sfx as X

ROOT = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(ROOT, "../../assets/fonts/Rajdhani-Bold.ttf")
LEN = 75.0

# (start, shot, offset into the clip, length, options)
EDL = [
	(0.0, "under_eye", 1.6, 5.0, {}),
	(5.0, "card_year", 0.2, 2.2, {"card": True}),
	(7.2, "city_wave", 0.6, 3.0, {"flash": 0.12}),
	(10.2, "city_street", 0.0, 3.4, {}),
	(13.6, "black", 0, 0.8, {}),
	(14.4, "storm_wide", 0.2, 4.2, {"flash": 0.1}),
	(18.6, "storm_wheel", 0.4, 2.4, {}),
	(21.0, "storm_bow", 0.3, 2.4, {}),
	(23.4, "storm_sailor", 0.6, 1.6, {}),
	(25.0, "crash", 0.6, 1.6, {}),
	(26.6, "white", 0, 0.12, {}),
	(26.72, "black", 0, 0.6, {}),
	(27.32, "card_survived", 0.0, 2.2, {"card": True}),
	(29.52, "wake_eye", 1.0, 3.5, {}),
	(33.02, "wake_wide", 2.2, 2.98, {}),
	(36.0, "card_notdone", 0.3, 2.4, {"card": True, "flash": 0.08}),
	(38.4, "m_fire", 0.0, 2.4, {}),
	(40.8, "m_tree", 0.9, 1.8, {"flash": 0.06}),
	(42.6, "m_build", 0.2, 2.4, {}),
	(45.0, "m_shark", 0.3, 1.8, {"flash": 0.06}),
	(46.8, "m_torch", 0.4, 1.8, {}),
	(48.6, "storm_bow", 1.5, 1.2, {}),
	(49.8, "m_fire", 1.4, 0.6, {}),
	(50.4, "city_street", 2.2, 0.6, {"flash": 0.06}),
	(51.0, "m_tree", 1.6, 0.6, {}),
	(51.6, "storm_sailor", 1.2, 0.6, {}),
	(52.2, "m_shark", 1.6, 0.6, {}),
	(52.8, "crash", 1.9, 0.6, {}),
	(53.4, "m_torch", 1.6, 0.6, {}),
	(54.0, "storm_wide", 3.0, 0.6, {}),
	(54.6, "black", 0, 0.6, {}),
	(55.2, "hero_sail", 0.4, 4.2, {"flash": 0.15}),
	(59.4, "hero_reveal", 0.1, 5.4, {}),
	(64.8, "title", 0.0, 4.2, {"card": True, "flash": 0.1}),
	(69.0, "black", 0, 0.6, {}),
	(69.6, "stinger", 0.0, 4.8, {}),
	(74.4, "black", 0, 0.6, {}),
]

# sound design per shot: (kind, shot-time, args) — ambiences span the whole cut
SOUND = {
	"under_eye": [("underwater", None, 1.0), ("bubbles", None, 0.5)],
	"card_year": [("underwater", None, 0.4)],
	"city_wave": [("siren", None, 0.35), ("roar", None, 0.6), ("wind", None, 0.3)],
	"city_street": [("roar", None, 1.0), ("siren", None, 0.25)],
	"storm_wide": [("rain", None, 0.5), ("wind", None, 0.6), ("thunder", 1.35, 0.9), ("thunder", 3.6, 0.7), ("wave", 2.0, 0.6)],
	"storm_wheel": [("rain", None, 0.6), ("wind", None, 0.6), ("thunder", 0.9, 1.0)],
	"storm_bow": [("rain", None, 0.4), ("wind", None, 0.5), ("wave", 0.6, 1.0), ("thunder", 1.8, 0.8)],
	"storm_sailor": [("rain", None, 0.5), ("wind", None, 0.6), ("wave", 1.1, 1.2)],
	"crash": [("rain", None, 0.5), ("wind", None, 0.5), ("thunder", 0.7, 1.0), ("wood", 2.05, 1.3)],
	"white": [("ring", 0.0, 1.0)],
	"wake_eye": [("surf", None, 0.7)],
	"wake_wide": [("surf", None, 0.8), ("wind", None, 0.15)],
	"m_fire": [("fire", None, 0.7), ("ignite", 0.3, 0.8)],
	"m_tree": [("fall", 0.5, 0.9)],
	"m_build": [("hammer", None, 0.6), ("surf", None, 0.3)],
	"m_shark": [("underwater", None, 0.8), ("bubbles", None, 0.6)],
	"m_torch": [("fire", None, 0.4), ("wind", None, 0.4), ("surf", None, 0.4)],
	"hero_sail": [("wind", None, 0.35), ("surf", None, 0.5), ("wave", 1.5, 0.4)],
	"hero_reveal": [("wind", None, 0.3), ("surf", None, 0.35)],
	"stinger": [("surf", None, 0.6), ("wind", None, 0.15)],
}


def sh(cmd):
	r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
	if r.returncode:
		print(r.stderr[-2000:])
		raise SystemExit("failed: " + cmd[:200])


def grade(card):
	if card:
		return ""
	return ("eq=contrast=1.07:saturation=1.08:gamma=0.98,"
		"colorbalance=rs=-0.04:gs=-0.01:bs=0.05:rh=0.05:gh=0.01:bh=-0.04,vignette=PI/5,")


def video(clips, out, res, tmp):
	w, h = map(int, res.split("x"))
	parts = []
	for i, (start, shot, off, ln, opt) in enumerate(EDL):
		seg = os.path.join(tmp, f"s{i:03d}.mp4")
		src = os.path.join(clips, shot + ".mp4")
		flash = f",fade=t=in:st=0:d={opt['flash']}:color=white" if opt.get("flash") else ""
		if shot in ("black", "white") or not os.path.exists(src):
			col = "white" if shot == "white" else ("black" if shot == "black" else "0x101418")
			label = ""
			sh(f"ffmpeg -y -loglevel error -f lavfi -i color=c={col}:s={w}x{h}:r=24:d={ln:.3f} "
				f"-vf \"format=yuv420p{label}{flash}\" -c:v libx264 -crf 12 -preset fast {seg}")
		else:
			sh(f"ffmpeg -y -loglevel error -ss {off:.3f} -i {src} -t {ln:.3f} -vf \"scale={w}:{h}:flags=lanczos,"
				f"tpad=stop_mode=clone:stop_duration={ln:.3f},{grade(opt.get('card'))}fps=24,format=yuv420p{flash}\" "
				f"-t {ln:.3f} -an -c:v libx264 -crf 12 -preset fast {seg}")
		parts.append(seg)
	lst = os.path.join(tmp, "list.txt")
	open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
	body = os.path.join(tmp, "body.mp4")
	sh(f"ffmpeg -y -loglevel error -f concat -safe 0 -i {lst} -c copy {body}")
	return body


def sound(score_path, tmp):
	n = int((LEN + 1) * S.SR)
	fx = np.zeros((n, 2), np.float32)

	def add(t, clip, g):
		i = int(t * S.SR)
		if i >= n:
			return
		j = min(n, i + len(clip))
		fx[i:j] += clip[: j - i] * g

	for start, shot, off, ln, _ in EDL:
		for kind, at, g in SOUND.get(shot, []):
			if at is None:
				d = ln + 0.4
				clip = {"underwater": X.underwater, "bubbles": X.bubbles, "siren": X.siren, "roar": X.roar,
					"wind": X.wind, "rain": X.rain, "surf": X.surf, "fire": X.fire, "hammer": X.hammer}[kind](d)
				add(start, clip, g)
			elif off - 0.05 <= at <= off + ln:
				t = start + (at - off)
				clip = {"thunder": lambda: X.thunder(0.3), "wave": X.wave_crash, "wood": X.wood_crash,
					"ring": X.ring, "fall": X.creak_fall, "ignite": X.ignite}[kind]()
				add(t + (0.25 if kind == "thunder" else 0.0), clip, g)
	# a whoosh into every hard cut of the montage and the big transitions
	for start, shot, off, ln, opt in EDL:
		if 36.0 <= start <= 55.2 or opt.get("flash"):
			add(start - 0.45, S.whoosh(0.6, int(start * 10)), 0.35)
	score, sr = sf.read(score_path, dtype="float32", always_2d=True)
	m = min(len(score), n)
	mix = fx * 0.55
	mix[:m] += score[:m]
	mix = mix[: int(LEN * S.SR)]
	meter = pyln.Meter(S.SR)
	for _ in range(3):
		mix = pyln.normalize.loudness(mix, meter.integrated_loudness(mix), -14.0)
		mix = limit(mix, 0.89)
	out = os.path.join(tmp, "mix.wav")
	sf.write(out, mix, S.SR, subtype="PCM_24")
	return out


def limit(x, ceiling):
	"""Look-ahead peak limiter (5 ms attack, 120 ms release)."""
	from scipy.ndimage import maximum_filter1d
	peak = maximum_filter1d(np.abs(x).max(axis=1), int(0.005 * S.SR) * 2 + 1)
	g = np.minimum(1.0, ceiling / np.maximum(peak, 1e-9))
	rel = np.exp(-1.0 / (0.12 * S.SR))
	out = np.empty_like(g)
	cur = 1.0
	for i in range(len(g)):  # fast enough at 75 s
		cur = g[i] if g[i] < cur else g[i] + (cur - g[i]) * rel
		out[i] = cur
	return (x * out[:, None]).astype(np.float32)


def main():
	clips, score, out = sys.argv[1:4]
	res = sys.argv[sys.argv.index("--res") + 1] if "--res" in sys.argv else "1920x1080"
	w, h = map(int, res.split("x"))
	bar = int((h - w / 2.39) / 2)
	tmp = tempfile.mkdtemp(prefix="cut_")
	body = video(clips, out, res, tmp)
	wav = sound(score, tmp)
	sh(f"ffmpeg -y -loglevel error -i {body} -i {wav} -vf \"noise=alls=5:allf=t,drawbox=x=0:y=0:w=iw:h={bar}:color=black:t=fill,"
		f"drawbox=x=0:y=ih-{bar}:w=iw:h={bar}:color=black:t=fill,format=yuv420p\" -c:v libx264 -crf 16 -preset slow "
		f"-c:a aac -b:a 320k -shortest -movflags +faststart {out}")
	print("wrote", out)


if __name__ == "__main__":
	main()
