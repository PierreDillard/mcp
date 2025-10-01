/** Type definitions for the MCP server */

export type IndexedSubtest = {
  testName: string;
  subtestName: string;
  description: string;
  keywords: string[];
  command?: string;
};

export type IndexedTest = {
  name: string;
  description?: string;
  keywords: string[];
  subtests: IndexedSubtest[];
};

export type CmdItem = {
  test: string;
  subtest: string;
  desc?: string;
  command: string;
  score: number;
};
