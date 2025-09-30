# GPAC Test Suite MCP Server

A Model Context Protocol (MCP) server that provides intelligent access to the GPAC multimedia framework test suite, enabling AI assistants to understand and generate GPAC command examples based on validated test cases.

---

## Quick Start with Claude Code

### Prerequisites
- Node.js 18+ and pnpm  
- Basic familiarity with MCP configuration  

### 1. Clone and Build
```bash
git clone <repository-url>
cd mcp
pnpm install
pnpm run build
````

### 2. Configure Claude Code

Register the MCP server globally:

```bash
claude mcp add gpac-testsuite \
  --env XML_TESTS_PATH=/absolute/path/to/all_tests_descriptions.xml \
  --env SCRIPTS_DIR=/absolute/path/to/scripts \
  -- /absolute/path/to/node /absolute/path/to/mcp/dist/index.js
```

