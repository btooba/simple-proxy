"""Sentence windows for an outside voiceover: matches whisper word timings to spoken.txt and writes
lines.json (start/end of each line), which align.py uses to place every word.
Line boundaries sit in the middle of the pause between two lines.
Usage: python lines_from_words.py <whisper words.json> <voice duration s>"""
import difflib, json, pathlib, re, sys
P = pathlib.Path(__file__).resolve().parent.parent
norm = lambda w: re.sub(r"[^a-z0-9]", "", w.lower().replace("a.i.", "ai").replace("o.g.", "og"))
SAID = {"70000": ["seventy", "thousand"], "2026": ["twenty", "twentysix"], "80": ["eighty", "percent"], "100": ["one", "hundred"]}  # digits as spoken
lines = [l.strip() for l in (P / "spoken.txt").read_text().splitlines() if l.strip()]
J = json.load(open(sys.argv[1])); dur = float(sys.argv[2])
ww = []
for s in J["transcription"]:
    a0, b0, w = s["offsets"]["from"] / 1000, s["offsets"]["to"] / 1000, norm(s["text"])
    if not w: continue
    parts = SAID.get(w, [w])  # split a number's time span evenly over the words it is said as
    for k, part in enumerate(parts):
        ww.append((a0 + (b0 - a0) * k / len(parts), a0 + (b0 - a0) * (k + 1) / len(parts), part))
toks = [(i, norm(t)) for i, l in enumerate(lines) for t in l.split()]
sm = difflib.SequenceMatcher(a=[t for _, t in toks], b=[w[2] for w in ww], autojunk=False)
first, last = {}, {}
for a, b, n in sm.get_matching_blocks():
    for k in range(n):
        li = toks[a + k][0]; s, e = ww[b + k][0], ww[b + k][1]
        first[li] = min(first.get(li, 1e9), s); last[li] = max(last.get(li, -1), e)
missing = [i for i in range(len(lines)) if i not in first]
if missing: raise SystemExit(f"no matched words for lines {missing}")
starts = [0.0] + [(last[i - 1] + first[i]) / 2 for i in range(1, len(lines))]
ends = starts[1:] + [dur]
out = [{"i": i, "text": l, "start": round(starts[i], 3), "end": round(ends[i], 3)} for i, l in enumerate(lines)]
(P / "lines.json").write_text(json.dumps({"voice": "outside voiceover", "duration": dur, "lines": out}, indent=1))
for L in out: print(f'{L["start"]:6.2f}-{L["end"]:6.2f}  {L["text"][:60]}')
