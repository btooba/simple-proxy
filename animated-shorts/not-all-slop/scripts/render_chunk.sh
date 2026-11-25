#!/bin/bash
# Render one piece of the short: scripts/render_chunk.sh <index> <start s> <end s>
# Pieces are joined by scripts/join_chunks.sh. Each piece stays well under the 2-hour background limit.
cd "$(dirname "$0")/.."
i=$1; s=$2; e=$3
DO_NOT_TRACK=1 ../../troll-duels-ad/node_modules/.bin/hyperframes render -q delivery --workers=${W:-1} --start=$s --end=$e \
  -o renders/chunks/c$i.mp4 > renders/chunks/c$i.log 2>&1
echo "EXIT $?" >> renders/chunks/c$i.log
