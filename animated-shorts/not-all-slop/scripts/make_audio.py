"""Music + sound effects synthesized in code (no licences, no paid tools), mixed under the voice.
Music sits at least 12 LU under the voice in every section, each effect ~12 dB under the voice's loudest moments, mix at -14 LUFS.
Usage: python make_audio.py  -> assets/mix.wav (48 kHz stereo) + prints levels."""
import json, pathlib, subprocess
import numpy as np, soundfile as sf, pyloudnorm as pyln

P = pathlib.Path(__file__).resolve().parent.parent
SR = 48000
T = json.loads((P / "assets" / "timing.js").read_text().split("= ", 1)[1].rstrip().rstrip(";"))
D = T["end"]  # video length comes from the voice
N = int(SR * D)
BOOM = T["bomb"] + 0.14
rng = np.random.default_rng(7)

# ---------- voice ----------
v48 = P / "assets" / "voice48.wav"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(P / "assets" / "voice_raw.wav"), "-ar", str(SR), "-ac", "1", str(v48)], check=True)
voice, _ = sf.read(v48); voice = np.pad(voice, (0, max(0, N - len(voice))))[:N]
meter = pyln.Meter(SR)
voice *= 10 ** ((-16 - meter.integrated_loudness(voice)) / 20)

def momentary_max(x):
    best = -99
    for i in range(0, len(x) - int(0.4 * SR), int(0.1 * SR)):
        seg = x[i:i + int(0.4 * SR)]
        if np.max(np.abs(seg)) < 1e-4: continue
        try: best = max(best, pyln.Meter(SR, block_size=0.4).integrated_loudness(seg))
        except Exception: pass
    return best
v_mom = momentary_max(voice)

# ---------- synth helpers ----------
def tt(d): return np.arange(int(d * SR)) / SR
def env(d, a=0.005, dec=0.3): t = tt(d); return np.minimum(1, t / a) * np.exp(-t / dec)
def pluck(f, d=0.45, dec=0.18): t = tt(d); return (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t)) * env(d, 0.004, dec)
def noise(d): return rng.uniform(-1, 1, int(d * SR))
def lowpass(x, k=0.08):
    y = np.zeros_like(x); acc = 0.0
    for i in range(len(x)): acc += k * (x[i] - acc); y[i] = acc
    return y
def hp(x): return np.diff(x, prepend=0)
def put(buf, x, t0, g=1.0):
    i = int(t0 * SR)
    if i >= len(buf) or i + len(x) <= 0: return
    j0 = max(0, -i); i = max(0, i); n = min(len(x) - j0, len(buf) - i)
    buf[i:i + n] += g * x[j0:j0 + n]

