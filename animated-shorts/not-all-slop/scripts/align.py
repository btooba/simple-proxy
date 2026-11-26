"""Word timings for captions and camera cues.
Matches whisper.cpp word timestamps to the known script, fills gaps by interpolation inside each
sentence's exact window (from lines.json), and merges spoken forms into display forms (70,000, 2026, AI...).
Usage: python align.py <whisper words.json>  -> writes words.json [{w, s, e, line}]"""
import difflib, json, pathlib, re, sys

P = pathlib.Path(__file__).resolve().parent.parent
lines = json.loads((P / "lines.json").read_text())["lines"]
wj = json.load(open(sys.argv[1]))
ww = [(s["offsets"]["from"] / 1000, s["offsets"]["to"] / 1000, s["text"].strip())
      for s in wj["transcription"] if s["text"].strip()]
norm = lambda w: re.sub(r"[^a-z0-9]", "", w.lower())

toks = []  # spoken tokens with line index
for L in lines:
    for t in L["text"].split():
        toks.append({"t": t, "line": L["i"]})

sm = difflib.SequenceMatcher(a=[norm(t["t"]) for t in toks], b=[norm(w[2]) for w in ww], autojunk=False)
for a, b, n in sm.get_matching_blocks():
    for k in range(n):
        toks[a + k]["s"], toks[a + k]["e"] = ww[b + k][0], ww[b + k][1]

# per line: clamp to the exact window, anchor first/last, interpolate the rest by length
for L in lines:
    idx = [i for i, t in enumerate(toks) if t["line"] == L["i"]]
    s0, e0 = L["start"], L["end"]
    for i in idx:
        if "s" in toks[i]:
            toks[i]["s"] = min(max(toks[i]["s"], s0), e0)
            toks[i]["e"] = min(max(toks[i]["e"], toks[i]["s"] + 0.05), e0)
    # a line's first/last word keeps its heard time when whisper matched it (line windows run to the middle of
    # the pause, so forcing them made the first caption of every sentence show up during the pause, early)
    if "s" not in toks[idx[0]]: toks[idx[0]]["s"] = s0
    if "e" not in toks[idx[-1]]: toks[idx[-1]]["e"] = e0
    k = 0
    while k < len(idx):
        if "e" in toks[idx[k]] and "s" in toks[idx[k]]:
            k += 1
            continue
        j = k
        while j < len(idx) and not ("s" in toks[idx[j]] and "e" in toks[idx[j]]):
            j += 1
        left = toks[idx[k - 1]]["e"] if k > 0 else s0
        if "s" in toks[idx[k]] and k == 0:
            left = toks[idx[k]]["s"]
        right = toks[idx[j]]["s"] if j < len(idx) else e0
        span = idx[k:j]
        lens = [max(2, len(toks[i]["t"])) for i in span]
        tot, acc = sum(lens), left
        for i, ln in zip(span, lens):
            d = (right - left) * ln / tot
            toks[i]["s"], toks[i]["e"] = acc, acc + d
            acc += d
        k = j
    # keep monotonic
    for a_, b_ in zip(idx, idx[1:]):
        if toks[b_]["s"] < toks[a_]["s"]:
            toks[b_]["s"] = toks[a_]["e"]
        toks[b_]["e"] = max(toks[b_]["e"], toks[b_]["s"] + 0.04)

# spoken -> display merges
MERGE = [(("seventy", "thousand"), "70,000"), (("twenty", "twenty-six."), "2026."),
         (("eighty", "percent"), "80%"), (("one", "hundred"), "100")]
out, i = [], 0
while i < len(toks):
    hit = None
    for seq, disp in MERGE:
        if tuple(t["t"].lower() for t in toks[i:i + len(seq)]) == seq:
            hit = (len(seq), disp)
    if hit:
        n, disp = hit
        out.append({"w": disp, "s": toks[i]["s"], "e": toks[i + n - 1]["e"], "line": toks[i]["line"]})
        i += n
        continue
    w = toks[i]["t"].replace("A.I.", "AI").replace("O.G.", "OG")
    nxt = toks[i + 1] if i + 1 < len(toks) else None
    if toks[i]["t"] == "A.I." and (nxt is None or nxt["line"] != toks[i]["line"] or nxt["t"][0].isupper()):
        w = "AI."
    w = w.replace("Peak", "PEAK")
    out.append({"w": w, "s": toks[i]["s"], "e": toks[i]["e"], "line": toks[i]["line"]})
    i += 1
for o in out:
    o["s"], o["e"] = round(o["s"], 3), round(o["e"], 3)
(P / "words.json").write_text(json.dumps(out, indent=0))
matched = sum(1 for t in toks if t.get("s") is not None)
print(f"{len(out)} display words; {sum(n for _, _, n in sm.get_matching_blocks())}/{len(toks)} matched to whisper")
