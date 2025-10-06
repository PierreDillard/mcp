/**
 * Command Cleaning Utilities
 * Removes test-specific artifacts from GPAC Test Suite commands
 * before presenting them to users.
 */

/** Test-specific files to replace with placeholders */
const TEST_FILES: Record<string, string> = {
  "counter.hvc": "input.hevc",
  "counter.264": "input.h264",
  "counter.mp4": "input.mp4",
  "dead_ogg.ogg": "input.ogg",
  "bifs-all.bt": "scene.bt",
  "counter_30s": "input",
  "test.mp4": "input.mp4",
  "auxiliary_files/": "media/",
  // Generic test placeholders
  "file.ts": "input.ts",
  "file.mp4": "input.mp4",
  "file.mpd": "output.mpd",
  // Test-specific directory patterns
  "myrep/": "segments/",
  "out/": ""
};

/** Test environment variables to remove */
const TEST_ENV_VARS = [
  "$TEMP_DIR/",
  "$EXTERNAL_MEDIA_DIR/",
  "$MEDIA_DIR/"
];

/** Test-only options to remove (not needed for user commands) */
const TEST_OPTIONS = [
  "!check_dur",
  "subs_sidx",
  ":dur=",
  ":bandwidth=",
  "pssh=",
  "buf="
];

/**
 * Clean a GPAC command by removing test artifacts
 */
export function cleanCommand(cmd: string): { cleaned: string; changes: string[] } {
  let cleaned = cmd;
  const changes: string[] = [];

  // Remove test environment variables first
  for (const envVar of TEST_ENV_VARS) {
    if (cleaned.includes(envVar)) {
      cleaned = cleaned.replace(new RegExp(envVar.replace(/\$/g, "\\$"), "g"), "");
      changes.push(`Removed ${envVar}`);
    }
  }

  // Replace test files with placeholders
  for (const [testFile, placeholder] of Object.entries(TEST_FILES)) {
    if (cleaned.includes(testFile)) {
      cleaned = cleaned.replace(new RegExp(testFile, "g"), placeholder);
      changes.push(`Replaced ${testFile} → ${placeholder}`);
    }
  }

  // Remove test-only options
  for (const opt of TEST_OPTIONS) {
    if (cleaned.includes(opt)) {
      const regex = new RegExp(`\\s*${opt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\\s:]*`, "g");
      cleaned = cleaned.replace(regex, "");
      changes.push(`Removed test option: ${opt}`);
    }
  }

  return { cleaned: cleaned.trim(), changes };
}

/**
 * Check if a command appears to be test-instrumented
 */
export function isTestCommand(cmd: string): boolean {
  return TEST_OPTIONS.some(opt => cmd.includes(opt)) ||
         Object.keys(TEST_FILES).some(file => cmd.includes(file));
}
