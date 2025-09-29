import fs from "fs/promises";
import { XMLParser } from "fast-xml-parser";

export type XmlSubtest = { name: string; desc?: string; command: string; keywords?: string[] };
export type XmlTest = { name: string; desc?: string; keywords?: string[]; subtests: XmlSubtest[] };

export interface EnrichedXmlTest extends XmlTest {
  enrichedKeywords: string[];
  fullDescription: string;
  subtestSummary: string;
}

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
        command: subtest.command
      }))
    });
  }
  
  return results.sort((a, b) => a.name.localeCompare(b.name));
}
export function getXmlTest(name: string): EnrichedXmlTest | null {
  const basicTest = TESTS[name] ?? null;
  if (!basicTest) {
    return null;
  }

  const enrichedKeywords = new Set<string>();
  const descriptions: string[] = [];

  // Add keywords from the main test
  if (basicTest.keywords && Array.isArray(basicTest.keywords)) {
    basicTest.keywords.forEach(kw => enrichedKeywords.add(kw.toLowerCase()));
  }

  // Add main test description if it exists
  if (basicTest.desc) {
    descriptions.push(basicTest.desc);
    // Extract implicit keywords from main description
    const wordsInDesc = basicTest.desc.match(/\b(\w+)\b/g);
    if (wordsInDesc) {
      wordsInDesc.forEach(word => {
        if (word.length > 2 && isNaN(parseInt(word))) {
          enrichedKeywords.add(word.toLowerCase());
        }
      });
    }
  }

  // Process subtests to aggregate their information
  const subtestDescriptions: string[] = [];
  if (basicTest.subtests && Array.isArray(basicTest.subtests)) {
    basicTest.subtests.forEach(subtest => {
      // Extract keywords from subtest name
      if (subtest.name) {
        const wordsInName = subtest.name.match(/\b(\w+)\b/g);
        if (wordsInName) {
          wordsInName.forEach(word => {
            if (word.length > 2 && isNaN(parseInt(word))) {
              enrichedKeywords.add(word.toLowerCase());
            }
          });
        }
      }

      // Extract keywords from subtest description
      if (subtest.desc) {
        subtestDescriptions.push(subtest.desc);
        const wordsInDesc = subtest.desc.match(/\b(\w+)\b/g);
        if (wordsInDesc) {
          wordsInDesc.forEach(word => {
            if (word.length > 2 && isNaN(parseInt(word))) {
              enrichedKeywords.add(word.toLowerCase());
            }
          });
        }
      }

      // Extract keywords from command (technical terms)
      if (subtest.command && typeof subtest.command === 'string') {
        // Look for common technical patterns in GPAC/MP4Box commands
        const technicalTerms = subtest.command.match(/(?:^|\s)(-\w+|:\w+|\w+:\w+|[A-Z]{2,}|\w+(?:_\w+)+)/g);
        if (technicalTerms) {
          technicalTerms.forEach(term => {
            const cleanTerm = term.trim().toLowerCase();
            if (cleanTerm.length > 1) {
              enrichedKeywords.add(cleanTerm);
            }
          });
        }
      }
    });
  }

  return {
    ...basicTest,
    enrichedKeywords: Array.from(enrichedKeywords),
    fullDescription: descriptions.join(' '),
    subtestSummary: subtestDescriptions.join('; ')
  };
}

export function buildDryRunScript(name: string) {
  const t = getXmlTest(name);
  if (!t) throw new Error(`Unknown XML test: ${name}`);
  const out: string[] = [];
  out.push(`# Repro for: ${t.name}`);
  if (t.desc) out.push(`# ${t.desc}`);
  out.push(`set -e`);
  out.push(`: "\${MEDIA_DIR:=./media}"`);
  out.push(`: "\${EXTERNAL_MEDIA_DIR:=./external_media}"`);
  out.push(`: "\${TEMP_DIR:=./out}"`);
  out.push(`mkdir -p "$TEMP_DIR"\n`);
  t.subtests.forEach((s, i) => {
    out.push(`# Subtest ${i+1}: ${s.name}${s.desc ? " — " + s.desc : ""}`);
    if (!s.command) {
      out.push("# No command available");
      out.push("");
      return;
    }
    const cmd = String(s.command)
      .replace(/\bout\//g, `"$TEMP_DIR"/`)
      .replace(/\bMP4Box\b/g, `"${process.env.MP4BOX || 'MP4Box'}"`)
      .replace(/\bgpac\b/g, `"${process.env.GPAC || 'gpac'}"`);

    out.push(cmd);
    out.push("");
  });
  return out.join("\n");
}
