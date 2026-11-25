#!/bin/bash
# Join the rendered pieces (renders/chunks/c0.mp4, c1.mp4, ...) into renders/not-all-slop.mp4.
# Video is copied as-is; the audio is the original assets/mix.wav, so there are no gaps at the joins.
set -e
cd "$(dirname "$0")/.."
ls renders/chunks/ | grep -E '^c[0-9]+\.mp4$' | sort -V | sed "s|^|file '|; s|$|'|" > renders/chunks/list.txt
for f in $(sed "s/file '\(.*\)'/\1/" renders/chunks/list.txt); do
  echo "$f $(ffprobe -v error -count_frames -select_streams v -show_entries stream=nb_read_frames -of csv=p=0 renders/chunks/$f) frames"
done
ffmpeg -v error -y -f concat -safe 0 -i renders/chunks/list.txt -i assets/mix.wav -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 192k -ar 48000 -movflags +faststart renders/not-all-slop.mp4
echo "joined: $(ffprobe -v error -count_frames -select_streams v -show_entries stream=nb_read_frames -of csv=p=0 renders/not-all-slop.mp4) frames (want 1896)"
