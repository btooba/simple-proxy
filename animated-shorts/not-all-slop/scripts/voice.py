"""Narration with the free local Kokoro voice: one line per sentence, edges trimmed, short gaps.
Writes assets/voice.wav (24 kHz mono) and lines.json (start/end of each sentence)."""
import json, os, pathlib, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
P = pathlib.Path(__file__).resolve().parent.parent
M = pathlib.Path(os.environ.get("VIDEO_TOOLS", "/opt/video-tools")) / "models"
voice, speed, gap = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
k = Kokoro(str(M / "kokoro-v1.0.int8.onnx"), str(M / "voices-v1.0.bin"))
lines = [l.strip() for l in (P / "spoken.txt").read_text().splitlines() if l.strip()]
out, meta, t, sr = [], [], 0.0, 24000
for i, line in enumerate(lines):
    a, sr = k.create(line, voice=voice, speed=speed, lang="en-us")
    on = np.where(np.abs(a) > 0.01)[0]
    a = a[max(0, on[0] - int(0.02 * sr)): on[-1] + int(0.06 * sr)]
    meta.append({"i": i, "text": line, "start": round(t, 3), "end": round(t + len(a) / sr, 3)})
    out.append(a); t += len(a) / sr
    if i < len(lines) - 1:
        out.append(np.zeros(int(gap * sr), dtype=a.dtype)); t += gap
sf.write(P / "assets" / "voice_raw.wav", np.concatenate(out), sr)
(P / "lines.json").write_text(json.dumps({"voice": voice, "speed": speed, "gap": gap, "duration": round(t, 3), "lines": meta}, indent=1))
words = sum(len(l.split()) for l in lines)
print(f"{t:.2f}s  {words} words  {words / t:.2f} words/s")
