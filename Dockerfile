#syntax=docker/dockerfile:1.7
FROM debian:bullseye-slim AS builder

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        build-essential \
        ca-certificates \
        curl \
        git \
        libreadline8 \
        libbz2-dev \
        libsqlite3-dev \
        libssl-dev \
        zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

SHELL ["/bin/bash", "-euo", "pipefail", "-c"]

ENV PATH="/root/.nvm/versions/node/v10.16.0/bin:$PATH"

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash \
    && export NVM_DIR="$HOME/.nvm" \
    && \. "$NVM_DIR/nvm.sh" \
    && nvm install 10.16.0

ENV PYENV_ROOT="/root/.pyenv" \
    PATH="/root/.pyenv/shims:/root/.pyenv/bin:$PATH"

RUN curl https://pyenv.run | bash \
    && pyenv install 2.7.18 \
    && pyenv global 2.7.18

WORKDIR /build
COPY . ./

RUN npm install \
    && ./node_modules/.bin/gulp build \
    && npm prune --production

FROM debian:bullseye-slim AS runtime

COPY --from=builder /root/.nvm/versions/node/v10.16.0 /usr/local

WORKDIR /srv

COPY --from=builder /build/app ./app
RUN mv ./app/public/holding/static/fonts ./app/public/static
COPY --from=builder /build/config  ./config
COPY --from=builder /build/utils  ./utils
COPY --from=builder /build/project/data/locales ./project/data/locales
COPY --from=builder /build/doodles/master_manifest.json  ./doodles/master_manifest.json
COPY --from=builder /build/doodles/master_manifest_DEV.json ./doodles/master_manifest_DEV.json
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/package.json ./package.json

EXPOSE 3000
CMD ["npm", "start"]
