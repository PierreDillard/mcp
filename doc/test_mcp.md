# MCP Test Queries

## Q: How do I create DASH segments with 1 second duration?

**A:** Use MP4Box with the `-dash` or `-dash-live` option and set segment duration to 1000 milliseconds:

```bash
MP4Box -dash 1000 input.mp4 -out output.mpd
```

For live DASH with 1 second segments:

```bash
MP4Box -dash-live 1000 input.mp4#video input.mp4#audio -out output.mpd
```

The segment duration is specified in milliseconds, so `1000` = 1 second.

## Q: Create DASH with live profile

**A:** Use MP4Box with `-profile live`:

**Static DASH with live profile:**
```bash
MP4Box -dash 1000 -profile live -out output.mpd input.mp4
```

**Dynamic live DASH session:**
```bash
MP4Box -dash-live 2000 -profile live -mpd-refresh 10 -time-shift -1 input.mp4#video input.mp4#audio -out output.mpd
```

Options:
- `-profile live`: Use DASH live profile
- `-mpd-refresh 10`: Update manifest every 10 seconds
- `-time-shift -1`: Keep all segments (no time shift buffer limit)
- `-subdur`: Maximum input duration to dash in live mode
- `-run-for`: Run session for specified milliseconds then exit

## Q: Low latency DASH streaming
**A:** For low latency DASH streaming, use the dashif.ll profile:
```bash
MP4Box -dash 1000 -profile dashif.ll input.mp4 -out output.mpd
```
**For dynamic low latency DASH:**
```bash
MP4Box -dash-live 1000 -profile dashif.ll -mpd-refresh 5 -time-shift 10 input.mp4#video input.mp4#audio -out output.mpd
```
The dashif.ll profile configures DASH-IF low latency mode with optimized settings for minimal delay streaming.

## Q: Resample audio to 44.1kHz

**A:** Use GPAC with the `resample` filter:

```bash
gpac -i input_audio.aac resample:osr=44100:och=2 -o output.pcm
```

**Options:**
- `osr=44100` - output sample rate (44.1kHz)
- `och=2` - output channels (2 for stereo, 1 for mono)

You can also use shorthand notation:
```bash
gpac -i input.aac resample:osr=44.1k:och=1 -o output.pcm
```

## Q: Mix multiple audio tracks

**A:** Use GPAC with the FFmpeg `amix` filter via `ffavf`:

```bash
gpac -i audio1.mp3 -i audio2.mp3 ffavf::f=amix=inputs=2 -o output.aac
```

**Options (in the filter chain):**
- `inputs=N` - number of audio inputs to mix (default: 2, max: 32767)
- `weights="1 1"` - set weight for each input for volume control
- `duration=shortest|longest|first` - how to determine output duration
- `normalize=1` - scale inputs to prevent clipping (default: 1/true)

**Example with custom weights:**
```bash
gpac -i music.mp3 -i voice.mp3 ffavf::f=amix=inputs=2:weights="0.3 1.0" -o mixed.aac
```

Note: Use `::f=` (double colon) to escape the filter options when they contain GPAC separator characters (`:` or `,`).

## Q: Export WebVTT subtitles from MP4

**A:** Use GPAC to extract subtitle tracks to WebVTT format:

```bash
gpac -i input.mp4 -o subtitles.vtt
```

To extract a specific subtitle track by ID:
```bash
gpac -i input.mp4:#trackID=3 -o subtitles.vtt
```

**VTT header injection options:**
```bash
gpac -i input.mp4 writegen:vtth=single -o subtitles.vtt
```

- `vtth=single` - inject VTT header only at first frame (default)
- `vtth=seg` - inject at each non-empty segment
- `vtth=all` - inject at each segment even empty ones

**List tracks to find subtitle track ID:**
```bash
gpac -i input.mp4 -info
```

## Q: CMAF detection

**A:** Use MP4Box to detect CMAF brand and compliance:

```bash
MP4Box -info input.mp4
```

This displays the file's major brand and compatible brands (e.g., `cmf2`, `cmfc` for CMAF).

**For detailed CMAF analysis:**
```bash
gpac -i input.mp4 inspect:deep:analyze=on:log=cmaf_analysis.txt
```

**Check specific CMAF compliance:**
- `cmf2` - CMAF brand for fragmented files
- `cmfc` - CMAF brand for chunked/segment files

The `inspect` filter with `analyze=on` performs deep packet-level analysis and can detect CMAF-specific structures.

## Q: How do I inspect all frames from source with GPAC?

**A:** To inspect all frames from a source file with GPAC, use the **`inspect` filter** with the `deep` option:

```bash
gpac -i input.mp4 inspect:deep:interleave=false:log=inspect.txt
```

**Key options explained:**

- `inspect:deep` - Performs deep inspection of all frames (not just structure)
- `interleave=false` - Outputs each PID sequentially instead of interleaved
- `log=inspect.txt` - Writes results to a file (optional, omit to print to stdout)

