# 開発環境（コンテナ化）

開発環境を Docker でコンテナ化するにあたっての方式・ツールの選定と、その理由・却下した代替案をまとめた ADR。ローカルマシンの状態（Node の版など）に依存しない再現可能な開発環境を整えることを目的とする。

- ステータス: 決定完了・実ファイル作成済み（コンテナ起動の最終確認は Infisical プロジェクト設定後）
- 関連 issue: #14（モノレポ雛形を含む開発環境構築）
- 関連ドキュメント: [プロジェクト構成・ツール選定](./project-structure.md) / [TypeScript 設定](./tsconfig.md) / [技術スタック](./tech-stack.md)

## 背景
- ローカルの Node は v26（Current）だが、プロジェクトの標準は別ラインに固定したい。コンテナ化してコンテナ内の Node に固定すれば、**ローカルの版に依存しない**開発環境になる。

## 決定するレイヤ（進捗）
- [x] コンテナ統合方式（compose / Dev Container）
- [x] ベースイメージ・Node ライン
- [x] pnpm の導入方式
- [x] compose のサービス構成
- [x] Postgres（DB サービス）の扱い
- [x] 環境変数の管理方式（Infisical / Zod・認証情報の渡し方を含む）
- [x] 開発時のソース反映 / `node_modules` / 依存インストール
- [x] Docker 関連ファイルの配置・compose ファイル名

## 決定事項

### 1. コンテナ統合方式 — `docker compose` を正 ＋ 薄い `devcontainer.json`
環境定義の正は `compose.yaml` ＋ `Dockerfile` とし、`.devcontainer/devcontainer.json` は「その compose サービスを参照するだけ」の薄い opt-in レイヤに留める。

**理由**
- `docker compose up` / `docker compose exec` だけで誰でも完結し、**VS Code に依存せず**動く（CI でも同一の環境をそのまま使える）。「VS Code は使うが環境は依存させない」という要件に合致。
- VS Code 利用時は「Reopen in Container」でエディタがコンテナ内で動き、TypeScript 言語サーバ・ターミナル・デバッガが**コンテナの toolchain（Node/pnpm/依存）と一致**する。ホスト（Node 26）とコンテナ（Node 24）の差による型補完のズレを避けられる。
- 拡張機能・設定の自動適用（`customizations`）、`postCreateCommand` でのセットアップ自動化、`forwardPorts` などの利便を、環境定義を二重化せず（正は compose のまま）得られる。
- Dev Container はオープン仕様で GitHub Codespaces や JetBrains（Gateway）でも使えるため、厳密な VS Code 専用ではない。VS Code を使わない人にとっては未使用ファイルが 1 つ増えるだけで無害。

**却下した代替案**
- compose のみ（`devcontainer.json` を置かない）: 動作はするが、VS Code 利用時にエディタがホスト側で動くため型補完がコンテナとズレうる／拡張・設定の自動共有がない。先行 `my-family-tree` はこの形だが、上記の利便を無料で得られるなら薄い devcontainer を足す方が良い。
- Dev Container 主体（環境定義を `devcontainer.json` 側に持たせる）: VS Code 依存が強まり「依存しない」要件に反する。

### 2. ベースイメージ・Node ライン — `node:24.16.0-bookworm-slim`
コンテナの Node は **24 系 LTS** に固定し、公式イメージの **Debian(bookworm) slim** をマイナーまで固定して使う。

**理由**
- Node 24 は現行の Active LTS「Krypton」（〜2028 サポート）。本番で載せる現実的な標準であり、開発もそれに合わせる。`@types/node` も `^24` に揃える。
- Debian（glibc）系のため、Alpine（musl libc）で稀に起きる native 依存（esbuild / `pg` / Drizzle 等）の不具合を避けられる。
- slim で軽量に保ちつつ、必要なツール（git 等）は Dockerfile で明示的に入れる（何が必要かが見える）。
- マイナー（`24.16.0`）まで固定し、コンテナ再ビルドでの版ブレを防ぐ（再現性）。
- コンテナ内に固定するため、ローカルが Node 26 でも影響しない。

**却下した代替案**
- fully Debian（`node:24-bookworm`）: git・ビルドツール同梱で楽だがサイズ大。必要分は Dockerfile で足す方針のため不採用。
- Alpine（`node:24-alpine`）: 最小だが musl 由来で native 依存が稀に詰まるため非推奨。
- Node 22 LTS（先行 `my-family-tree` の採用版）/ Node 26 Current: 22 は一世代前、26 はまだ LTS 化前（2026/10 予定）で本番標準には先行しすぎ。現行 Active LTS の 24 を採る。
- タグ無し/メジャーのみ（`node:24-slim`）: 再現性が落ちるためマイナー固定にする。

