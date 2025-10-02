import "dotenv/config";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "fs";

import { loadXmlTests } from "./utils/xml-tests.js";
import { scoreTest, extractAndScoreCommands, deduplicateAndSort } from "./utils/scoring.js";
import { buildInMemoryIndex } from "./utils/indexing.js";
import { validateGpacCommand } from "./utils/gpac-validator.js";
import { buildIndex, findOptionInFilters, getFilterHelp } from "./utils/gpac-docs.js";
import { buildMP4BoxIndex } from "./utils/mp4box-docs.js";
import { cleanCommand } from "./utils/command-cleaner.js";

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
await loadXmlTests(XML_PATH).then((testCount: number) => console.error(`[XML] tests: ${testCount}`));

/** RAM Index */
const testByName = buildInMemoryIndex(aliases);
console.error(`[INDEX] tests: ${testByName.size}`);

// Build GPAC and MP4Box indexes at startup
buildIndex();
buildMP4BoxIndex();

/** Constants */
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 5;

// --- Validation Tool ---
server.registerTool(
  "validate_gpac_command",
  {
    title: "Validate GPAC command syntax",
    description: [
      "Static validation of GPAC/MP4Box commands without executing media.",
      "Checks filter options via 'gpac -h filter.option' and MP4Box switches.",
      "",
      "Returns: {valid: boolean, errors: [{type, filter?, option?, message, suggestion?}]}",
      "",
      "IMPORTANT: Always validate commands before presenting to user."
    ].join("\n"),
    inputSchema: {
      command: z.string().min(1).describe("GPAC/MP4Box command to validate")
    }
  },
  async ({ command }) => {
    const result = validateGpacCommand(command);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }
);

// --- Filter Help Tool ---
server.registerTool(
  "get_filter_help",
  {
    title: "Get GPAC filter documentation",
    description: [
      "Get help for a specific filter or find which filters have a given option.",
      "",
      "Modes:",
      "• filter='<name>' → returns `gpac -h <filter>` output",
      "• option='<name>' → returns list of filters that have this option"
    ].join("\n"),
    inputSchema: {
      filter: z.string().optional().describe("Filter name to get help for"),
      option: z.string().optional().describe("Option name to search across filters")
    }
  },
  async ({ filter, option }) => {
    if (filter) {
      const help = getFilterHelp(filter);
      return {
        content: [{ type: "text", text: help }]
      };
    }

    if (option) {
      const results = findOptionInFilters(option);

      if (results.length === 0) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ error: `No filter found with option '${option}'` }, null, 2)
          }]
        };
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            option,
            filters: results.map(result => ({
              filter: result.filter,
              description: result.desc
            }))
          }, null, 2)
        }]
      };
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({ error: "Provide either 'filter' or 'option' parameter" }, null, 2)
      }]
    };
  }
);

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
      "• All commands are AUTOMATICALLY CLEANED (test artifacts removed) and VALIDATED before returning.",
      "",
      "Command Cleaning (automatic):",
      "• Test files → generic placeholders (counter.hvc → input.hevc, dead_ogg.ogg → input.ogg)",
      "• Test-only options removed (!check_dur, subs_sidx, :dur=, :bandwidth=, pssh=, buf=)",
      "• Original command preserved in 'originalCommand' field if changes made",
      "• Cleaning notes provided in 'cleaningNotes' field",
      "",
      "Outputs:",
      "• { total, valid, invalid, commands: [...valid], invalidCommands?: [...], note } on success",
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

    // Split query into words (simple tokenization)
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);

    // Score all tests
    const rankedTests = Array.from(testByName.values())
      .map(test => ({ test, score: scoreTest(test, queryWords) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ test }) => test);

    if (rankedTests.length === 0) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "NO_MATCH", query }, null, 2) }]
      };
    }

    // Extract and score commands
    const pool = extractAndScoreCommands(rankedTests, queryWords);
    const topCommands = deduplicateAndSort(pool, limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    if (topCommands.length === 0) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "NO_MATCH", query }, null, 2) }]
      };
    }

    // Clean & validate commands before returning
    const commands = topCommands.map(cmd => {
      const { cleaned, changes } = cleanCommand(cmd.command);
      const validation = validateGpacCommand(cleaned);

      return {
        test: cmd.test,
        subtest: cmd.subtest,
        description: (cmd.desc || "").slice(0, 180),
        command: cleaned,
        originalCommand: changes.length > 0 ? cmd.command : undefined,
        cleaningNotes: changes.length > 0 ? changes : undefined,
        confidence: cmd.score >= 3 ? "high" : "medium",
        validated: validation.valid,
        validationErrors: validation.valid ? undefined : validation.errors
      };
    });

    const validCommands = commands.filter(cmd => cmd.validated);
    const invalidCommands = commands.filter(cmd => !cmd.validated);

    return {
      content: [{ type: "text", text: JSON.stringify({
        total: commands.length,
        valid: validCommands.length,
        invalid: invalidCommands.length,
        commands: validCommands,
        invalidCommands: invalidCommands.length > 0 ? invalidCommands : undefined,
        note: `Found ${validCommands.length} valid command(s)${invalidCommands.length > 0 ? ` (${invalidCommands.length} invalid)` : ""}.`
      }, null, 2) }]
    };
  }
);


// --- Transport (stdio) ---
const transport = new StdioServerTransport();
await server.connect(transport);
