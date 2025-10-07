# Docker Usage Guide - Claude Code

## 🏗️ Build the Docker image

```bash
docker build -t gpac-testsuite-mcp:latest .
```

**Build time:** ~10-15 minutes (GPAC compilation from source)

---

## 🚀 Setup with Claude Code

### 1. Register the MCP server

```bash
claude mcp add gpac-testsuite \
  --command docker \
  --args run,-i,--rm,-v,$(pwd):/workspace:rw,gpac-testsuite-mcp:latest
```

### 2. Verify installation

```bash
claude mcp list
```

You should see `gpac-testsuite` in the list.

### 3. Test the MCP

Start Claude Code and ask:
```
How do I create DASH segments with 1 second duration?
```

Claude will automatically use the MCP tools to find GPAC commands.

---

## 🔧 Advanced Configuration

### With custom test suite XML

```bash
claude mcp add gpac-testsuite \
  --command docker \
  --args run,-i,--rm,-v,/path/to/all_tests_descriptions.xml:/app/all_tests_descriptions.xml:ro,-v,$(pwd):/workspace:rw,gpac-testsuite-mcp:latest
```

### With media files workspace

The default configuration mounts `$(pwd)` as `/workspace` in the container, allowing you to:
- Process local media files
- Execute GPAC commands on your files
- Extract/analyze media safely in Docker

**Example workflow:**
```bash
cd /path/to/your/videos
claude code

# In Claude Code:
# "Extract audio from video.mp4 to mono MP3 at 44.1kHz"
# MCP will execute: gpac -i /workspace/video.mp4 ...
```

---

## 📋 Available MCP Tools

Once registered, Claude Code can use these tools:

1. **`find_commands_by_goal`** - Find GPAC commands from natural language
2. **`validate_gpac_command`** - Validate command syntax
3. **`get_filter_help`** - Get GPAC filter documentation
4. **`execute_gpac_command`** - Execute commands in sandbox (NEW)

---

## 🌐 Push to Registry (Optional)

Share the image with your team:

```bash
# Tag for GitHub Container Registry
docker tag gpac-testsuite-mcp:latest ghcr.io/youruser/gpac-testsuite-mcp:latest

# Login to registry
echo $GITHUB_TOKEN | docker login ghcr.io -u youruser --password-stdin

# Push
docker push ghcr.io/youruser/gpac-testsuite-mcp:latest
```

Users can then use it directly:

```bash
claude mcp add gpac-testsuite \
  --command docker \
  --args run,-i,--rm,-v,$(pwd):/workspace:rw,ghcr.io/youruser/gpac-testsuite-mcp:latest
```

---

## 🔍 Image Info

- **Base**: `node:22.12-alpine`
- **GPAC version**: Latest master (built from source)
- **Size**: ~150-200 MB (compressed)
- **Tools included**: `gpac`, `MP4Box`, Node.js 22.12
- **Architecture**: Multi-platform (amd64, arm64)

### Build multi-platform

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t gpac-testsuite-mcp:latest --push .
```

---

## 🛠️ Troubleshooting

### MCP not found in Claude Code

```bash
# Restart Claude Code
claude mcp restart

# Check logs
docker logs $(docker ps -q --filter ancestor=gpac-testsuite-mcp:latest)
```

### Permission issues with mounted files

```bash
# Run with current user
claude mcp add gpac-testsuite \
  --command docker \
  --args run,-i,--rm,--user,$(id -u):$(id -g),-v,$(pwd):/workspace:rw,gpac-testsuite-mcp:latest
```

### Update the image

```bash
# Rebuild
docker build -t gpac-testsuite-mcp:latest .

# Restart MCP
claude mcp restart gpac-testsuite
```

---

## 📝 Environment Variables

- `XML_TESTS_PATH`: Path to test descriptions (default: `/app/all_tests_descriptions.xml`)
- `ALIASES_PATH`: Path to aliases config (default: `/app/aliases.json`)
- `NODE_ENV`: Node environment (default: `production`)