# ---------- music: 112 BPM, C-G-Am-F, bouncy plucks ----------
bpm = 112; beat = 60 / bpm
CH = [(130.81, [261.6, 329.6, 392.0]), (98.0, [246.9, 293.7, 392.0]), (110.0, [220.0, 261.6, 329.6]), (87.31, [220.0, 261.6, 349.2])]
music = np.zeros(N)
night0, night1, myst0 = T["see"] - 0.3, T["made"] - 0.1, T["so"] - 0.2
kick = np.sin(2 * np.pi * np.cumsum(np.linspace(120, 45, int(0.18 * SR))) / SR) * env(0.18, 0.002, 0.07)
hat = hp(noise(0.05)) * env(0.05, 0.001, 0.012)
clap = lowpass(noise(0.14), 0.35) * env(0.14, 0.002, 0.04)
bell = lambda f: (np.sin(2 * np.pi * f * tt(0.6)) + 0.4 * np.sin(2 * np.pi * 2.01 * f * tt(0.6))) * env(0.6, 0.003, 0.22)
nb = int(D / beat) + 2
for b in range(nb):
    t0 = b * beat; root, tri = CH[(b // 4) % 4]
    night = night0 <= t0 < night1; myst = myst0 <= t0 < night0; arena = t0 >= night1
    if night:
        if b % 4 == 0:  # soft pad chord per bar
            d = 4 * beat; t = tt(d); pad = sum(np.sin(2 * np.pi * f * t) for f in tri) / 3 * np.minimum(1, t / 0.4) * np.minimum(1, (d - t) / 0.4)
            put(music, lowpass(pad, 0.2) * 0.55, t0); put(music, np.sin(2 * np.pi * root * t) * 0.35 * np.minimum(1, t / 0.3) * np.minimum(1, (d - t) / 0.3), t0)
        continue
    if b % 2 == 0: put(music, pluck(root, 0.5, 0.22) * 0.8, t0)
    put(music, pluck(root * 2, 0.3, 0.1) * 0.25, t0 + beat * 0.75)
    for f in tri: put(music, pluck(f, 0.35, 0.09) * 0.22, t0 + beat * 0.5)
    put(music, hat * 0.18, t0); put(music, hat * 0.12, t0 + beat * 0.5)
    if not myst:
        if b % 2 == 0: put(music, kick * 0.9, t0)
        else: put(music, clap * 0.45, t0)
    if arena and b % 2 == 0: put(music, bell(tri[(b // 2) % 3] * 2) * 0.12, t0 + beat * 0.25)
fade = np.ones(N); fl = int(0.35 * SR); fade[-fl:] = np.linspace(1, 0, fl); music *= fade
music *= 10 ** ((-32.5 - meter.integrated_loudness(music)) / 20)  # 16.5 LU under overall so every section stays >= 12 LU under (Ben's rule)

# ---------- sound effects ----------
FX = []  # (signal, time, extra dB)
def sfx(x, t0, db=0.0): FX.append((x, t0, db))
def chirp(f0, f1, d): t = tt(d); return np.sin(2 * np.pi * np.cumsum(np.linspace(f0, f1, len(t))) / SR)
pop = chirp(500, 1300, 0.09) * env(0.09, 0.002, 0.03)
whoosh = lambda d=0.4: lowpass(noise(d), 0.12) * np.sin(np.pi * tt(d) / d) ** 2
click = lowpass(hp(noise(0.012)), 0.45) * env(0.012, 0.0005, 0.003)  # softened: raw high-passed noise rings after AAC encoding
thud = (np.sin(2 * np.pi * 85 * tt(0.25)) * env(0.25, 0.002, 0.07) + 0.5 * lowpass(noise(0.25), 0.3) * env(0.25, 0.001, 0.02))
def chime():
    out = np.zeros(int(0.9 * SR))
    for i, f in enumerate([1046.5, 1318.5, 1568.0, 2093.0]): put(out, bell(f), i * 0.06)
    return out
sfx(pop, T["game"] - 0.03); sfx(chime(), T["game"] + 0.02)
t = T["type"]
while t < T["sentence"] + 0.5: sfx(click, t); t += 0.07 + rng.uniform(0, 0.06)
sfx(whoosh(0.45), T["july"] - 0.3); sfx(whoosh(0.4), T["made"] - 0.6, -3)  # in the pause before "I made" (it masked "made")
sfx(bell(1318.5) + 0.6 * bell(1975.5), T["p80"])
for i in range(3):
    for k in range(200):
        ts = (k - i * 0.37) / 1.7
        if T["everybody"] <= ts < T["slop3"]: sfx(click * 1.4, ts, -9); sfx(click, ts + 0.05, -9)  # crowd shutters, kept well under the voice
k = 0
while True:
    ts = k / 2.2; k += 1
    if ts >= T["everybody"]: break
    if ts >= T["camera"] + 0.68: sfx(click * 1.4, ts, -9); sfx(click, ts + 0.05, -9)  # first shutter after "camera in your phone", so "in" stays clear
sfx(whoosh(0.3), T["flipping"] + 0.32, -6)  # after the word "flipping" (it masked it), with the screen roll
sfx(whoosh(0.3), T["dropping"] - 0.3)
slip = T["dropping"] + 0.55
d = 0.5; tb = tt(d); sfx(np.sin(2 * np.pi * np.cumsum(260 + 160 * np.sin(2 * np.pi * 9 * tb) * np.exp(-tb / 0.25)) / SR) * env(d, 0.003, 0.2), slip)
sfx(chirp(1300, 280, 0.8) * np.minimum(1, tt(0.8) / 0.02) * np.linspace(1, 0.2, int(0.8 * SR)), slip + 0.25)
boom = lowpass(noise(1.2), 0.05) * env(1.2, 0.003, 0.35) * 3 + np.sin(2 * np.pi * np.cumsum(np.linspace(90, 30, int(1.2 * SR))) / SR) * env(1.2, 0.002, 0.25)
sfx(boom, BOOM); sfx(pop, T["bomb"] - 0.75)
sfx(thud, T["exactly"]); sfx(thud, T["also"] + 0.15)
sfx(chime(), T["fun"] - 0.05); sfx(chime(), T["limited"] - 0.1); sfx(thud * 0.8, T["limited"] - 0.12)
for i in range(3): sfx(thud * 0.6, T["revealing"] + i * 0.16)
sfx(whoosh(0.35), T["coming"] - 0.35); sfx(pop, T["follow"] - 0.05)
sfx_bus = np.zeros(N)
v_pk = np.max(np.abs(voice))
target = v_mom - 12
for x, t0, db in FX:
    seg = np.pad(x, (0, max(0, int(0.4 * SR) - len(x))))
    try: l = pyln.Meter(SR, block_size=0.4).integrated_loudness(seg)
    except Exception: l = -70
    g = 10 ** ((target - l) / 20) if l > -70 else 0
    g = min(g, 0.5 * v_pk / max(np.max(np.abs(x)), 1e-9))  # short clicks read quiet over 0.4 s; cap their peak at half the voice's
    put(sfx_bus, x * g * 10 ** (db / 20), t0)

# dip music + effects 6 dB under "I made Troll Duels" (the "d" of "made" is soft in the voice and the arena music starts there)
duck = np.ones(N); i0, i1, rr = int((T["made"] - 0.2) * SR), int((T["made"] + 0.3) * SR), int(0.06 * SR)
duck[i0:i1] = 0.5; duck[i0 - rr:i0] = np.linspace(1, 0.5, rr); duck[i1:i1 + rr] = np.linspace(0.5, 1, rr)
music *= duck; sfx_bus *= duck
mix = voice + music + sfx_bus
# section check: voice vs music short-term loudness (3 s windows, voiced windows only)
st3 = pyln.Meter(SR, block_size=3.0); gaps = []
for i in range(0, N - 3 * SR, SR // 2):
    v, m = voice[i:i + 3 * SR], music[i:i + 3 * SR]
    if np.sqrt(np.mean(v ** 2)) < 0.01: continue
    gaps.append((st3.integrated_loudness(v) - st3.integrated_loudness(m), i / SR))
g_min = min(gaps); print(f"music under voice: smallest 3 s gap {g_min[0]:.1f} LU at {g_min[1]:.1f} s")
mix *= 10 ** ((-17.5 - meter.integrated_loudness(mix)) / 20)
lim = 10 ** (-1.5 / 20); mix = np.where(np.abs(mix) > lim * 0.8, np.sign(mix) * (lim * 0.8 + (lim * 0.2) * np.tanh((np.abs(mix) - lim * 0.8) / (lim * 0.2))), mix)
sf.write(P / "assets" / "mix_pre.wav", np.stack([mix, mix], 1), SR, subtype="PCM_16")

# two-pass loudnorm to -14 LUFS; true-peak target -3 dBTP so the AAC encode stays at or under -1 dBTP
pre, out = str(P / "assets" / "mix_pre.wav"), str(P / "assets" / "mix.wav")
r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", pre, "-af", "lowpass=f=16000,loudnorm=I=-14:TP=-3:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
m = json.loads(r[r.rindex("{"):r.rindex("}") + 1])
ln = f"lowpass=f=16000,loudnorm=I=-14:TP=-3:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", pre, "-af", ln, "-ar", str(SR), "-c:a", "pcm_s16le", out], check=True)
def tp(f):
    e = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", f, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    e = e[e.rindex("Summary"):]; g = lambda k: e.split(k)[1].split()[0]
    return f"{g('I:')} LUFS, true peak {g('Peak:')} dBTP"
(P / "renders").mkdir(exist_ok=True); aac = str(P / "renders" / "mix_test.m4a")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", out, "-c:a", "aac", "-b:a", "192k", aac], check=True)
print(f"mix.wav: {tp(out)} | after AAC encode: {tp(aac)}")
print(f"voice momentary max {v_mom:.1f} LUFS(rel) | music {meter.integrated_loudness(music):.1f} vs voice {meter.integrated_loudness(voice):.1f} | mix {meter.integrated_loudness(mix):.1f} LUFS | {len(FX)} sfx")
