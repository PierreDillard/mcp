/** Scoring utilities for test and command ranking */

import { IndexedTest, IndexedSubtest, CmdItem } from "./types.js";

/**
 * Normalize string for case-insensitive comparison
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Decompose a natural language query into searchable keywords
 */
export function decomposeQuery(query: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'from', 'by', 'via', 'how', 'what', 'when', 'where',
    'why', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may',
    'might', 'must', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'this',
    'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our',
    'their'
  ]);

  return query
    .toLowerCase()
    .split(/[\s,]+|(?:\bwith\b)|(?:\band\b)/)
    .map(keyword => keyword.trim())
    .filter(keyword => keyword.length > 0 && !stopWords.has(keyword));
}

/**
 * Score a test based on how well it matches the query keywords
 */
export function scoreTest(test: IndexedTest, keywords: string[]): number {
  let score = 0;

  // Create unified textual corpus for search
  const testCorpus = [
    normalize(test.name),
    ...test.keywords.map(normalize),
    normalize(test.description ?? ""),
    ...test.subtests.map(subtest => normalize(subtest.subtestName))
  ].join(' ');

  for (const keyword of keywords) {
    const normalizedKeyword = normalize(keyword);
    if (!testCorpus.includes(normalizedKeyword)) {
      continue;
    }

    // Apply weighting for each found keyword
    if (normalize(test.name).includes(normalizedKeyword)) score += 5;
    if (test.keywords.some(kw => normalize(kw).includes(normalizedKeyword))) score += 3;
    if (normalize(test.description ?? "").includes(normalizedKeyword)) score += 2;
    if (test.subtests.some(subtest => normalize(subtest.subtestName).includes(normalizedKeyword))) score += 2;
  }

  // Cumulative bonus if multiple requested keywords are present
  const foundKeywordsCount = keywords.filter(keyword => testCorpus.includes(normalize(keyword))).length;
  if (foundKeywordsCount > 1) {
    score += foundKeywordsCount * 5;
  }

  return score;
}

/**
 * Score a command/subtest based on how well it matches the query
 */
export function scoreCommand(
  subtest: IndexedSubtest,
  command: string,
  queryKeywords: string[],
  originalQuery: string,
  debug = false
): number {
  const commandLower = command.toLowerCase();
  const descLower = (subtest.description || "").toLowerCase();
  const subtestKeywordsLower = (subtest.keywords || []).map(k => k.toLowerCase()).join(' ');
  let score = 0;

  // Count keywords in subtest keywords (most heavily weighted)
  const keywordsInSubtestKw = queryKeywords.filter(keyword => subtestKeywordsLower.includes(keyword));
  score += keywordsInSubtestKw.length * 10;

  // Count keywords in description (heavily weighted)
  const keywordsInDesc = queryKeywords.filter(keyword => descLower.includes(keyword));
  score += keywordsInDesc.length * 8;

  // Count keywords in command (moderately weighted)
  const keywordsInCmd = queryKeywords.filter(keyword => commandLower.includes(keyword));
  score += keywordsInCmd.length * 5;

  // Bonus if description contains the full original query
  if (descLower.includes(originalQuery.toLowerCase())) score += 15;

  // Bonus if command includes the full original query
  if (commandLower.includes(originalQuery.toLowerCase())) score += 10;

  if (debug && (descLower.includes("rtp") || commandLower.includes("rtp") || subtestKeywordsLower.includes("rtp"))) {
    console.error(`[SCORE DEBUG] ${subtest.testName}/${subtest.subtestName}:`);
    console.error(`  Description: "${subtest.description?.substring(0, 80)}..."`);
    console.error(`  Subtest keywords: [${subtest.keywords?.join(", ")}]`);
    console.error(`  Keywords in subtest.keywords: [${keywordsInSubtestKw.join(", ")}] → +${keywordsInSubtestKw.length * 10}`);
    console.error(`  Keywords in desc: [${keywordsInDesc.join(", ")}] → +${keywordsInDesc.length * 8}`);
    console.error(`  Keywords in cmd: [${keywordsInCmd.join(", ")}] → +${keywordsInCmd.length * 5}`);
    console.error(`  Total score: ${score}`);
  }

  // Semantic bonuses (optional, still 100% index-only)
  if (/\b-dash\b|\bcmaf=/.test(commandLower) && queryKeywords.some(keyword => /dash|cmaf|mpd|segment/.test(keyword))) {
    score += 4;
  }
  if (/compositor:|vout\b|png\b|rgb\b/.test(commandLower) && queryKeywords.some(keyword => /render|bifs|png|rgb/.test(keyword))) {
    score += 3;
  }
  if (/inspect:|analy[sz]e=on|dump\b/.test(commandLower) && queryKeywords.some(keyword => /inspect|probe|boxes?/.test(keyword))) {
    score += 2;
  }
  if (/-crypt\b|encryption|cenc/.test(commandLower) && queryKeywords.some(keyword => /encrypt|crypt|cenc|drm/.test(keyword))) {
    score += 4;
  }

  return score;
}

/**
 * Extract and score commands from ranked tests
 */
export function extractAndScoreCommands(
  rankedTests: IndexedTest[],
  queryKeywords: string[],
  originalQuery: string,
  debug = false
): CmdItem[] {
  const pool: CmdItem[] = [];

  for (const testData of rankedTests) {
    for (const subtest of testData.subtests) {
      const command = subtest.command;
      if (!command) continue;

      const score = scoreCommand(subtest, command, queryKeywords, originalQuery, debug);

      pool.push({
        test: testData.name,
        subtest: subtest.subtestName,
        desc: subtest.description,
        command: command,
        score: score
      });
    }
  }

  return pool;
}

/**
 * Deduplicate and sort commands by score
 */
export function deduplicateAndSort(pool: CmdItem[], limit: number, maxLimit: number): CmdItem[] {
  const seenCommands = new Set<string>();
  return pool
    .sort((a, b) => b.score - a.score)
    .filter(cmdItem => {
      const commandKey = cmdItem.command.trim();
      if (seenCommands.has(commandKey)) return false;
      seenCommands.add(commandKey);
      return true;
    })
    .slice(0, Math.min(limit, maxLimit));
}
