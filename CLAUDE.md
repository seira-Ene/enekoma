# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

EneKoma(エネコマ)は、日本大学文理学部(CHS)の学生向けAIチャットアシスタント。回答は『学部要覧』と時間割データに準拠し、履修登録や空きコマの相談にチャットで答える。

| 機能 | 内容 | 主な実装 |
|---|---|---|
| OCRカルテ化 | 成績表・時間割の画像/PDFから修得単位・GPA・履修科目を反映 | `app/api/chat/route.ts`, `parseProfileUpdateFromText`(`data/studentAccounts.ts`) |
| 卒業・進級要件チェック | 必修・選択必修の未履修、資格コース・教職の教科専門科目・副専攻の進捗、不足単位を判定 | `analyzeAcademicDeficiency`(`data/gakubuYoran.ts`), `data/departmentCurriculum.ts`, `data/coursesAndMinorsCurriculum.ts`, `data/teachingLicenseCurriculum.ts` |
| 目標GPA逆算 | 今期S・Aを何単位取れば目標GPAに届くかを提案 | `simulateGpaEngine`(`data/gakubuYoran.ts`) |
| 空き教室・構内ナビ | 今の時限の空き教室、自販機・ゴミ箱・各課窓口を案内 | `findFreeRooms`(`data/courses.ts`), `SYSTEM_PROMPT` と `answerLocally`(`route.ts`) |
| 履修サポート | 重複チェック、空きコマ提案、友達との空きコマ照合、必修組み込みの時間割案、移動判定、科目・教員・教室の逆引き | `answerTimetableQuery`(`data/timetableAssistant.ts`) |
| デザインテーマ | デフォルト・かわいい・かっこいいの切り替えと、メインの色(おすすめの色・好きな色)の選択(プロフィールの基本設定タブ) | `data/themes.ts`, `globals.css`, `layout.tsx` |
| 位置情報・自動出欠 | GPSで文理学部の校内 / 校外を判定し、時間割の授業ごとに出席・遅刻・欠席を自動記録、手で修正（プロフィールの「出欠」タブ）。スマホの自動化（iPhoneのショートカット・Androidの自動化アプリ）から到着・出発を受け取り、EneKomaを閉じていた間の授業も記録 | `data/campusLocation.ts`, `data/attendance.ts`, `components/AttendancePanel.tsx`, `components/LocationCard.tsx`, `components/CampusAutomationCard.tsx`, `data/campusHook.ts`, `api/campus-hook/` |
| フレンド | フレンドコードで申請・承認、フレンドの今の曜限の授業（科目名・教室）か空きコマか、校内 / 校外を表示（位置情報なしの人も一覧に出す）、共有のON/OFF、チャットで「今だれが空きコマ？」に回答 | `components/FriendsPanel.tsx`, `api/friends/`, `data/friendStatus.ts` |
| 話し方の指定 | 「織田信長みたいに話して」「関西弁で話して」で口調を変え、「普通の話し方に戻して」かチップの✕まで続ける。事実は変えない | `data/speakingStyle.ts`, `api/chat/styleRewrite.ts` |
| お問い合わせ・ユーザーの声 | レビュー・ご意見・質問・不具合報告の受付、管理者画面でのステータス管理と公開の切り替え、公開分を `/voices` に匿名で表示 | `components/FeedbackModal.tsx`, `components/AdminFeedbackModal.tsx`, `api/feedback/`, `api/admin/feedback/` |
| いつもの質問 | 2回以上送った質問のうち、60日以内に使ったものを回数の多い順に4件、チャットの質問例の上にチップで出す。タップで送信、✕で履歴から削除。記録は端末内・アカウントごと（`enekoma_user_frequent_questions:<ログインID>`）で、サーバーには送らない。60文字超・メールアドレス・7桁以上の数字を含む文は記録しない | `data/frequentQuestions.ts`, `components/FrequentQuestions.tsx` |

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
2. `route.ts` が `GEMINI_MODEL_ORDER` の順に1モデルずつ試す。すべて失敗すれば `answerLocally` で応答する。同時に呼ぶと無料枠を2倍使うので並列にしない。思考量は用途で分ける(`*_THINKING_CONFIG`)。チャットと成績表は `minimal`、時間割は `low`。時間割を `minimal` にすると、画質の悪い画像で科目名を読み違えた(架空データでの実測)。変更するときは正答率を測ってから決める。

