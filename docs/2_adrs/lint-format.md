# Lint / Formatter（Biome）

Linter／Formatter のツール選定と各設定の理由・却下した代替案をまとめた ADR。コード品質を一定に保ち、複数人・AI エージェント開発でも静的解析と整形を統一することを目的とする。

なお Issue #5 の「コーディング規約の整備」は、**機械的に強制できる規約（整形・命名・静的解析）を `biome.json` に集約することで満たす**方針とし、人間向けの別途規約ドキュメント（`CONTRIBUTING.md` 等）は現時点では作成しない。必要が生じた時点（ディレクトリ構成や commit 規約などを明文化したくなった時）に別途追加する。

- ステータス: 完了（`biome.json`・スクリプト整備済み、既存コードへ適用済み）
- 関連 issue: #5
- 関連ドキュメント: [TypeScript 設定](./tsconfig.md)（決定 7：Lint 責務は tsconfig に持たせず lint ツール側で扱う）/ [プロジェクト構成・ツール選定](./project-structure.md)（pnpm + Turborepo モノレポ）

## 決定事項

### 1. ツール選定 — Biome（lint + format の単一ツール）
Linter と Formatter を **Biome** 1 ツールに統一する。ESLint + Prettier は採用しない。

**理由**
- lint・format・import 並べ替えを**単一ツール・単一設定（`biome.json`）・単一コマンド**で完結できる。
- Rust 製で高速、依存も 1 つに収まり、1 人 ＋ AI エージェント開発での**設定・保守コストが軽い**。
- React Hooks の `exhaustive-deps` 相当（`useExhaustiveDependencies` / `useHookAtTopLevel`）を内蔵し、TS + React + Hono の基本的な静的解析は賄える。
- tsconfig 側の決定 7（`noUnusedLocals` 等を tsconfig に持たせず lint で一元化）の受け皿となる。

**却下した代替案**
- **ESLint(flat config) + Prettier**: 業界標準で、`typescript-eslint` による型を見た解析（`no-floating-promises` 等）やプラグイン資産が最大という利点はある。しかし 2 ツール構成で設定・依存・保守が増え、`eslint-config-prettier` での競合回避配線も要る。
- **ESLint + Biome(format のみ) のハイブリッド**: 両者の利点を取れるが構成が複雑化し、単一ツールで完結させる利点を失う。

### 2. 設定ファイルの配置 — ルート単一構成（`/biome.json` 1ファイル）
モノレポのルートに `biome.json` を 1 つだけ置き、全 workspace（`apps/frontend` / `apps/backend` / `packages/shared`）を対象にする。各パッケージに設定ファイルは置かない。

**理由**
- 決定 1（単一ツール・単一設定・単一コマンドで完結）と一貫する。設定が 1 ファイルに集約され、1 人 ＋ AI エージェント開発での保守が軽い。
- frontend / backend / shared 間で lint・format ルールを揃えたい段階で、パッケージごとに設定を分散させる動機がない。
- React 固有ルール（`useExhaustiveDependencies` 等）を frontend だけに効かせたい等のパッケージ差分は、`overrides`（パスごとの上書き）でルート 1 ファイル内に表現でき、ネスト構成にせずに済む。
- 受け入れ基準「ルートからワンコマンド」に最短で合致する（ルートで `biome check .` 一発）。

**却下した代替案**
- **ネスト構成（ルート + 各パッケージにも `biome.json`）**: Biome 2.x はモノレポを公式サポートし、ネスト側に `"root": false` を付ければ分割できる。ただし各パッケージが独立公開・独自ルールを強く持つ規模で初めて利点が出るもので、現規模では設定ファイルが増えるだけ。将来必要になれば移行可能なため、今は採用しない。

### 3. 導入とバージョン固定 — ルートに `@biomejs/biome` を exact 固定
`@biomejs/biome` をルートの `devDependencies` にのみ追加し、バージョンは **exact 固定**（`pnpm add -DE -w`）する。導入時点のバージョンは **2.5.0**。`$schema` はインストール版に対応する `node_modules/@biomejs/biome/configuration_schema.json` を相対参照する。

**理由**
- 決定 2（ルート単一構成）と一貫し、依存もルート 1 箇所に集約する。
- Biome はマイナー更新でも lint ルールが追加され、既存コードに新規エラーが出ることがある。`^` 指定だと環境・CI 間で挙動がブレるため exact 固定し、更新はバージョンを意図的に上げる運用にする（決定 1 の「挙動を安定させ保守を軽く」と整合）。
- `$schema` をローカルの `node_modules` 参照にすることで、インストール版とスキーマのズレを防ぐ。

