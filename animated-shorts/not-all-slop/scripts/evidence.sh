#!/bin/bash
# Review evidence for a rendered short: contact sheets (1 frame/s, timestamped), loudness, black/frozen
# frames, a transcript of the final audio checked against the script, and the basic format numbers.
# Usage: scripts/evidence.sh renders/not-all-slop.mp4 <out-dir>
set -e
V="$1"; O="$2"; mkdir -p "$O"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
ffprobe -v error -show_entries stream=codec_type,width,height,r_frame_rate:format=duration -of compact "$V" > "$O/format.txt"
ffmpeg -v error -y -i "$V" -vf "fps=1,scale=270:-1,drawtext=text='%{pts\:hms}':x=8:y=8:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6,tile=6x2" "$O/sheet_%02d.jpg"
ffmpeg -hide_banner -nostats -i "$V" -af ebur128=peak=true -f null - 2>&1 | grep -A14 Summary > "$O/loudness.txt"
ffmpeg -hide_banner -nostats -i "$V" -vf "blackdetect=d=0.1:pix_th=0.08" -an -f null - 2>&1 | grep -o "black_start.*" > "$O/black.txt" || true
ffmpeg -hide_banner -nostats -i "$V" -vf "freezedetect=n=0.002:d=0.5" -an -f null - 2>&1 | grep -oE "freeze_(start|end|duration).*" > "$O/freeze.txt" || true
ffmpeg -v error -y -i "$V" -ar 16000 -ac 1 "$O/audio16k.wav"
whisper-cli -m /opt/video-tools/models/ggml-base.en.bin -f "$O/audio16k.wav" -np -t 4 > "$O/transcript.txt" 2>/dev/null
python3 - "$O/transcript.txt" "$HERE/spoken.txt" > "$O/transcript_check.txt" <<'EOF'
import re, sys, difflib
n = lambda s: re.findall(r"[a-z0-9]+", s.lower().replace("a.i.", "ai").replace("o.g.", "og").replace("70,000", "seventy thousand").replace("2026", "twenty twenty six").replace("80%", "eighty percent").replace("100", "one hundred"))
heard = n(re.sub(r"\[[^\]]*\]", " ", open(sys.argv[1]).read())); said = n(open(sys.argv[2]).read())
sm = difflib.SequenceMatcher(a=said, b=heard, autojunk=False)
print(f"script words {len(said)}, heard {len(heard)}, match ratio {sm.ratio():.3f}")
for op, a0, a1, b0, b1 in sm.get_opcodes():
    if op != "equal": print(f"{op}: script '{' '.join(said[a0:a1])}' vs heard '{' '.join(heard[b0:b1])}'")
EOF
echo "evidence in $O"; cat "$O/format.txt" "$O/loudness.txt"; echo "black:"; cat "$O/black.txt"; echo "freeze:"; cat "$O/freeze.txt"; head -3 "$O/transcript_check.txt"
