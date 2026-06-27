---
description: GitHub Projects の先頭 issue を取得し、In Progress に移動してワークツリーとブランチを作成し、実装を開始する。
disable-model-invocation: true
---

## フェーズ 1 — PICK

Projects から先頭の issue を取得する:

```bash
gh project item-list 2 --owner yuki1567 --format json --limit 20 \
  | jq '[.items[] | select(.status == "Ready")] | .[0]'
```

取得した item の `id` と `content.number` を確認する。

---

## フェーズ 2 — CLAIM

issue を Projects の **In progress** に移動する:

```bash
gh project item-edit --project-id PVT_kwHOBVmhbs4BbOwL --id <item-id> --field-id PVTSSF_lAHOBVmhbs4BbOwLzhWAvBQ --single-select-option-id 47fc9ee4
```

---

## フェーズ 3 — REVIEW

issue の内容を確認する:

```bash
gh issue view <issue-number>
```

背景・作業内容・受け入れ基準を理解してから次に進む。

---

## フェーズ 4 — BRANCH

worktree とブランチを作成する:

```bash
git worktree add ../family-tree-app-<issue-number> -b <type>/<issue-number>-<kebab-case-description>
```

ブランチ命名規則:
- `<type>`: `feat` / `fix` / `chore` / `docs`
- `<kebab-case-description>`: issue タイトルから導いた短い英語の説明

---

## フェーズ 5 — IMPLEMENT

新しい worktree に移動し、受け入れ基準に沿って実装を開始する。

---

## エッジケース

- **Ready の item がない**: 「Projects に着手可能な issue がありません」と報告して停止する。
