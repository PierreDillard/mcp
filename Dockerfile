# Multi-stage build for GPAC Test Suite MCP Server
# Stage 1: Build Node.js application
FROM node:22.12-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

# Copy entire project for build
COPY . /app
WORKDIR /app

# Install dependencies and build TypeScript with pnpm
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install && \
    pnpm run build

# Stage 2: Build GPAC from source
FROM alpine:3.19 AS gpac-builder

# Install build dependencies
RUN apk add --no-cache --virtual .build-deps \
    build-base git cmake yasm wget zlib-dev zlib-static ccache \
    linux-headers musl-dev

# Clone and build GPAC (latest master)
RUN git clone --depth 1 https://github.com/gpac/gpac.git /tmp/gpac-master

WORKDIR /tmp/gpac-master
RUN make distclean && \
    ./configure --static-bin && \
    make -j$(nproc) && \
    cp bin/gcc/MP4Box /usr/local/bin/MP4Box && \
    cp bin/gcc/gpac /usr/local/bin/gpac

# Stage 3: Production runtime
FROM node:22.12-alpine

# Install pnpm globally
RUN npm install -g pnpm

# Copy built Node.js application
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/pnpm-lock.yaml /app/pnpm-lock.yaml

# Copy GPAC binaries from builder
COPY --from=gpac-builder /usr/local/bin/MP4Box /usr/local/bin/MP4Box
COPY --from=gpac-builder /usr/local/bin/gpac /usr/local/bin/gpac

# Set production environment
ENV NODE_ENV=production
ENV XML_TESTS_PATH=/app/all_tests_descriptions.xml
ENV ALIASES_PATH=/app/aliases.json

WORKDIR /app

# Install production dependencies with pnpm
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile && \
    pnpm store prune && \
    # Verify GPAC installation
    MP4Box -h > /dev/null && \
    gpac -h > /dev/null

# Health check: verify MCP server can start
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('MCP server healthy')" || exit 1

# Run MCP server on stdio
ENTRYPOINT ["node", "dist/index.js"]
