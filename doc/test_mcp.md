# MCP Test - Questions and Answers

## Question: DASH AAC SBR

**Question:** Give me a command line for DASH AAC SBR.

**Answer (via MCP):**

Here is the command line for DASH with AAC SBR:

```bash
MP4Box -dash 1000 -rap sbr.mp4 -out out/sbr.mpd
```

This command creates a DASH with 1000ms segments from an MP4 file containing AAC SBR. To create the source MP4 file with AAC SBR, first use:

```bash
MP4Box -add sbrps_fhg.aac:sbr -new out/sbr.mp4
```

## Question: HEVC Encoding

**Question:** How to use GPAC to re-encode a video in HEVC?

**Answer (via MCP):**

To re-encode a video in HEVC with GPAC, use this command:

```bash
gpac -i input_video.mp4 enc:c=hevc @ -o output.mp4
```

For more control (example with resizing and encoding parameters):

```bash
gpac -i input_video.h264:FID=1 ffsws:osize=512x512:SID=1 @ enc:c=hevc:fintra=1 @ -o output.mp4
```

This command:
- Loads the input video (`-i input_video.h264`)
- Resizes it to 512x512 (`ffsws:osize=512x512`)
- Encodes it in HEVC with an I-frame every second (`enc:c=hevc:fintra=1`)
- Saves the result (`-o output.mp4`)

## Question: RTP Streaming

**Question:** Show an example of GPAC command to stream a video via RTP.

**Answer (via MCP):**

The GPAC test suite does not contain specific examples for RTP streaming in the analyzed XML file.

However, to stream a video via RTP with GPAC, here is the typical command:

```bash
gpac -i input.mp4 @ -o rtp://224.1.1.1:1234
```

To specify codec and parameters:

```bash
gpac -i input.mp4 enc:c=avc:b=1M @ -o rtp://224.1.1.1:1234/:ttl=5
```

This command encodes the video in AVC with 1Mbps bitrate and broadcasts it via multicast RTP with a TTL of 5.

## Question: MKV to MP4 Remuxing

**Question:** Show me how to remux an MKV file to MP4.

**Answer (via MCP):**

The GPAC test suite does not contain specific examples of MKV to MP4 remuxing.

To remux an MKV file to MP4 with GPAC, here is the standard command:

```bash
gpac -i input.mkv -o output.mp4
```

This command copies audio and video streams from MKV container to MP4 without re-encoding.

For more control over tracks:

```bash
MP4Box -add input.mkv#video -add input.mkv#audio -new output.mp4
```

This approach allows specific selection of video and audio tracks from the MKV file.

## Question: Subtitle Import

**Question:** How can I import a subtitle file to include it in an MP4 video?

**Answer (via MCP):**

To import a subtitle file into an MP4 video with GPAC, use this command:

```bash
MP4Box -add subtitle.srt -new output.mp4
```

To add subtitles to an existing MP4 file with video:

```bash
MP4Box -add video.mp4 -add subtitle.srt -new output_with_subs.mp4
```

Or to add subtitles to an existing MP4:

```bash
MP4Box -add subtitle.srt existing_video.mp4
```

Supported subtitle formats include SRT, VTT, TTML, and TX3G. GPAC will automatically convert the format according to the output container.

## Question: DASH Multi-Period Manifest Merging

**Question:** How to merge two existing DASH manifests to create a multi-period presentation?

**Answer (via MCP):**

To merge two existing DASH manifests to create a multi-period presentation with GPAC, here is the command:

```bash
gpac -i manifest1.mpd:#Period=1 -i manifest2.mpd:#Period=2 -o merged.mpd:sigfrag --forward=segb
```

This command:
- Loads the first manifest and assigns it to period 1 (`:#Period=1`)
- Loads the second manifest and assigns it to period 2 (`:#Period=2`)
- Uses the `sigfrag` filter for manifest-only rewrite
- The `--forward=segb` option ensures all dashers forward segment boundaries and template info

To merge a multi-period manifest with a single period manifest:

```bash
gpac -i multi_period.mpd:#PStart=-1 -i single_period.mpd:#PStart=-2 -o final_merged.mpd:sigfrag --forward=segb
```

The `#PStart` markers allow specifying period start indicators to control the order and timing of periods in the final manifest.