### 4. 土台ブロック（`$schema` / `vcs` / `files`）
`biome.json` の土台として以下を設定する。

```jsonc
{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": {
    "includes": [
      "**",
      "!**/dist", "!**/.turbo", "!**/coverage",
      "!.claude", "!.mcp.json", "!.devcontainer"
    ]
  }
}
```

**理由**
- `vcs.useIgnoreFile: true`：Biome が `.gitignore` を尊重する。`node_modules` 等は `.gitignore` 済みのため `files` 側で重複指定が不要になる。
- `files.includes`：Biome 2.x の新方式（`include/ignore` 廃止 → `includes` 配列で `!` 否定）。全ファイル `**` から、ビルド生成物 `dist`・Turborepo キャッシュ `.turbo`・カバレッジ `coverage` を除外。`coverage` はテスト未導入だが先回りで除外。
- 外部ツール/エディタ設定（`.claude` / `.mcp.json` / `.devcontainer`）も除外し、**Biome の責務を「自分たちのプロジェクトソース」に限定**する。外部ツールが独自フォーマットで書き換えても lint 差分が出ないようにするため。フォルダ除外は Biome 2.2.0 以降は末尾 `/**` を付けず `!.claude` の形で書く（`/**` を付けると `lint/suspicious/useBiomeIgnoreFolder` の警告が出る）。

### 5. フォーマッタ（`formatter` / `javascript.formatter`）
**Biome 2.5 のデフォルトと異なる値だけを明記する**方針とする（決定 3 で版を exact 固定済みのため、デフォルトはバージョン更新時しか変わらず、デフォルト一致項目を書くのは冗長。逸脱点だけを書くことで「意図的な変更」が一目で分かる）。

```jsonc
{
  "formatter": { "expand": "always" },
  "javascript": {
    "formatter": { "quoteStyle": "single", "semicolons": "asNeeded" }
  }
}
```

**デフォルトから変更した項目とその理由**
- `formatter.expand: "always"`：デフォルト `auto` は著者が `{` の後に改行したかで出力が変わり（同じ意味のコードが 2 通りに整形され正規化されない）、複数人 ＋ AI エージェント開発で差分がブレる。`always` は入力に依存せず全オブジェクト/配列を 1 要素 1 行に展開するため決定的で、要素の増減が 1 行単位のきれいな diff になる（レビュー容易）。数値配列まで縦に伸びる冗長さは許容と判断。
- `javascript.formatter.quoteStyle: "single"`：デフォルト `double` → JS/TS 慣習のシングルクォートに変更。
- `javascript.formatter.semicolons: "asNeeded"`：デフォルト `always` → セミコロン省略スタイルに変更。

**デフォルトのまま採用した主な項目（明記しない）**
- `indentStyle: "tab"`：タブ。`attributePosition: "auto"`：行幅基準で折るため入力非依存（既に決定的）。`lineWidth: 80` / `trailingCommas: "all"` / `bracketSpacing: true` / `jsxQuoteStyle: "double"` / `quoteProperties: "asNeeded"` / `arrowParentheses: "always"` / `useEditorconfig: true`（ただし `.editorconfig` は置かず Biome に一本化）。

### 6. Lint の大方針 — `recommended` を土台に、ドメインは自動検出に委ねる
Linter は `preset: "recommended"`（base recommended）を土台とし、必要に応じて個別ルールを上乗せする方針（C「`all`」は nursery 含む誤検知過多で学習プロジェクトに過剰なため不採用）。tsconfig 決定 7 で lint に委ねた責務（未使用変数 `noUnusedVariables`／未使用引数 `noUnusedFunctionParameters`／未使用 import `noUnusedImports`／switch フォールスルー `noFallthroughSwitchClause`）は、検証の結果**すべて recommended に含まれており追加設定は不要**。

**ドメイン（`linter.domains`）は明示せず、Biome の自動検出に委ねる。**
- Biome 2.x は React Hooks 系ルール（`useExhaustiveDependencies` / `useHookAtTopLevel` / `useJsxKeyInIterable` / `noChildrenProp`、いずれも `error`）を `react` ドメイン側の recommended として持つ。ドメインは**ファイルに最も近い `package.json` の依存から自動検出**される。
- 検証の結果、ルート単一設定でも `apps/frontend`（react 依存あり）のファイルでのみ react ルールが発火し、`apps/backend`（Hono）/`packages/shared` には適用されない。**パッケージ単位で正しくスコープされる**。
- ルートで `domains: { react: "recommended" }` と明示すると全ファイル（backend 含む）に react ルールが広がり、frontend に絞るには `overrides` が別途必要になる。自動検出のほうがスコープが正確で設定も増えない。
- 自動検出は `package.json` の依存の関数であり著者の書き方に依存しないため、決定 5 で重視した「出力の決定性」も損なわない。発見性（設定ファイルから react 有効が読み取れない）の弱点は本 ADR への明記で補う。
- 型推論が必要な `types` ドメイン（`noFloatingPromises` 等）は自動検出されない opt-in。採否は別途検討する（→ 決定 7）。