成績表・時間割の読み取り（プロフィール・新規登録の添付、チャットで種類を選び文を書かずに送った添付）は、`extract`（`transcript` / `current_timetable` / `past_timetable`）を付けて送り、`api/chat/extraction.ts` の `extractDocument` が会話文なしのJSON（`responseSchema`、`temperature: 0`、PDFは `mediaResolution` HIGH）で読む。会話文と一緒に出させると、科目が多いほど遅くなり、72科目のPDFは上限時間を超えて全件を失った（架空データ：従来は平均33秒・72科目PDFは失敗、JSONだけにして平均7〜10秒・全172行を抽出）。AIに表の行数（`courseRowCount` / `classCellCount`）を先に数えさせ、読めた件数がそれより少ない・形の崩れた行があるときは思考を1段上げて1回だけ読み直し、それでも足りなければ `extractionWarning` を返して画面で知らせる。縦に長い画像は `prepareFileForUpload(file, undefined, { split: true })` が上下の重なる複数枚（`images`）に分け、重なりで2回出た行はサーバーで1つにする。
3. サーバー通信自体が失敗すると、`page.tsx` がブラウザからGeminiを直接呼ぶ。

Geminiに失敗したときも `/api/chat` は200で `source: 'local'` と `error`（理由）・`errorStatus` を返す。キーがどこにもないのに画像・PDFが送られたときは `needsApiKey: true` を返す。成績表・時間割の読み込み（`handleProfileFileUpload`）はこれを見て、キーの設定が必要か、キーの不備・上限などの理由を表示する。本番のVercelに `GEMINI_API_KEY` がないと、画面でキーを入れた利用者しか画像を読み取れない。

モデル名は `route.ts` と `page.tsx`(直接呼び出しとキーのテスト)の両方にハードコードされているので、変更時は両方を更新する。

添付ファイルは `data/imageUpload.ts` の `prepareFileForUpload` を通す。形式は中身の先頭バイトで判定する（Androidでは `file.type` が空のことがあるため）。写真（JPEG・HEIC・WebP）と500KBを超える画像は長辺1600px程度・品質0.85のJPEGにし、写真は明るさの幅を広げる（`stretchContrast`。影や薄い印刷で文字が消えないように）。スクリーンショット（PNG）の明暗は変えない。Vercelはリクエスト本文が約4.5MBを超えると413で弾くので、data URL が `MAX_UPLOAD_DATA_URL_CHARS`（元のファイルで約3MB）を超えるものは送らずに理由を出す。ファイル選択の `accept` は `UPLOAD_ACCEPT` にそろえる（`image/*` を含めるとスマホで写真・カメラを選べ、iPhoneはHEICをJPEGにして渡す）。失敗時の文言は `describeAnalysisFailure` で作り、通知（`profileNotification`）はモーダルより前面に出す。チャット履歴を `localStorage` に保存するときは画像データを除く(`withoutImagePreviews`)。含めると容量を超えて画面全体が落ちる。

### 時間割の回答

Geminiに時間割の事実を推測させない。`answerTimetableQuery` が質問を振り分けて実データを検索し、その結果を次の2通りで使う。

- `answerLocally`: 最初に呼び、結果があればそのまま返す。
- Gemini: `buildTimetableContext` が検索結果と現在日時をプロンプトに追加し、`SYSTEM_PROMPT` の規則でその内容以外を答えないように制限する。

時刻は `getCampusClock` で日本時間に変換する(Vercelのサーバーは日本時間ではない)。4〜9月を前期、10〜3月を後期とし、祝日・休講・行事は扱わない。教室の空き判定は入学年度に関係なく、全カリキュラムの授業を合わせて行う。

