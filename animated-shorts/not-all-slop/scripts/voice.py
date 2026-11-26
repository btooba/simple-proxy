"""Narration with the free local Kokoro voice (full-precision model, no paid AI).
The whole script is read in one continuous pass so the delivery flows across sentences,
and tricky words get fixed pronunciations:
  Roblox -> "ROH-blocks" (the default dictionary says "RAH-blocks")
  A.I.   -> read as "AI" (with dots it paused after each letter)
  O.G.   -> "oh-jee" in one go (with dots it paused; without, it said "og")
Usage:
  voice.py <voice> <speed>                      -> assets/voice_raw.wav + lines.json
  voice.py <voice> <speed> --sample <out.wav>   -> short sample with the tricky words
  voice.py --phonemes                           -> print the phonemes of every line (check fixes)"""
import json, os, pathlib, re, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
from kokoro_onnx.tokenizer import Tokenizer

P = pathlib.Path(__file__).resolve().parent.parent
M = pathlib.Path(os.environ.get("VIDEO_TOOLS", "/opt/video-tools")) / "models"
SR = 24000
FIX = [("ɹˈɑːblɑːks", "ɹˈoʊblɑːks")]          # Roblox, Roblox's (suffix stays)
WORD_FIX = {"og": "ˌoʊdʒˈiː"}                 # whole phoneme words, matched after cleaning
tok = Tokenizer()

def text_for_voice(line):
    line = re.sub(r"A\.I\.(?=\s+[A-Z]|\s*$)", "AI.", line)   # sentence-final A.I. keeps its full stop
    return line.replace("A.I.", "AI").replace("O.G.", "OG")

def phonemes(line):
    ph = tok.phonemize(text_for_voice(line), "en-us")
    for a, b in FIX: ph = ph.replace(a, b)
    # replace whole phoneme words (keep trailing punctuation)
    out = []
    for w in ph.split(" "):
        core = w.rstrip(".,?!:;")
        if text_for_voice(line).lower().count(" og ") and core == "ˈɑːɡ": w = WORD_FIX["og"] + w[len(core):]
        out.append(w)
    return " ".join(out)

def lines():
    return [l.strip() for l in (P / "spoken.txt").read_text().splitlines() if l.strip()]

def speak(k, text_lines, voice, speed):
    ph = " ".join(phonemes(l) for l in text_lines)
    a, sr = k.create(ph, voice=voice, speed=speed, is_phonemes=True, sentence_pause=0.16, clause_pause=0.06)
    on = np.where(np.abs(a) > 0.01)[0]
    return a[max(0, on[0] - int(0.02 * SR)): on[-1] + int(0.08 * SR)]

if __name__ == "__main__":
    if sys.argv[1] == "--phonemes":
        for l in lines(): print(phonemes(l))
        sys.exit()
    voice, speed = sys.argv[1], float(sys.argv[2])
    k = Kokoro(str(M / "kokoro-v1.0.onnx"), str(M / "voices-v1.0.bin"))
    L = lines()
    if "--sample" in sys.argv:
        out = sys.argv[sys.argv.index("--sample") + 1]
        pick = [L[0], L[2], L[8], L[14]]   # Roblox x3, AI x2, Troll Duels
        sf.write(out, speak(k, pick, voice, speed), SR); sys.exit()
    a = speak(k, L, voice, speed)
    sf.write(P / "assets" / "voice_raw.wav", a, SR)
    t = len(a) / SR; words = sum(len(l.split()) for l in L)
    (P / "lines.json").write_text(json.dumps({"voice": voice, "speed": speed, "duration": round(t, 3), "lines": [{"i": i, "text": l} for i, l in enumerate(L)]}, indent=1))
    print(f"{t:.2f}s  {words} words  {words / t:.2f} words/s")