## Question: DASH to HLS Conversion with On-the-Fly Encryption

**Question:** Can I take a DASH manifest as input, encrypt its content on-the-fly, and generate a corresponding HLS manifest without re-executing the complete segmentation process?

**Answer (via MCP):**

**Yes, this is possible with GPAC!** 

The test suite shows three main approaches:

### 1. **Direct conversion with on-the-fly encryption**
The `dash_fwd_hls_twores` test demonstrates exactly what you're looking for:

```bash
# Load HLS manifest, encrypt frames and generate DASH
gpac -i orig/file.m3u8:forward=segb cecrypt:cfile=ctr.xml @ -o out/live.mpd

# Or the reverse: DASH to HLS with encryption
gpac -i orig/file.mpd:forward=segb cecrypt:cfile=ctr.xml @ -o out/live.m3u8
```

**Key points:**
- `:forward=segb` : reuses existing segmentation without re-segmenting
- `cecrypt:cfile=ctr.xml` : encrypts on-the-fly according to config file
- Simultaneous manifest format conversion

### 2. **Manifest generation without re-segmentation**
The `dash-gen-manifest*` tests show pure manifest conversion:

```bash
# Generate HLS from existing DASH segments
gpac -i source_dashinit.mp4 -o gen-hls.m3u8:sigfrag

# Or change DASH profile
gpac -i source_dashinit.mp4 -o gen-main.mpd:sigfrag:profile=main
```

**The `:sigfrag` option** indicates that existing segments are preserved.

### 3. **Recommended workflow for your use case**
```bash
# Step 1: Take DASH manifest + segments, encrypt and convert to HLS
gpac -i input.mpd:forward=segb cecrypt:cfile=encryption_config.xml @ -o output.m3u8
```

This command will:
- Read your existing DASH manifest
- Preserve segmentation (`:forward=segb`)
- Encrypt content according to your configuration
- Generate the corresponding HLS manifest

The encryption and conversion happen in a single pass, without complete re-segmentation.

## Question: SDL Audio Debugging

**Question:** How do I debug audio playback issues with SDL?

**Answer (via MCP):**

**Test:** `audio-sdl`

**Input:** Basic SDL audio test setup



**Debugging Commands:**
```bash
# Enable audio debugging
gpac -logs=audio@debug -i input.mp4 aout

# Test SDL audio output specifically
gpac -i input.mp4 aout:drv=sdl

# Debug with verbose logging
gpac -logs=all@debug -i input.mp4 aout:drv=sdl

# Check available audio drivers
gpac -h aout

# Test with specific SDL audio settings
gpac -i input.mp4 aout:drv=sdl:freq=44100:ch=2:bps=16

# Force audio format for debugging
gpac -i input.mp4 aout:drv=sdl:fmt=s16
```

**Key debugging flags:**
- `-logs=audio@debug`: Audio-specific debug logs
- `aout:drv=sdl`: Force SDL audio driver
- `freq/ch/bps`: Override audio parameters
- `fmt`: Force specific audio format

## Question: Auxiliary Content

**Question:** What can I do with auxiliary content?

**Answer (via MCP):**

Based on the GPAC test suite, here's what you can do with auxiliary content:

### Auxiliary Video Tracks
- **Add alpha channels**: Use auxiliary tracks to add alpha (transparency) information to videos
- **MP4 files**: `MP4Box -add video.ivf:hdlr=auxv:alpha -new output.mp4`
- **HEIF images**: `MP4Box -add-image video.ivf:hdlr=auxv:alpha -new output.heif`

The auxiliary content functionality in GPAC allows you to:

1. **Alpha channel support**: Add transparency data as auxiliary tracks
2. **Multi-format support**: Works with both video files (MP4) and image containers (HEIF)  
3. **Flexible input**: Accept various video formats (like AV1 in IVF containers) as auxiliary data

The `hdlr=auxv:alpha` parameter specifies that the auxiliary track contains alpha channel information for transparency effects.

## Question: AVC Stream Export

**Question:** How can an AVC stream contained in an MP4 be exported to a raw bitstream?

**Answer (via MCP):**

To export an AVC stream from an MP4 file to a raw bitstream, use this command:

```bash
MP4Box -raw 1 input.mp4 -out output.avc
```