科目・先生の逆引きは、プロフィールの入学年度の時間割だけを検索する。見つからず、もう一方のカリキュラムにあるときは、そちらにあることと入学年度の直し方を答える（`answerFromOtherCurriculum`）。科目名は `rankCourseNames` で探す。そのまま含まれる名前のほか、2文字の組の75%以上が一致する少し違う書き方（「次世代コミュニティ情報科学1」→ 次世代社会コミュニティ情報科学1、「データ構造とアルゴリズム」→ アルゴリズムとデータ構造）も候補にし、「〇〇のことですね」と正しい名前を添える。番号つきの科目は文章の数字と合うものだけ。ローマ数字は `normalizeCourseNumerals`（`baseCourseName` の中）で算用数字にそろえる。もう一方のカリキュラムのほうが長く一致するとき（自分の時間割には名前の一部の「アルゴリズム」しかない、など）は、もう一方を案内し、同じ先生が同じ学期・曜日・時限に教える自分のカリキュラムの科目（名前が変わった対応科目の候補）も添える。これは教員と時限の一致からの推測なので、検索結果に `COUNTERPART_NOTE` があるときは `buildTimetableContext` が `COUNTERPART_TONE_RULE`（「対応しています」「登録されているはず」と断定せず、「〜の可能性があります」と伝え、シラバスか教務課での確認を添える）をGeminiへの指示に足す。`SYSTEM_PROMPT` にも、参照データで推測・候補とされた内容は断定しない規則がある。科目名と曜日・時限があれば（「〇〇は月曜4限？」「月4の〇〇」）、そのコマにあるかを先に答える。「月4」「火曜3」も曜日と時限として読む（「11月4日」「月4回」は除く）。「次の授業の教室に早めに入れる？」は、カルテの今期の時間割から今日の次の授業を探し、その教室が前のコマに使われているかで答える（`answerEarlyEntry`）。「今日の授業は？」「明日の授業」「次の授業は？」「私の時間割」は、カルテの今期の時間割から答える（`answerMySchedule`。科目・先生・教室の名前があれば逆引き、曜日と時限の指定は開講科目のまま）。Geminiのプロフィール欄には今期の時間割が入らないので、この検索結果がないと「時間割が未登録」と答えてしまう。名字だけの先生検索は「谷先生」のような1文字の名字にも対応し、直前に漢字があるとき（「大谷先生」）は一致させない。

### `profile_update` の契約

