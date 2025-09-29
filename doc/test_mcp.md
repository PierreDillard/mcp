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