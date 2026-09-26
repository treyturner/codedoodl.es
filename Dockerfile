# syntax=docker/dockerfile:1.7
FROM node:24.21.0-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS base
WORKDIR /srv
# Include system TLS roots alongside Node's bundled roots.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS builder
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . ./
RUN npm run build && npm run test:build

FROM base AS production-dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=production-dependencies /srv/node_modules ./node_modules
COPY --from=builder /srv/app ./app
COPY --from=builder /srv/config ./config
COPY --from=builder /srv/project/data/locales ./project/data/locales
COPY --from=builder /srv/doodles/master_manifest.json ./doodles/master_manifest.json
COPY --from=builder /srv/doodles/master_manifest_DEV.json ./doodles/master_manifest_DEV.json
COPY --from=builder /srv/package.json ./package.json
USER node
EXPOSE 3000
CMD ["npm", "start"]
