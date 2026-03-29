# ─── Stage 1: deps ───────────────────────────────────────────────────────────
FROM oven/bun:1.2-alpine AS deps

WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

# ─── Stage 2: preprocess + build ─────────────────────────────────────────────
FROM deps AS builder

WORKDIR /app

COPY . .

# PUBLIC_MAPBOX_TOKEN must be available at build time because SvelteKit
# inlines $env/static/public values into the client bundle.
# Pass it as a build arg: docker build --build-arg PUBLIC_MAPBOX_TOKEN=pk.xxx
ARG PUBLIC_MAPBOX_TOKEN
ENV PUBLIC_MAPBOX_TOKEN=$PUBLIC_MAPBOX_TOKEN

# Run CSV preprocessing to generate static/data/districts.json
# The raw CSV files must be present in static/data/raw/ before building.
RUN bun scripts/preprocess.ts

# Build the SvelteKit app (adapter-node output goes to ./build)
RUN bun run build

# ─── Stage 3: production runner ──────────────────────────────────────────────
FROM oven/bun:1.2-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Only copy what the Node adapter needs at runtime
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json

# Install only production runtime deps
RUN bun install --production --frozen-lockfile

EXPOSE 3000

# Runtime env vars that should NOT be baked into the image:
#   ANTHROPIC_API_KEY
#   GOOGLE_GENERATIVE_AI_API_KEY
#   AI_PROVIDER
# Inject these via: docker run -e ANTHROPIC_API_KEY=... or a .env file.

CMD ["bun", "build/index.js"]