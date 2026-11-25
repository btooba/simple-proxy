"""Captions (1-3 word chunks) and title cards from words.json, written into index.html.
Adapted from animated-shorts/templates/scripts/overlays.py."""
import json, pathlib, re
P = pathlib.Path(__file__).resolve().parent.parent
W = json.loads((P / "words.json").read_text()); D = 63.2
html_path = P / "index.html"
norm = lambda w: re.sub(r"[^a-z0-9]", "", w.lower())
def at(word, n=1):
    k = 0
    for w in W:
        if norm(w["w"]) == word:
            k += 1
            if k == n: return w["s"]
    raise SystemExit("no word " + word)

# ---- caption chunks: up to 3 words / ~18 chars, break after punctuation or a pause
chunks, cur = [], []
for i, w in enumerate(W):
    cur.append(w); text = " ".join(x["w"] for x in cur); nxt = W[i + 1] if i + 1 < len(W) else None
    brk = w["w"][-1] in ".,?!:" or len(cur) >= 3 or len(text) >= 16 or (nxt and nxt["s"] - w["e"] > 0.35)
    if nxt and len(text + " " + nxt["w"]) > 20: brk = True
    if brk or not nxt: chunks.append(cur); cur = []
KEY = {"filter", "hide", "build", "sentence", "game", "code", "art", "clickers", "copycats", "counterstrike", "exactly",
       "peak", "pirate", "slop", "ripoff", "camera", "photographer", "fun", "troll", "duels", "screen", "banana", "bomb",
       "funny", "video", "ai", "soon", "week", "og", "pet", "follow", "million"}
SKIP = {"70000", "2026", "80"}
out, tw = [], []
for k, c in enumerate(chunks):
    if any(norm(w["w"]) in SKIP for w in c): continue
    s0 = max(0, c[0]["s"] - 0.08); e0 = chunks[k + 1][0]["s"] - 0.08 if k + 1 < len(chunks) else min(D, c[-1]["e"] + 0.3)
    e0 = min(e0, c[-1]["e"] + 0.3)
    if e0 - s0 < 0.12: e0 = s0 + 0.12
    words = [f'<span class="w {"kw" if norm(w["w"]) in KEY else ""}">{w["w"]}</span>' for w in c]
    cid = f"cap{k:03d}"
    out.append(f'<div id="{cid}" class="clip cap" data-start="{s0:.3f}" data-duration="{e0 - s0:.3f}" data-track-index="5"><div class="cin">{" ".join(words)}</div></div>')
    tw.append(f'tl.fromTo("#{cid} .cin",{{y:22,opacity:0}},{{y:0,opacity:1,duration:0.13,ease:"power2.out",immediateRender:false}},{s0:.3f});')

# ---- title cards
g, gt = [], []
def clip(id_, s0, dur, inner): g.append(f'<div id="{id_}" class="clip ov" data-start="{s0:.3f}" data-duration="{dur:.3f}" data-track-index="6">{inner}</div>')
def num(id_, t0, t1, big, label):
    clip(id_, t0 - 0.05, t1 - t0 + 0.05, f'<div class="num"><div class="nn">{big}</div><div class="nl">{label}</div></div>')
    gt.append(f'tl.fromTo("#{id_} .num",{{scale:0.4,opacity:0}},{{scale:1,opacity:1,duration:0.35,ease:"back.out(2.6)",immediateRender:false}},{t0 - 0.05:.3f}); tl.to("#{id_} .num",{{opacity:0,y:-20,duration:0.2}},{t1 - 0.22:.3f});')
def badge(id_, t0, dur, name, role, top=300):
    clip(id_, t0 - 0.1, dur, f'<div class="badge" style="top:{top}px"><div class="pin"></div><div class="bn">{name}</div><div class="br">{role}</div></div>')
    gt.append(f'tl.fromTo("#{id_} .badge",{{scale:0.55,rotation:-9,opacity:0}},{{scale:1,rotation:-3,opacity:1,duration:0.42,ease:"back.out(2.2)",immediateRender:false}},{t0 - 0.1:.3f}); tl.to("#{id_} .badge",{{y:-24,opacity:0,duration:0.22,ease:"power2.in"}},{t0 - 0.1 + dur - 0.24:.3f});')

