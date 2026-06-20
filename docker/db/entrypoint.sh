#!/usr/bin/env bash
set -euo pipefail

export INFISICAL_TOKEN=$(infisical login --method=universal-auth --silent --plain)

# Infisical が POSTGRES_* を注入してから公式 postgres entrypoint を実行する。
exec infisical run --projectId="$INFISICAL_PROJECT_ID" --env=dev -- docker-entrypoint.sh postgres
