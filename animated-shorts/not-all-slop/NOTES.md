# NOTES — "Not All Slop" animated short

Skill: github.com/brinderr/animated-shorts (cloned to /home/user/brinderr/animated-shorts in the cloud session).

## Progress
- [x] Step 0 setup: Node 22, FFmpeg 6.1, yt-dlp, whisper.cpp + base.en, HyperFrames 0.9.86 (in ../../troll-duels-ad/node_modules), three.js 0.181.2 via `npm pack`.
- [x] Render test: the skill's eiffel-tower template renders correctly in the cloud container with software WebGL, ~2.1 s per frame → ~65 min per full 60 s render.
- [x] Step 1: topic from Ben = rise of AI slop games on Roblox + Troll Duels as proof AI games don't have to be slop. No reference link → built-in style. Voice = free local Kokoro (Ben's no-paid-AI rule).
- [x] Step 3: facts checked, script v1 + hook scores in SCRIPT.md.
- [x] Ben said go (2026-11-25): Troll Duels made entirely with Claude; not live yet; first-week players get a limited edition OG pet; added a follow CTA.
- [x] Step 4 voice: Kokoro af_heart, speed 1.3, 0.12 s gaps → 62.9 s, 3.6 words/s (`scripts/voice.py`). Word timings: whisper.cpp `-ml 1 -sow -oj` + `scripts/align.py` → words.json; cue times → `assets/timing.js` (`scripts/make_timing.py`).
- [x] Step 5 build: `assets/scene.js` (toy town, slop mountain + filter, Build phone, clicker conveyor, help poster, copier + copycat cat, PEAK devs, TOP 100 board, night crowd, floating Troll Duels arena, OG pet crate). Overlays/captions: `scripts/overlays.py` → index.html.
- [x] Step 6 look check: 2 rounds of snapshots, fixes applied (framing, card timing, floor texture, island height).
- [x] Step 7 sound: music + SFX synthesized in `scripts/make_audio.py` (no licences needed), two-pass loudnorm → assets/mix.wav at -14 LUFS, -1 dBTP.
- [ ] Final render + review

## Rebuild from scratch
```
python scripts/voice.py af_heart 1.3 0.12   # with /opt/video-tools/venv/bin/python
whisper-cli -m /opt/video-tools/models/ggml-base.en.bin -f <voice 16k wav> -ml 1 -sow -oj -of words_raw
python scripts/align.py words_raw.json && python scripts/make_timing.py && python scripts/overlays.py
python scripts/make_audio.py   # then two-pass loudnorm to -14 LUFS / -1.5 dBTP
npx hyperframes render -q delivery -o renders/not-all-slop.mp4
```

## Environment notes
- News sites can't be fetched from the cloud session (proxy blocks them); WebSearch works and was used for fact checks.
- YouTube is blocked, so the skill's `ytsearch` "has it been done?" check was replaced with web search.
- Template needs local copies of gsap and three (no CDN at render time).
