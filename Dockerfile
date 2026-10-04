FROM node:22-bookworm-slim AS deps
WORKDIR /app

# better-sqlite3 is a native module. The build tools are only needed in this stage.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --no-audit --no-fund

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run typecheck
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/src ./src
COPY --from=builder --chown=node:node /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=node:node /app/postcss.config.mjs ./postcss.config.mjs
COPY --from=builder --chown=node:node /app/eslint.config.mjs ./eslint.config.mjs
COPY --from=builder --chown=node:node /app/docker-entrypoint.sh ./docker-entrypoint.sh
COPY --from=builder --chown=node:node /app/drizzle.config.json ./drizzle.config.json

RUN mkdir -p /data && chown -R node:node /data
USER node

EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