### 3. pnpm の導入方式 — corepack
コンテナ内で pnpm は **corepack** で有効化する（`corepack enable`）。版はルート `package.json` の `packageManager: pnpm@11.6.0` に従う。

**理由**
- 版の指定が `packageManager` フィールド 1 か所に集約され、一意に固定される。Node に同梱の corepack を使うため追加の版管理が要らない。

**却下した代替案**
- `npm install -g pnpm@x`（先行 `my-family-tree` の方式）: pnpm の版を Dockerfile にハードコードすることになり、`packageManager` と二重管理になる。

### 4. compose のサービス構成 — 単一 `workspace` コンテナ
開発時はフロント（3000）とバックエンド（4000）を **1 つのサービスで**動かし、`turbo run dev`（Vite と tsx watch を同時起動）で回す。サービス名は **`workspace`** とする。

**理由（単一コンテナにする）**
- 取り回しが軽く、`node_modules` も 1 つで済む。
- 「SPA ＋ 独立 API」（tech-stack 決定 2・6）の独立性は**本番のデプロイ単位**で担保されており、dev で物理分割しなくても型共有・モノレポ構成は維持され、設計は崩れない。

**理由（名前を `workspace` にする）**
- このコンテナは「1 つのアプリ」ではなく、**pnpm/Turborepo の workspace（モノレポ全体）を開発モードで動かす実行環境**。本番では frontend（静的ビルド）と backend（esbuild バンドル）が別々にビルド・デプロイされるため、コンテナ自体はデプロイ成果物ではない。役割（＝ワークスペースの dev 実行環境）で名付けるのが正確。
- `workspace` は pnpm/Turborepo の正式用語（`pnpm-workspace.yaml` / `workspace:*`）であり、Dev Container 慣習（`/workspace`・`workspaceFolder`）とも揃う。app やパッケージが増えても意味が変わらない。

**却下した代替案**
- `frontend` / `backend` を別サービスに分割: 本番の 2 デプロイ topology に近く個別再起動もできるが、compose 設定が増え dev には過剰。学習目的で分割の価値が見えた時点で再検討する。
- サービス名 `app`（単数）: 「コンテナ＝1 アプリ」と誤読させる。アプリは frontend/backend の 2 つで独立しており、かつコンテナはアプリではなく dev 実行環境。
- サービス名 `apps`（複数、先行 `my-family-tree` の方式）: 「アプリ群そのもの」とコンテナを同一視するうえ、モノレポの `apps/` ディレクトリと名前が衝突して紛らわしい。

### 5. Postgres（DB サービス）— compose に `db` サービスとして今回追加
開発環境構築の一環として、PostgreSQL（tech-stack 採用済み）を compose の `db` サービスとして今回から立てる。backend は現状 `/health` のみで DB 未着手だが、環境を一式揃えておく。

**理由**
- 本 PR の主旨が「開発環境構築」であり、DB まで含めて一式揃える方が一貫する。Drizzle / スキーマ着手時にすぐ使える。先行 `my-family-tree` も DB サービスを持つ。

**却下した代替案**
- DB を今回入れず Drizzle 着手時に追加: スコープは最小になるが、「開発環境構築」が DB 抜きで一旦終わってしまう。一式揃える方を採る。

**パラメータ（決定済み）**
- イメージ: `postgres:18.4-bookworm`。18 が最新メジャー（2025-09 リリース、最新パッチ 18.4）。決定 2 と同じ「再現性のため固定」方針でパッチまで固定し、Node に合わせ Debian bookworm を選ぶ。
  - 却下: `postgres:18.4`（OS 既定＝将来 trixie に動きうる）/ `postgres:18`（メジャーのみで再ビルド時にパッチが動く）/ Alpine 版（musl 回避）。
- データ永続化: **しない**（ボリュームを定義しない）。`docker compose down` 等でコンテナを破棄すると DB データは消える。スキーマ・データは Drizzle のマイグレーション（と必要ならシード）から常に再現する前提とし、ローカルに古い状態が残らない＝毎回クリーンな状態で開発できる。
  - 却下: 名前付きボリューム（標準的に永続化できるが、ローカルに状態が溜まり「マイグレーションから再現」を徹底しにくい）/ バインドマウント（ホスト OS 差で権限・FS の問題が出やすい）。
