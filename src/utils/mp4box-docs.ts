/** MP4Box documentation - indexed once at startup */

import { execSync } from "child_process";

type MP4BoxFlag = {
  flag: string;
  group: string;
  desc: string;
};

// Global MP4Box indexes
const FLAG_INDEX = new Map<string, MP4BoxFlag[]>();
const GROUPS = ["import", "dash", "hint"] as const;
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
 * Build complete MP4Box flag index (runs once at startup)
 */
export function buildMP4BoxIndex(): void {
  if (INDEXED) return;

  for (const group of GROUPS) {
    try {
      const output = execSync(`MP4Box -h ${group}`, {
        encoding: "utf-8",
        timeout: 5000,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, LANG: "C", LC_ALL: "C", COLUMNS: "200" }
      });

      parseMP4BoxHelp(output, group);
    } catch (error: any) {
      console.error(`[MP4BOX-DOCS] Failed to index ${group}:`, error.message);
    }
  }

  INDEXED = true;
  console.error(`[MP4BOX-DOCS] Indexed ${FLAG_INDEX.size} flags`);
}

/**
 * Parse MP4Box help output for a specific group
 */
function parseMP4BoxHelp(output: string, group: string): void {
  const cleaned = stripAnsi(output);
  const lines = cleaned.split("\n");

  for (const line of lines) {
    // Match flags like "-add", "-dash", ":sbr", ":asemode", etc.
    const flagMatch = line.match(/^\s*(-[\w-]+|:[\w-]+)\s+(.+)/);
    if (flagMatch) {
      const flag = flagMatch[1];
      const desc = normalizeWhitespace(flagMatch[2]);

      if (!FLAG_INDEX.has(flag)) {
        FLAG_INDEX.set(flag, []);
      }

      FLAG_INDEX.get(flag)!.push({ flag, group, desc });
    }
  }
}

/**
 * Check if a flag is valid for MP4Box
 */
export function isMP4BoxFlag(flag: string): boolean {
  if (!INDEXED) buildMP4BoxIndex();
  return FLAG_INDEX.has(flag);
}

/**
 * Get info about a specific MP4Box flag
 */
export function getMP4BoxFlagInfo(flag: string): MP4BoxFlag[] {
  if (!INDEXED) buildMP4BoxIndex();
  return FLAG_INDEX.get(flag) || [];
}

/**
 * Check if command is MP4Box (vs gpac)
 */
export function isMP4BoxCommand(command: string): boolean {
  return command.trim().startsWith("MP4Box");
}
