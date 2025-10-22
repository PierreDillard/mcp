/** Type definitions for the MCP server */

export type IndexedSubtest = {
  testName: string;
  subtestName: string;
  description: string;
  keywords: string[];
  command?: string;
  file?: string;
  line?: number;
};

export type IndexedTest = {
  name: string;
  description?: string;
  keywords: string[];
  file?: string;
  subtests: IndexedSubtest[];
};

export type CmdItem = {
  test: string;
  subtest: string;
  desc?: string;
  command: string;
  score: number;
  file?: string;
  line?: number;
};

export type ValidationResult = {
  valid: boolean;
  stderr: string;
};

export type OptionInfo = {
  filter: string;
  option: string;
  desc: string;
};

/**
 * Metadata for MCP tool registration
 * Used to provide additional context about tool documentation and visibility
 */
export type ToolMeta = {
  /** Path to internal documentation file relative to project root */
  internalDocs?: string;
  /** Visibility level of the tool (internal, public, experimental, etc.) */
  visibility?: "internal" | "public" | "experimental" | "deprecated";
  /** Additional custom metadata fields */
  [key: string]: unknown;
};
