# NOTES — "Not All Slop" animated short

Skill: github.com/brinderr/animated-shorts (cloned to /home/user/brinderr/animated-shorts in the cloud session).

## Progress
- [x] Step 0 setup: Node 22, FFmpeg 6.1, yt-dlp, whisper.cpp + base.en, HyperFrames 0.9.86 (in ../../troll-duels-ad/node_modules), three.js 0.181.2 via `npm pack`.
- [x] Render test: the skill's eiffel-tower template renders correctly in the cloud container with software WebGL, ~2.1 s per frame → ~65 min per full 60 s render.
- [x] Step 1: topic from Ben = rise of AI slop games on Roblox + Troll Duels as proof AI games don't have to be slop. No reference link → built-in style. Voice = free local Kokoro (Ben's no-paid-AI rule).
- [x] Step 3: facts checked, script v1 + hook scores in SCRIPT.md.
- [ ] Waiting on Ben: "go" on the script, confirm "swap games" meant "slop games", confirm how AI was used to make Troll Duels and that it's live on Roblox.
- [ ] Step 4 voice + word timings
- [ ] Step 5 build (copy template, replace world/characters/camera/overlays)
- [ ] Step 6 snapshots look check
- [ ] Step 7 sound + render

## Environment notes
- News sites can't be fetched from the cloud session (proxy blocks them); WebSearch works and was used for fact checks.
- YouTube is blocked, so the skill's `ytsearch` "has it been done?" check was replaced with web search.
- Template needs local copies of gsap and three (no CDN at render time).
