/** GPAC filter documentation - indexed once at startup */

import { execSync } from "child_process";

type OptionInfo = {
  filter: string;
  option: string;
  desc: string;
};

// Global indexes
const OPTION_INDEX = new Map<string, OptionInfo[]>();
const FILTER_SET = new Set<string>();
const GLOBAL_OPTIONS = new Map<string, string>(); // --option → description
let INDEXED = false;

/** Strip ANSI color codes */
function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

/** Normalize whitespace */
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Build complete index from `gpac -ha filters` (runs once)
 */
export function buildIndex(): void {
  if (INDEXED) return;

  try {
    const output = execSync("gpac -ha filters", {
      encoding: "utf-8",
      timeout: 30000,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, LANG: "C", LC_ALL: "C", COLUMNS: "200" }
    });

    parseAllFiltersHelp(output);
    parseGlobalOptions();
    INDEXED = true;
    console.error(`[GPAC-DOCS] Indexed ${OPTION_INDEX.size} options, ${FILTER_SET.size} filters, ${GLOBAL_OPTIONS.size} global opts`);
  } catch (error: any) {
    console.error("[GPAC-DOCS] Failed to index filters:", error.message);
  }
}

/** Parse global GPAC options (--block_size, etc.) */
function parseGlobalOptions(): void {
  try {
    const output = execSync("gpac -h doc", {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, LANG: "C", LC_ALL: "C", COLUMNS: "200" }
    });

    const cleaned = stripAnsi(output);
    const lines = cleaned.split("\n");

    for (const line of lines) {
      const match = line.match(/^\s+(--[\w-]+)\s+(.+)/);
      if (match) {
        GLOBAL_OPTIONS.set(match[1], normalizeWhitespace(match[2]));
      }
    }
  } catch (error: any) {
    console.error("[GPAC-DOCS] Failed to parse global options:", error.message);
  }
}

/** Check if name is a valid GPAC filter */
export function isFilterName(name: string): boolean {
  if (!INDEXED) buildIndex();
  return FILTER_SET.has(name);
}

/**
 * Parse `gpac -ha filters` output to extract filter:option:description
 */
function parseAllFiltersHelp(output: string): void {
  const cleaned = stripAnsi(output);
  const lines = cleaned.split("\n");
  let currentFilter = "";
  let currentOption = "";
  let currentDesc = "";

  const saveOption = () => {
    if (currentOption && currentFilter) {
      if (!OPTION_INDEX.has(currentOption)) {
        OPTION_INDEX.set(currentOption, []);
      }
      OPTION_INDEX.get(currentOption)!.push({
        filter: currentFilter,
        option: currentOption,
        desc: normalizeWhitespace(currentDesc)
      });
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Detect filter name: "filterName: description"
    const filterMatch = line.match(/^([\w-]+):\s*(.*)/);
    if (filterMatch) {
      saveOption();
      currentFilter = filterMatch[1];
      FILTER_SET.add(currentFilter);
      currentOption = "";
      currentDesc = "";
      continue;
    }

    // Detect option: " -optionName (type): description"
    const optionMatch = line.match(/^\s+-?([\w-]+)\s*\([^)]+\):\s*(.*)/);
    if (optionMatch && currentFilter) {
      saveOption();
      currentOption = optionMatch[1];
      currentDesc = optionMatch[2];
      continue;
    }

    // Multi-line continuation: indented lines without option marker
    if (currentOption && line.match(/^\s+\S/) && !line.match(/^\s+-/)) {
      currentDesc += " " + line.trim();
    }
  }

  saveOption(); // Save last option
}

/**
 * Find which filters have a specific option
 */
export function findOptionInFilters(optionName: string): OptionInfo[] {
  if (!INDEXED) buildIndex();
  return OPTION_INDEX.get(optionName) || [];
}

/**
 * Get raw help for specific filter (lazy cached)
 */
const HELP_CACHE = new Map<string, string>();

export function getFilterHelp(filterName: string): string {
  if (HELP_CACHE.has(filterName)) {
    return HELP_CACHE.get(filterName)!;
  }

  try {
    const help = execSync(`gpac -h ${filterName}`, {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"]
    });

    HELP_CACHE.set(filterName, help);
    return help;
  } catch (error: any) {
    return error.stderr?.toString() || `Error: filter '${filterName}' not found`;
  }
}
