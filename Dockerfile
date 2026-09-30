# syntax=docker/dockerfile:1.7
FROM node:24.21.0-trixie-slim@sha256:8ec5d7557396cfe32d21c3f9c13072355ceab22b584578ca4bb28af31120cffe AS base
WORKDIR /srv
# Include system TLS roots and refresh Debian's OpenSSL packages from security.
# CI bypasses this stage's cache so repository fixes reach each candidate.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates openssl libssl3t64 openssl-provider-legacy \
    && rm -rf /var/lib/apt/lists/*

FROM base AS builder
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . ./
RUN npm run build && npm run test:server && npm run test:tools && npm run test:build

FROM base AS production-dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM base AS runtime
ENV NODE_ENV=production \
    DOODLE_DATA_SOURCE=production
# Production executes Node directly; package managers belong only in build stages.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-* \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --from=production-dependencies /srv/node_modules ./node_modules
COPY --from=builder /srv/dist/app ./dist/app
COPY --from=builder /srv/dist/config ./dist/config
COPY --from=builder /srv/dist/project/data/locales ./dist/project/data/locales
COPY --from=builder /srv/dist/doodles/master_manifest.json ./dist/doodles/master_manifest.json
COPY --from=builder /srv/dist/doodles/master_manifest_DEV.json ./dist/doodles/master_manifest_DEV.json
COPY --from=builder /srv/package.json ./package.json
USER node
EXPOSE 3000
CMD ["node", "dist/app/start.cjs"]
