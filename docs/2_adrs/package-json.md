# 依存パッケージの導入理由

`package.json` に入っている各依存について「**なぜ入れたのか（役割・導入理由）**」を記録する ADR。フレームワーク級の選定理由は tech-stack.md / project-structure.md にあるため、本書はそれらへの対応付けと、そこに明記されていない補助ライブラリ（glue）の理由を補う。

- ステータス: 決定完了（#14 開発環境構築の一部、随時追記）
- 関連 issue: #14
- 関連ドキュメント: [技術スタック](./tech-stack.md) / [プロジェクト構成・ツール選定](./project-structure.md) / [開発環境（コンテナ化）](./dev-environment.md)

> バージョンの指定方針（基盤 exact／ライブラリ caret フル表記 floor）は project-structure.md 決定 6 を参照。本書はバージョンではなく「採用そのもの」の理由を扱う。

## 共通（ルート / 全パッケージ）
| 依存 | 役割 | 導入理由 |
| --- | --- | --- |
| `typescript` | 型システム / コンパイラ（型チェック専用） | フロント・バック・shared すべて TS（tech-stack 決定 1）。`tsc --noEmit` で型チェックする（tsconfig.md）。 |
| `turbo`（Turborepo） | モノレポのタスクランナー | `build`/`dev`/`type-check` を依存グラフ・キャッシュ付きで束ねる（project-structure 決定 2）。 |
| `@types/node` | Node ランタイム API の型 | backend など Node の `process` 等を型付きで扱うため。版はランタイム Node 24 に合わせる（dev-environment 決定 2）。 |

（pnpm は依存ではなく `packageManager` で固定。理由は project-structure 決定 1。）

## frontend（`apps/frontend`）
| 依存 | 役割 | 導入理由 |
| --- | --- | --- |
| `react` / `react-dom` | UI ライブラリ本体／DOM レンダラ | SPA を React で構築（tech-stack 決定 3）。`react-dom` がブラウザへの描画を担う。 |
| `vite` | フロントのビルド/開発サーバ | 決定 3 のビルドツール。dev は HMR、本番は静的ビルド。 |
| `@vitejs/plugin-react` | Vite で React を扱う公式プラグイン | JSX 変換と Fast Refresh（HMR）を提供。決定 3（React + Vite）を成立させる glue。これが無いと Vite が JSX/React リフレッシュを扱えない。 |
| `@types/react` / `@types/react-dom` | React の型定義 | React 本体は型を同梱しないため、型付き開発に必須。 |
| `shared`（`workspace:*`） | モノレポ内の共有パッケージ | `Person` 等の共有型・定数をフロントから利用（project-structure 決定 3／型共有 = tech-stack 決定 1）。 |

## backend（`apps/backend`）
| 依存 | 役割 | 導入理由 |
| --- | --- | --- |
| `hono` | API フレームワーク | 独立 API を Hono で構築（tech-stack 決定 4）。ランタイム非依存の Web 標準フレームワーク。 |
| `@hono/node-server` | Hono の Node ランタイム用アダプタ | Hono 自体はランタイム非依存のため、**Node 上で常駐サーバとして動かすにはアダプタが必要**（tech-stack 決定 6＝常駐 Node サーバ）。`serve()` でリクエストを Node の HTTP に橋渡しする。 |
| `tsx` | dev で TS を直接実行 | backend の開発実行（`tsx watch`）。バンドルせず TS をそのまま起動・watch する（project-structure 決定 5）。 |
| `esbuild` | 本番バンドラ | backend の本番ビルドで自己完結バンドルを生成（project-structure 決定 5）。 |
| `shared`（`workspace:*`） | モノレポ内の共有パッケージ | 共有型・定数を backend から利用（型共有 = tech-stack 決定 1）。本番は esbuild が TS ソースごと取り込む（決定 5）。 |

## shared（`packages/shared`）
| 依存 | 役割 | 導入理由 |
| --- | --- | --- |
| `typescript` | 型チェック | ライブラリ単体でも `tsc --noEmit` で型検証するため（project-structure 決定 4）。 |

## 本 PR（開発環境構築）で追加予定
| 依存 | 役割 | 導入理由 |
| --- | --- | --- |
| `zod` | 実行時の環境変数スキーマ検証 | Infisical が注入した `process.env` を起動時に検証して型を付ける（dev-environment 決定 6）。 |

## 今後（実装着手時に追加予定／tech-stack で採用済み）
- `react-router` … ルーティング（tech-stack 決定 3）
- `@tanstack/react-query` … サーバ状態・データ取得（tech-stack 決定 3）
- `drizzle-orm` ＋ Postgres ドライバ（`pg` 等） … DB アクセス（tech-stack 決定 5）

導入時に本 ADR へ役割・理由を追記する。
