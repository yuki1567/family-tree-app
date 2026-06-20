# syntax=docker/dockerfile:1
FROM node:24.16.0-bookworm-slim

# System tools: curl/ca-certificates（Infisical CLI 取得用）
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Infisical CLI — dev プロセスへ実行時にシークレットを注入する
RUN curl -1sLf 'https://artifacts-cli.infisical.com/setup.deb.sh' | bash \
  && apt-get update \
  && apt-get install -y --no-install-recommends infisical \
  && rm -rf /var/lib/apt/lists/*

# pnpm は corepack で有効化（バージョンは root package.json の "packageManager" に従う）
RUN corepack enable

WORKDIR /workspace

COPY docker/workspace/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000 4000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
