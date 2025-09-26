# GPAC Test Suite MCP Server

A Model Context Protocol (MCP) server that provides intelligent access to the GPAC multimedia framework test suite, enabling AI assistants to understand and generate GPAC command examples based on validated test cases.

## Overview

This MCP server transforms GPAC's extensive test suite (8,600+ test scripts) into an intelligent assistant that can answer questions about GPAC usage with precise, validated examples. Instead of manually searching through thousands of test files, developers can ask natural language questions and get reliable command-line examples.

### Key Features

- **Semantic Test Search**: Find relevant GPAC tests by keywords and descriptions
- **Command Generation**: Get exact command lines from validated test cases
- **Script Analysis**: Access and analyze shell test scripts with context
- **No Hallucination**: Responses based entirely on real, tested GPAC commands

## Quick Start with Claude Code

### Prerequisites

- Node.js 18+ and pnpm
- [Claude Desktop](https://claude.ai/download) app
- Basic familiarity with MCP configuration

### 1. Clone and Build

```bash
git clone <repository-url>
cd testsuite-mcp
pnpm install
pnpm run build
```

### 2. Configure Claude Desktop

Add this MCP server to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "gpac-testsuite": {
      "command": "node",
      "args": ["/absolute/path/to/testsuite-mcp/dist/index.js"],
      "env": {
        "XML_TESTS_PATH": "/absolute/path/to/testsuite-mcp/all_tests_desriptions.xml",
        "SCRIPTS_DIR": "/absolute/path/to/testsuite-mcp/scripts"
      }
    }
  }
}
```

**Important**: Use absolute paths in the configuration.

### 3. Restart Claude Desktop

Close and reopen Claude Desktop for the configuration to take effect.

### 4. Test the Integration

In Claude Desktop, ask questions like:
- "Show me how to create DASH streaming with GPAC"
- "How to encrypt MP4 files for streaming?"
- "Give me examples of subtitle handling in GPAC"

## Development

### Project Structure

```
├── index.ts              # Main MCP server entry point
├── xml-tests.ts          # XML test descriptions parser
├── scripts-index.ts      # Shell scripts indexer
├── all_tests_desriptions.xml  # Structured test metadata
├── scripts/              # GPAC test shell scripts
└── dist/                 # Compiled JavaScript output
```

### Available MCP Tools

- `list_xml_tests` - List all available XML test names
- `get_xml_test` - Get complete test details with commands
- `find_tests_by_keywords` - Search tests by keywords
- `dry_run_xml_test` - Generate bash script for test reproduction
- `read_script` - Read specific shell script content
- `find_commands_by_goal` - Find commands by describing the goal

### Build Commands

```bash
# Development with hot reload
pnpm run dev

# Build for production
pnpm run build

# Run compiled version
pnpm start
```

### Environment Variables

- `XML_TESTS_PATH`: Path to the XML test descriptions file (default: `./all_tests_desriptions.xml`)
- `SCRIPTS_DIR`: Directory containing shell test scripts (default: `./scripts`)

## Usage Examples

### Basic Questions

**Question**: "How to create DASH streaming?"

**Response**: The assistant will search through test cases and provide exact commands like:
```bash
MP4Box -dash 2000 -frag 1000 -profile live input.mp4 -out manifest.mpd
```

### Advanced Workflows

**Question**: "Can I convert DASH to HLS with encryption without re-segmentation?"

**Response**: Based on test `dash_fwd_hls_twores`, you'll get:
```bash
gpac -i input.mpd:forward=segb cecrypt:cfile=encryption_config.xml @ -o output.m3u8
```

## Technical Architecture

### Data Sources

1. **XML Test Descriptions** (`all_tests_desriptions.xml`): Structured metadata describing test purposes, keywords, and expected outcomes
2. **Shell Scripts** (`scripts/` directory): Actual executable test scripts with environment setup

