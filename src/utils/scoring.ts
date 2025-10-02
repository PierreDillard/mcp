/** Simplified scoring: let the LLM handle semantic search */

import { IndexedTest, IndexedSubtest, CmdItem } from "./types.js";

function normalize(text: string): string {
  return text.toLowerCase();
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
 * Simple keyword matching - count how many query words appear
 */
export function scoreTest(test: IndexedTest, queryWords: string[]): number {
  const searchText = buildSearchText(test);
  return queryWords.filter(word => searchText.includes(normalize(word))).length;
}

/**
 * Score command by counting query word matches
 */
export function scoreCommand(
  subtest: IndexedSubtest,
  command: string,
  queryWords: string[]
): number {
  const searchText = buildSubtestSearchText(subtest, command);
  return queryWords.filter(word => searchText.includes(normalize(word))).length;
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
        score: scoreCommand(subtest, subtest.command, queryWords)
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
