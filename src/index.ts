import "dotenv/config";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "fs";

import { loadXmlTests } from "./utils/xml-tests.js";
import {
  decomposeQuery,
  scoreTest,
  extractAndScoreCommands,
  deduplicateAndSort
} from "./utils/scoring.js";
import { buildInMemoryIndex } from "./utils/indexing.js";

const XML_PATH = process.env.XML_TESTS_PATH || "./all_tests_descriptions.xml";
const ALIASES_PATH = process.env.ALIASES_PATH || "./aliases.json";

// Anti-hallucination mode: only return exact matches from index
const STRICT_MODE = true;

const server = new McpServer({ name: "testsuite-mcp", version: "0.1.0" });

// --- Load aliases ---
let aliases: Record<string, string[]> = {};
try {
  const aliasData = readFileSync(ALIASES_PATH, "utf-8");
  aliases = JSON.parse(aliasData);
  console.error(`[ALIASES] loaded: ${Object.keys(aliases).length} test scripts`);
} catch (err: any) {
  console.error(`[ALIASES] Warning: Could not load aliases.json - ${err.message}`);
}

// --- Boot + In-memory Index ---
await loadXmlTests(XML_PATH).then((n: number) => console.error(`[XML] tests: ${n}`));

/** RAM Index */
const testByName = buildInMemoryIndex(aliases);
console.error(`[INDEX] tests: ${testByName.size}`);

/** Constants */
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 5;

// --- Phase 1: Single Tool ---
server.registerTool(
  "find_commands_by_goal",
  {
    title: "Find GPAC commands by goal",
    description: [
      "Given a natural-language goal (e.g., 'render BIFS text with gradients to PNG', 'DASH 1s from sbrx.mp4'),",
      "return  command lines that exist in the indexed GPAC Test Suite.",
      "",
      "Behavior:",
      "• STRICT: If no exact indexed match is found, return a structured error { error: 'NO_MATCH', query }.",
      "• NEVER invent or paraphrase commands. No fallbacks. No heuristics outside the index.",
      "• When matches exist, return a ranked list of concrete commands with their origin (test/subtest).",
      "",
      "Outputs:",
      "• { total, commands: [{ test, subtest, description, command, confidence }], note? } on success",
      "• { error: 'NO_MATCH', query } on failure"
    ].join("\n"),
    inputSchema: {
      goal: z.string().min(2).describe("User intent in natural language or concise keywords."),
      limit: z.number().int().min(1).max(MAX_LIMIT).optional()
        .describe("Max number of commands to return (default 5)")
    },
  },
  async ({ goal, limit = 5 }) => {
    const query = (goal || "").trim();
    if (!query) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "NO_MATCH", query: goal }, null, 2) }]
      };
    }

    // 1) Decompose query into keywords
    const queryKeywords = decomposeQuery(query);
    console.error(`[DEBUG] Query: "${query}" → Keywords: [${queryKeywords.join(", ")}]`);

    // 2) Find relevant tests using multi-keyword scoring
    const rankedTests = Array.from(testByName.values())
      .map(test => ({ test, score: scoreTest(test, queryKeywords) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ test }) => test);

    console.error(`[DEBUG] Found ${rankedTests.length} tests with score > 0`);
    if (rankedTests.length > 0) {
      console.error(`[DEBUG] Top 3 tests: ${rankedTests.slice(0, 3).map(t => t.name).join(", ")}`);
    }

    // 3) Extract and score commands from ranked tests
    const enableDebug = query.toLowerCase().includes("rtp");
    const pool = extractAndScoreCommands(rankedTests, queryKeywords, query, enableDebug);
    console.error(`[DEBUG] Command pool size: ${pool.length}`);

    if (pool.length > 0) {
      console.error(`[DEBUG] Top 3 commands by score:`);
      pool.slice(0, 3).forEach(cmd => {
        console.error(`  - ${cmd.test}/${cmd.subtest}: score=${cmd.score}`);
      });
    }

    // 4) Sort + deduplicate by command line
    const topCommands = deduplicateAndSort(pool, limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    if (STRICT_MODE && topCommands.length === 0) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "NO_MATCH", query }, null, 2) }]
      };
    }

    if (topCommands.length === 0) {
      // If not STRICT, you could return a graceful empty payload — but in Phase 1, STRICT is recommended.
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "NO_MATCH", query }, null, 2) }]
      };
    }

    // 5) Success payload
    const commands = topCommands.map(cmdItem => ({
      test: cmdItem.test,
      subtest: cmdItem.subtest,
      description: (cmdItem.desc || "").slice(0, 180),
      command: cmdItem.command,
      confidence: cmdItem.score >= 8 ? "high" : "medium"
    }));

    const payload = {
      total: commands.length,
      commands,
      note: `Found ${commands.length} command(s).`
    };

    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
  }
);


// --- Transport (stdio) ---
const transport = new StdioServerTransport();
await server.connect(transport);
