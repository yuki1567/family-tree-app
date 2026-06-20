# TypeScript 設定（tsconfig）

モノレポの TypeScript 設定（共通ベース＋各パッケージの extends）について、各 compilerOptions の選定理由と却下した代替案をまとめたドキュメント。上位方針は [プロジェクト構成・ツール選定](./project-structure.md) の決定 4 にあり、本書はその詳細を担う。

- ステータス: 決定完了（実装は #14 で実施）
- 関連 issue: #14
- 関連ドキュメント: [プロジェクト構成・ツール選定](./project-structure.md)（決定 4：TypeScript 設定方針）

## 背景
- 構成は `tsconfig.base.json`（共通 compilerOptions）を `apps/*`・`packages/*` が `extends` し、環境差分のみ上書きする（project-structure.md 決定 4）。本書はその base と各パッケージの個別設定の選定理由を記録する。
- 前提: TypeScript 6.0 系 / pnpm + Turborepo / フロントは Vite、backend は dev=tsx・本番=esbuild バンドル。型チェックは各パッケージの `tsc --noEmit`（決定 5）。TypeScript を含む各依存の導入理由は [package.json の依存と導入理由](./package-json.md) を参照。
- 選定にあたり、最新の TypeScript 仕様と Vite 公式 react-ts テンプレートを突き合わせ、context7 で裏取りした。

## 決定事項

### 1. tsc は型チェック専用（`noEmit: true`）
tsc では出力せず、型チェック専用にする。実際の JS 出力は Vite（フロント）/ esbuild（backend 本番）/ tsx（backend dev）が各自で行う。

**理由**
- ビルドツールが出力を担う構成（project-structure.md 決定 5）と整合し、出力責務が二重化しない。
- tsconfig の `target` 等は「出力 JS の水準」ではなく「型チェック上どの言語機能・グローバルを前提とするか」を決める設定になる（決定 2 の floor の考え方の前提）。

### 2. `target` / `lib` の floor — ES2023
型チェック上の言語水準（floor）を base で `target: "ES2023"` / `lib: ["ES2023"]`（DOM なし）とする。

**理由**
- `noEmit` のため `target` は出力水準を決めず、型チェック上の「前提にできる言語機能・グローバル」を決めるだけ。よって floor は「コードがどの環境でも安全に前提にできる範囲」で選ぶ。
- `packages/shared` はフロント（ブラウザ）と backend（Node）双方から import されるため、共有コードが前提にできるのは**両環境の交差点**。base の floor をブラウザ安全側に置くことで、shared が `Object.groupBy` 等の新しめ API を使ってブラウザで動かない事故を防ぐ。
- ES2023（`Array.prototype.findLast` / `toSorted` 等）はモダンブラウザ（対応ブラウザ要件の Chrome・Safari 最新）と Node 24 の双方が完全対応する。Vite 公式 react-ts テンプレートも `ES2023` を採用しており整合する。

**却下した代替案**
- ES2022 据え置き: 動作するが、Vite テンプレと水準がずれ、ES2023 の便利 API を型上使えない。引き上げない積極的理由がない。
- ES2024 以上を base に: Node 24 では動くが、`packages/shared` 経由で ES2024 専用 API がブラウザに載るリスクが出る。floor は交差点に置く原則から外れる。
- backend だけ floor を ES2024 に上書き: Node 専用なので技術的には可能。ただし ES2024 固有機能が必要な場面が現状見えないため見送り、必要が見えた時点で backend の tsconfig に追加する（「追加は実装しながら判断」方針に沿う）。

### 3. `module` / `moduleResolution` — `ESNext` + 明示 `Bundler`
`module: "ESNext"` と `moduleResolution: "Bundler"` を明示併記する。

**理由**
- バンドラ（Vite / esbuild / tsx）が解決・変換を行う前提に合わせる。`Bundler` 解決により拡張子なし import 等を許容し、実挙動と型解決を一致させる。
- `moduleResolution: "Bundler"` は `module: "esnext"`（または `"preserve"`）でしか使えない制約があり（context7 で確認）、`module: "es2022"` 等は組み合わせ不可。Bundler 採用時の実質的な選択肢は `esnext` か `preserve` の 2 択。
- `esnext` + 明示 `bundler` は Vite 公式テンプレートと一致し、`moduleResolution` が明示で「何が効いているか」が読みやすい（学習面の利点）。

**却下した代替案**
- `module: "preserve"`（TS5.4+）: `moduleResolution: bundler` / `esModuleInterop` / `resolveJsonModule` を含意して 1 行に畳めるが、(1) 含意が暗黙化し可読性で劣る、(2) 主目的の `import x = require()` 混在対応は純 ESM の本プロジェクトで不要、(3) Vite テンプレも採用していない、ため見送り。
- `module: "es2022"` 等: `moduleResolution: "Bundler"` と組み合わせ不可のため選択肢にならない。

### 4. ファイル単位変換を前提とした厳格化
`isolatedModules` / `verbatimModuleSyntax` / `erasableSyntaxOnly` / `moduleDetection: "force"` をまとめて有効化する。

