# Deploys examples/demo. Built from the repo root so the demo's
# workspace:* dependencies (packages/*) resolve; Bun runs them from src
# via the "bun" export condition, so no package build step is needed.
# Dependencies are installed with pnpm (the repo's manager) in a Node
# stage; the runtime stage stays Bun.
FROM node:22-slim AS deps

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json ./
COPY packages/ai/package.json packages/ai/
COPY packages/core/package.json packages/core/
COPY packages/react/package.json packages/react/
COPY packages/server/package.json packages/server/
COPY examples/demo/package.json examples/demo/
RUN pnpm install --frozen-lockfile

FROM oven/bun:1

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/ai/node_modules ./packages/ai/node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/react/node_modules ./packages/react/node_modules
COPY --from=deps /app/packages/server/node_modules ./packages/server/node_modules
COPY --from=deps /app/examples/demo/node_modules ./examples/demo/node_modules
COPY packages ./packages
COPY examples/demo ./examples/demo

ENV NODE_ENV=production
EXPOSE 3000

WORKDIR /app/examples/demo
CMD ["bun", "run", "src/server.ts"]
