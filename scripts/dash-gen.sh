#!/usr/bin/env bash
set -euo pipefail
# Exemple simplifié de packaging DASH avec MP4Box
: "${MEDIA_DIR:=./media}"
: "${TEMP_DIR:=./out}"
mkdir -p "$TEMP_DIR"
MP4Box -dash 2000 -frag 2000 -rap -profile cmaf -out "$TEMP_DIR/stream.mpd" "$MEDIA_DIR/input_bigbuck_bunny_360p.mp4"
