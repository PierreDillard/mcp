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