**Common variations:**

```bash
# Inspect and print to console
gpac -i input.mp4 inspect:deep

# Inspect first N seconds only
gpac -i input.mp4 inspect:deep:dur=5

# Inspect with full analysis
gpac -i input.mp4 inspect:deep:full:interleave=false
```

This works with any media container (MP4, MKV, MPD, TS, etc.). The `inspect` filter will decode and analyze every frame in the source.

## Q: How do I create HLS session from input using 0.5s fragments in raw formats and redirect output to two different folders?

**A:** To create an HLS session with 0.5s fragments in raw format and output to multiple folders:

```bash
gpac -i input.hevc dasher:cmfc:cdur=0.5:mname=m3u8:muxtype=raw -o hls3/live.m3u8 -o hls4/live.m3u8
```

**Key options explained:**

- `dasher` - DASH/HLS packager filter
- `cmfc` - Use CMAF brand (required for HLS)
- `cdur=0.5` - Fragment duration of 0.5 seconds
- `mname=m3u8` - Generate HLS manifest (`.m3u8` instead of `.mpd`)
- `muxtype=raw` - Output raw format (no MP4 container wrapping)
- `-o hls3/live.m3u8` - First output destination
- `-o hls4/live.m3u8` - Second output destination (clone)

**Variations:**

```bash
# HLS with CMAF fragments (TS format instead of raw)
gpac -i input.mp4 dasher:cmfc:cdur=0.5:mname=m3u8 -o hls1/live.m3u8 -o hls2/live.m3u8

# With explicit segment duration
gpac -i input.hevc dasher:cmfc:cdur=0.5:segdur=2:mname=m3u8:muxtype=raw -o folder1/live.m3u8 -o folder2/live.m3u8
```

The `-o` option can be repeated to clone the output to multiple destinations simultaneously. The folders will be created automatically if they don't exist.

## Q: How do I play a source for 1 second using compositor VR/360 mode?

**A:** To play a source for 1 second using compositor VR/360 mode:

```bash
gpac --noaudio -blacklist=vtbdec,nvdec -mp4c input.mpd#VR -runfor=1000
```

**Key options explained:**

- `--noaudio` - Disable audio output
- `-blacklist=vtbdec,nvdec` - Disable hardware decoders (for consistent behavior)
- `-mp4c` - Use MP4Client/compositor mode
- `input.mpd#VR` - Input file with `#VR` fragment to enable VR/360 mode
- `-runfor=1000` - Run for 1000 milliseconds (1 second)

**Variations:**

```bash
# Play for 0.5 seconds
gpac --noaudio -blacklist=vtbdec,nvdec -mp4c input.mpd#VR -runfor=500

# Play in 2D mode (without VR)
gpac --noaudio -blacklist=vtbdec,nvdec -mp4c input.mpd -runfor=1000

# With audio enabled
gpac -blacklist=vtbdec,nvdec -mp4c input.mpd#VR -runfor=1000
```

The `#VR` fragment identifier tells the compositor to use VR/360 rendering mode for equirectangular or cubemap video.

## Q: How do I add a DIMS file to a new MP4?

**A:** To add a DIMS file to a new MP4, use MP4Box:

```bash
MP4Box -add shapes-circle-01-t.dml -new dims.mp4
```

**Key options explained:**

- `-add` - Add a track to the MP4 file
- `shapes-circle-01-t.dml` - DIMS file to import
- `-new` - Create a new MP4 file

**Variations:**

```bash
# Add DIMS file with compression
MP4Box -add file.dml -new dimz.mp4

# Add multiple files
MP4Box -add video.264 -add audio.aac -add dims.dml -new output.mp4
```

**Note:** The `-new` switch may not be available in all MP4Box versions. If it fails, try without `-new`:

```bash
MP4Box -add file.dml dims.mp4
```

## Q: How do I split each temporal sublayer of each layer of input HEVC in separate tracks?

**A:** To split each temporal sublayer of each layer of input HEVC into separate tracks, use GPAC with the `bssplit` filter:

```bash
gpac -i shvc.265 bssplit:ltid=all @ -o scal_split.mp4
```

**Key options explained:**

- `bssplit` - Bitstream splitter filter
- `ltid=all` - Split **all** temporal sublayers of each layer into separate tracks
- `@` - Process all input PIDs

**Variations:**

```bash
# Split only specific temporal IDs (e.g., 1 and 2 across all layers)
gpac -i shvc.265 bssplit:ltid=.1,.2 @ -o scal_split.mp4

# Split specific layer+temporal combinations (layer 0, temporal IDs 1 and 2)
gpac -i shvc.265 bssplit:ltid=0.1,0.2 @ -o scal_split.mp4
```

**To reverse the process** (aggregate back into single track):

```bash
gpac -i scal_split.mp4 bsagg @ -o scal_agg.mp4
```

**Note:** This also works for SVC (H.264/AVC Scalable Video Coding) - just replace the input with your `.264` file.