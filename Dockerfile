#syntax=docker/dockerfile:1.7
FROM debian:bullseye-slim@sha256:e5b6442dd2e9684cf5e87d8338b5968f3b348636fc0be6d7850a381e3731a2bd AS builder

# Preserve a rebuildable legacy baseline until the Node/OS upgrade. The live
# Bullseye security indexes now reference packages no longer on the mirror.
RUN printf '%s\n' \
    'deb [check-valid-until=no] http://snapshot.debian.org/archive/debian/20260901T000000Z bullseye main' \
    'deb [check-valid-until=no] http://snapshot.debian.org/archive/debian-security/20260901T000000Z bullseye-security main' \
    > /etc/apt/sources.list

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

# Pin the pyenv source already used by the validated legacy build (2.8.6).
RUN curl --fail --location --show-error \
        https://codeload.github.com/pyenv/pyenv/tar.gz/513364609d0e56b919bcc44163614b04fa239621 \
        -o /tmp/pyenv.tar.gz \
    && echo '439f41edbea23d1ad34490e004cffa40d45f5e34247c5592ed86959a9fbc352f  /tmp/pyenv.tar.gz' | sha256sum --check --strict \
    && mkdir -p "$PYENV_ROOT" \
    && tar -xzf /tmp/pyenv.tar.gz --strip-components=1 -C "$PYENV_ROOT" \
    && rm /tmp/pyenv.tar.gz \
    && pyenv install 2.7.18 \
    && pyenv global 2.7.18

WORKDIR /build
COPY . ./

RUN npm install \
    && ./node_modules/.bin/gulp build \
    && npm prune --production

FROM debian:bullseye-slim@sha256:e5b6442dd2e9684cf5e87d8338b5968f3b348636fc0be6d7850a381e3731a2bd AS runtime
ENV NODE_ENV=production \
    DOODLE_DATA_SOURCE=production

COPY --from=builder /root/.nvm/versions/node/v10.16.0 /usr/local

WORKDIR /srv

COPY --from=builder /build/app ./app
RUN cp -r ./app/public/holding/static/fonts ./app/public/static/fonts
COPY --from=builder /build/config  ./config
COPY --from=builder /build/project/data/locales ./project/data/locales
COPY --from=builder /build/doodles/master_manifest.json  ./doodles/master_manifest.json
COPY --from=builder /build/doodles/master_manifest_DEV.json ./doodles/master_manifest_DEV.json
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/package.json ./package.json

EXPOSE 3000
CMD ["node", "-r", "coffee-script/register", "app/main.coffee"]
