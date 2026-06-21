# pnpm workspace 設定（pnpm-workspace.yaml）

`pnpm-workspace.yaml` の各設定の理由・却下した代替案をまとめた ADR。pnpm を採用するという**選定**そのものは [プロジェクト構成・ツール選定](./project-structure.md) の決定 1 にあり、本書はその設定ファイルの中身を担う。

- ステータス: 決定完了
- 関連 issue: #14
- 関連ドキュメント: [プロジェクト構成・ツール選定](./project-structure.md)（決定 1：pnpm 選定／決定 3：ディレクトリ構成／決定 6：依存バージョン方針）

## 設定（最終形）
```yaml
packages:
  - "apps/*"
  - "packages/*"
strictDepBuilds: true
allowBuilds:
  esbuild: true
```

## 決定事項

### 1. `packages` — `apps/*` ＋ `packages/*`
workspace に含めるパッケージのグロブ。

**理由**
- project-structure 決定 3 のディレクトリ構成（`apps/{frontend,backend}` ＋ `packages/shared`）に一致させ、`apps/` 配下と `packages/` 配下を workspace パッケージとして認識させる。
- グロブ指定のため、将来パッケージを足しても自動で認識される。

**却下した代替案**
- 個別列挙（`apps/frontend` 等を逐一）: パッケージ追加のたびに編集が要る。グロブで足りる。
- ルート直下フラット構成に合わせた指定: 決定 3 で `apps`/`packages` 分類を採用したため不要。

### 2. ビルドスクリプト許可 — 既定ブロック ＋ `allowBuilds` で必要分のみ許可
pnpm は v10.26+ で、依存の `postinstall` 等ライフサイクルスクリプトを**既定でブロック**する（サプライチェーン攻撃対策）。実行が必要な依存だけ `allowBuilds` で明示許可する。現状の許可対象は `esbuild` のみ。

**理由**
- 既定ブロックは、悪意ある／不要な install スクリプトの自動実行を防ぐ安全策。これを活かす方針とする。
- `esbuild` はプラットフォーム別バイナリ選択の install スクリプトを持つため、許可しないと backend の本番バンドル（project-structure 決定 5）が壊れる。よって `esbuild: true`。
- Vite 8 の Rolldown や esbuild の native バイナリ自体は prebuilt（`optionalDependencies`）で配布されるため、追加の許可は不要。実際 install はクリーン（許可漏れ警告なし）。

**却下した代替案**
- すべてのスクリプトを許可（v10 以前の挙動）: 任意の依存の `postinstall` が自動実行され、サプライチェーン的に危険。
- `allowBuilds` を空にする: `esbuild` の install スクリプトが走らずバイナリ選択に失敗し、バンドルが壊れる。

### 3. `strictDepBuilds: true` — 未許可スクリプトは無視せず失敗させる
許可していないビルドスクリプトに遭遇した場合、**黙って無視せず install を失敗**させる。

**理由**
- 既定では未許可スクリプトは静かにスキップされるため、(1) 未知の `postinstall` を持つ依存が紛れ込んでも気づけない、(2) 本来必要なビルドが実行されない「許可漏れ」にも気づけない。`strictDepBuilds: true` は両方を**失敗として顕在化**させる。
- pnpm の「既定でスクリプトをブロックする」思想と一貫し、安全側に倒せる。現状 install はクリーンなので追加しても失敗しない。

**却下した代替案**
- 未設定（既定）: 未許可スクリプトが黙って無視されるため、見逃し・許可漏れに気づきにくい。

### 4. catalog — 複数パッケージで使う依存のバージョンを一元管理

`pnpm-workspace.yaml` の `catalog:` に複数パッケージで共通利用する依存を登録し、各 `package.json` では `"catalog:"` で参照する。現在の登録対象は `zod` と `typescript`。

**理由**
- 複数パッケージが同じ依存を持つ場合、各 `package.json` に別々にバージョンを書くと更新時に複数箇所を直す必要が生じる。catalog に集約することで `pnpm-workspace.yaml` の1行だけ更新すれば全パッケージに反映される。
- `noUndeclaredDependencies`（Biome ルール）により各パッケージは自身の `package.json` に依存を宣言する必要があるため、ルートにまとめて置く方式は取れない。catalog はこの制約を守りつつバージョンを一元管理できる。

**catalog 対象外とするもの**
- `@biomejs/biome`: exact 固定・ルート専用（lint-format ADR 決定 3 参照）
- `@types/node`: backend 専用のため複数パッケージで共有しない

**却下した代替案**
- 各パッケージに個別宣言（`^x.x.x`）: `pnpm update -r` で一括更新できるが、バージョン指定が複数箇所に散らばる。
- ルートの `devDependencies` に置く: `noUndeclaredDependencies` ルールに違反する。
