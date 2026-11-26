"""Tighten an outside voiceover (e.g. an ElevenLabs MP3) for Shorts pacing.
- Long pauses are shortened (>= 0.5 s -> 0.28 s, 0.25-0.5 s -> 0.18 s, short ones capped at 0.12 s).
- Each stretch of speech between pauses is sped up with pitch kept (ffmpeg atempo): slow stretches more,
  fast ones less, so the delivery sounds even. Tempo stays within 1.08x-1.28x.
Usage: python pace_voice.py <voice.mp3|wav> <whisper words.json of that file> [target syllables/s]
Writes assets/voice_raw.wav (44.1 kHz mono) and prints the new length."""
import json, pathlib, re, subprocess, sys, tempfile
import numpy as np, soundfile as sf

P = pathlib.Path(__file__).resolve().parent.parent
src, wpath = sys.argv[1], sys.argv[2]
TARGET = float(sys.argv[3]) if len(sys.argv) > 3 else 5.0
SR = 44100
tmp = pathlib.Path(tempfile.mkdtemp())
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-ac", "1", "-ar", str(SR), str(tmp / "in.wav")], check=True)
x, _ = sf.read(tmp / "in.wav")

# --- pauses: 10 ms frames below -40 dBFS for at least 0.12 s
fr = int(0.01 * SR); n = len(x) // fr
db = 20 * np.log10(np.sqrt(np.mean(x[:n * fr].reshape(n, fr) ** 2, axis=1)) + 1e-9)
quiet = db < -40
runs, i = [], 0
while i < n:
    if quiet[i]:
        j = i
        while j < n and quiet[j]: j += 1
        if (j - i) * 0.01 >= 0.12 or i == 0 or j == n: runs.append((i * fr, min(j * fr, len(x))))
        i = j
    else: i += 1
speech, last = [], 0
for a, b in runs:
    if a > last: speech.append((last, a))
    last = b
if last < len(x): speech.append((last, len(x)))

# --- syllables per stretch, from whisper words (numbers expanded to how they are said)
NUM = {"70,000": "seventy thousand", "2026": "twenty twenty six", "2026,": "twenty twenty six", "80%": "eighty percent", "100": "one hundred"}
syl = lambda w: max(1, len(re.findall(r"[aeiouy]+", re.sub(r"e\b", "", w.lower()))))
J = json.load(open(wpath))
W = [((s["offsets"]["from"] + s["offsets"]["to"]) / 2000, s["text"].strip()) for s in J["transcription"] if s["text"].strip()]
def syllables(a, b):
    tot = 0
    for t, w in W:
        if a / SR - 0.05 <= t < b / SR + 0.05:
            for part in NUM.get(w, w).split():
                part = re.sub(r"[^A-Za-z']", "", part)
                if part: tot += syl(part)
    return tot

def pause_len(d):
    return 0.28 if d >= 0.5 else (0.18 if d >= 0.25 else min(d, 0.12))

out, report = [], []
gaps = [(speech[k][1], speech[k + 1][0]) for k in range(len(speech) - 1)]
for k, (a, b) in enumerate(speech):
    seg = x[a:b]; d = (b - a) / SR; sy = syllables(a, b)
    rate = sy / d if d > 0 else TARGET
    tempo = 1.15 if d < 0.9 or sy == 0 else float(np.clip(TARGET / rate, 1.08, 1.28))
    sf.write(tmp / "s.wav", seg, SR)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp / "s.wav"), "-af", f"atempo={tempo:.4f}", str(tmp / "t.wav")], check=True)
    y, _ = sf.read(tmp / "t.wav")
    f = min(int(0.004 * SR), len(y) // 2)
    if f > 0: y[:f] *= np.linspace(0, 1, f); y[-f:] *= np.linspace(1, 0, f)
    if k == 0: out.append(np.zeros(int(0.03 * SR)))
    out.append(y)
    if k < len(gaps): out.append(np.zeros(int(pause_len((gaps[k][1] - gaps[k][0]) / SR) * SR)))
    report.append((a / SR, d, sy, rate, tempo))
out.append(np.zeros(int(0.12 * SR)))
y = np.concatenate(out)
sf.write(P / "assets" / "voice_raw.wav", y, SR)
for a, d, sy, r, t in report: print(f"{a:6.2f}s  {d:4.2f}s  {sy:3d} syl  {r:4.1f}/s -> x{t:.2f}")
print(f"before {len(x) / SR:.1f}s -> after {len(y) / SR:.1f}s")