- ヘルスチェック: **現時点では付けない**。`workspace` は素の `depends_on: [db]` で**起動順のみ**担保する。
  - 理由: healthcheck＋`condition: service_healthy` の目的は「アプリが起動時に DB へ繋いで準備中で落ちるのを防ぐ」ことだが、**現状 backend は DB に接続していない**（Drizzle 等の DB コードなし、`DATABASE_URL` も未使用）。防ぐべき初回接続エラーがまだ無いため、healthcheck は不要（YAGNI）。
  - DB 連携（Drizzle 着手）時に、接続ライブラリのリトライ有無も踏まえて**その時に必要な readiness 判定**を入れる。
  - 補足（その時の選択肢）: 標準の `pg_isready -U $POSTGRES_USER` を使うには `POSTGRES_USER` が healthcheck から見える必要があり、Infisical 注入（postgres プロセスにのみ注入）では見えない。標準形を使うなら `POSTGRES_USER`/`POSTGRES_DB` を非機密として compose 側に出す（password のみ Infisical）構成にするか、ポート接続可否（`nc -z` 等）で代替する。
  - 却下: 今 healthcheck を付ける（DB 未接続で守る対象が無く、接続方式未確定のまま判定方法を決めることになる）。
- ホストポート: `5432:5432` で公開する。アプリ↔DB はコンテナ内ネットワーク（`db:5432`）で接続するため、この公開はホストの GUI ツール（TablePlus / `psql` 等）から覗くための用途。ホストに別 Postgres が無い前提で既定ポートを素直に使う。
  - 却下: `5433:5432`（ホスト競合回避。競合が判明したらこちらにずらす）/ 公開しない（外部ツールから覗けない）。

> 残りのパラメータ（認証情報の渡し方）は次の「環境変数の管理方式」で決める。

### 6. 環境変数の管理 — Infisical（管理・注入）＋ Zod（起動時バリデーション）
環境変数・シークレットは **Infisical** で一元管理し、実行時の `process.env` への注入も Infisical で行う（ローカル dev・本番とも）。アプリ側は注入された `process.env` を **Zod** スキーマで起動時に検証してから使う。`.env` ファイル・`dotenv` は使わない。

**理由**
- シークレットを平文ファイル（`.env`）としてローカルやリポジトリに置かず、一元管理・監査・ローテーションができる。本番もローカルも Infisical 経由で**注入経路が統一**され、アプリのコードは常に `process.env` を読むだけで済む（tech-stack「環境変数はクラウド側で管理／`.env` を使わない」と整合）。
- Zod 検証により「必要な env が揃っているか・型/形が正しいか」を**起動時に保証**でき、`process.env.X` が `undefined` のまま使われる事故を防ぎ、型も付与できる。

**却下した代替案**
- compose の `environment:` に dev 値を直書き / `.env` ＋ `dotenv` / direnv（`.envrc`）: いずれもシークレットがローカルやリポジトリに散らばり、一元管理や本番との注入経路統一ができない。

**注入の置き場所 — コンテナの entrypoint で `infisical run` で包む**
ホストで `docker compose` をラップするのではなく、コンテナ内のプロセス自身が Infisical から取得する。具体的には `workspace` の **entrypoint** で `infisical run -- pnpm dev` のように包み、`db` も entrypoint で `infisical run -- docker-entrypoint.sh postgres` と包む。`package.json` の `dev` は素の `turbo run dev` のままにする。
- 理由: 秘密注入は**インフラ層（entrypoint）の責務**として分離し、`package.json` を**環境非依存**に保つ。`pnpm dev` 単体に Infisical CLI＋認証の前提を持ち込まない（ホストや他環境で素直に動く）。コンテナ内プロセスが自分で `process.env` に注入できる点も満たす。
- 却下:
  - `package.json` の `dev` を `infisical run -- turbo run dev` にする: `pnpm dev` がどこでも Infisical 前提になり、アプリのスクリプトにインフラ関心が混入する。
  - ホストで `infisical run -- docker compose up`: Infisical CLI がホストの前提になり、Dev Container の自動 compose 起動とも噛み合わない。