num("n70", at("70000"), at("filter") - 0.7, "70,000", "NEW GAMES")
tj, tb = at("july"), at("build")
clip("year", tj - 0.05, tb - tj - 0.45, '<div class="year"><div class="ymask"><div class="yl">JULY</div></div><div class="ymask"><div class="yn">2026</div></div></div>')
gt.append(f'tl.fromTo("#year .yl",{{yPercent:150}},{{yPercent:0,duration:0.45,ease:"expo.out",immediateRender:false}},{tj - 0.05:.3f}); tl.fromTo("#year .yn",{{yPercent:150}},{{yPercent:0,duration:0.5,ease:"expo.out",immediateRender:false}},{tj + 0.12:.3f}); tl.to("#year .year",{{y:-30,opacity:0,duration:0.25,ease:"power2.in"}},{tb - 0.75:.3f});')
badge("bBuild", tb, 1.5, "BUILD", "ROBLOX'S AI GAME MAKER")
num("n500", at("half"), at("robloxs") - 0.1, "500,000", "PEOPLE TRIED IT")
badge("bPeak", at("peak"), 1.9, "PEAK", "INDIE GAME · AGGRO CRAB")
num("n80", at("80"), at("see") - 0.35, "80%", "OF ROBLOX'S TOP 100")
badge("bTD", at("troll"), 1.6, "TROLL DUELS", "MADE ENTIRELY WITH AI")
ta, td = at("also"), at("did")
clip("stamp", ta - 0.05, td - ta + 0.05, '<div class="stamp"><div class="s1">THIS VIDEO</div><div class="s2">AI-MADE</div></div>')
gt.append(f'tl.fromTo("#stamp .stamp",{{scale:2.2,rotation:-14,opacity:0}},{{scale:1,rotation:-7,opacity:1,duration:0.22,ease:"power4.in",immediateRender:false}},{ta - 0.05:.3f}); tl.to("#stamp .stamp",{{opacity:0,duration:0.15}},{td - 0.15:.3f});')
tf, tr = at("first"), at("revealing")
clip("pet", tf - 0.15, tr - tf + 0.05, '<div class="ticket"><span>FIRST WEEK</span><span class="arr">→</span><span>OG PET</span></div>')
gt.append(f'tl.fromTo("#pet .ticket",{{x:-120,opacity:0,rotation:-6}},{{x:0,opacity:1,rotation:-3,duration:0.45,ease:"expo.out",immediateRender:false}},{tf - 0.15:.3f}); tl.to("#pet .ticket",{{x:120,opacity:0,duration:0.25,ease:"power2.in"}},{tr - 0.3:.3f});')
tfo = at("follow")
clip("follow", tfo - 0.1, D - tfo + 0.1, '<div class="follow">+ FOLLOW</div>')
gt.append(f'tl.fromTo("#follow .follow",{{scale:0.3,opacity:0}},{{scale:1,opacity:1,duration:0.35,ease:"back.out(3)",immediateRender:false}},{tfo - 0.1:.3f}); tl.to("#follow .follow",{{scale:1.08,duration:0.18,yoyo:true,repeat:3,ease:"sine.inOut"}},{tfo + 0.4:.3f});')

h = html_path.read_text()
h = re.sub(r"<!-- OVERLAYS -->.*?<!-- /OVERLAYS -->", "<!-- OVERLAYS -->\n" + "\n".join(out + g) + "\n      <!-- /OVERLAYS -->", h, flags=re.S)
h = re.sub(r"// OVTWEENS.*?// /OVTWEENS", "// OVTWEENS\n      " + "\n      ".join(tw + gt) + "\n      // /OVTWEENS", h, flags=re.S)
html_path.write_text(h); print(len(chunks), "caption chunks;", len(g), "cards")
