#!/usr/bin/env bash
set -euo pipefail

export INFISICAL_TOKEN=$(infisical login --method=universal-auth --silent --plain)

# 依存を node_modules ボリュームへインストール（lockfile 固定）。
# store は bind mount 外の volume(/pnpm-store)に置き、リポジトリへ漏らさない。
pnpm install --frozen-lockfile --store-dir /pnpm-store

# infisical run が Vite(3000) / tsx(4000) に env を注入する。
exec infisical run --projectId="$INFISICAL_PROJECT_ID" --env=dev -- pnpm dev
