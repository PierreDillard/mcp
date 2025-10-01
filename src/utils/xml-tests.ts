import fs from "fs/promises";
import { XMLParser } from "fast-xml-parser";

export type XmlSubtest = { name: string; desc?: string; command: string; keywords?: string[] };
export type XmlTest = { name: string; desc?: string; keywords?: string[]; subtests: XmlSubtest[] };

let TESTS: Record<string, XmlTest> = {};

export async function loadXmlTests(xmlPath: string) {
  const xml = await fs.readFile(xmlPath, "utf8");
  const parser = new XMLParser({ ignoreAttributes: false });
  const root = parser.parse(xml);

  const tests = root?.TestSuiteDescription?.Test ?? root?.Tests ?? root?.test ?? [];
  TESTS = {};
  for (const t of tests) {
    const name = t?.["@_name"] ?? t?.name;
    if (!name) continue;
    const desc = t?.["@_desc"] ?? t?.desc;
    const keywords = String(t?.["@_keywords"] ?? t?.keywords ?? "")
      .split(/\s+/).filter(Boolean);
    const subs = Array.isArray(t?.Subtest) ? t.Subtest : (t?.Subtests?.Subtest ?? []);
    const subtests: XmlSubtest[] = subs.map((s: any) => {
      const command = s?.Command ?? s?.command ?? "";
      const sKeywords = String(s?.["@_keywords"] ?? s?.keywords ?? "")
        .split(/\s+/).filter(Boolean);
      return {
        name: s?.["@_name"] ?? s?.name ?? "sub",
        desc: s?.["@_desc"] ?? s?.desc,
        command: typeof command === 'string' ? command : String(command || ""),
        keywords: sKeywords
      };
    }).filter((x: XmlSubtest) => x.command);
    TESTS[name] = { name, desc, keywords, subtests };
  }
  return Object.keys(TESTS).length;
}

export function listXmlTests(keywords?: string[] | string) {
  const results = [];

  for (const [testName, test] of Object.entries(TESTS)) {
    // Filter by keywords if provided
    if (keywords && keywords.length > 0) {
      const keywordArray = Array.isArray(keywords) ? keywords : [keywords];
      const searchText = [
        testName,
        test.desc || '',
        ...(test.keywords || []),
        ...test.subtests.map(s => s.name + ' ' + (s.desc || ''))
      ].join(' ').toLowerCase();

      const matchesKeywords = keywordArray.some(keyword =>
        searchText.includes(keyword.toLowerCase())
      );

      if (!matchesKeywords) continue;
    }

    results.push({
      name: testName,
      desc: test.desc,
      keywords: test.keywords,
      subtestCount: test.subtests.length,
      subtests: test.subtests.map(subtest => ({
        name: subtest.name,
        desc: subtest.desc,
        command: subtest.command,
        keywords: subtest.keywords
      }))
    });
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}
