# Test Queries for GPAC MCP Server

## Basic DASH Commands

### Query 1: Simple DASH segmentation
**Question**: "How do I create DASH segments with 1 second duration?"
**Expected**: Commands with `-dash 1000` pattern from various tests
**Validation**: Should find aac-sbr dash, hevc dash, etc.

### Query 2: DASH with specific profile
**Question**: "Create DASH with live profile"
**Expected**: Commands with `-profile live` or CMAF live patterns
**Validation**: Should prioritize DASH/CMAF tests

### Query 3: DASH low latency
**Question**: "Low latency DASH streaming"
**Expected**: CMAF chunked commands with `cdur` parameter
**Validation**: Should find cmaf-lowlat or similar tests

## Import/Export Operations

### Query 4: Import HEVC
**Question**: "Add HEVC video to MP4"
**Expected**: `MP4Box -add *.hvc -new` or `MP4Box -add *.hevc`
**Validation**: Should return hevc-au-delim test commands

### Query 5: Extract subtitle track
**Question**: "Export WebVTT subtitles from MP4"
**Expected**: Commands with `-raw` or `-dump` for VTT tracks
**Validation**: Should find subtitle export tests

### Query 6: AAC with SBR
**Question**: "Import AAC with SBR parametric stereo"
**Expected**: Commands with `:sbr:ps` or `:sbrx:psx` flags
**Validation**: Should return aac-sbr+ps test variants

## Filtering and Processing

### Query 7: Video encoding
**Question**: "Encode video with GPAC encoder"
**Expected**: `gpac -i input reframer @ enc:c=avc -o output`
**Validation**: Should find encode filter commands

### Query 8: Audio resampling
**Question**: "Resample audio to 44.1kHz"
**Expected**: Commands with `resample` filter and `osr=44100`
**Validation**: Should NOT suggest `compositor:osr` (invalid)

### Query 9: Audio mixing
**Question**: "Mix multiple audio tracks"
**Expected**: Commands with `audiomix` filter
**Validation**: Should find audio composition tests

## Subtitles

### Query 10: VTT to TTML conversion
**Question**: "Convert WebVTT to TTML"
**Expected**: Commands using `vttmerge` or subtitle filters
**Validation**: Should return subtitle format conversion tests

### Query 11: Burn subtitles
**Question**: "Overlay subtitles on video"
**Expected**: Commands with `txtin` filter or compositor
**Validation**: May suggest compositor (lower score unless explicit)

## Inspection and Analysis

### Query 12: Show MP4 structure
**Question**: "Inspect MP4 box structure"
**Expected**: `MP4Box -diso` or `MP4Box -dxml`
**Validation**: Should find inspect/info tests

### Query 13: Media info
**Question**: "Get video codec and resolution"
**Expected**: `MP4Box -info` or `gpac -i file inspect`
**Validation**: Should return info/analyze commands

## Edge Cases

### Query 14: Multi-keyword match
**Question**: "DASH HEVC with subtitles"
**Expected**: High-scoring commands matching all 3 keywords
**Validation**: Score should include multi-keyword bonus

### Query 15: Ambiguous request
**Question**: "Process media file"
**Expected**: Generic/top-scoring commands
**Validation**: Should return diverse command types

### Query 16: Compositor (penalty test)
**Question**: "Render BIFS scene to PNG"
**Expected**: Compositor commands despite -2 score penalty
**Validation**: Should find compositor tests when explicitly relevant

### Query 17: Specific file format
**Question**: "Work with OGG Vorbis audio"
**Expected**: Commands referencing .ogg files (cleaned to input.ogg)
**Validation**: Original test file names should be in cleaningNotes

## Command Cleaning Validation

### Query 18: Test artifacts removal
**Question**: "DASH with bandwidth constraint"
**Expected**: Commands WITHOUT `:bandwidth=`, `!check_dur`, etc.
**Validation**: cleaningNotes should mention removed test options

### Query 19: Generic placeholders
**Question**: "Import HEVC file"
**Expected**: Commands showing `input.hevc` not `counter.hvc`
**Validation**: originalCommand should preserve test file name

### Query 20: User explicit request (no cleaning)
**Question**: "Show me exact test command for aac-sbr import"
**Expected**: Unmodified command with test artifacts (if user asks explicitly)
**Validation**: Should bypass cleaning when user wants exact test command

## Scoring System Validation

### Query 21: Name match priority
**Question**: "aac-sbr"
**Expected**: aac-sbr test should score highest (+5 for name match)
**Validation**: Top result must be exact test name match

### Query 22: Description match
**Question**: "implicit mode parametric stereo"
**Expected**: Tests with description containing these terms (+2 per match)
**Validation**: aac-ps test should rank high

### Query 23: Keyword accumulation
**Question**: "DASH SBR PS"
**Expected**: aac-sbr+ps dash subtest (+5 multi-keyword bonus)
**Validation**: Should beat single-keyword matches

## Special Patterns

### Query 24: CMAF detection
**Question**: "CMAF chunked encoding"
**Expected**: +4 score boost for CMAF pattern
**Validation**: CMAF tests should dominate results

### Query 25: Inspect boost
**Question**: "Analyze MP4 metadata"
**Expected**: +3 score for inspect/analyze pattern
**Validation**: Info/inspect commands should rank highest

---

## Test Execution Protocol

For each query:
1. Call `find_commands_by_goal` with the question
2. Verify top 3 results match expected patterns
3. Check `cleaningNotes` and `originalCommand` fields
4. Validate score calculation matches algorithm
5. Ensure NO hallucinated commands (all from test suite)

## Success Criteria

- ✅ 90%+ queries return relevant commands
- ✅ Multi-keyword queries show bonus scoring
- ✅ Cleaning applied correctly (unless user requests raw)
- ✅ No invented commands (strict index mode)
- ✅ Special patterns (DASH/CMAF/inspect) boost correctly
