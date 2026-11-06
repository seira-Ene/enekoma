# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

EneKoma(エネコマ)は、日本大学文理学部(CHS)の学生向けAIチャットアシスタント。回答は『学部要覧』と時間割データに準拠し、履修登録や空きコマの相談にチャットで答える。

| 機能 | 内容 | 主な実装 |
|---|---|---|
| OCRカルテ化 | 成績表・時間割の画像/PDFから修得単位・GPA・履修科目を反映 | `app/api/chat/route.ts`, `parseProfileUpdateFromText`(`data/studentAccounts.ts`) |
| 卒業・進級要件チェック | 必修・選択必修の未履修、資格コース・副専攻の進捗、不足単位を判定 | `analyzeAcademicDeficiency`(`data/gakubuYoran.ts`), `data/departmentCurriculum.ts`, `data/coursesAndMinorsCurriculum.ts` |
| 目標GPA逆算 | 今期S・Aを何単位取れば目標GPAに届くかを提案 | `simulateGpaEngine`(`data/gakubuYoran.ts`) |
| 空き教室・構内ナビ | 今の時限の空き教室、自販機・ゴミ箱・各課窓口を案内 | `findFreeRooms`(`data/courses.ts`), `SYSTEM_PROMPT` と `answerLocally`(`route.ts`) |
| 履修サポート | 重複チェック、空きコマ提案、友達との空きコマ照合、必修組み込みの時間割案、移動判定、科目・教員・教室の逆引き | `answerTimetableQuery`(`data/timetableAssistant.ts`) |

## コマンド

ルートの `package.json` は `frontend` への委譲のみ。依存関係は `frontend` にインストールする。

```bash
npm --prefix frontend install
npm run dev      # http://localhost:3000
npm run build
npm run lint
cd frontend && npx tsc --noEmit   # 型チェック

# 時間割PDFの更新時(新カリ用と旧カリ用のPDFを1つのフォルダに置く。同種は日付が新しいものを使う)
pip install pdfplumber
python scripts/parse_timetable.py <PDFフォルダ> --check   # 件数と要確認行だけ表示
python scripts/parse_timetable.py <PDFフォルダ>           # timetableReiwa8*.json を更新

# FastAPI(任意)
cd backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8000
```

- テストフレームワークとテストファイルはリポジトリにない。変更後は型チェック、lint、ブラウザでの動作確認で検証する。
- lintは既存の指摘が多い(36 errors / 36 warnings)。変更箇所で新しい指摘を増やしていないかを見る。
- Geminiを使うには `frontend/.env.local.example` を `.env.local` にコピーして `GEMINI_API_KEY` を設定する。画面から入力したキーでも動く。キーがなければ `answerLocally` のローカル応答になる。
- 管理者画面を使うには `ADMIN_SECRET_KEY` を設定する。未設定だと管理者認証はすべて拒否される。`NEXT_PUBLIC_` は付けず、`page.tsx` にコードを書かない。検証は `/api/admin/maintenance` だけで行う。

## アーキテクチャ

実装の中心は `frontend/` のNext.js(App Router)。`@/*` は `frontend/` 直下を指す。

- `frontend/app/page.tsx`: UI全体を持つ約4500行の単一クライアントコンポーネント。`frontend/src/app/page.tsx` は再エクスポートのみなので、編集しない。
- `frontend/app/api/chat/route.ts`: チャットの中核。ナレッジを埋め込んだ `SYSTEM_PROMPT`、ルールベースの `answerLocally`、Gemini呼び出しを持つ。
- `frontend/app/data/`: 要覧・カリキュラム・時間割のデータと判定ロジック。`page.tsx` と `route.ts` の両方から使う。

### チャットの流れ

1. `page.tsx` が質問、APIキー、直近6件の履歴、添付ファイル、プロフィールを `POST /api/chat` に送る。
2. `route.ts` が `GEMINI_MODEL_ORDER` の順に1モデルずつ試す。すべて失敗すれば `answerLocally` で応答する。同時に呼ぶと無料枠を2倍使うので並列にしない。チャットは思考を最小にして速くしている。画像は読み取り精度を確認できていないので既定のまま。
3. サーバー通信自体が失敗すると、`page.tsx` がブラウザからGeminiを直接呼ぶ。

モデル名は `route.ts` と `page.tsx`(直接呼び出しとキーのテスト)の両方にハードコードされているので、変更時は両方を更新する。

添付画像は `data/imageUpload.ts` の `prepareFileForUpload` を通す。1MBを超える画像だけを縮小し、小さくならなければ元のまま送る。チャット履歴を `localStorage` に保存するときは画像データを除く(`withoutImagePreviews`)。含めると容量を超えて画面全体が落ちる。

### 時間割の回答

Geminiに時間割の事実を推測させない。`answerTimetableQuery` が質問を振り分けて実データを検索し、その結果を次の2通りで使う。

- `answerLocally`: 最初に呼び、結果があればそのまま返す。
- Gemini: `buildTimetableContext` が検索結果と現在日時をプロンプトに追加し、`SYSTEM_PROMPT` の規則でその内容以外を答えないように制限する。