### 7. 型解析系ルール（`types` ドメイン / `noFloatingPromises`）— 現時点では不採用
await 漏れ検出（`noFloatingPromises`）など型推論を要するルールは、当初導入を検討したが**見送る**。

**理由**
- `noFloatingPromises` は **nursery（実験的）グループ**でのみ提供されており、`types` ドメインを有効化しても自動では ON にならず、個別に明示 ON が必須（検証で確認）。
- nursery ルールは仕様変更・誤検知の可能性があり、立ち上げ初期の学習プロジェクトで抱えるリスクに見合わない。
- 基本の型安全は `tsc`（`type-check` タスク）で既に担保されている。

**再検討の条件**：`noFloatingPromises` 等が nursery を卒業して recommended に昇格した時点、または await 漏れが実際に問題化した時点で導入を再検討する。

### 8. 上乗せする個別ルール — `noUndeclaredDependencies` のみ
recommended に含まれない安定版ルールのうち、`correctness/noUndeclaredDependencies`（`error`）の 1 つだけを上乗せする。

```jsonc
{
  "linter": {
    "rules": { "correctness": { "noUndeclaredDependencies": "error" } }
  }
}
```

**理由**
- pnpm モノレポでは「`package.json` に入れ忘れたパッケージを import する」事故が起きやすく、これを確実に止められる。安定版で誤検知もほぼ無い（既存全ファイルで誤検知ゼロを確認）。
- `recommended` はデフォルト ON のため `preset` は明記せず、OFF がデフォルトの本ルールを ON にする記述のみ書く（決定 5 の方針と一貫）。

**見送ったルール**
- `suspicious/noConsole`：学習段階では `console.log` デバッグが多く warn が邪魔。backend に logger を導入する段階で再検討。
- `style/useNamingConvention`：命名規約が未確定の初期に強制すると摩擦が大きい。規約を別途定めてから検討。

### 9. import 整理（`assist`）— デフォルト据え置き
import 並べ替え（`assist/source/organizeImports`）は **Biome のデフォルトで ON** のため、`assist` ブロックは記載しない（決定 5 の方針と一貫）。

**理由**
- デフォルトの並び順（`node:` 組み込み → 外部パッケージのアルファベット順 → 相対パス）が一般的で読みやすく、カスタムグループ（空行区切り・scope 別細分化）を初期に作り込む必要がない（検証で挙動確認済み）。
- 実際の整理は `biome check --write`（→ 決定 10 のスクリプト）経由で走る。`biome check`（書き換えなし）では未整列を検出してエラーにできる。

### 10. スクリプトとワンコマンド化 — ルート直接実行（Turborepo 非経由）
ルート `package.json` に以下の 2 スクリプトを置き、ルートから 1 コマンドで全 workspace を対象にする。

```jsonc
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write ."
  }
}
```

**理由**
- `biome check` は **lint + format 検証 + import 整理**を統合する単一コマンド。`format` 単体スクリプトは作らず `check` に一本化し、決定 1（単一コマンド）と一貫させる。
- `lint`＝検証のみ（CI・確認用）、`lint:fix`＝自動修正（format／import 整理／安全な lint 修正を適用）。
- **Turborepo は経由しない**。Biome は Rust 製・単一設定で全 workspace を一括高速処理でき（実測：全 20 ファイルを約 60–100ms）、Turborepo のタスク分割・キャッシュの恩恵が薄い。各パッケージにスクリプトを撒く分だけ複雑化するため、決定 2（ルート単一構成）と一貫してルート直接実行とする。
- CI 専用の `biome ci` は CI 未整備のため今回は置かず、CI 構築時に追加する。

**既存コードへの適用**：導入時点で `pnpm lint:fix` を実行し、既存全ファイル（ソース・各 `package.json`・`tsconfig`・`biome.json` 自身など）を Biome 規約へ整形済み（整形差分のみ、lint ロジックエラーは無し）。適用後 `pnpm lint` が 0 エラーであることを確認済み。
