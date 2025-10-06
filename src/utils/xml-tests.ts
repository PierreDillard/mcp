import fs from "fs/promises";
import { XMLParser } from "fast-xml-parser";

export type XmlSubtest = { name: string; desc?: string; command: string; keywords?: string[]; line?: number };
export type XmlTest = { name: string; desc?: string; keywords?: string[]; file?: string; subtests: XmlSubtest[] };

let TESTS: Record<string, XmlTest> = {};

export async function loadXmlTests(xmlPath: string) {
  const xml = await fs.readFile(xmlPath, "utf8");
  const parser = new XMLParser({ ignoreAttributes: false });
  const root = parser.parse(xml);

  const tests = root?.TestSuiteDescription?.Test ?? root?.Tests ?? root?.test ?? [];
  TESTS = {};
  for (const test of tests) {
    const name = test?.["@_name"] ?? test?.name;
    if (!name) continue;
    const desc = test?.["@_desc"] ?? test?.desc;
    const file = test?.["@_file"] ?? test?.file;
    const keywords = String(test?.["@_keywords"] ?? test?.keywords ?? "")
      .split(/\s+/).filter(Boolean);
    const subs = Array.isArray(test?.Subtest) ? test.Subtest : (test?.Subtests?.Subtest ?? []);
    const subtests: XmlSubtest[] = subs.map((subtest: any) => {
      const command = subtest?.Command ?? subtest?.command ?? "";
      const subtestKeywords = String(subtest?.["@_keywords"] ?? subtest?.keywords ?? "")
        .split(/\s+/).filter(Boolean);
      const line = subtest?.["@_line"] ?? subtest?.line;
      return {
        name: subtest?.["@_name"] ?? subtest?.name ?? "sub",
        desc: subtest?.["@_desc"] ?? subtest?.desc,
        command: typeof command === 'string' ? command : String(command || ""),
        keywords: subtestKeywords,
        line: line ? parseInt(String(line), 10) : undefined
      };
    }).filter((subtest: XmlSubtest) => subtest.command);
    TESTS[name] = { name, desc, keywords, file, subtests };
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
        ...test.subtests.map(subtest => subtest.name + ' ' + (subtest.desc || ''))
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
      file: test.file,
      subtestCount: test.subtests.length,
      subtests: test.subtests.map(subtest => ({
        name: subtest.name,
        desc: subtest.desc,
        command: subtest.command,
        keywords: subtest.keywords,
        line: subtest.line
      }))
    });
  }

  return results.sort((first, second) => first.name.localeCompare(second.name));
}