**Explanation:**
- `-raw 1`: Extracts track 1 (usually the video track) in raw format
- `input.mp4`: Source MP4 file containing the AVC stream
- `-out output.avc`: Output file for the raw AVC bitstream

**Alternative approaches:**
- Extract specific track by ID: `MP4Box -raw <track_id> input.mp4`
- Extract without output file (default naming): `MP4Box -raw 1 input.mp4`

The exported `.avc` file will contain the raw H.264/AVC bitstream that can be played by any AVC-compatible decoder or re-imported into other containers.

## Question: MP4 Playback with Detailed Logs

**Question:** What GPAC command plays an MP4 file while showing detailed logs of I/O operations?

**Answer (via MCP):**

Based on the GPAC test suite examples, here's the command to play an MP4 file while showing detailed logs of I/O operations:

```bash
gpac -logs=all@debug -i input.mp4 vout aout
```

**Key components:**
- `-logs=all@debug`: Enables debug-level logging for all modules
- `-i input.mp4`: Input MP4 file
- `vout`: Video output filter for display
- `aout`: Audio output filter for playback

**Alternative approaches for specific logging:**
```bash
# I/O specific logging
gpac -logs=io@debug -i input.mp4 vout aout

# Network and container logging
gpac -logs=network@debug,container@debug -i input.mp4 vout aout

# Media-specific logging
gpac -logs=media@debug -i input.mp4 vout aout

# Maximum verbosity
gpac -logs=all@info -i input.mp4 vout aout
```

From the test suite examples, GPAC uses this logging syntax throughout for debugging playback and I/O operations during media processing.

*Note: The correct module name for I/O logging should be `mmio@debug`, not `io@debug`.

## Question: DASH with AAC Parametric Stereo Explicit Mode

**Question:** How can you create a DASH presentation (.mpd) with an AAC track in Parametric Stereo explicit mode?

**Answer (via MCP):**

To create a DASH presentation (.mpd) with an AAC track in Parametric Stereo explicit mode:

**Step 1: Import AAC with Parametric Stereo explicit mode**
```bash
MP4Box -add input.aac:psx -new output.mp4
```

**Step 2: Create DASH presentation**
```bash
MP4Box -dash 1000 -rap output.mp4 -out presentation.mpd
```

**Complete workflow:**
```bash
# Import AAC with Parametric Stereo explicit mode
MP4Box -add sbrps_fhg.aac:psx -new out/psx.mp4

# Create DASH with 1000ms segments
MP4Box -dash 1000 -rap psx.mp4 -out out/psx.mpd
```

**Key parameters:**
- `:psx` - Enables Parametric Stereo explicit mode
- `-dash 1000` - Creates DASH with 1000ms segments
- `-rap` - Uses Random Access Points for segmentation

This creates a DASH manifest with AAC Parametric Stereo explicit encoding.

## Question: BT Scene Rendering with Audio Output

**Question:** How can I produce a 44.1 kHz stereo PCM audio output while rendering a BT scene with GPAC?

**Answer (via MCP):**

To produce 44.1 kHz stereo PCM audio output while rendering a BT scene, use:

```bash
gpac -i scene.bt -o audio.pcm:sr=44100:ch=2
```

Or with the audio compositor options:

```bash
gpac -i scene.bt compositor:osr=44100:och=2 -o audio.pcm
```

**Key parameters:**
- `sr=44100` or `osr=44100`: Output sample rate (44.1 kHz)
- `ch=2` or `och=2`: Output channels (stereo)

If you need to resample existing audio while rendering:

```bash
gpac -i scene.bt resample:osr=44100:och=2 -o audio.pcm
```

## Question: DASH Stream with 1-Second Segments

**Question:** How do I create a DASH stream with 1-second segments?

**Answer (via MCP):**

The validated command is:

```bash
MP4Box -dash 1000 -out out/test.mpd input.hevc -profile main --muxtype=raw --sfile
```

This creates DASH with **1000ms (1 second) segments**. Key parameters:
- `-dash 1000`: 1-second segment duration
- `-profile main`: DASH main profile
- `-out out/test.mpd`: Output manifest path
- `input.hevc`: Your input video file

