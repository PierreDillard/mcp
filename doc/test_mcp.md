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