"""Captions (1-3 word chunks) and title cards from words.json, written into index.html.
Adapted from animated-shorts/templates/scripts/overlays.py."""
import json, pathlib, re
P = pathlib.Path(__file__).resolve().parent.parent
W = json.loads((P / "words.json").read_text())
T = json.loads((P / "assets" / "timing.js").read_text().split("= ", 1)[1].rstrip().rstrip(";")); D = T["end"]  # video length from the voice
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
    if nxt and norm(w["w"]) == "troll" and norm(nxt["w"]).startswith("duels"): brk = False  # keep the game's name on one caption
    if brk or not nxt: chunks.append(cur); cur = []
KEY = {"filter", "hide", "build", "sentence", "game", "code", "art", "clickers", "copycats", "counterstrike", "exactly",
       "peak", "pirate", "slop", "ripoff", "camera", "photographer", "fun", "troll", "duels", "screen", "banana", "bomb",
       "funny", "video", "ai", "soon", "week", "og", "pet", "follow", "million"}
SKIP = {"july", "2026", "80"}      # chunks shown by a title card instead
STRIP = {"70000"}         # number shown by a card; the rest of the chunk is still captioned
# caption height per shot, by chunk start time: keeps captions off faces and held props
CAPTOP = [  # anchored to words so they follow any voice; the first range that contains a chunk's first word wins
    (at("game") - 0.05, at("no") - 0.02, 1440),            # "game." between the PLAY button and the held card
    (at("no") - 0.02, at("clickers") - 0.03, 1480),        # held CLICK SIM card, crowd, help poster
    (at("so") - 0.05, at("why") - 0.05, 1500),             # close-up of the PIRATE OURS sign: caption below the sign
    (at("camera") - 0.45, at("slop", 3) - 0.45, 1480),     # night shot: maker's face
    (at("slop", 3) - 0.45, at("made") - 0.15, 230),        # close-up with the held card: caption above the head
    (at("flipping") - 0.45, at("dropping") - 0.1, 1480),    # screen flip: spinning faces, dizzy stars
    (at("funny") - 0.1, at("funny") + 0.4, 1480),          # "funny.": launched heads
    (at("limited") - 0.3, at("revealing") + 0.05, 1520),   # crate shots: text ends above ~1630 px, clear of app UI
]
out, tw = [], []
for k, c in enumerate(chunks):
    if any(norm(w["w"]) in SKIP for w in c): continue
    c = [w for w in c if norm(w["w"]) not in STRIP]
    if not c: continue
    s0 = max(0, c[0]["s"] - 0.08); e0 = chunks[k + 1][0]["s"] - 0.08 if k + 1 < len(chunks) else min(D, c[-1]["e"] + 0.3)
    e0 = min(e0, c[-1]["e"] + 0.3)
    if e0 - s0 < 0.12: e0 = s0 + 0.12
    words, i = [], 0
    while i < len(c):  # "Troll Duels" is one unbreakable span so the name never wraps across lines
        w = c[i]
        if i + 1 < len(c) and norm(w["w"]) == "troll" and norm(c[i + 1]["w"]).startswith("duels"):
            words.append(f'<span class="w kw">{w["w"]}&nbsp;{c[i + 1]["w"]}</span>'); i += 2; continue
        words.append(f'<span class="w {"kw" if norm(w["w"]) in KEY else ""}">{w["w"]}</span>'); i += 1
    cid = f"cap{k:03d}"
    top = next((y for a, b, y in CAPTOP if a <= c[0]["s"] < b), None); sty = f' style="top:{top}px"' if top else ""
    out.append(f'<div id="{cid}" class="clip cap" data-start="{s0:.3f}" data-duration="{e0 - s0:.3f}" data-track-index="5"><div class="cin"{sty}>{" ".join(words)}</div></div>')
    tw.append(f'tl.fromTo("#{cid} .cin",{{y:22,opacity:0}},{{y:0,opacity:1,duration:0.13,ease:"power2.out",immediateRender:false}},{s0:.3f});')

# ---- title cards
g, gt = [], []
def clip(id_, s0, dur, inner): g.append(f'<div id="{id_}" class="clip ov" data-start="{s0:.3f}" data-duration="{dur:.3f}" data-track-index="6">{inner}</div>')
def num(id_, t0, t1, big, label, top=None):
    st = f' style="top:{top}px"' if top else ""
    clip(id_, t0 - 0.05, t1 - t0 + 0.05, f'<div class="num"{st}><div class="nn">{big}</div>{f'<div class="nl">{label}</div>' if label else ""}</div>')
    gt.append(f'tl.fromTo("#{id_} .num",{{scale:0.4,opacity:0}},{{scale:1,opacity:1,duration:0.35,ease:"back.out(2.6)",immediateRender:false}},{t0 - 0.05:.3f}); tl.to("#{id_} .num",{{opacity:0,y:-20,duration:0.2}},{t1 - 0.22:.3f});')
