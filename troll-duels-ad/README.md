# Troll Duels — Reels/Shorts ad

A 15–30 s vertical (9:16, 30 fps) ad for the Roblox game **Troll Duels**, built from our own
gameplay clips with free local tools. Structure copied from the Duskwood Roblox ad
(twist hook in frame 1 → show it → on-screen meter → payoff → 3 CTAs in the last 7 s).

**Rule: no paid AI generation (any API key / credits) without Ben's explicit yes and the price shown first.**

## Status

| Tool | Version | Tested by |
|---|---|---|
| FFmpeg | 6.1.1 | converted the voice files to MP3, measured loudness |
| whisper.cpp (base.en model) | built from source | transcribed the voice-over word-for-word, "Troll Duels" spelled right |
| yt-dlp | 2026.10.26 | downloaded a test file from GitHub. YouTube/TikTok/Instagram are blocked in cloud sessions |
| Remotion | 4.0.546 | rendered a 3 s 720×1280 test with word-by-word captions + voice |
| HyperFrames | 0.9.86 | rendered a 3 s 1080×1920 test with footage + caption + voice |
| Kokoro voice (free, local) | v1.0 int8 | made the 4 voice samples in `voice/` |

Tools live in `/opt/video-tools` (installed by the cloud environment's setup script).
`npm ci` in this folder installs Remotion + HyperFrames.

## Waiting on Ben

1. **Voice pick**: listen to `voice/af_heart.mp3`, `af_bella.mp3`, `am_puck.mp3`, `am_michael.mp3`
   (whole script, speed 1.15, 19–22 s).
2. **The 12 clips** (list below). Upload them into `clips/` named `01.mp4` … `12.mp4`.
3. **Music** we have rights to (Roblox audio library or YouTube Audio Library), ~115 BPM.

## Script (v2)

See `script.txt` (one spoken line per row — the voice script reads it).

1. In this Roblox game, you get to troll your friends.
2. Before every fight, you pick your trolls.
3. Flip their screen, drop a banana, and watch them slide right off the map.
4. Every bonk fills your elixir, and when it's full, you drop this.
5. Now they're all flying.
6. So grab your whole squad, like this video, and add it to your favorites.
7. The game is called Troll Duels.

Changes from Duskwood: draining SANITY meter → ELIXIR meter that FILLS; monster reveal → Bomb troll.

## The 12 clips (3–5 s each; PC 1080p landscape is fine; hide chat/leaderboard; Studio + bots OK)

| # | Shot | Treatment |
|---|---|---|
| 1 | you holding your animal in an arena, camera behind | full + "YOU" tag |
| 2 | 2–4 players together | PiP + FRIEND tags |
| 3 | troll pick screen | PiP |
| 4 | victim's screen flipping | full |
| 5 | dropping a banana | full |
| 6 | someone slipping off the map | full |
| 7 | bonking with elixir bar visible | PiP + ELIXIR meter |
| 8 | placing the Bomb | full + white flash |
| 9 | bomb launches players | full + "BONK THEM" heading |
| 10 | team in 2v2/3v3 queue | PiP |
| 11 | nice lobby/arena shot | PiP + LIKE/FAVORITE buttons |
| 12 | logo/thumbnail or wide lobby | PiP + big "TROLL DUELS" title + PLAY FREE pill |

## Look

Word-by-word captions (heavy white Montserrat Black, black outline, one coloured keyword, ~60% down
the frame). Picture-in-picture every 3rd–4th shot (rounded white-bordered clip swinging in over a
blurred copy of itself). "YOU"/"FRIEND" pill tags, ELIXIR bar + %, white flash on the bomb, LIKE /
FAVORITE buttons with a tapping hand, "PLAY FREE ON ROBLOX" pill, big game-name title. Cut every ~1.35 s.

## Commands

```bash
# voice-over (writes voice/<name>.wav + .lines.json with per-line timings)
/opt/video-tools/venv/bin/python scripts/make_voice.py --voice af_heart --speed 1.15 --out voice/af_heart

# transcribe (word timings: add -ml 1 -oj)
ffmpeg -i voice/af_heart.wav -ar 16000 -ac 1 /tmp/v16k.wav
whisper-cli -m /opt/video-tools/models/ggml-base.en.bin -f /tmp/v16k.wav
```

## Review checklist (every render, before Ben sees it)

- Captions never cover the action; stay out of top 10% / bottom 20% / right 12% of the frame.
- Caption text = spoken words; appears ≤0.15 s early, leaves ≤0.3 s late.
- Music ≥12 LU quieter than voice; mix about −14 LUFS, true peak ≤ −1 dBTP.
- No black/frozen frames, no mid-word cuts.
- Hook text cap height ≥5% of frame height.
- "Troll Duels" spelled right and on screen during the last line.
- 15–30 s, 9:16, 30 fps.

A separate reviewer (never edits) writes PASS or FAIL with timestamp / problem / fix. Max 3 fix rounds,
then hand over with the open problems listed.
