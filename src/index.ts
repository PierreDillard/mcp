import "dotenv/config";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadXmlTests, listXmlTests, getXmlTest, buildDryRunScript } from "./utils/xml-tests.js";
import { loadScripts, readScriptSegment } from "./utils/scripts-index.js";

const XML_PATH = process.env.XML_TESTS_PATH || "./all_tests_desriptions.xml";
const SCRIPTS_DIR = process.env.SCRIPTS_DIR || "./scripts";

const server = new McpServer({ name: "testsuite-mcp", version: "0.1.0" });

// --- Boot + In-memory Index ---
await loadXmlTests(XML_PATH).then((n: number) => console.error(`[XML] tests: ${n}`));
await loadScripts(SCRIPTS_DIR).then((n: number) => console.error(`[SCRIPTS] files: ${n}`));

/** Lightweight types for the index */
type IndexedSubtest = {
  testName: string;          // e.g. "aac-sbr"
  subtestName: string;       // e.g. "dash"
  description: string;       // subtest description
  keywords: string[];        // test keywords (and/or subtest if you add them later)
  command?: string;          // command line (not returned by default on find side)
};

type IndexedTest = {
  name: string;              // test name
  description?: string;
  keywords: string[];
  subtests: IndexedSubtest[];
};

/** RAM Index */
const testByName = new Map<string, IndexedTest>();
const flatSubtests: IndexedSubtest[] = []; // useful if you want to search at this level

/** Builds the index from listXmlTests() (no need to touch xml-tests.js) */
function buildInMemoryIndex() {
  const allXmlTests = listXmlTests(); // returns an array of "complete" tests
  testByName.clear();
  flatSubtests.length = 0;

  for (const xmlTest of allXmlTests as any[]) {
    const indexedTest: IndexedTest = {
      name: xmlTest.name,
      description: xmlTest.desc ?? "",
      keywords: Array.isArray(xmlTest.keywords) ? xmlTest.keywords : [],
      subtests: (xmlTest.subtests ?? []).map((xmlSubtest: any) => ({
        testName: xmlTest.name,
        subtestName: xmlSubtest.name,
        description: xmlSubtest.desc ?? "",
        keywords: Array.isArray(xmlTest.keywords) ? xmlTest.keywords : [], // reusing for now
        command: xmlSubtest.command
      }))
    };
    testByName.set(indexedTest.name, indexedTest);
    flatSubtests.push(...indexedTest.subtests);
  }
  console.error(`[INDEX] tests: ${testByName.size}, subtests: ${flatSubtests.length}`);
}
buildInMemoryIndex();

/** Search/pagination/summary helpers */
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;
const MAX_DESC_CHARS = 220;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalize(s: string) { return s.toLowerCase(); }


/** Very simple scoring (name > keywords > description) */
function scoreTest(test: IndexedTest, query: string): number {
  const normalizedQuery = normalize(query);
  let score = 0;
  if (normalize(test.name).includes(normalizedQuery)) score += 5;
  if (test.keywords.some(keyword => normalize(keyword).includes(normalizedQuery))) score += 3;
  if ((test.description ?? "").toLowerCase().includes(normalizedQuery)) score += 2;
  // bonus if a subtest name matches
  if (test.subtests.some(subtest => normalize(subtest.subtestName).includes(normalizedQuery))) score += 2;
  return score;
}

/** Lightweight summaries (without Command) to avoid massive payloads */
function toTestSummaries(rows: IndexedTest[], includeSubtests = true) {
  return rows.map(t => ({
    name: t.name,
    desc: (t.description ?? "").slice(0, MAX_DESC_CHARS),
    keywords: t.keywords,
    subtestCount: t.subtests.length,
    subtests: includeSubtests
      ? t.subtests.map(st => ({
          name: st.subtestName,
          desc: (st.description ?? "").slice(0, MAX_DESC_CHARS)
          // no command here (we get it via get_xml_test)
        }))
      : undefined
  }));
}

