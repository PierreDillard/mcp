/** Index building utilities */

import { IndexedTest } from "./types.js";
import { listXmlTests } from "./xml-tests.js";

/**
 * Builds an in-memory index from XML tests and enriches with aliases
 */
export function buildInMemoryIndex(
  aliases: Record<string, string[]>
): Map<string, IndexedTest> {
  const testByName = new Map<string, IndexedTest>();
  const allXmlTests = listXmlTests();

  for (const xmlTest of allXmlTests as any[]) {
    // Get base keywords from XML
    const baseKeywords = Array.isArray(xmlTest.keywords) ? xmlTest.keywords : [];

    // Enrich with aliases: find matching script name and add its tags
    const scriptName = (xmlTest.file ?? "").replace(/\.sh$/, "");
    const aliasKeywords = aliases[scriptName] ?? [];

    // Merge keywords (deduplicate)
    const enrichedKeywords = [...new Set([...baseKeywords, ...aliasKeywords])];

    const indexedTest: IndexedTest = {
      name: xmlTest.name,
      description: xmlTest.desc ?? "",
      keywords: enrichedKeywords,
      subtests: (xmlTest.subtests ?? []).map((xmlSubtest: any) => ({
        testName: xmlTest.name,
        subtestName: xmlSubtest.name,
        description: xmlSubtest.desc ?? "",
        keywords: Array.isArray(xmlSubtest.keywords) && xmlSubtest.keywords.length
          ? xmlSubtest.keywords
          : enrichedKeywords,
        command: xmlSubtest.command
      }))
    };
    testByName.set(indexedTest.name, indexedTest);
  }

  return testByName;
}
