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
- [x] Final render + review (2026-11-25). A single 63 s render takes ~2.4 h here and hits the 2-hour background limit, so the video is rendered in 8 s pieces (`scripts/render_chunk.sh`, one browser worker each, ~15-23 min per piece) and joined with the original mix laid over the whole video (`scripts/join_chunks.sh`).
  - Review round 1 (independent reviewer): FAIL. Fixed: captions over faces/held cards (per-shot caption heights), missing "games into" caption, "Troll Duels" split, TROLL DUELS banner text overflowing its canvas and cropped mid-word, AI-MADE stamp and FIRST WEEK ticket over scene text, whoosh masking "flipping", music only ~10 LU under the voice in places, AAC true peak +1 dBTP (synthetic clicks rang after encoding).
  - Review round 2: FAIL on smaller overlaps. Fixed: more caption heights, JULY 2026 card moved off the TOP 100 board, BUILD badge clear of the phone header, cut-in on "coming", COMING SOON sign shrinks away above the captions, shutter clicks 9 dB quieter.
  - Review round 3 (final): one must-fix (crate captions too low for app UI) fixed; restored a lost whoosh; shutter clicks moved off "in".
  - Final numbers: 1080x1920, 30 fps, 63.2 s, -14.1 LUFS, true peak about -2 dBTP after AAC, music >= 12.8 LU under the voice in every 3 s section.
  - Minor items left as they are: copier cat half out of frame at 17.5-19.5 s; "So if AI" crosses the PEAK sign for ~0.2 s at 28.7 s; "top 100" on card, board and caption at 32-33 s; 500,000 card over the phone screen at 12.4-13.7 s; the very short "The" at 39.85 s is hard to hear (weak TTS word); "dropping a / banana," second line reaches ~1660 px at 47.8-48.8 s; a few <0.2 s caption crossings during fast camera moves.

## Voice v2 (2026-11-26): Ben's ElevenLabs voiceover
Ben didn't like the Kokoro voices (choppy, "A. I." gaps, "RAH-blocks"), so he made the narration himself on ElevenLabs
("Larry - High-Energy Social Media Voice"): `assets/voice_src/elevenlabs_larry.mp3`, 91.8 s. The voice skips "You see," so
spoken.txt drops it too (captions = spoken words) and the night-scene cue `see` now starts at "AI is like".
```
whisper-cli -m /opt/video-tools/models/ggml-base.en.bin -f <mp3 as 16k wav> -ml 1 -sow -oj -of src_words
python scripts/pace_voice.py assets/voice_src/elevenlabs_larry.mp3 src_words.json 5.0   # -> assets/voice_raw.wav, 69.9 s
whisper-cli ... -f <voice_raw as 16k wav> -ml 1 -sow -oj -of words_raw
python scripts/lines_from_words.py words_raw.json <voice_raw seconds>   # -> lines.json
python scripts/align.py words_raw.json && python scripts/make_timing.py && python scripts/overlays.py && python scripts/make_audio.py
```
pace_voice.py shortens long pauses and speeds each stretch of speech 1.08-1.28x (slow stretches more), pitch kept.
The video length now comes from the voice (`T.end` in timing.js = 70.2 s); 9 render pieces.

## Rebuild from scratch
```
python scripts/voice.py <voice> <speed>      # with /opt/video-tools/venv/bin/python; needs models/kokoro-v1.0.onnx (full model). The 2026-11-25 render used the older per-sentence version (git history): af_heart 1.3, 0.12 s gaps
whisper-cli -m /opt/video-tools/models/ggml-base.en.bin -f <voice 16k wav> -ml 1 -sow -oj -of words_raw
python scripts/align.py words_raw.json && python scripts/make_timing.py && python scripts/overlays.py
python scripts/make_audio.py   # writes assets/mix.wav (includes the two-pass loudnorm + AAC true-peak check)
# render in 8 s pieces (each ~15-23 min here; run in two batches, a background job stops after 2 hours), then join with the mix:
for p in "0 0 8" "1 8 16" "2 16 24" "3 24 32" "4 32 40" "5 40 48" "6 48 56" "7 56 63.2"; do scripts/render_chunk.sh $p; done
scripts/join_chunks.sh        # -> renders/not-all-slop.mp4
scripts/evidence.sh renders/not-all-slop.mp4 <out-dir>   # review evidence
```

## Environment notes
- News sites can't be fetched from the cloud session (proxy blocks them); WebSearch works and was used for fact checks.
- YouTube is blocked, so the skill's `ytsearch` "has it been done?" check was replaced with web search.
- Template needs local copies of gsap and three (no CDN at render time).