// --- Tools ---
server.tool(
  "find_tests_by_keywords",
  { 
    keywords: z.array(z.string()).min(1),
    limit: z.number().int().min(1).max(MAX_LIMIT).optional(),
    offset: z.number().int().min(0).optional(),
    include_subtests: z.boolean().optional()
  },
  async ({ keywords, limit = DEFAULT_LIMIT, offset = 0, include_subtests = true }) => {
    const query = keywords.join(" ");
    
    // Search in the index
    const matches = Array.from(testByName.values())
      .map(test => ({ test, score: scoreTest(test, query) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ test }) => test);

    // Pagination
    const total = matches.length;
    const paginatedMatches = matches.slice(offset, offset + limit);
    
    const result = {
      total,
      offset,
      limit,
      returned: paginatedMatches.length,
      tests: toTestSummaries(paginatedMatches, include_subtests)
    };

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }
);

server.tool(
  "list_xml_tests",
  {
    limit: z.number().int().min(1).max(MAX_LIMIT).optional(),
    offset: z.number().int().min(0).optional(),
    include_subtests: z.boolean().optional()
  },
  async ({ limit = DEFAULT_LIMIT, offset = 0, include_subtests = false }) => {
    const allTests = Array.from(testByName.values());
    const total = allTests.length;
    const paginatedTests = allTests.slice(offset, offset + limit);
    
    const result = {
      total,
      offset,
      limit,
      returned: paginatedTests.length,
      tests: toTestSummaries(paginatedTests, include_subtests)
    };

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }
);

server.tool(
  "get_xml_test",
  { name: z.string() },
  async ({ name }) => {
    const t = getXmlTest(name);
    if (!t) throw new Error(`Unknown XML test: ${name}`);
    return {
      content: [{ type: "text", text: JSON.stringify(t, null, 2) }]
    };
  }
);

server.tool(
  "dry_run_xml_test",
  { name: z.string() },
  async ({ name }) => ({
    content: [{ type: "text", text: buildDryRunScript(name) }]
  })
);

/* server.tool(
  "search_scripts",
  { query: z.string().min(2), context: z.number().int().min(0).max(20).optional() },
  async ({ query, context }) => ({
    content: [{ type: "text", text: JSON.stringify(await searchScripts(query, context ?? 3), null, 2) }]
  })
); */

server.tool(
  "read_script",
  { path: z.string(), start_line: z.number().int().min(1), end_line: z.number().int().min(1) },
  async ({ path, start_line, end_line }) => ({
    content: [{ type: "text", text: await readScriptSegment(path, start_line, end_line) }]
  })
);

// ------- Tool one-shot: trouve et renvoie directement des commandes -------
const FIND_MAX_LIMIT = 5;           // on renvoie peu d'options, mais très pertinentes
const FIND_MAX_DESC_CHARS = 180;

server.tool(
  "find_commands_by_goal",
  {
    goal: z.string().min(2),
    limit: z.number().int().min(1).max(10).optional()
  },
  async ({ goal, limit }) => {
    const query = goal.toLowerCase();
    const allTests = Array.from(testByName.values());
    
    // Simple scoring based on goal matching
    const matches = allTests
      .map(test => ({ test, score: scoreTest(test, goal) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    const lim = Math.min(limit ?? FIND_MAX_LIMIT, FIND_MAX_LIMIT);
    
    // Extract commands with context
    type CmdItem = { test: string; subtest: string; desc?: string; command: string; score: number };
    const cmdPool: CmdItem[] = [];
    
    for (const { test } of matches) {
      for (const subtest of test.subtests) {
        const cmd = subtest.command;
        if (!cmd) continue;
        
        // Score based on command content matching goal
        const cmdScore = cmd.toLowerCase().includes(query) ? 10 : 1;
        
        cmdPool.push({
          test: test.name,
          subtest: subtest.subtestName,
          desc: subtest.description,
          command: cmd,
          score: cmdScore
        });
      }
    }

    // Sort and deduplicate
    const seen = new Set<string>();
    const top = cmdPool
      .sort((a, b) => b.score - a.score)
      .filter(x => {
        const key = x.command.trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, lim);

    const items = top.map(c => ({
      title: `${c.test}#${c.subtest}`,
      description: (c.desc || "").slice(0, FIND_MAX_DESC_CHARS),
      command: c.command,
      confidence: c.score > 5 ? "high" : "medium"
    }));

    const hint = items.length > 0
      ? `Found ${items.length} relevant command(s).`
      : `No matching commands found for "${goal}".`;

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          goal,
          results: items,
          note: hint
        }, null, 2)
      }]
    };
  }
);
/* 
server.tool(
  "list_script_files",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(listScriptFiles(), null, 2) }]
  })
); */

// --- Transport (stdio) ---
const transport = new StdioServerTransport();
await server.connect(transport);