AIの回答末尾に置く ` ```profile_update ` JSONブロックでプロフィールを更新する。`action` は `enroll_current_timetable`(今期の時間割)、`add_completed_timetable`(過去の時間割)、`transcript`(成績表)の3種類。

形式を変えるときは次をすべて揃える。

- `route.ts` の `SYSTEM_PROMPT` と `imageInstruction`(同じ形式が2か所にある)
- `parseProfileUpdateFromText`(`data/studentAccounts.ts`)
- `applyProfileUpdate`(`page.tsx`)

時間割表には成績が載っていないため、過去の時間割から登録する科目の評価は「修得」または「-」とし、推測しない(GPAを歪めないため)。

### 成績と再履修

評価の判定、修得単位とGPAの計算は `data/courseGrades.ts` にまとめてある。個別に `grade === 'D'` のような判定を書かず、ここの関数を使う。

- 評価は `normalizeGrade` で S/A/B/C/D/E/F にそろえる(秀→S、優→A、良→B、可→C、不可→D)。
- D/E/F は不合格で、修得単位に数えない。GPAでは0点として分母に含める。P(履修中止)は修得単位にもGPAにも入れない。N(認定)と合格は修得単位に入れ、GPAには入れない。
- 同名科目は `resolveRetakes` で1件にし、最後の履修だけを残す(要覧 p.39)。`takenYear`(年度)と `term`(学期)があればそれで前後を決める。なければ合格した記録を残し(修得済みの科目は再履修できないため)、どちらも同じなら後から読み込んだ方を残す。
- `currentCredits` と `currentGpa` は、科目の記録があればそこから計算し直す。AIが返した `totalEarnedCredits` は使わず、記録の合計と違えば通知で知らせる(読み取り漏れの確認用)。

### 状態の保存

データベースはない。

- プロフィール、成績、時間割、チャット履歴、APIキーはブラウザの `localStorage` / `sessionStorage` に保存する。サーバーには送らない。例外はフレンド機能で、共有をONにしている人の今期の時間割のうち、曜日・時限・科目名・教室だけと、位置情報をオンにしている人の「校内か校外か」だけをサーバーに送る（下記）。もう1つは「開いていないときも記録する」を設定した人の到着・出発（下記）。緯度・経度と出欠の記録は端末から出さない。
- ログイン情報（ログインID・氏名・学科・学年・メールアドレス・パスワードのscryptハッシュ）だけは、`/api/account`（`app/api/account/`）がRedisに保存する。パスワードの照合はサーバーで行い、サーバーに登録したアカウントは端末にパスワードを残さない（`serverLinked`）。
- パスワード再設定とログインIDの確認は、確認済みのメールアドレスに送るリンク（再設定30分・確認24時間、1回限り、保存はトークンのハッシュだけ）で行う。応答はアカウントの有無で変えない。ログインは同じIDに15分で10回まで、同じアドレスへのメールは1時間に3通まで。
- 以前の端末内だけのアカウントは、次のログインでサーバーに登録する（パスワードが8文字未満なら新しいパスワードを決めてもらう）。デモアカウント（`INITIAL_DEMO_ACCOUNTS`）は端末内だけで、サーバーには登録できない。
- アカウント切替は、デモ以外はパスワードの入力が必要（共用PCで他人のカルテを開けないように）。
- メールアドレスは `checkEmailAddress`（`data/emailAddress.ts`）で画面とサーバーの両方で確認する。大学のドメイン（`@g.nihon-u.ac.jp`）に似ているのに違うもの（`.ac.jo` など）や、よくある打ち間違い（`gmail.con` など）は登録させない。入力欄では大学のアドレスの登録を案内する。
- メールの送信は `app/api/account/mailer.ts`。本番はGmail（`GMAIL_USER` と `GMAIL_APP_PASSWORD`、nodemailerでsmtp.gmail.com:465）で送る。送信元はそのGmailアドレスで、`MAIL_FROM` で表示名だけ変えられる。Gmailの送信上限は1日約500通。送信のたびに `[mail] sent` / `[mail] failed` の1行ログ（日本時間・宛先のユーザー名を伏せたアドレス・件名・Gmailの応答・messageId）を出す。本文とリンクは出さない。同じ内容を直近50件・7日間Redisにも残し（`app/api/account/mailLog.ts`）、管理者モードの「📧 メール送信ログ」（`/api/admin/mail-log`、`ADMIN_SECRET_KEY` で認証）で見られる。送らなかった場合も `skipped` と理由（account_not_found・email_not_verified・rate_limited など）を残す。Vercel Hobbyの実行ログは約1時間で消え、`vercel logs` でも実行ログは取れないので、届かない報告はこの画面で確認する。Resend（`MAIL_PROVIDER=resend`、`RESEND_API_KEY`、`MAIL_FROM`）にも切り替えられる。ローカル開発で未設定ならサーバーのログに出し、Vercel上で未設定ならメール機能は503を返す。リンクのドメインは `APP_BASE_URL`、なければVercelの本番URLを使う（Hostヘッダーは使わない）。Redisのない環境では、ローカル開発だけメモリに保存する。
- メンテナンス設定だけはサーバー側のRedisに保存する(「運用ルール」参照)。
- ログイン・登録の応答で、ログイン中の印（`sessionToken`）を返す。サーバーはハッシュだけを30日間保存する（`createSession`）。端末ではログインIDと同じく `sessionStorage` の `enekoma_session` に置き、「ログイン状態を保持する」のときだけ `localStorage` の `enekoma_remembered_session` にも置く。アカウントを切り替えると消す（`setCurrentStudentId`）。この印がない以前のログインでは、フレンド画面でパスワードを聞き直す。
- フレンド機能（`api/friends/`）：フレンドコード（読み間違えやすい0/O・1/Iを除く英数8桁、`ensureFriendCode`）で申請し、相手が承認すると friendships の status が accepted になる。相手に返すのは名前とフレンドコードだけで、ログインIDは返さない。共有設定（`shareScheduleStatus`、既定ON）がONの人の時間割は `sanitizeSharedSchedule` で曜日・時限・科目名・教室だけにして保存し、OFFにしたら消す。校内 / 校外は、プロフィールの「出欠」か「フレンド」タブで位置情報をオンにした端末が、画面を見ている間2分ごとに `getCurrentPosition` で測位し、`isOnCampus` / `judgeCampus`（`data/campusLocation.ts`。文理学部の敷地の中心 35.6632, 139.6346 から半径350m（敷地の四隅が約318mあるため）、誤差75mまで見込む。誤差500m超は、誤差の円がまるごと校外のときだけ校外、それ以外は判定しない）で決める。測位は起動時・画面に戻ったとき（visibilitychange・pageshow・focus）・出欠かフレンドのタブを開いたとき・2分ごとに行い、まず高精度で測って、時間切れなど（拒否以外）なら通常精度（Wi-Fi・基地局）で取り直す（屋内でGPSが届かないため）。測位の記録は判定が変わったときと1分ごとに残す。原因調査用の `[Attendance]` ログ（`attendanceLog`）は開発中と、`localStorage` に `enekoma_debug_attendance=1` を入れた端末だけに出す。サーバーには `campus` アクションで真偽値だけを送り（変わったときと5分ごと、オフにしたら null）、`campus:` に1日保存する。30分以上新しい判定がなければ「位置情報なし」。共有OFFの人は保存せず、フレンドには null を返す。一覧は校内の人を上にする（`compareCampus`）。以前のオンライン表示（heartbeat）は廃止した。自動出欠は `data/attendance.ts`：開始30分前〜15分後に校内なら出席、30分後までなら遅刻、開始後に校外と確認されて30分を過ぎるか、終わりまで校内と確認できなければ欠席、授業の時間に一度も測位していなければ未確認（ブラウザはアプリを開いている間しか測位できないため）。手で直した記録（`source: 'manual'`）は自動で上書きしない。ブラウザは閉じている間に測位できないので、出欠タブの「開いていないときも記録する」（`CampusAutomationCard`）で自動化用のURLを作り、スマホの自動化（iPhoneのショートカットの「到着」「出発」、Androidは MacroDroid などのジオフェンス）から `POST /api/campus-hook?t=<鍵>&e=arrive|leave` を送ってもらう。ログインは不要で、鍵（ハッシュだけ保存。作り直すと前の鍵は無効）でアカウントを決め、到着か出発かと時刻だけを `campus_events:<ログインID>` に36時間保存する（最大40件、1時間に30回まで）。鍵はURLを見直せるように端末の `enekoma_campus_hook:<ログインID>` に置く。画面は起動時と画面に戻ったときに `events` で取りに行き、`kind: 'transition'` の記録として判定に足す。到着・出発は次の記録まで状態が続くとみなし（`withTransitionStates`）、前の日の記録は使わない（前の晩の出発で翌日を欠席にしないため）。無効にすると鍵と記録を消す。記録は `enekoma_attendance:<ログインID>`、校内 / 校外の記録（時刻と真偽値だけ）は `enekoma_campus_log` に端末内で保存する。今のコマの判定は `campusSlotAt`（日本時間。`phase` は before＝1限前・class・break＝休み時間（次の時限で判定）・after＝5限のあと・holiday＝日曜）と `friendStatusAt`。授業時間外でも答えられるように、ツールの結果には今日の予定（`today`：授業の一覧・最後の時限・終わる時刻・no_classes/before/during/finished）、次の授業（`nextClass`：次の授業日まで探す）、今日の次の空きコマ（`nextFree`）を入れる。チャットでフレンドの居場所・空きコマ・今日の予定・もう終わったか・次の授業・放課後を聞かれたら、`api/chat/route.ts` がツール `get_friends_current_status` を呼び（引数 `intent` は `friendQueryIntent` で now・next_slot・next_class・today・finished・after_school・common_classes・common_free_periods・on_campus）。共通の授業（同じ曜日・同じ時限の同じ授業。名前は `isSameSharedCourse` で表記ゆれを吸収）と共通の空きコマ（どちらも授業のない1〜5限。今日・明日・曜日指定・今週）は、送られてきた本人の時間割とフレンドの共有時間割を `findCommonClasses`・`findCommonFreePeriods` で比べる。時間割全体はこのときだけツールの結果に付け（`withSchedule`）、フレンド画面の状態APIには入れない、その結果だけから `answerFriendStatusQuery` で答える（AIに推測させない。「空き教室」「先生は誰」、名前のない「次の授業いつ？」は時間割の検索のまま）。フレンドのカードのバッジは `cardBadges`（朝は「本日1限から（教室）」、放課後は「本日の授業は終了（4限まで）」、日曜は「本日は授業なし（休日）」と次の授業）。テストでは `ENEKOMA_ALLOW_TIME_OVERRIDE=1` のときだけ `x-enekoma-now` ヘッダーで時刻を固定できる（本番では無視）。
- お問い合わせは `api/feedback/feedbackStore.ts` がRedisに保存する（新しい順に最大500件、ステータスは未対応・対応中・対応済み・対応不要）。送信は同じ接続元から1時間に5件まで。成績などのカルテの内容は送らない。管理者用APIの認証は `api/_lib/adminAuth.ts` の `rejectUnlessAdmin` を使う。管理者が「公開する」にしたものだけを `/voices`（`app/voices/page.tsx`）と `GET /api/feedback` に出す。メール・ログインID・端末情報・管理メモは出さず、本文中のメールアドレス・電話番号・7桁以上の数字は `anonymizeText` で伏せる。受け付けると、`after` で応答のあとに管理者へ通知メールを送る（`api/feedback/notify.ts`。送信先は `ADMIN_EMAIL`、なければ `GMAIL_USER`）。送信に失敗しても保存と完了表示には影響させず、結果はメール送信ログに残す。
- FAQ（よくある質問・不具合の対処法）は、お問い合わせに管理者が回答（`answer`、任意で `faqTitle`）を保存し、「FAQとして公開」（`isFaq`）にしたものだけを `listPublicFaq` で出す。回答がないと公開できず、回答を消すとFAQから外れる。質問文は `anonymizeText` で伏せる。検索は `data/faqSearch.ts`（キーワードのAND検索と、入力中の文に似たものを探す `findSimilarFaq`）で、`/voices` の `FaqSearch` と `GET /api/faq`（`mode=similar` はフォームの「こちらの解決策はお試しになりましたか？」用）が使う。「これで解決しました」を押すと送信しない。
- 検索とSNS向けの情報は `app/siteConfig.ts`（サイト名・説明・キーワード・URL）にまとめ、`layout.tsx` のメタデータ、`robots.ts`、`sitemap.ts` で使う。OGP画像は `app/opengraph-image.png` と `twitter-image.png`（1200×630）。`/api/` と `/admin` はクロールさせない。
- デザインテーマはアカウントではなく端末ごとに `localStorage` の `enekoma_theme` に保存する。`layout.tsx` の `<head>` のスクリプトが描画前に `<html data-theme>` を付けるので、再読み込みでちらつかない。メインの色も同じく端末ごとに `enekoma_accent` に保存し、同じスクリプトが `data-accent` と `--accent-h`・`--accent-k` を付ける。

### 学科の選択必修の区分

情報科学科のカテゴリ4〜6、社会福祉学科のコース、体育学科のF群・G群のように、学生がどれか1つを選ぶ区分は `tracks`(`data/departmentCurriculum.ts`)に持つ。選んだ区分はプロフィールの `departmentTrack` に保存し、`electivesForTrack`(`data/gakubuYoran.ts`)でほかの区分の選択必修を除く。未選択ならすべて出す。学科必修チェックの修得判定は修得済み科目と同じ `hasEarnedCourse`(名前の表記ゆれを無視し、不合格は数えない)を使う。

### 資格コース・教職・副専攻のデータ

要覧 p.144-192 の表を書き写したもの。科目を直すときは要覧の表と照らし合わせる。

- `data/coursesAndMinorsCurriculum.ts`: 資格コース7種と副専攻24種。`category` は必修・選択必修・選択の3種類で、「a群から4単位以上」「A又はB」などの条件は `groupRules` に書く。
- `data/teachingLicenseCurriculum.ts`: 教職の「教科に関する専門的事項」を学科・教科ごとに持つ。表の網掛け（必修・選択必修）の科目だけで、網掛けでない選択科目は載せていない。
- 進み具合は `evaluateProgram`(`data/programProgress.ts`)で判定する。科目名の照合は `isSameCourseName`(`data/courseGrades.ts`)を使い、部分一致にしない（「生理学」と「代謝生理学」を区別するため）。
- `GAKUBU_YORAN_COURSES` と `GAKUBU_YORAN_ALL_24_MINORS`(`gakubuYoran.ts`)のページ・窓口・主な科目は、上の詳細データから作る。
- Geminiには `buildCurriculumContext`(`data/curriculumContext.ts`)で該当する表を渡し、APIキーがないときは `answerCurriculumLocally` で答える。

### デザインテーマ

Tailwind v4 のユーティリティは `--color-slate-900` などの変数を参照するので、`globals.css` の `html[data-theme="..."]` で変数を上書きして画面全体の配色を変える。`page.tsx` のクラスはテーマごとに書き分けない。

- かわいい: グレーをピンク系、indigo/blue をピンク・バイオレットに置き換え、角丸を大きくし、M PLUS Rounded 1c を使う。
- かっこいい: 各色の濃淡を反転したダーク配色(`white` も暗くなる)で、indigo/blue をシアン系にし、角丸を小さくし、Zen Kaku Gothic New を使う。新しい色を使うときは、反転後も読めるか確認する。
- テーマ用フォントは `preload: false` なので、選んだ端末だけが読み込む。フォントは `--theme-font` 経由で `font-sans` と `body` に効かせる。
- テーマを追加するときは `THEMES`(`data/themes.ts`)と `globals.css` の両方に足す。
- メインの色は、選んだ色の色相と鮮やかさだけを使い、`html[data-accent]` で slate と indigo・blue を置き換える。明るさは段階ごとに固定しているので、どの色でも文字が読める。emerald・amber・rose(成功・注意・エラー)は変えない。テーマのフォントと角丸はそのまま。かっこいいテーマでは暗い配色の段階を使う。

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
- 話し方の指定：`parseStyleRequest` が「〇〇みたいに話して」などを見分け、サーバーは `speakingStyle` を返す。端末は `localStorage` の `enekoma_speaking_style` に保存し、毎回 `speakingStyle` として送る。Geminiの回答には `styleInstruction` をシステムプロンプトに足す（口調だけ。数字・教室・科目名・人名は変えない）。フレンドの答えのような決まった文は `restyleReply` で口調だけ書き換え、数字と名前・教室・科目名が1つでも消えたら元の文を使う（`keepsFacts`）。APIキーがなければ話し方は変わらない。
- AIの回答は、LINEのような自然な会話文にする方針。`SYSTEM_PROMPT` で記号・太字・見出し・システムタグを禁止し、`sanitizeConversationalReply` で後処理している。`answerLocally` の文言も同じ文体に揃える。
- 校舎・自販機・施設の案内は `SYSTEM_PROMPT` と `answerLocally` の両方に書かれている。情報を更新するときは両方を直す。
- 要覧の規則を扱うときは、必修と選択必修を区別し、令和7年度以降と令和6年度以前のカリキュラムも区別する。
