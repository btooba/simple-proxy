"""Tighten an outside voiceover (e.g. an ElevenLabs MP3) for Shorts without making it sound robotic.
- One even speed for the whole read (ffmpeg rubberband, pitch kept), so the speaker's own rhythm survives.
  (v2 sped each phrase by a different amount and flattened every pause -> Ben: "sounds very robotic".)
- Pauses are shortened in proportion, not flattened: short ones stay, long ones shrink the most,
  so a comma still sounds shorter than a full stop, and a full stop shorter than a new paragraph.
  Cuts are made in the middle of each pause with short crossfades, so word endings and breaths stay.
Usage: python pace_voice.py <voice.mp3|wav> [tempo, default 1.0 = no speed change]
Ben (2026-11-27) on the 1.1x version: "it sounds like a robot filter is on. this is not the audio that i uploaded" -> use 1.0.
Writes assets/voice_raw.wav (44.1 kHz mono) and prints the pause changes and the new length."""
import pathlib, subprocess, sys, tempfile
import numpy as np, soundfile as sf

P = pathlib.Path(__file__).resolve().parent.parent
src = sys.argv[1]
TEMPO = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0   # 1.0 = Ben's voice exactly as uploaded (any stretch sounded robotic)
SR = 44100
tmp = pathlib.Path(tempfile.mkdtemp())
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-ac", "1", "-ar", str(SR), str(tmp / "in.wav")], check=True)
x, _ = sf.read(tmp / "in.wav")

# --- pauses: 10 ms frames below -40 dBFS for at least 0.15 s
fr = int(0.01 * SR); n = len(x) // fr
db = 20 * np.log10(np.sqrt(np.mean(x[:n * fr].reshape(n, fr) ** 2, axis=1)) + 1e-9)
quiet = db < -40
runs, i = [], 0
while i < n:
    if quiet[i]:
        j = i
        while j < n and quiet[j]: j += 1
        if j - i >= 15: runs.append((i * fr, min(j * fr, len(x))))
        i = j
    else: i += 1

def new_len(d):
    """Shorten in proportion: 0.2 s -> 0.19, 0.4 s -> 0.31, 0.7 s -> 0.47, 0.9 s+ -> 0.55 (before the speed change)."""
    return min(d, 0.15 + 0.6 * (d - 0.15), 0.55)

XF = int(0.012 * SR)
keep, last, report = [], 0, []
for a, b in runs:
    d = (b - a) / SR
    if a == 0: last = max(0, b - int(0.05 * SR)); continue                  # lead-in silence -> 50 ms
    if b >= len(x): keep.append((last, min(len(x), a + int(0.15 * SR)))); last = None; break   # tail -> 150 ms
    nd = new_len(d)
    cut = int((d - nd) * SR)
    if cut > 2 * XF:
        mid = (a + b) // 2
        keep.append((last, mid - cut // 2)); last = mid + cut // 2
    report.append((a / SR, d, nd))
if last is not None: keep.append((last, len(x)))

out = x[keep[0][0]:keep[0][1]].copy()
ramp = np.linspace(0, 1, XF)
for s, e in keep[1:]:
    seg = x[s:e]
    out[-XF:] = out[-XF:] * (1 - ramp) + seg[:XF] * ramp                  # crossfade inside the silence
    out = np.concatenate([out, seg[XF:]])
sf.write(tmp / "cut.wav", out, SR)
if TEMPO == 1.0:                                                          # no time-stretch at all: only silences were shortened
    sf.write(P / "assets" / "voice_raw.wav", out, SR, subtype="PCM_16")
else:
  subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp / "cut.wav"), "-af",
                f"rubberband=tempo={TEMPO}:transients=smooth:detector=soft:window=standard:formant=preserved:pitchq=quality",
                "-ar", str(SR), str(P / "assets" / "voice_raw.wav")], check=True)
y, _ = sf.read(P / "assets" / "voice_raw.wav")
for t, d, nd in report: print(f"{t:6.2f}s  pause {d:4.2f} -> {nd:4.2f}  (heard {nd / TEMPO:4.2f})")
print(f"before {len(x) / SR:.1f}s -> pauses trimmed {len(out) / SR:.1f}s -> x{TEMPO} = {len(y) / SR:.1f}s")