For typical MP4 inputs (not raw bitstream), use:
```bash
MP4Box -dash 1000 -out manifest.mpd video.mp4
```

## Question: Add AAC Audio with SBR to MP4

**Question:** How can I add AAC audio with SBR to an MP4 file?

**Answer (via MCP):**

To add AAC audio with SBR (Spectral Band Replication) to an MP4 file, use one of these commands:

**SBR implicit mode:**
```bash
MP4Box -add audio.aac:sbr -new output.mp4
```

**SBR explicit mode:**
```bash
MP4Box -add audio.aac:sbrx -new output.mp4
```

**SBR + Parametric Stereo (both implicit):**
```bash
MP4Box -add audio.aac:sbr:ps -new output.mp4
```

**SBR + Parametric Stereo (SBR implicit, PS explicit):**
```bash
MP4Box -add audio.aac:sbr:psx -new output.mp4
```

**SBR explicit + Parametric Stereo implicit:**
```bash
MP4Box -add audio.aac:sbrx:ps -new output.mp4
```

**Key parameters:**
- `:sbr` - Enables SBR implicit mode
- `:sbrx` - Enables SBR explicit mode
- `:ps` - Enables Parametric Stereo implicit mode
- `:psx` - Enables Parametric Stereo explicit mode

The `-new` flag creates a new MP4 file with the AAC+SBR audio track.

## Question: Add Alpha Channel as Auxiliary Track

**Question:** How can I add an alpha channel as an auxiliary track?

**Answer (via MCP):**

To add an alpha channel as an auxiliary track in GPAC:

**For MP4 video files:**
```bash
MP4Box -add video.ivf:hdlr=auxv:alpha -new output.mp4
```

**For HEIF image files:**
```bash
MP4Box -add-image video.ivf:hdlr=auxv:alpha -new output.heif
```

**Key parameters:**
- `:hdlr=auxv` - Sets handler type to auxiliary video
- `:alpha` - Specifies this is alpha channel data
- The input file (e.g., `.ivf` containing AV1 video) contains the alpha/transparency information

This allows you to add transparency data as auxiliary tracks, supporting alpha channels in both video files (MP4) and image containers (HEIF).

## Question: Force Stereo Channel Configuration When Adding AAC

**Question:** How do I force stereo channel configuration when adding AAC?

**Answer (via MCP):**

To force stereo channel configuration when adding AAC to MP4, use the **`asemode`** option:

**Force stereo (2 channels):**
```bash
MP4Box -add audio.aac:asemode=v0-2 -new output.mp4
```

**Available `asemode` values:**
- `v0-bs`: Use MPEG AudioSampleEntry v0 with channel count from bitstream (default)
- `v0-2`: Use MPEG AudioSampleEntry v0 and **force channel count to 2 (stereo)**
- `v1`: Use MPEG AudioSampleEntry v1 with channel count from bitstream
- `v1-qt`: Use QuickTime Sound Sample Description Version 1 with channel count from bitstream

The `:asemode=v0-2` option forces the channel count to 2 (stereo) regardless of the actual channel configuration in the AAC bitstream.

## Question: How do I play audio using SDL output in GPAC?

**Question:** How do I play audio using SDL output in GPAC?

**Answer (via MCP):**

To play audio using SDL output in GPAC, use the `aout` filter with the SDL driver:

```bash
gpac -i input.mp4 aout:drv=SDL
```

**With additional parameters:**
```bash
# Set volume and buffer size
gpac -i audio.mp4 aout:drv=SDL:vol=80:buffer=300

# Adjust playback speed
gpac -i audio.mp4 aout:drv=SDL:speed=1.5

# Set stereo pan (0-100, 50 = centered)
gpac -i audio.mp4 aout:drv=SDL:pan=30

# Multiple parameters
gpac -i audio.mp4 aout:drv=SDL:vol=80:buffer=200:speed=1.0:pan=50
```

**Key `aout` parameters:**
- `drv=SDL`: Use SDL audio driver
- `vol=100`: Volume percentage (0-100)
- `buffer=200`: Playout buffer in ms
- `speed=1.0`: Playback speed
- `pan=50`: Stereo pan (0=left, 50=center, 100=right)
- `bnum=2`: Number of audio buffers
- `bdur=100`: Total duration of all buffers in ms