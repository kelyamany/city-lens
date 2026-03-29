# ─── Stage 1: deps ───────────────────────────────────────────────────────────
FROM oven/bun:1.2-alpine AS deps

WORKDIR /app

# Only copy package.json — do NOT copy bun.lockb into the install step.
# bun.lockb is platform-specific (generated on macOS/arm64) and its checksums
# fail integrity verification on Alpine Linux amd64. We let Bun resolve fresh.
COPY package.json ./
RUN bun install --no-save

# ─── Stage 2: preprocess + build ─────────────────────────────────────────────
FROM deps AS builder

WORKDIR /app

ARG PUBLIC_MAPBOX_TOKEN
ENV PUBLIC_MAPBOX_TOKEN=$PUBLIC_MAPBOX_TOKEN

# Now copy the full source (node_modules already in /app from deps stage)
COPY . .

RUN bun scripts/preprocess.ts
RUN bun run build

# ─── Stage 3: production runner ──────────────────────────────────────────────
FROM oven/bun:1.2-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json

RUN bun install --production --no-save

EXPOSE 3000

CMD ["bun", "build/index.js"]