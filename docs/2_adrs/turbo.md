# Turborepo タスク設定（turbo.json）

`turbo.json` の各設定の理由・却下した代替案をまとめた ADR。Turborepo を採用するという**選定**そのものは [プロジェクト構成・ツール選定](./project-structure.md) の決定 2 にあり、本書はその設定ファイルの中身を担う。

- ステータス: 決定完了
- 関連 issue: #14
- 関連ドキュメント: [プロジェクト構成・ツール選定](./project-structure.md)（決定 2：Turborepo 選定／決定 4：TS 設定方針・project references 不採用／決定 5：backend ビルド方針・shared は source 消費）/ [TypeScript 設定](./tsconfig.md)

## 決定事項

### 1. `globalDependencies: ["tsconfig.base.json"]`
全タスクのキャッシュキーに `tsconfig.base.json` を含める。

**理由**
- 各パッケージが `extends` する base tsconfig は**パッケージディレクトリの外**にあるため、turbo の既定ハッシュ（各パッケージ内のファイル＋ root の `turbo.json`/lockfile）には入らない。これを `globalDependencies` に入れることで、**base を変更したら `build`/`type-check` の全キャッシュが無効化**される。
- 実機で「`tsconfig.base.json` 変更 → 全タスク cache bypass」を確認済み。

**却下した代替案**
- 未設定: base を変えても各パッケージのタスクがキャッシュヒットし、**古い型チェック結果を返す**事故が起きる（実際に一度ヒットを観測したため追加した）。

### 2. `tasks.build` — `outputs: ["dist/**"]`
build 成果物のキャッシュ対象を指定する。

**理由**
- `outputs` は**各パッケージのディレクトリからの相対パス**として評価される。`build` は `build` スクリプトを持つ各パッケージで個別に実行され、`dist/**` は `apps/frontend/dist/**` と `apps/backend/dist/**` にそれぞれ解決される。フロントとサーバーが**別々にビルドしても、各自の `dist/` を独立にキャッシュ**できる。
- 単一の glob で足りるのは、両パッケージとも出力先が `dist/` だから（frontend = Vite 既定 outDir `dist`、backend = esbuild `--outfile=dist/index.js`、いずれも実機で確認済み）。`shared` は `build` スクリプトを持たないため対象外。

**却下した代替案**
- `outputs` 未指定: キャッシュから成果物を復元できず、ヒットしても実質フルビルドになる。

**留意点**
- いずれかのパッケージが `dist` 以外へ出力するようになったら、グローバルの glob では拾えないため、そのパッケージ側で `outputs` を上書きする。現状は両方 `dist` なので共通指定で正しく機能する。

### 3. `tasks.type-check` — 追加設定なし
`tsc --noEmit` のため出力がない。

**理由**
- 出力が無いので `outputs` は不要。turbo は入力（パッケージ内ファイル＋ `globalDependencies`）のハッシュでキャッシュ判定する。

### 4. `tasks.dev` — `cache: false` / `persistent: true`
**理由**
- dev は常駐プロセス（Vite dev server / `tsx watch`）。成果物が無くキャッシュ対象でないため `cache: false`。`persistent: true` で turbo が終了を待たずに常駐タスクとして扱う。

### 5. `dependsOn` は付けない
どのタスクにもタスク間依存（`dependsOn`）を定義しない。

**理由**
- `shared` を**ビルドせず TS ソースのまま消費**する方針（決定 5）で、`shared` に build 成果物が無い。project references も不採用（決定 4）。よって frontend/backend の `build`・`type-check` は上流パッケージのビルドに依存せず、各パッケージ独立に実行してよい。

**却下した代替案**
- `build.dependsOn: ["^build"]` 等の上流依存: 一般的なモノレポでは妥当だが、`shared` に build 成果物が無く references も無い現状では不要。将来 `shared` をビルド成果物（.d.ts）配布に変える（決定 4・5 の再検討契機）場合に追加する。
