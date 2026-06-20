# syntax=docker/dockerfile:1
FROM postgres:18.4-bookworm

# Infisical CLI — postgres の entrypoint より前に POSTGRES_* を注入する
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && curl -1sLf 'https://artifacts-cli.infisical.com/setup.deb.sh' | bash \
  && apt-get update \
  && apt-get install -y --no-install-recommends infisical \
  && rm -rf /var/lib/apt/lists/*

# 起動時ログイン → infisical run -- docker-entrypoint.sh postgres を行う entrypoint
COPY docker/db/entrypoint.sh /usr/local/bin/db-entrypoint.sh
RUN chmod +x /usr/local/bin/db-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/db-entrypoint.sh"]