def badge(id_, t0, dur, name, role, top=300):
    clip(id_, t0 - 0.1, dur, f'<div class="badge" style="top:{top}px"><div class="pin"></div><div class="bn">{name}</div><div class="br">{role}</div></div>')
    gt.append(f'tl.fromTo("#{id_} .badge",{{scale:0.55,rotation:-9,opacity:0}},{{scale:1,rotation:-3,opacity:1,duration:0.42,ease:"back.out(2.2)",immediateRender:false}},{t0 - 0.1:.3f}); tl.to("#{id_} .badge",{{y:-24,opacity:0,duration:0.22,ease:"power2.in"}},{t0 - 0.1 + dur - 0.24:.3f});')

num("n70", at("70000"), at("filter") - 0.7, "70,000", "", top=190)  # higher, clear of the TOP 100 board header
tj, tb = at("july"), at("build")
clip("year", tj - 0.05, tb - tj - 0.45, '<div class="year" style="top:1060px"><div class="ymask"><div class="yl">JULY</div></div><div class="ymask"><div class="yn">2026</div></div></div>')
gt.append(f'tl.fromTo("#year .yl",{{yPercent:150}},{{yPercent:0,duration:0.45,ease:"expo.out",immediateRender:false}},{tj - 0.05:.3f}); tl.fromTo("#year .yn",{{yPercent:150}},{{yPercent:0,duration:0.5,ease:"expo.out",immediateRender:false}},{tj + 0.12:.3f}); tl.to("#year .year",{{y:-30,opacity:0,duration:0.25,ease:"power2.in"}},{tb - 0.95:.3f});')
badge("bBuild", tb, 1.0, "BUILD", "ROBLOX'S AI GAME MAKER", top=110)  # high and short: clear of the phone's own BUILD header
num("n500", at("half"), at("robloxs") - 0.1, "500,000", "PEOPLE TRIED IT")
badge("bPeak", at("peak"), 1.9, "PEAK", "INDIE GAME · AGGRO CRAB")
num("n80", at("80"), at("ai", 3) - 0.35, "80%", "OF ROBLOX'S TOP 100")
badge("bTD", at("troll"), 1.6, "TROLL DUELS", "MADE ENTIRELY WITH AI", top=680)  # below the arena banner
# (the "THIS VIDEO AI-MADE" stamp was removed: Ben 2026-11-27 "get rid of the buttons completely")
tf, tr = at("first"), at("revealing")
clip("pet", tf - 0.15, tr - tf + 0.05, '<div class="ticket"><span>FIRST WEEK</span><span class="arr">→</span><span>OG PET</span></div>')
gt.append(f'tl.fromTo("#pet .ticket",{{x:-120,opacity:0,rotation:-6}},{{x:0,opacity:1,rotation:-3,duration:0.45,ease:"expo.out",immediateRender:false}},{tf - 0.15:.3f}); tl.to("#pet .ticket",{{x:120,opacity:0,duration:0.25,ease:"power2.in"}},{tr - 0.3:.3f});')
tfo = at("follow")
# end card instead of a + FOLLOW button (Ben: "get rid of the buttons completely but add a follow so you don't miss it at the end");
# up in the empty sky, above the maker's head, held to the last frame
clip("follow", tfo - 0.1, D - tfo + 0.1, '<div class="num" style="top:110px"><div class="nn" style="font-size:180px">FOLLOW</div><div class="nl">SO YOU DON&#39;T MISS IT</div></div>')
gt.append(f'tl.fromTo("#follow .num",{{scale:0.4,opacity:0}},{{scale:1,opacity:1,duration:0.35,ease:"back.out(2.6)",immediateRender:false}},{tfo - 0.1:.3f}); tl.to("#follow .num",{{scale:1.06,duration:0.2,yoyo:true,repeat:3,ease:"sine.inOut"}},{tfo + 0.45:.3f});')

h = html_path.read_text()
# composition length = voice length
h = re.sub(r'(id="(?:root|a-roll-audio|world)"[^>]*?data-duration=")[0-9.]+(")', lambda m: f"{m.group(1)}{D}{m.group(2)}", h)
h = re.sub(r"(tl\.to\(\{ v: 0 \}, \{ v: 1, duration: )[0-9.]+", lambda m: f"{m.group(1)}{D}", h)
h = re.sub(r"<!-- OVERLAYS -->.*?<!-- /OVERLAYS -->", "<!-- OVERLAYS -->\n" + "\n".join(out + g) + "\n      <!-- /OVERLAYS -->", h, flags=re.S)
h = re.sub(r"// OVTWEENS.*?// /OVTWEENS", "// OVTWEENS\n      " + "\n      ".join(tw + gt) + "\n      // /OVTWEENS", h, flags=re.S)
html_path.write_text(h); print(len(chunks), "caption chunks;", len(g), "cards")
