# プロジェクト構成・ツール選定

モノレポの雛形（#14）にあたって決めるパッケージマネージャ・構成・ツールの選定と、その理由をまとめたドキュメント。決定したレイヤから順次追記する。

- ステータス: 決定完了（雛形の実装は #14 で実施）
- 関連 issue: #14
- 関連ドキュメント: [技術スタック](./tech-stack.md)

## 決定するレイヤ（進捗）
- [x] パッケージマネージャ
- [x] モノレポの orchestration（素の workspace か Turborepo 等か）
- [x] ディレクトリ構成（apps / packages）
- [x] TypeScript 設定方針
- [x] backend のビルド/実行方針（共通 tsconfig と各パッケージ）

## 決定事項

### 1. パッケージマネージャ — pnpm
モノレポ（apps + packages）のパッケージマネージャに pnpm を採用する。

**理由**
- 依存解決が厳格で、宣言していない依存（幽霊依存）を使えない。依存を正しく管理でき、学習面でも有益。
- コンテンツアドレス格納＋リンク方式でディスク効率が高く、モノレポで複数パッケージを抱えても実体の重複が少ない。
- workspace 機能が成熟しており、モノレポの実務標準。

**却下した代替案**
- npm: 標準で導入は楽だが、hoisting により幽霊依存が起きやすく、workspace 機能も後発で薄め。
- Bun: 高速だが新しめでエコシステム互換に穴があり、ランタイム採用の是非も絡む。React/TS 学習の主目的から外れる。
- Yarn: pnpm に対する明確な優位が薄く、Berry の PnP は互換で詰まりやすい。

### 2. モノレポの orchestration — Turborepo
pnpm workspace に Turborepo を組み合わせ、タスク（build / dev / test / lint）を束ねる。

**理由**
- 学習目的：Turborepo 未使用のため、タスクの依存グラフ・キャッシュ・差分実行といった効果を実地で体験したい。これらの考え方はモノレポ実務で頻出で、学ぶ価値が高い。
- 設定は比較的軽量で、後から外す／入れることも容易。
- 将来パッケージやタスクが増えた際の高速化にそのまま効く。

**却下した代替案**
- 素の pnpm workspace のみ：最もシンプルだが、キャッシュ／差分実行を体験するという今回の学習目的に合わない。
- Nx：高機能だが規約が多く重い。個人・小規模・学習には過剰。

**留意点**
- 現状の 2 アプリ＋shared 規模では性能面の恩恵は小さく、機能的にはやや過剰である点は、学習目的として許容する。

### 3. ディレクトリ構成（apps / packages）— apps/{frontend, backend} ＋ packages/shared
モノレポを「デプロイ対象（apps）」と「共有ライブラリ（packages）」に分ける。

```
.
├─ apps/
│  ├─ frontend/        # name: frontend  (React + Vite / SPA)
│  └─ backend/         # name: backend   (Hono / API)
├─ packages/
│  └─ shared/          # name: shared    (共有型・Zod スキーマ・定数・ユーティリティ)
├─ docs/
├─ package.json        # ルート（workspace・共通スクリプト）
├─ pnpm-workspace.yaml
└─ turbo.json
```

**理由**
- `apps/`＝デプロイ物、`packages/`＝ライブラリ、と役割を位置で明示でき、ツリーを見て判別できる。
- `shared` は両アプリから使われるライブラリ。`packages/` に置くことで `apps → packages` の一方向の依存を保て、front/back を疎結合に保ったまま型を共有できる（決定 2 の分離方針と整合）。
- pnpm workspace / Turborepo の標準構成（`apps/*` `packages/*`）に合い、例・ツールがそのまま当てはまる。将来の共有物（config 等）にも拡張しやすい。

**細部の決定**
- アプリ名: `frontend` / `backend`（役割が明確）。
- 共有パッケージ: まず `packages/shared` 1つ（用途が増えたら分割）。
- npm スコープ: 付けない（公開しない個人プロジェクトのため不要）。