**理由**
- esbuild / tsx / Vite は型情報を使わず**1 ファイル単位で型を剥がす**変換を行う。これらフラグは「ファイル単位で安全に変換できる」制約をコンパイラに強制し、変換器の挙動と型レベルの前提を一致させる。
  - `isolatedModules`: 1 ファイル単独でトランスパイル可能な制約（const enum の越境参照などを禁止）。
  - `verbatimModuleSyntax`: import/export を書いたまま出力し、型のみ import に `import type` を必須化。型 import を確実に消せる。値／型の区別が明示され学習面でも有利。
  - `erasableSyntaxOnly`（TS5.8+）: 型を剥がすだけでは消えない構文（`enum` / ランタイムコードを持つ `namespace` / パラメータプロパティ / `import = require()` / `export =`）をエラーに。Node の型ストリップ実行とも整合し、`verbatimModuleSyntax` との併用が公式推奨。
  - `moduleDetection: "force"`: 全ファイルをモジュール扱いにし、暗黙のグローバルスクリプト化（グローバルへの変数流出・名前衝突）を防ぐ。
- `verbatimModuleSyntax` / `erasableSyntaxOnly` / `moduleDetection: force` は Vite 公式テンプレートにも含まれる。

**却下した代替案**
- これらを無効化: 記述の手間（`import type` の明示、`enum`/`namespace` を避ける等）は減るが、ファイル単位変換器との不一致による「型だけ import を消し損ねる」「enum がランタイムで壊れる」等の事故リスクが残る。手間はエラーで誘導されるため学習コストとして許容する。
- `erasableSyntaxOnly` で `enum` が禁止される点: `as const` オブジェクトや union 型で代替でき、モダン TS のベストプラクティスに沿うためむしろ利点と判断。

### 5. `skipLibCheck: true`
依存パッケージの `.d.ts` の型チェックをスキップする（自分のコードの型チェックには影響しない）。

**理由**
- 型チェック／ビルドを高速化。`@types/*` のバージョン差など**自分では直せない他者由来の型不整合**に振り回されない。React / Vite / Next 等ほぼ全テンプレが標準で有効にしており、Vite テンプレも `true`。

**却下した代替案**
- `false`: 依存の `.d.ts` 不整合まで検出できるが、自分のコード品質向上には寄与せず、直せないエラーで赤くなりがちで実益が薄い。

### 6. 追加の厳格フラグは当面見送り
`noUncheckedIndexedAccess` / `noUncheckedSideEffectImports` は設定しない（`strict` には含まれない独立フラグ）。

**理由**
- 初期実装の摩擦を避け、必要性が見えた時点で追加する（project-structure.md 決定 4「追加フラグは実装しながら判断」に沿う）。

**却下した代替案（＝今は入れない判断）**
- `noUncheckedIndexedAccess` を入れる: 配列/辞書アクセスを `T | undefined` 扱いにし安全性は上がるが、`for` ループや自明なキーでも undefined 対応が増え摩擦が大きい。`family` のデータ構造を扱い始めて必要性が見えた段階で導入を再検討する。
- `noUncheckedSideEffectImports`（TS5.6+）を入れる: 解決できない副作用 import（`import "./x"`）のタイポを検出できるが、Vite 公式テンプレ外の上乗せ。フロントの CSS 副作用 import は `vite/client` の型で解決されるため実害はないが、まずはテンプレ準拠とし見送り。

### 7. Lint 系チェックは tsconfig に持たせない
`noUnusedLocals` / `noUnusedParameters` / `noFallthroughCasesInSwitch` 等は tsconfig に入れない。

**理由**
- 未使用変数・switch フォールスルー等は静的解析の領分であり、lintツールで一元的に扱う方が責務が綺麗。
- Vite テンプレはこれらを tsconfig に含むが、lintツールと役割が重複するため本プロジェクトでは tsconfig から外す。

### 8. 各パッケージの上書き
base を共通に保ち、環境差分のみ各パッケージで上書きする。

**`apps/frontend`**
- `lib: ["ES2023", "DOM", "DOM.Iterable"]`: ブラウザ実行のため DOM API の型を追加。Vite テンプレは `["ES2023", "DOM"]` だが、`DOM.Iterable`（`for...of` で NodeList 等を反復する型）は React 開発で有用なため残す。
- `jsx: "react-jsx"`: React 17+ の自動 JSX ランタイム（`import React` 不要）。
- `types: ["vite/client"]`: `import.meta.env` / `*.css` 等の Vite 型を有効化。
- `include: ["src", "vite.config.ts"]`: アプリ本体に加え設定ファイルも型チェック対象に含める。

**`apps/backend`**
- `types: ["node"]`: Node ランタイム（`process` / `Buffer` 等）の型を有効化。DOM は継承せず（base に無い）、ブラウザ API の誤用は型エラーになる。

**`packages/shared`**
- base を `extends` するのみ。DOM も Node も前提にしないライブラリのため追加の `lib`/`types` を持たず、両環境で安全な範囲（決定 2 の floor）に自然に制約される。

## その他の共通設定（標準的で代替案検討の対象外）
- `strict: true`: `noImplicitAny`・`strictNullChecks` 等の厳格チェック一式。型安全の根幹（project-structure.md 決定 4 で確定）。
- `esModuleInterop: true`: CommonJS を default import で扱える相互運用。`module: esnext` では含意されないため明示。
- `resolveJsonModule: true`: JSON ファイルの import を許可。
- `forceConsistentCasingInFileNames: true`: ファイル名の大小不一致を禁止。mac（大小無視 FS）と Linux（区別）の差で壊れるのを防ぐ。
