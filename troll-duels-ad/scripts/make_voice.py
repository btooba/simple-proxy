"""Free local voice-over with Kokoro (no API key, no cost).

Reads script.txt (one spoken line per row), speaks each line with one voice,
joins them with a short gap, and writes:
  <out>.wav          the voice-over
  <out>.lines.json   start/end second of every line (used for captions)

Usage:
  python make_voice.py --voice af_heart --speed 1.15 --out voice/af_heart
"""

import argparse
import json
import os
import pathlib

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

HERE = pathlib.Path(__file__).resolve().parent
PROJECT = HERE.parent
MODELS = pathlib.Path(os.environ.get("VIDEO_TOOLS", "/opt/video-tools")) / "models"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="af_heart")
    ap.add_argument("--speed", type=float, default=1.15)
    ap.add_argument("--gap", type=float, default=0.28, help="silence between lines, seconds")
    ap.add_argument("--script", default=str(PROJECT / "script.txt"))
    ap.add_argument("--out", required=True, help="output path without extension")
    args = ap.parse_args()

    lines = [l.strip() for l in pathlib.Path(args.script).read_text().splitlines() if l.strip()]
    kokoro = Kokoro(str(MODELS / "kokoro-v1.0.int8.onnx"), str(MODELS / "voices-v1.0.bin"))

    chunks, timings, t, rate = [], [], 0.0, 24000
    for i, line in enumerate(lines, 1):
        audio, rate = kokoro.create(line, voice=args.voice, speed=args.speed, lang="en-us")
        dur = len(audio) / rate
        timings.append({"line": i, "text": line, "start": round(t, 3), "end": round(t + dur, 3)})
        chunks.append(audio)
        t += dur
        if i < len(lines):
            chunks.append(np.zeros(int(args.gap * rate), dtype=audio.dtype))
            t += args.gap

    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    sf.write(out.with_suffix(".wav"), np.concatenate(chunks), rate)
    out.with_suffix(".lines.json").write_text(json.dumps(
        {"voice": args.voice, "speed": args.speed, "gap": args.gap, "duration": round(t, 3), "lines": timings},
        indent=2))
    print(f"{out.with_suffix('.wav')}  {t:.2f}s")


if __name__ == "__main__":
    main()
