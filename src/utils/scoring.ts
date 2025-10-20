/** Simplified scoring with basic synonym support */

import { IndexedTest, IndexedSubtest, CmdItem } from "./types.js";

// Basic synonyms for scoring
const SCORING_SYNONYMS: Record<string, string[]> = {
  compress: ["reduce", "optimize", "smaller", "rescale", "scale", "crop", "box_compression"],
  bitrate: ["bandwidth", "rate", "b", "Maxrate", "TargetRate", "DownloadRate", "max_bw", "min_bw"],
  encode: ["transcode", "convert", "enc", "ffenc", "resampler", "tx3g2srt", "ttml2srt"],
  dash: ["segment", "adaptive", "dasher", "dashin", "MPD", "HLS", "ABR", "live", "dynamic"],
  mux: ["merge", "combine", "add", "multiplexer", "mp4mx", "m2tsmx", "ffmx", "gsfmx", "avimx", "oggmx", "bsagg", "tileagg", "remultiplex"],
  encrypt: ["protection", "drm", "cecrypt", "cdcrypt", "CENC", "ProtectionScheme", "PSSH", "CryptInfo", "DecryptInfo", "gcryp"],
};

function normalize(text: string): string {
  return text.toLowerCase();
}

/**
 * Get all word variations (word + synonyms)
 */
function getWordVariations(word: string): string[] {
  const normalized = normalize(word);
  const variations = [normalized];
  if (SCORING_SYNONYMS[normalized]) {
    variations.push(...SCORING_SYNONYMS[normalized]);
  }
  return variations;
}

/**
 * Build searchable text from test data
 */
function buildSearchText(test: IndexedTest): string {
  const parts = [
    test.name,
    test.description || "",
    ...test.keywords,
    ...test.subtests.map(subtest => `${subtest.subtestName} ${subtest.description || ""}`)
  ];
  return normalize(parts.join(" "));
}

/**
 * Build searchable text from subtest data
 */
function buildSubtestSearchText(subtest: IndexedSubtest, command: string): string {
  const parts = [
    subtest.subtestName,
    subtest.description || "",
    ...(subtest.keywords || []),
    command
  ];
  return normalize(parts.join(" "));
}

/**
 * Simple keyword matching with synonym support
 */
export function scoreTest(test: IndexedTest, queryWords: string[]): number {
  const searchText = buildSearchText(test);
  let matches = 0;

  for (const word of queryWords) {
    const variations = getWordVariations(word);
    if (variations.some(v => searchText.includes(v))) {
      matches++;
    }
  }

  return matches;
}

/**
 * Score command by counting query word matches with synonym support
 */
export function scoreCommand(
  subtest: IndexedSubtest,
  command: string,
  queryWords: string[]
): number {
  const searchText = buildSubtestSearchText(subtest, command);
  let matches = 0;

  for (const word of queryWords) {
    const variations = getWordVariations(word);
    if (variations.some(v => searchText.includes(v))) {
      matches++;
    }
  }

  return matches;
}

/**
 * Extract all commands from tests
 */
export function extractAndScoreCommands(
  rankedTests: IndexedTest[],
  queryWords: string[]
): CmdItem[] {
  const pool: CmdItem[] = [];

  for (const test of rankedTests) {
    for (const subtest of test.subtests) {
      if (!subtest.command) continue;

      pool.push({
        test: test.name,
        subtest: subtest.subtestName,
        desc: subtest.description,
        command: subtest.command,
        score: scoreCommand(subtest, subtest.command, queryWords),
        file: subtest.file,
        line: subtest.line
      });
    }
  }

  return pool;
}

/**
 * Deduplicate and sort commands by score
 */
export function deduplicateAndSort(pool: CmdItem[], limit: number, maxLimit: number): CmdItem[] {
  const seen = new Set<string>();
  return pool
    .sort((first, second) => second.score - first.score)
    .filter(cmd => {
      if (seen.has(cmd.command)) return false;
      seen.add(cmd.command);
      return true;
    })
    .slice(0, Math.min(limit, maxLimit));
}
