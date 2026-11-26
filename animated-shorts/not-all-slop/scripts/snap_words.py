"""Make whisper word timings line up with the real voice.
whisper.cpp word times drift (up to ~0.9 s on Ben's ElevenLabs voice: it put "phone." inside the pause after it).
The audio itself shows exactly where the voice stops and starts again, so:
 1. find every pause (>= 0.12 s below -40 dBFS),
 2. for each place the voice starts again, transcribe a short cut from there and match its first word to the
    whisper word list (nearby, same word) -> that word really starts at the pause end,
 3. between two such anchors the speech is one stretch with known start and end: the words inside it keep
    whisper's relative spacing, stretched to fit exactly.
Usage: python snap_words.py <whisper.json> <voice.wav> <out.json>"""
import difflib, json, re, subprocess, sys, tempfile, pathlib
import numpy as np, soundfile as sf

wj, wav, outp = sys.argv[1:4]
WC = "/opt/video-tools/whisper.cpp/build/bin/whisper-cli"
MODEL = "/opt/video-tools/models/ggml-base.en.bin"
tmp = pathlib.Path(tempfile.mkdtemp())
J = json.load(open(wj))
segs = [s for s in J["transcription"] if s["text"].strip()]
norm = lambda w: re.sub(r"[^a-z0-9]", "", w.lower())
W = [norm(s["text"]) for s in segs]
st = [s["offsets"]["from"] / 1000 for s in segs]
en = [s["offsets"]["to"] / 1000 for s in segs]

x, sr = sf.read(wav)
if x.ndim > 1: x = x.mean(1)
fr = int(0.01 * sr); n = len(x) // fr
db = 20 * np.log10(np.sqrt(np.mean(x[:n * fr].reshape(n, fr) ** 2, axis=1)) + 1e-9)
q = db < -40
pauses, i = [], 0
while i < n:
    if q[i]:
        j = i
        while j < n and q[j]: j += 1
        if j - i >= 12 and j < n and i > 0: pauses.append((i / 100, j / 100))
        i = j
    else: i += 1
on = np.where(~q)[0]
voice_start, voice_end = on[0] / 100, (on[-1] + 1) / 100

def first_word(t):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-t", "1.0", "-i", wav, "-ac", "1", "-ar", "16000",
                    "-af", "apad=pad_dur=0.5", str(tmp / "c.wav")], check=True)
    r = subprocess.run([WC, "-m", MODEL, "-f", str(tmp / "c.wav"), "-nt", "-np"], capture_output=True, text=True).stdout
    ws = [norm(w) for w in r.split() if norm(w)]
    return ws[0] if ws else ""

anchors = [(0, voice_start, None)]           # (word index, time the word starts, time the previous stretch ended)
for ps, pe in pauses:
    fw = first_word(pe)
    cand = [k for k in range(len(W)) if abs(st[k] - pe) < 1.5 and fw and
            (W[k] == fw or difflib.SequenceMatcher(None, W[k], fw).ratio() >= 0.6 or (len(fw) >= 3 and W[k].startswith(fw[:3])))]
    if not cand:
        print(f"{pe:6.2f}s  heard '{fw}' - no match, pause ignored (probably inside a word)"); continue
    k = min(cand, key=lambda k: abs(st[k] - pe))
    if k <= anchors[-1][0]:
        print(f"{pe:6.2f}s  '{fw}' -> word {k} not after the last anchor, ignored"); continue
    anchors.append((k, pe, ps))
    print(f"{pe:6.2f}s  {segs[k]['text'].strip():14s} whisper said {st[k]:6.2f} ({pe - st[k]:+.2f})")
anchors.append((len(W), None, voice_end))

def stretch_words(t0, t1):
    """Transcribe one stretch of speech on its own: word times in a short cut are far more precise."""
    a = max(0, t0 - 0.05)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{a:.3f}", "-to", f"{t1 + 0.05:.3f}", "-i", wav, "-ac", "1",
                    "-ar", "16000", "-af", "apad=pad_dur=0.6", str(tmp / "s.wav")], check=True)
    subprocess.run([WC, "-m", MODEL, "-f", str(tmp / "s.wav"), "-ml", "1", "-sow", "-oj", "-of", str(tmp / "s"), "-np"],
                   capture_output=True)
    S = json.load(open(tmp / "s.json"))
    return [(s["offsets"]["from"] / 1000 + a, s["offsets"]["to"] / 1000 + a, norm(s["text"]))
            for s in S["transcription"] if norm(s["text"])]

new = [None] * len(W)
for a in range(len(anchors) - 1):
    k0, t0, _ = anchors[a]; k1, _, t1 = anchors[a + 1]
    ws0, ws1 = st[k0], en[k1 - 1]
    span = max(ws1 - ws0, 1e-3)
    scaled = [(t0 + (st[k] - ws0) / span * (t1 - t0), t0 + (en[k] - ws0) / span * (t1 - t0)) for k in range(k0, k1)]
    got = [None] * (k1 - k0)
    if k1 - k0 > 1:                                    # one-word stretches are already exact
        sw = stretch_words(t0, t1)
        sm = difflib.SequenceMatcher(a=W[k0:k1], b=[w for _, _, w in sw], autojunk=False)
        for i0, j0, m in sm.get_matching_blocks():
            for d in range(m):
                s, e = sw[j0 + d][0], sw[j0 + d][1]
                got[i0 + d] = (min(max(s, t0), t1), min(max(e, t0), t1))
    got[0] = (t0, got[0][1] if got[0] else scaled[0][1])  # the stretch start is exact from the audio
    # fill unmatched words between matched neighbours, by spelling length
    i = 0
    while i < len(got):
        if got[i]: i += 1; continue
        j = i
        while j < len(got) and not got[j]: j += 1
        left = got[i - 1][1] if i > 0 else t0
        right = got[j][0] if j < len(got) else t1
        L = [max(2, len(W[k0 + q])) for q in range(i, j)]; acc = left
        for q, ln in zip(range(i, j), L):
            d = (right - left) * ln / sum(L); got[q] = (acc, acc + d); acc += d
        i = j
    for q in range(1, len(got)):                          # keep words in order
        if got[q][0] < got[q - 1][0]: got[q] = (got[q - 1][0] + 0.04, max(got[q][1], got[q - 1][0] + 0.08))
    for q in range(len(got)): new[k0 + q] = got[q]
for s, (a, b) in zip(segs, new):
    s["offsets"]["from"], s["offsets"]["to"] = int(round(a * 1000)), int(round(b * 1000))
json.dump(J, open(outp, "w"), indent=1)
print(f"{len(anchors) - 2} anchors from {len(pauses)} pauses; voice {voice_start:.2f}-{voice_end:.2f}s")