**却下した代替案**
- `apps/shared`: 動作はするが、`apps`（デプロイ物）の分類を採用しながらライブラリを `apps` に置く中途半端な形で、役割が誤解される。
- ルート直下フラット（`frontend/` `backend/` `shared/`）: 3つだけなら簡潔だが、役割分類が無くルートが散らかりやすく、拡張時に手戻りが出やすい。

### 4. TypeScript 設定方針 — 自前ベース ＋ 各パッケージ extends（strict 有効）
ルートに `tsconfig.base.json`（共通 compilerOptions・`strict: true`）を置き、`apps/*`・`packages/*` が `extends` して環境差分のみ上書きする。

**環境差分（各パッケージで上書き）**
- `apps/frontend`: `lib` に DOM、`jsx: react-jsx`、bundler 向け `moduleResolution`
- `apps/backend`: Node 向け（`module`/`moduleResolution` を Node 系、Node の型）
- `packages/shared`: ライブラリ向け（必要なら `declaration` 等）

**理由**
- 共通設定を1か所（`tsconfig.base.json`）に集約でき、重複を排除。方針が目の前に見え、学習面でも有利。
- `strict: true` を有効化し、型の恩恵を最大化する（追加フラグ `noUncheckedIndexedAccess` 等は実装しながら判断）。
- 環境差分は各パッケージで上書きし、ベースは共通に保つ。

**却下した代替案**
- コミュニティベース（`@tsconfig/*`）: 妥当な初期値を即使えるが、設定が `node_modules` 内に隠れて見えにくく、学習向きでない（更新は opt-in でピン留めされ、自動追従はしない）。中身は参考に見るに留める。

**project references について（当面は不採用）**
- 型チェックは各パッケージの `tsc --noEmit` を Turborepo がパッケージ順・タスクキャッシュ付きで回す方式で足りる（`shared` は TS ソースのまま参照）。
- ※ Vite / tsx は型チェックをしない（変換のみ）ため、`type-check`（`tsc --noEmit`）スクリプトは各パッケージに必ず用意し、Turborepo / CI で回す。
- 再検討の契機: ①パッケージ数・コード量が増えて型チェックが遅くなる、②`shared` をビルド成果物（.d.ts）として配布する方式に変える。その際に composite / references を導入し、tsc レベルの増分チェックを足す。

### 5. backend のビルド/実行方針 — dev: tsx ／ 本番バンドル: esbuild
- **dev**: backend は `tsx` で TS を直接実行（バンドル不要）。
- **型チェック**: 各パッケージで `tsc --noEmit`（Turborepo / CI で実行）。
- **shared の消費**: TS ソースのまま参照（方式1）。本番ビルドで取り込むため、`shared` の dist も project references も不要。
- **本番ビルド**: **esbuild（直接）** でバンドルし、自己完結した成果物を出力する。

**理由**
- esbuild は最速・最小依存で中立。特定ホストに縛られず移植しやすく、アプリのバンドルを自分で制御できる。
- バンドルにより `shared` の TS ソースを取り込めるため方式1を維持でき、project references が不要（決定 4 と整合）。
- 自己完結成果物はコンテナ／サーバレスなど、デプロイ先を問わず載せやすい。

**却下した代替案**
- tsup: ゼロコンフィグで手軽だがライブラリ向け寄り。アプリのバンドル制御は esbuild 直の方が利く。
- tsc 出力（バンドルなし）: `import` が外部に残り、`shared` を方式2（compiled）にする必要が生じ project references も要る。決定 4 と矛盾。
- Vite / Rollup: サーバ用途には不向きで重め。
- ランタイム固有（Wrangler / Bun 等）: ホスト依存で、デプロイ先未定の今は固定できない。

**留意点**
- デプロイ先が Cloudflare Workers / Bun / Deno 等に決まった場合、そのランタイムのバンドル方式（Wrangler 等）へ切り替える余地は残す。esbuild はそれら基盤の土台でもあり、移行コストは大きくない。
