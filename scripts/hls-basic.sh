#!/usr/bin/env bash
set -euo pipefail
: "${MEDIA_DIR:=./media}"
: "${TEMP_DIR:=./out}"
mkdir -p "$TEMP_DIR"
MP4Box -hls 6 -frag 2000 -segment-name seg_$Number%05d$.m4s -out "$TEMP_DIR/master.m3u8" "$MEDIA_DIR/input_aac.mp4"
