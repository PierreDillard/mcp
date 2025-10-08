# GPAC Test Suite MCP Server

A Model Context Protocol (MCP) server that provides intelligent access to the GPAC multimedia framework test suite, enabling AI assistants to understand and generate GPAC command examples based on validated test cases.

---

## Quick Start with Docker (Recommended)

### Prerequisites
- Docker

### 1. Build the Docker image
```bash
docker build -t gpac-testsuite-mcp .
```

### 2. Configure Claude Code

Edit `~/.claude/mcp_servers.json`:

```json
{
  "mcpServers": {
    "gpac-testsuite": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "gpac-testsuite-mcp"]
    }
  }
}
```

Restart Claude Code. The MCP server will be available globally across all projects.

## Local Development

### Prerequisites
- Node.js 18+ and pnpm

### 1. Build
```bash
pnpm install
pnpm run build
```

### 2. Configure Claude Code

Edit `~/.claude/mcp_servers.json`:

```json
{
  "mcpServers": {
    "gpac-testsuite": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"],
      "env": {
        "XML_TESTS_PATH": "/absolute/path/to/all_tests_descriptions.xml",
        "ALIASES_PATH": "/absolute/path/to/aliases.json"
      }
    }
  }
}
```