時刻は `getCampusClock` で日本時間に変換する(Vercelのサーバーは日本時間ではない)。4〜9月を前期、10〜3月を後期とし、祝日・休講・行事は扱わない。教室の空き判定は入学年度に関係なく、全カリキュラムの授業を合わせて行う。

### `profile_update` の契約

AIの回答末尾に置く ` ```profile_update ` JSONブロックでプロフィールを更新する。`action` は `enroll_current_timetable`(今期の時間割)、`add_completed_timetable`(過去の時間割)、`transcript`(成績表)の3種類。

形式を変えるときは次をすべて揃える。

- `route.ts` の `SYSTEM_PROMPT` と `imageInstruction`(同じ形式が2か所にある)
- `parseProfileUpdateFromText`(`data/studentAccounts.ts`)
- `applyProfileUpdate`(`page.tsx`)

時間割表には成績が載っていないため、過去の時間割から登録する科目の評価は「修得」または「-」とし、推測しない(GPAを歪めないため)。

### 状態の保存

データベースはない。

- アカウント、プロフィール、チャット履歴、APIキーはブラウザの `localStorage` / `sessionStorage` に保存する。
- ログインと登録はクライアント側の `data/studentAccounts.ts` で処理する。`/api/auth` は `page.tsx` から呼ばれておらず、登録内容を保存もしない。
- メンテナンス設定だけはサーバー側のRedisに保存する(「運用ルール」参照)。

### カリキュラムの分岐

`admissionYear` が `reiwa6_or_earlier` か `reiwa7_or_later` かで参照する時間割が変わる。`getLectureDatabase(curriculum)` を経由する。

- `reiwa7_or_later`: `timetableReiwa8.json`
- `reiwa6_or_earlier`: `timetableReiwa8Legacy.json`

どちらも `scripts/parse_timetable.py` の生成物なので直接編集しない。修正はパーサーを直して再生成する。

### Python側とデプロイ構成

- `backend/main.py`: FastAPI版。空き教室、卒業判定、チャットなどのAPIを持つが、フロントエンドからは呼ばれていない。
- `frontend/api/index.py`: `backend/main.py` のほぼ複製。`api/index.py` は `backend/main.py` を読み込むだけの薄いラッパー。
- `chs_courses*.py`: `backend/`、`api/`、`frontend/api/` に同一のコピーがある。TS側の時間割データとは別管理で、令和8年度の更新は反映していない。

`vercel.json` では全リクエスト(`/api/*` を含む)を `frontend` サービスへ流すので、APIの実装先はNextのRoute Handler(`frontend/app/api/`)。`backend` サービスの定義は残っているが、公開ルートはない。

## 運用ルール

### メンテナンスモードの自動解除防止

- 機能追加やバグ修正などの作業中は、管理者が手動で解除するまでメンテナンス状態を継続する。
- 再デプロイ、環境変数の更新、サーバー再起動でメンテナンスモードが解除・リセットされない設計または運用手順にする。

設定は `maintenanceStore.ts` がUpstash Redisに保存する(`KV_REST_API_*` または `UPSTASH_REDIS_REST_*`)。Previewの操作が本番に影響しないよう、`VERCEL_ENV` ごとにキーを分ける。

- Redisが未設定の環境では、メモリと `.maintenance_state.json` に保存され、再デプロイで元に戻る。管理者画面に警告が出る。
- Redisの読み込みに失敗したときは前回の値を返し、起動直後で前回の値がなければ通常稼働として扱う。障害でサイト全体を止めないため。更新は失敗として返す。

### ログイン状態の保持

- メンテナンス完了時や本番デプロイの後も、ユーザーのログイン状態を維持する。
- デプロイのたびにセッションが切れて強制ログアウトされないよう、セッションと認証情報の保持方法を調整する。

ログイン中のIDは通常 `sessionStorage` だけに保存し、タブを閉じるとログアウトする。共用PCなどで他人の成績や時間割が表示されないようにするための意図的な設計で、既定の動作として維持する。

ログイン画面で「ログイン状態を保持する」を選んだときだけ、IDと有効期限(30日、延長なし)を `localStorage` の `enekoma_remembered_login` に保存する(`data/studentAccounts.ts`)。ログアウトと別アカウントへの切り替えで削除する。

`sessionStorage` / `localStorage` のキー名を変えるとログイン状態やデータが引き継がれないので、変更時は移行処理を入れる。

## 変更時の注意

- Next.jsは16系で、学習データと異なる場合がある。コードを書く前に `frontend/node_modules/next/dist/docs/` の該当ガイドを読む(`frontend/AGENTS.md`)。
- `frontend/CLAUDE.md` と `frontend/AGENTS.md` は `next dev` が管理するブロックを含む。
- AIの回答は、LINEのような自然な会話文にする方針。`SYSTEM_PROMPT` で記号・太字・見出し・システムタグを禁止し、`sanitizeConversationalReply` で後処理している。`answerLocally` の文言も同じ文体に揃える。
- 校舎・自販機・施設の案内は `SYSTEM_PROMPT` と `answerLocally` の両方に書かれている。情報を更新するときは両方を直す。
- 要覧の規則を扱うときは、必修と選択必修を区別し、令和7年度以降と令和6年度以前のカリキュラムも区別する。
