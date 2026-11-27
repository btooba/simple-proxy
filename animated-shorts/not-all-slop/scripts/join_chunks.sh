#!/bin/bash
# Join the rendered pieces (renders/chunks/c0.mp4, c1.mp4, ...) into renders/not-all-slop.mp4 with assets/mix.wav laid over
# the whole video, so there are no audio gaps at the joins.
# SLOW=1.1 scripts/join_chunks.sh plays the rendered picture 1.1x slower (v4: Ben's voice stays exactly as uploaded, and
# every word in it lands at 1.1x its time in the rendered timing). The picture is then re-encoded at 30 fps.
# Without SLOW the video is copied as-is.
set -e
cd "$(dirname "$0")/.."
SLOW=${SLOW:-1}
ls renders/chunks/ | grep -E '^c[0-9]+\.mp4$' | sort -V | sed "s|^|file '|; s|$|'|" > renders/chunks/list.txt
for f in $(sed "s/file '\(.*\)'/\1/" renders/chunks/list.txt); do
  echo "$f $(ffprobe -v error -count_frames -select_streams v -show_entries stream=nb_read_frames -of csv=p=0 renders/chunks/$f) frames"
done
DUR=$(/opt/video-tools/venv/bin/python -c "import soundfile as sf; i = sf.info('assets/mix.wav'); print(f'{i.frames / i.samplerate:.3f}')")
if [ "$SLOW" = "1" ]; then
  ffmpeg -v error -y -f concat -safe 0 -i renders/chunks/list.txt -i assets/mix.wav -map 0:v -map 1:a \
    -c:v copy -c:a aac -b:a 192k -ar 48000 -movflags +faststart renders/not-all-slop.mp4
else
  ffmpeg -v error -y -f concat -safe 0 -i renders/chunks/list.txt -i assets/mix.wav -map 0:v -map 1:a \
    -vf "setpts=$SLOW*PTS,fps=30" -t "$DUR" \
    -c:v libx264 -preset medium -crf 15 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
    -c:a aac -b:a 192k -ar 48000 -movflags +faststart renders/not-all-slop.mp4
fi
echo "joined: $(ffprobe -v error -count_frames -select_streams v -show_entries stream=nb_read_frames -of csv=p=0 renders/not-all-slop.mp4) frames, audio $DUR s (want about $DUR x 30 frames)"
