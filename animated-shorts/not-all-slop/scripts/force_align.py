"""Exact word timings for a voiceover whose words are known (spoken.txt): CTC forced alignment with the free
wav2vec2-base-960h speech model (ONNX, runs locally, /opt/video-tools/models/w2v, from huggingface Xenova/wav2vec2-base-960h).
Whisper guesses word times while it transcribes (off by up to ~0.9 s here); forced alignment instead finds where each
known letter is said, so every word lands within a few hundredths of a second.
Usage: python force_align.py <voice.wav> <out.json>
Writes whisper.cpp-style JSON ({"transcription": [{"text", "offsets": {"from", "to"}}]}, ms), one entry per spoken.txt word,
so lines_from_words.py and align.py can use it as they are."""
import json, pathlib, re, subprocess, sys, tempfile
import numpy as np, onnxruntime as ort, soundfile as sf

P = pathlib.Path(__file__).resolve().parent.parent
M = pathlib.Path("/opt/video-tools/models/w2v")
wav, outp = sys.argv[1:3]
tmp = pathlib.Path(tempfile.mkdtemp())
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-ac", "1", "-ar", "16000", str(tmp / "v.wav")], check=True)
x, sr = sf.read(tmp / "v.wav", dtype="float32")
vocab = json.load(open(M / "vocab.json"))
BLANK, SEP = vocab["<pad>"], vocab["|"]
HOP = 320                                                     # one output frame = 20 ms

# --- letter probabilities for every 20 ms, in 20 s windows with 1 s of context on each side
sess = ort.InferenceSession(str(M / "model.onnx"), providers=["CPUExecutionProvider"])
inp = sess.get_inputs()[0].name
win, ctx = 20 * sr, 1 * sr
frames = []
for s in range(0, len(x), win):
    a, b = max(0, s - ctx), min(len(x), s + win + ctx)
    seg = x[a:b]; seg = (seg - seg.mean()) / (seg.std() + 1e-7)
    lg = sess.run(None, {inp: seg[None, :].astype(np.float32)})[0][0]
    f0 = (s - a) // HOP; f1 = f0 + (min(s + win, len(x)) - s) // HOP
    frames.append(lg[f0:f1])
lg = np.concatenate(frames)
lp = lg - lg.max(1, keepdims=True); lp = lp - np.log(np.exp(lp).sum(1, keepdims=True))   # log-softmax
T = len(lp)

# --- the known words, spelled the way they are said
tokens = [t for l in (P / "spoken.txt").read_text().splitlines() if l.strip() for t in l.split()]
def letters(tok):
    t = tok.upper().replace("A.I.", "A I").replace("O.G.", "O G").replace("-", " ")
    return [w for w in re.sub(r"[^A-Z' ]", "", t).split() if w]
seq, owner = [], []                                         # label sequence and which token each label belongs to
for i, tok in enumerate(tokens):
    for j, w in enumerate(letters(tok)):
        if seq: seq.append(SEP); owner.append(-1)
        for ch in w: seq.append(vocab[ch]); owner.append(i)
L = len(seq)
ext = np.full(2 * L + 1, BLANK); ext[1::2] = seq             # blank, l1, blank, l2, ..., blank
S = len(ext)
skip = np.zeros(S, bool)
skip[3::2] = ext[3::2] != ext[1:-2:2]                       # may jump over a blank between two different labels

# --- Viterbi: best path through the labels in order
NEG = -1e9
dp = np.full(S, NEG); dp[0] = lp[0, ext[0]]; dp[1] = lp[0, ext[1]]
back = np.zeros((T, S), np.int8)
for t in range(1, T):
    stay = dp
    step = np.concatenate([[NEG], dp[:-1]])
    jump = np.where(skip, np.concatenate([[NEG, NEG], dp[:-2]]), NEG)
    cand = np.stack([stay, step, jump])
    k = cand.argmax(0); back[t] = k
    dp = cand[k, np.arange(S)] + lp[t, ext]
s = int(S - 1 if dp[S - 1] >= dp[S - 2] else S - 2)
path = np.zeros(T, int)
for t in range(T - 1, -1, -1):
    path[t] = s; s -= int(back[t, s])

# --- frames -> word times
st, en = {}, {}
for t, s in enumerate(path):
    if s % 2 == 1:
        i = owner[(s - 1) // 2]
        if i >= 0:
            st.setdefault(i, t); en[i] = t + 1
missing = [tokens[i] for i in range(len(tokens)) if i not in st]
if missing: raise SystemExit(f"words not aligned: {missing}")
ws = [st[i] * HOP / sr for i in range(len(tokens))]; we = [en[i] * HOP / sr for i in range(len(tokens))]
# CTC letter peaks come a little after the sound starts: lead every word by 40 ms (never before the previous word ends),
# and where the voice starts again after a pause (>= 0.12 s below -40 dBFS) use that exact moment.
fr = sr // 100; n = len(x) // fr
db = 20 * np.log10(np.sqrt(np.mean(x[:n * fr].reshape(n, fr) ** 2, axis=1)) + 1e-9)
q = db < -40; pe, i = [], 0
while i < n:
    if q[i]:
        j = i
        while j < n and q[j]: j += 1
        if j - i >= 12 and j < n: pe.append(j / 100)
        i = j
    else: i += 1
for k in range(len(tokens)):
    ws[k] = max(ws[k] - 0.04, we[k - 1] if k else 0.0)
    near = [p for p in pe if abs(p - ws[k]) < 0.2 and (k == 0 or p >= we[k - 1] - 0.02)]
    if near: ws[k] = min(near, key=lambda p: abs(p - ws[k]))
out = [{"text": " " + tok, "offsets": {"from": int(round(ws[i] * 1000)), "to": int(round(we[i] * 1000))}}
       for i, tok in enumerate(tokens)]
json.dump({"transcription": out}, open(outp, "w"), indent=1)
print(f"{len(out)} words aligned over {T * HOP / sr:.1f}s; path score {dp.max() / T:.3f}/frame")