**認証方法 — Machine Identity の client-id/secret を渡し、コンテナ起動時に自動ログイン**
- ローカル: Machine Identity（Universal Auth）の **client-id / client-secret（無期限）** を `INFISICAL_UNIVERSAL_AUTH_CLIENT_ID` / `INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET` の env でコンテナに渡す。各 entrypoint が起動時に `infisical login --method=universal-auth --silent --plain`（CLI が上記 env から自動で読む）で**その場でアクセストークンを取得**し、`INFISICAL_TOKEN` にセットしてから `infisical run` を実行する。
- 各自はシェル（`~/.zshrc`）に client-id/secret を 1 度設定するだけ（secret は macOS Keychain 由来にして平文化を避ける）。compose がコンテナへパススルーする。
- CI: 静的シークレットを置かず **OIDC**（CI の OIDC → Infisical の Machine Identity）で認証する。
- 理由: アクセストークンは**短命**で期限切れのたびに再ログインが要る。代わりに**無期限の client-id/secret を渡し、コンテナが起動のたびに自分でトークンを取り直す**ことで、利用者はトークンを一切管理せず `docker compose up` だけで済む。トークンは起動時に生成して即使うため、期限切れが運用上問題にならない。Service Token（非推奨）も使わない。
- 却下:
  - 短命アクセストークンをホストで `infisical login` して `INFISICAL_TOKEN` に export して渡す: 期限切れのたびに再ログインが必要で手間。
  - Service Token（静的トークン）: 設定は楽だが Infisical が非推奨（将来廃止の恐れ）。
  - ホストの `infisical login` セッション（`~/.infisical`）をコンテナにマウント: ホスト(macOS Keychain)とコンテナ(Linux)で資格情報ストアが異なり再利用できない。

**`db` の `POSTGRES_*` の供給 — `db` も `infisical run` で包む（単一ソース）**
`db` も Infisical から値を取得する。postgres 公式イメージに Infisical CLI を入れた custom Dockerfile を用意し、entrypoint で `infisical run --projectId=$INFISICAL_PROJECT_ID --env=dev -- docker-entrypoint.sh postgres` のように包む。`POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` は Infisical から注入し、`workspace` 側の `DATABASE_URL` と**同一ソース**にする。
- 理由: `POSTGRES_*` と `DATABASE_URL` が常に Infisical の単一ソースから供給され、両者の不整合が原理的に起きない。「環境変数は Infisical で一元管理」を DB 認証も含めて貫ける。
- プロジェクト ID の指定: **machine identity 認証では `infisical run` が `.infisical.json` の `workspaceId` を参照せず、`--projectId` の明示が必須**（実機で "Project ID is required when using machine identity" を確認）。そこでプロジェクト ID は **compose の env `INFISICAL_PROJECT_ID`（非機密）に一元化**し、`workspace`・`db` 両 entrypoint が `--projectId=$INFISICAL_PROJECT_ID` で渡す。`workspace`・`db` は同一プロジェクトを共有する。
- `.infisical.json` は不採用: machine identity の run では使われず、プロジェクト ID が compose env と二重管理になるため置かない（`infisical init` が作るが本構成では削除）。
- 却下: 非機密の固定値を compose に直書きし `DATABASE_URL` を手動で合わせる案（記述は最小だが、compose と Infisical の 2 箇所で値を同期する必要が残る）。
- 留意点: db 用に CLI 入りの custom イメージ＋起動時ログインする entrypoint を用意し、client-id/secret と `INFISICAL_PROJECT_ID` を `db` にも渡す必要がある（`workspace` と同じ経路）。

### 7. 開発時のソース反映と `node_modules` — bind mount ＋ `node_modules` は named volume
`workspace` コンテナはリポジトリを **bind mount** で反映し（コード編集が即 HMR / tsx watch に反映）、`node_modules` だけは **named volume** に分離してコンテナ内に閉じ込める。依存はコンテナ作成時に `pnpm install` で用意する。

**理由**
- bind mount により編集が即時反映され、Vite HMR / tsx watch が活きる。
- `node_modules` を named volume にすることで、ホスト側の `node_modules`（存在しない／別 OS・アーキ向け）に**上書き（shadow）されず**、依存をコンテナ native（Linux）に保てる。native 依存（esbuild 等）の不整合や macOS bind mount の I/O 遅延を避けられる。

**pnpm の store も bind mount 外の named volume に固定**
- `pnpm` のコンテンツアドレス・ストアは専用 named volume（`pnpm-store:/pnpm-store`）に置き、`entrypoint` の `pnpm install --store-dir /pnpm-store` で明示指定する。
- 理由: store-dir を指定しないと、pnpm は bind mount された `/workspace` 直下に `.pnpm-store`（100MB+）を作り、**ホストのリポジトリへ漏れ出す**（node_modules が別 FS の named volume にあり、pnpm が project ルート側に store を置こうとするため）。volume に固定すればリポジトリに漏れず、再 DL も避けられる。実機で「まっさら再インストールでも store はボリュームに入り、リポジトリに `.pnpm-store` が出ない」ことを確認済み。
- 念のため `.gitignore` にも `.pnpm-store/` を追加（保険）。

