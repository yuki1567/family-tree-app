# バックエンド API 基盤

Hono API の共有スキーマ・レスポンス形式・ルーティング構成・RPC 配線についての決定と理由をまとめた ADR。

- ステータス: 決定中（issue #19 で順次追記）
- 関連 issue: #19
- 関連ドキュメント: [技術スタック](./tech-stack.md)（決定 4: Hono / 決定 1: 型共有）/ [プロジェクト構成](./project-structure.md)（決定 3: packages/shared）

---

## 決定事項

### 1. 共有スキーマの SSOT — Zod スキーマを正とし、型は `z.infer` で導出

`packages/src/` の共有型は、Zod スキーマを本体（SSOT）とし、TypeScript の型は `z.infer<typeof schema>` で導出する。手書きの `interface` / `type` は持たない。

**理由**
- API 境界・CSV インポート・フォーム入力はすべて「実行時に外から来る未知の値」であり、型だけでは実行時検証ができない。Zod スキーマを本体にすることで `.parse()` / `.safeParse()` による実行時検証が同じ定義から得られる。
- スキーマを正にすることで、フィールド追加時にスキーマを直せば型も自動追従し、型と検証ロジックのズレが原理的に起きない。
- `.omit()` / `.partial()` / `.extend()` 等のスキーマ演算で「作成用（id 除外）」「更新用（全フィールド任意）」等の派生スキーマを1か所から導出できる。

**留意点**
- `.default()` / `.transform()` を付けると `z.input<>` と `z.output<>` が乖離するため、変換を伴う場合は `z.infer`（= `z.output`）と `z.input` を使い分ける。

**却下した代替案**
- 手書き `interface` ＋ Zod スキーマを並立: 型とスキーマが二重管理になりズレが入り込む。`satisfies z.ZodType<T>` で縛れるが根本解決にならない。

### 2. API レスポンス形式 — エラーは `{ error: { code, details? } }`、成功は `{ data: T }`

**エラーレスポンス**
```json
{ "error": { "code": "VALIDATION_ERROR", "details": [{ "field": "name", "code": "REQUIRED" }] } }
{ "error": { "code": "NOT_FOUND" } }
```

- `code` は機械読み用（`ErrorCode` 型）。フロントがエラー種別で分岐するために使う。
- `message` は持たない。ユーザー向け文言はフロントが `code` を元に自前で決める（NFR-07 i18n 方針とも整合）。開発者向けのデバッグ情報はサーバーログに出す。
- `details` はバリデーションエラー時のみ、フィールドレベルの詳細を配列で付ける。

**成功レスポンス**
```json
{ "data": { "id": "1", "name": "山田太郎" } }
{ "data": [...], "meta": { "total": 100, "page": 1 } }
```

- 成功は `data` キーでラップする。エラーとの識別（`'data' in response` vs `'error' in response`）が明確になる。
- リスト系エンドポイントはページネーション情報を `meta` として `data` と並列に付ける（数千人規模の要件に対応）。
- `ApiSuccessResponse<T>` 型は shared に定義しない。Hono RPC がハンドラの返り値から型を自動推論するため、ラッパー型は冗長になる。

**却下した代替案**
- エラーに `message` を含める: フロントはユーザーに見せず、デバッグ用ならサーバーログで十分。API レスポンスにサーバー内部の情報を出す理由がない。
- dev 環境のみ `message` を返す: 環境差分がコードに入り、dev/prod の挙動が乖離する。
- 成功をラップしない（プレーン返却）: リスト系でページネーション `meta` を付けると成功レスポンスの形がエンドポイントごとに揃わなくなる。
