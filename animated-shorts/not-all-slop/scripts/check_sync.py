"""Check every caption against the voice: for each caption, transcribe the audio from 0.15 s before it appears
to 1 s after, and look for its first word. Prints how early/late each caption is versus the heard word
(whisper word times inside a 1 s cut are accurate to ~0.05 s) and flags anything over 0.15 s.
Usage: python check_sync.py <audio.wav|video.mp4> [index.html]"""
import json, re, subprocess, sys, tempfile, pathlib, difflib

src = sys.argv[1]
html = open(sys.argv[2] if len(sys.argv) > 2 else "index.html").read()
WC = "/opt/video-tools/whisper.cpp/build/bin/whisper-cli"
MODEL = "/opt/video-tools/models/ggml-base.en.bin"
tmp = pathlib.Path(tempfile.mkdtemp())
norm = lambda w: re.sub(r"[^a-z0-9]", "", w.lower())
caps = re.findall(r'id="(cap\d+)" class="clip cap" data-start="([\d.]+)".*?<div class="cin">(.*?)</div></div>', html)
SAY = {"70000": "70", "2026": "2026", "80": "80", "100": "100"}
bad = 0
for cid, st, inner in caps:
    st = float(st)
    first = norm(re.sub(r"<[^>]+>", " ", inner).split()[0])
    t0 = max(0, st - 0.15)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t0:.3f}", "-t", "1.15", "-i", src, "-ac", "1", "-ar", "16000",
                    "-af", "apad=pad_dur=0.5", str(tmp / "c.wav")], check=True)
    subprocess.run([WC, "-m", MODEL, "-f", str(tmp / "c.wav"), "-ml", "1", "-sow", "-oj", "-of", str(tmp / "c"), "-np"],
                   capture_output=True)
    J = json.load(open(tmp / "c.json"))
    ws = [(s["offsets"]["from"] / 1000 + t0, norm(s["text"])) for s in J["transcription"] if norm(s["text"])]
    hit = [t for t, w in ws if w == first or difflib.SequenceMatcher(None, w, first).ratio() >= 0.7 or
           (len(first) >= 3 and w.startswith(first[:3])) or w == SAY.get(first)]
    if not hit:
        print(f"{st:6.2f}  {cid}  '{first}'  NOT HEARD in cut (heard: {' '.join(w for _, w in ws)})"); bad += 1; continue
    d = hit[0] - st
    flag = "  <-- OFF" if abs(d) > 0.15 else ""
    bad += bool(flag)
    print(f"{st:6.2f}  {cid}  {first:14s} heard {hit[0]:6.2f}  caption {'early' if d > 0 else 'late'} {abs(d):.2f}s{flag}")
print(f"{len(caps)} captions, {bad} flagged")