**却下した代替案**
- イメージにソースを `COPY` して焼き込む（bind しない）: 本番ビルド向け。dev では変更ごとに再ビルドが要り HMR も活きない。
- ホストの `node_modules` ごと bind mount: ホスト（mac/arm）の native 依存が Linux コンテナで壊れうる。コンテナ非依存の方針にも反する。
- pnpm store を既定のまま（store-dir 未指定）: 上記のとおり bind mount 上に store が作られリポジトリへ漏れる。

### 8. 依存インストールの実行タイミング — コンテナの entrypoint
`pnpm install`（`corepack enable` 込み）は `workspace` コンテナの **entrypoint** で実行し、その後に起動コマンド（`infisical run -- turbo run dev`）へ繋ぐ。

**理由**
- 決定 1 で「compose を正、`devcontainer.json` は薄い参照」と定めたため、インストールも **`docker compose up` だけで完結**する entrypoint に置くのが一貫する。VS Code 経由でも `docker compose` 直叩きでも同じく依存が揃う。

**却下した代替案**
- `devcontainer.json` の `postCreateCommand` に置く: VS Code（対応エディタ）でコンテナを作った時しか走らず、`docker compose up` 直叩きでは揃わない。compose を正とする方針とズレる。
- 併用（entrypoint ＋ postCreateCommand）: entrypoint だけで賄えるため冗長。

### 9. Docker 関連ファイルの配置・compose ファイル名
Docker 資材は次の配置とし、compose ファイル名は現行 Compose 仕様の推奨名 `compose.yaml` を使う。

**理由**
- 役割ごとにディレクトリを分け（`docker/workspace`・`docker/db`）、サービス名（決定 4・5）とディレクトリ名を一致させて見通しを良くする。
- `compose.yaml` は現行 Compose 仕様の推奨ファイル名。先行 `my-family-tree` は旧称 `docker-compose.yml` だが、新しい推奨名に揃える。

**却下した代替案**
- 旧称 `docker-compose.yml`: 動作はするが現行仕様では `compose.yaml` が推奨。
- Docker 資材をルート直下に平置き: ファイルが増えるとルートが散らかる。`docker/` 配下にまとめる。

## 作成したファイル
- `docker/workspace/Dockerfile` … `node:24.16.0-bookworm-slim` ＋ git ＋ Infisical CLI ＋ corepack
- `docker/workspace/entrypoint.sh` … `pnpm install --frozen-lockfile` → `pnpm dev`
- `docker/db/Dockerfile` … `postgres:18.4-bookworm` ＋ Infisical CLI
- `compose.yaml` … `workspace`（3000/4000）＋ `db`（5432, healthcheck, infisical でラップ）
- `.devcontainer/devcontainer.json` … compose を参照する薄い設定
- `.dockerignore` / `.infisical.json`（プレースホルダ）
- ルート `package.json` の `dev` を `infisical run -- turbo run dev` に変更
- `apps/backend/src/env.ts` … Zod による起動時 env 検証（`zod` を backend 依存に追加）

## セットアップ手順（利用者が行う）
1. Infisical プロジェクトを作成し、`infisical init` で `.infisical.json` の `workspaceId` を設定（現状プレースホルダ）。
2. Infisical に dev 環境のシークレットを登録（`DATABASE_URL` / `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` 等）。
3. Machine Identity のトークンをシェルに設定：`export INFISICAL_TOKEN=...`（CI は OIDC）。
4. `docker compose up`。

## 検証状況
- 済（ホスト）: `type-check` / `build` / backend `/health`（Zod env のデフォルトで標準起動）。
- 済（静的）: `docker compose config` が VALID。
- 未: `docker build` / `docker compose up` での起動・HMR・`/health`（Docker デーモン停止中、かつ Infisical 設定後に実施）。

## 既知の留意点（フォローアップ候補）
- macOS + Docker の bind mount では、ファイル変更イベントが伝わらず HMR/watch が効かない場合がある。起きたら Vite の `server.watch.usePolling` / tsx の watch オプションで polling を有効化する。
- `pnpm install` は `--frozen-lockfile`。依存追加時はコンテナ内で `pnpm add` し、lockfile を更新する。
