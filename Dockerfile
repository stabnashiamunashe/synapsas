# syntax=docker/dockerfile:1
# Multi-stage build for the ZimStat Approvals Next.js app (standalone output + Prisma/MySQL).

FROM node:20-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
# postinstall runs `prisma generate`, which needs the schema above.
RUN npm ci

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Prisma CLI with all of its dependencies, installed on its own so the runtime can run `db push`.
FROM deps AS cli
WORKDIR /opt/prisma
RUN npm init -y >/dev/null && npm i --no-audit --no-fund --omit=dev "prisma@$(node -p "require('/app/node_modules/prisma/package.json').version")"

FROM node:20-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/app/uploads

# Standalone server + static assets
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Prisma schema + CLI so the container can sync the schema at start-up
COPY --from=build /app/prisma ./prisma
COPY --from=cli /opt/prisma/node_modules /opt/prisma/node_modules
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /app/uploads && chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD curl -fsS http://127.0.0.1:3000/api/public/branding >/dev/null || exit 1
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
