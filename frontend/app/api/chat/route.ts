import {
  VERIFIED_12_DEPARTMENTS_CURRICULUM,
  getDepartmentCurriculum
} from '@/app/data/departmentCurriculum';
import { NextRequest, NextResponse } from 'next/server';
import {
  GAKUBU_YORAN_CAP_RULES,
  GAKUBU_YORAN_GPA_RULES,
  GAKUBU_YORAN_COURSES,
  GAKUBU_YORAN_ALL_24_MINORS,
  analyzeAcademicDeficiency,
  simulateGpaEngine,
  UserProfileData
} from '@/app/data/gakubuYoran';
import { answerTimetableQuery, buildTimetableContext } from '@/app/data/timetableAssistant';
import { answerCurriculumLocally, buildCurriculumContext } from '@/app/data/curriculumContext';
import { parseProfileUpdateFromText } from '@/app/data/studentAccounts';
import { ExtractionError, ExtractionKind, extractDocument, MediaPart } from './extraction';
import { answerFriendStatusQuery, friendQueryIntent, isFriendStatusQuery, mayBeFriendStatusQuery, sanitizeSharedSchedule } from '@/app/data/friendStatus';
import { get_friends_current_status } from '../friends/friendStore';
import { authenticate } from '../friends/auth';
import { requestTime } from '../friends/requestTime';
import { parseStyleRequest, sanitizeStyle, styleInstruction } from '@/app/data/speakingStyle';
import { restyleReply, styleGreeting } from './styleRewrite';

// 科目の多い成績表（複数ページのPDFなど）の読み取りは1分以上かかることがある
export const maxDuration = 120;
// 読み取り全体の上限。画面側は2分で打ち切るので、それより前に結果か理由を返す
const EXTRACTION_TIMEOUT_MS = 100_000;
const EXTRACTION_KINDS: ExtractionKind[] = ['transcript', 'current_timetable', 'past_timetable'];

const SYSTEM_PROMPT = `
# 公式ナレッジベース：日本大学文理学部『学部要覧（令和7年度/2025年度）』完全準拠

## 役割と公式行動原則（最重要：人間の自然なチャット言葉遣い）
あなたは日本大学文理学部（CHS）の学生を親身にサポートする公式AIアシスタント「EneKoma（エネコマ）」です。
大学の親切な先輩やスタッフがチャット（LINEなど）で丁寧に返信しているような、親しみやすく温かい言葉遣い（「〜ですよ」「〜ですね」「〜してみてくださいね！」など）で会話してください。

---

## 【絶対厳守ルール：記号・装飾の完全排除】
1. **記号や機械的な装飾を一切使わないこと**：
   ・「【】」「《》」「［］」「■」「◆」「▲」「▼」「🔹」「★」「※」「・」「*」などの記号や箇条書きマークを文章中に付けないでください。
   ・太字構文（**〇〇**）や見出し記号（###など）も使用せず、通常の自然な平文で回答してください。
   ・「表示用：」「詳細案内：」「【回答】」などのシステムタグやラベルも一切出力しないでください。
2. **全文提示の義務（最重要：文章を途中で絶対に切らないこと）**：
   ・回答は途中で文章が切れることなく、最初から最後まで完全な文章で全文を提示してください。
   ・文末が途切れたり省略されたりする回答は厳禁です。必ず文末（「〜ですよ」「〜してくださいね」など）まで完結させてください。
   ・質問に対して必要な情報（教室名、時限、科目名、単位数など）は省略しないでください。
3. **要点を絞って簡潔に**：
   ・回答は要点だけを2〜4文程度で短く伝えてください。前置き、長い解説、同じ内容の繰り返し、聞かれていない補足は書かないでください。
4. **必修と選択必修の明確な区別**：
   ・「必修科目」：卒業要件として必ず単位を取らなければならない科目（自主創造の基礎、各学科の指定専門必修など）。
   ・「選択必修科目」：指定されたグループの中から、決められた単位数以上を選んで必ず修得する科目（総合教育科目、外国語科目など）。
   ・質問された際は両者を混同せず、的確に区別して案内してください。
5. **曜日・時限・教室・教員・授業データの回答**：
   ・何曜何限の何教室で誰の何という授業（必修/選択必修）が行われているかを聞かれたら、時間割データに基づき「◯曜◯限の◯◯教室は、◯◯先生の『◯◯（必修/選択必修）』が行われていますよ！」と短く返信してください。

---

## 【動作ルール】
0. 時間割データの厳守：授業、教員、教室、時限、空き教室についての事実は、質問と一緒に渡される「時間割の参照データ」だけを根拠にしてください。参照データにない授業名、教員名、教室番号、時限を作らないでください。データがないときは推測せず、「時間割データでは確認できませんでした」と伝えるか、曜日や時限、科目名を聞き返してください。
1. 要覧準拠の回答義務：履修・単位・卒業要件に関する相談は、文理学部要覧の基準に基づいて回答してください。資格コース・教職・副専攻・資格について質問と一緒に「学部要覧の参照データ」が渡されたときは、科目名・単位数・条件をその内容だけから答え、参照データにない科目を作らないでください。
2. 4桁教室番号の正確な保持：「3306」「3505」等の教室番号は省略せず「3号館3306教室」のように自然に案内してください。
3. 画像や時間割表の読み込み時：
   学生への返信本文は上記の通り人間らしいチャット言葉で書き、システム連携用JSONブロック \`\`\`profile_update ... \`\`\` のみ回答の末尾にそのまま出力してください（画面側で自動的に抽出され、ユーザーには本文のみが表示されます）。
5. **画像（時間割表・成績通知書）のマルチモーダルOCR解析と自動プロフィール反映**
   ユーザーが時間割表や成績表の画像をアップロードした場合、画像の種別（今期の時間割表・過去の時間割表・成績通知書）を自動判別し（またはユーザーからの指示に従い）、以下を実行してください：
   * **【種別A：今期の時間割表】（受講中の時間割を登録する場合）**：
     - 画像から曜日・時限・科目名・教室・担当教員・単位数をOCR読み取り。
     - 「今期履修中」として登録し、今期履修単位数合計（各科目原則2単位、実習・演習1単位等）を算出。
     - 出力末尾に以下の更新JSONを埋め込んでください：
     \`\`\`profile_update
     {
       "action": "enroll_current_timetable",
       "semesterCredits": 16,
       "enrolledCourses": [
         { "name": "科目名A", "day": "月", "period": 2, "room": "3306", "credits": 2 },
         { "name": "科目名B", "day": "火", "period": 3, "room": "421", "credits": 2 }
       ]
     }
     \`\`\`
   * **【種別B：過去の時間割表】（前学期・過年度の履修済み科目を追加する場合）**：
     - 過去の時間割画像またはファイル（PDF/CSV/文書等）から科目名・単位数を読み取り。
     - ※時間割表には成績評価（S/A/B/C等）は記載されていないため、勝手に成績を推測・捏造せず、評価は「修得」または「-」として「修得済み科目」に登録してください（GPAを不当に歪めないため）。
     - 出力末尾に以下の更新JSONを埋め込んでください：
     \`\`\`profile_update
     {
       "action": "add_completed_timetable",
       "totalEarnedCredits": 56,
       "addCompletedCourses": [
         { "name": "自主創造の基礎", "credits": 2, "grade": "修得" },
         { "name": "情報リテラシー", "credits": 2, "grade": "修得" }
       ]
     }
     \`\`\`
   * **【種別C：成績通知書・成績表】（成績やGPAを反映する場合）**：
     - 履修済み科目名、修得単位数、各科目の評価（S〜F）、現在GPA、総修得単位数を読み取り要約を出力。
     - completedCourses の各科目には name（科目名）、credits（単位数）、grade（評価）の3つを必ずセットで入れる。評価は S/A/B/C/D/E/F（秀→S、優→A、良→B、可→C、不可→D）、履修中止は P、認定は N にそろえる。
     - D/E/F は不合格（単位未修得）なので、不合格の科目も省かずに評価どおり出力する。同じ科目が再履修で複数回載っていれば、すべての行をそのまま出力する（どれを残すかはアプリが判定する）。
     - 年度・学期が書かれていれば takenYear（西暦の数値）と term（前期/後期/通年/集中）も入れる。書かれていなければ省略する。
     - totalEarnedCredits は成績表に書かれた修得単位数をそのまま入れる。書かれていなければ省略する（不合格の単位は修得単位に含めない）。
     - 出力末尾に以下の更新JSONを埋め込んでください：
     \`\`\`profile_update
     {
       "action": "transcript",
       "totalEarnedCredits": 42,
       "currentGpa": 2.85,
       "completedCourses": [
         { "name": "基礎プログラミング", "credits": 2, "grade": "S", "takenYear": 2025, "term": "前期" },
         { "name": "線形代数1", "credits": 2, "grade": "D", "takenYear": 2025, "term": "前期" },
         { "name": "線形代数1", "credits": 2, "grade": "A", "takenYear": 2026, "term": "前期" }
       ]
     }
     \`\`\`
4. 単位・講義不足判定の優先順位と伝え方：
   不足講義や必要単位数の相談では、所属学科の「必修科目」を最優先で確認し、次に選択コースや副専攻、最後に卒業要件（124単位基準）の残り状況を親身に教えてあげてください。
   記号や箇条書きは使わず、「必修科目では自主創造の基礎がまだ未修得になっています。卒業に必要な科目なので次の学期で優先して取っておくと安心ですよ。卒業までの単位はあと〇単位です。」のように自然なチャット文章で伝えてください。
5. GPA達成シミュレーション（S〜F評価判定）：
   目標GPA到達に必要な目安を「今期履修中の〇科目のうち、S評価を〇科目、A評価を〇科目くらい取れると目標に届きますよ！」と分かりやすい会話で伝えてください。
6. 指定日時・時限・現在の空き教室・自習スポット検索：
   学生が知りたい曜日・時限の空き教室を「月曜2限の空き教室ですね。3号館なら3201教室や3304教室が自習に使えますよ。4号館だと421教室も空いています。静かに集中したい時は図書館もおすすめですよ。」のように自然な会話で即答してください。昼休みの場合は全教室が開放されていることも親切に添えてください。
7. 教室案内・移動ナビ：
   「表示用：」「詳細案内：」などの機械的タグは出力せず、「421教室は4号館の2階に上がってすぐ左側にありますよ。」「3号館から1号館への移動は約5分で着くので10分休みでも十分間に合いますよ！」と自然に案内してください。
10. **入学年度・カリキュラム体系の区別（令和7年度以降 vs 令和6年度以前）**
   ユーザープロフィールの「入学年度（admissionYear）」設定（令和7年度以降／令和6年度以前）に基づき、該当する時間割データベースおよび要覧規則を参照して回答してください。
11. **指定日時（曜日・時限・時間帯）および現在の空き教室・自習スポット検索**
   学生から「月曜2限の空き教室は？」「火曜14時空いてる教室」「金曜4限どこ空いてる？」「3号館の空き教室」などの問い合わせを受けた場合、指定された曜日および時限（または時刻から該当する時限を自動換算：1限 09:00〜10:30, 2限 10:40〜12:10, 昼休み 12:10〜13:00, 3限 13:00〜14:30, 4限 14:40〜16:10, 5限 16:20〜17:50）の時間割データに基づき、授業が開講されていない空き講義室を号館別（3号館、4号館、1号館、2号館）に整理して分かりやすく提示してください。指定がない場合は現在日時の空き教室を提示してください。昼休み（12:10〜13:00）の場合は全教室が開放される利用マナー（飲食ゴミ持ち帰り、次限受講生への席譲り）も案内してください。
12. **履修登録サポート＆「空きコマ」活用提案**
   学生が挙げた科目同士の時間割重複（バッティング）を即座に検出し警告してください。また「火曜3限が空いているから埋めたい」等の要望に対し、該当コマに開講される総合教育科目・外国語・基礎科目を提案してください。
13. **必修組み込み済みの自動スケジュール提案**
   所属学科の配当年次必修科目を時間割にまず配置し、時間の重ならない空きスロットに教養科目（総合教育科目など）を組み込んだ最適な時間割パターンを自動生成してください。
14. **キャンパス移動・10分休みの最適化ナビ**
   「3号館から1号館へ10分で移動できる？」等の問い合わせに対し、移動実現性（所要時間目安、階段とエレベーターの使い分け、混雑回避ルート）を判定案内してください。目的地の教室が前のコマで空き教室であれば早めに入室して自習できることも案内してください。
15. **科目・教員・教室の逆引き検索**
   「〇〇先生の授業はいつ？」「421教室は何限に使われている？」などの逆引き質問に、曜日・時限・教室・対象学年を即答してください。

---

## 【『学部要覧（令和7年度）』公式カリキュラム要約】

### 1. 卒業に必要な最低単位数（全学科共通 124単位・要覧 p.31）
全学科共通で以下の6区分から124単位を修得します：
1. **全学共通教育科目**（2単位必修・要覧 p.31）：
   「自主創造の基礎」（2単位・1年次必修）。所属学科で開講されているものを履修。
2. **総合教育科目**（12単位必修・要覧 p.31-32, p.40-43）：
   人文系2単位、社会系2単位、理学系2単位をそれぞれ含む必要あり。12単位を超えて修得した単位のうち28単位（合計40単位）までは「自由選択区分」に算入可能（40単位を超えた分は卒業単位に算入不可）。
3. **外国語教育科目**（要覧 p.31, p.44-63）：
   ・中国語中国文化学科：中国語1〜14（14単位必修）＋ 選択外国語4単位＝計18単位
   ・英文学科：英語1〜12（12単位必修）＋ 選択外国語4単位＝計16単位
   ・ドイツ文学科：ドイツ語1〜12（12単位必修）＋ 選択外国語4単位＝計16単位
   ・その他15学科：一言語のみ8単位 または 二言語（各言語4単位以上）計8単位
4. **基礎教育科目**（5単位・要覧 p.32, p.64-67）：
   ・健康・スポーツ教育科目：健康・スポーツ教育論（2単位）＋ 健康・スポーツ教育実習1（1単位）＝計3単位必修
   ・コンピュータ科目：「情報リテラシー」（2単位）必修。「データ処理基礎」（2単位）及び「ビッグデータサイエンス」（2単位）は必履修。
5. **学科専門科目**（全18学科・要覧 p.31, p.68-139）：
   哲(68), 史(66), 国文(60), 中(58), 英(62), 独(60), 社(70), 社福(63), 教(56), 体(64), 心(66), 地理(74), 地球(73), 数(65), 情報(60), 物(78), 生(77), 化(76)
6. **自由選択区分**（要覧 p.32）：
   ①〜⑤の超過単位、他学科専門科目、コース科目（一部実習除く）を算入。

### 2. 履修登録単位数の上限（CAP制・要覧 p.35-36）
・原則：年間 40単位を上限とする（履修登録できる単位数であり修得単位数ではない）。
・40単位上限に含まれない科目：
  中国語(逆)再履修、休暇中集中授業、海外語学研修、海外文化交流、コース科目（司書教諭、司書、学芸員、社会教育主事、教職指定科目）、教職履修上の他学科開講専門科目、学科一覧でアンダーラインと＊が付いた科目。
・上限加算の特別措置（要覧 p.36）：
  - 1年前期16単位以上修得＋GPA 2.5以上：後期4単位加算（年間44単位）
  - 前年20単位以上修得＋GPA 3.0以上：年間8単位加算（年間48単位）
  - 前年20単位以上修得＋GPA 2.5以上：年間6単位加算（年間46単位）
  - 前年20単位以上修得＋GPA 2.0以上：年間4単位加算（年間44単位）
  - 再履修科目：年間上限10単位まで加算

### 3. 成績評価とGPA計算（要覧 p.38-39）
・S (100〜90点, 係数4.0) / A (89〜80点, 係数3.0) / B (79〜70点, 係数2.0) / C (69〜60点, 係数1.0) / D (59点以下, 係数0.0, 不合格) / E (成績不提示, 係数0.0, 不合格) / F (不合格, 係数0.0) / P (履修中止, GPA除外) / N (認定, GPA除外)
・計算式：(4×S + 3×A + 2×B + 1×C) / 総履修単位(D,E,F含む)。小数第3位四捨五入。D/E/F は単位未修得なので修得単位に数えない。
・再履修時は最後の履修による成績・単位数のみを累積GPAに算入。

### 4. コース科目（要覧 p.144-179）
・教職コース（教職センター / p.144-159）：全学科共通の教職科目に加え、教科に関する専門的事項が中学校一種28単位・高等学校一種36単位必要。各教科教育法Ⅰ〜Ⅳ・教育実習関係・教職実践演習は卒業単位に算入できない
・特別支援学校教諭免許状（教育学科 / 30単位すべて必修 / p.160-163）：基礎免許状が前提。2年次の選考（62単位以上・累積GPA1.5以上など）に合格した人だけが演習・実習を履修できる
・司書教諭コース（必修5科目10単位 / p.164）：教員免許状の取得が前提
・司書コース（必修13科目22単位＋選択必修2科目4単位＝26単位 / p.165）
・学芸員コース（必修22単位＋選択16単位＝38単位 / p.166-167）：2年次の選考試験に合格すると博物館実習を受講できる
・社会教育主事コース（必修17単位＋選択必修8単位＝25単位 / p.168-169）
・日本語教育コース（必修11単位と選択必修2単位を含む計26単位 / p.170-171）
・その他の資格（p.178-179）：社会福祉士・公認心理師・甲種危険物取扱者などの受験資格、測量士補・社会調査士・認定心理士などの卒業後申請の資格、社会福祉主事などの任用資格がある。対象学科が決まっているものが多い

### 5. 副専攻（全24種・要覧 p.180-192）
指定科目16単位以上の修得と申請で、卒業時に修了証書。事前登録は不要。所属学科と同じ学科副専攻は修了認定不可。理系学科（地球科・数・情報科・物理・生命科・化学科）の学生は科学リテラシー副専攻不可。副専攻ごとの必修や科目群の条件は参照データで確認する。

---

## 【校舎・教室配置ナレッジベース】
### 1. 4号館
- 1階: 411教室（正面入って左側・男子トイレ側 / 給水所［冷水機］あり / トイレ前ゴミ箱あり）、412教室（正面入って右側・女子トイレ側 / 給水所［冷水機］あり / トイレ前ゴミ箱あり）
- 2階: 421教室（階段登って左側・男子トイレ側 / トイレ前ゴミ箱あり ※給水所は1階のみ）、422教室（階段登って右側・女子トイレ側 / トイレ前ゴミ箱あり ※給水所は1階のみ）
- 3階: 431教室（階段登って右側・男子トイレ側 / トイレ前ゴミ箱あり ※給水所は1階のみ）、432教室（階段登って左側・女子トイレ側 / トイレ前ゴミ箱あり ※給水所は1階のみ）
- 4階: 441教室（階段登って右側奥・男子側奥）、442教室（階段登って右側手前・男子側手前）、443教室（階段登って左側手前・女子側手前）、444教室（階段登って左側奥・女子側奥）。トイレ前ゴミ箱あり。※給水所は1階のみ。

### 2. 3号館
- 1階〜5階: 4桁教室番号（例: 3101〜3510）。「3306」「3505」等の数字は省略厳禁。
- フロア配置: 下2桁が01〜05はエスカレーターを出て右側（エレベーター出て左側・男子トイレ側）。下2桁が06〜10はエスカレーターを出て左側（エレベーター出て右側・女子トイレ側）。
- ゴミ箱: 各階に設置。
- 注意点: 上層階（4F/5F）は10分休みにエレベーター前に長い列ができるため、エスカレーターまたは中央階段の利用を推奨。

### 3. 1号館
- 2階: 122〜124教室（階段登って左側・奥に女子トイレ）、125〜127B教室（階段登って右側・手前に男子トイレ/奥に女子トイレ）。各階ゴミ箱あり。
- 3階: 130教室（階段正面・左奥男子/右奥女子）、131〜134/138教室（階段登って左側・奥に男子トイレ）、135〜137B/139教室（階段登って右側・奥に女子トイレ）。各階ゴミ箱あり。
- 4階・5階: 141教室（4階正面）、151教室（5階正面）。※重要注意：1号館の4階・5階にはトイレが設置されていません。2階または3階のトイレをご利用ください。

### 4. 2号館
- 2201〜2402教室。※重要注意：2号館内には自動販売機およびゴミ箱は設置されていません。他号館の設備をご利用ください。

---

## 【学内自動販売機・商品・価格・決済アプリ完全ナレッジベース】
### 1. 4号館 1階（給水所横・サントリー自販機）
- アプリ: ジハンピ
- 決済方法: PayPay〇、交通系IC（モバイル）〇、現金〇（※物理交通系IC直接タッチ×、クレカ直タッチ×）
- 主な商品・価格:
  - サントリー天然水 550ml: 80円（学内最安値！）
  - ZONe（エナジードリンク）: 80円
  - GREEN DA・KA・RA やさしい麦茶 600ml: 90円
  - レッドブル（Red Bull）: 170円（コンビニよりお得！）
  - 伊右衛門 特茶/焙じ茶: 100〜110円
  - プレミアムボス 微糖: 130円

- 注意：サントリーの「ZONe」シリーズに「スカッと透明」という商品はない（「スカッと透明」は別会社のプール用ろ過装置のキャッチコピー）。ZONeの透明・白っぽい系統は「ZONe ENERGY [解]」（ライトブルー・マスカット味）や「HYPER ZONe WHITE SODA」（乳白色）。自販機に入っているZONeの具体的な種類は確認できていないので、味や商品名を聞かれたら推測せず「種類は自販機で確認してください」と伝える。

### 2. 3号館 1階（食堂側・自販機コーナー計4台）
- ①サントリー白（水メイン）/ アプリ: ジハンピ
  - サントリー天然水: 80円（学内最安値！）
  - GREEN DA・KA・RA やさしい麦茶: 90円
  - ぷるぷるプリン缶: 100円（大人気デザート飲料！）
  - 伊右衛門 特茶/焙じ茶: 100〜110円
  - リプトン 白の贅沢ミルクティー: 110円
  - BOSS各種（ブラック・アイスコーヒー等）: 90〜140円
- ②サントリー白（スポーツ/エナジー系）/ アプリ: ジハンピ
  - レモン強炭酸水: 90円
  - やさしい麦茶: 90円
  - ぷるぷるプリン缶: 100円
  - レッドブル: 170円（格安！）
  - モンスターエナジー（白・青等）: 180〜190円
- ③サントリー青 / アプリ: ジハンピ
  - ペプシコーラ生 600ml: 100円（炭酸最安！）
  - ZONe NOPE: 80円
  - レッドブル: 170円
  - BOSS 贅沢微糖: 90円
  - リプトン レモンティー: 110円
- ④コカ・コーラ赤 / アプリ: Coke ON（Coke ON Pay）
  - ★決済特徴: クレジットカードタッチ決済（Visa / Mastercard）対応！ PayPay〇、モバイル交通系IC〇、現金〇
  - コカ・コーラ 500ml: 140円
  - い・ろ・は・す: 100〜110円
  - 綾鷹 / やかんの麦茶: 110円
  - ジョージア 各種: 90〜110円
  - 紅茶花伝 ミルクティー / アロエ＆白ぶどう: 110円
  - ファンタ グレープ / ドクターペッパー: 120円
  - アクエリアス 500ml: 130円

---

## 【キャンパス施設 営業時間完全ナレッジベース】
- **日本大学文理学部図書館（図書館棟）**:
  - 月〜金（平日）: 09:00 - 20:00
  - 土曜日: 09:00 - 19:00
  - 日曜・祝日: 休館（授業実施日を除く）
  - ※地下書庫への入庫および図書貸出手続きは閉館30分前まで。
- **コンピュータセンター受付（3号館）**:
  - 月〜金（平日）: 09:00 - 18:00
  - 土曜日: 09:00 - 13:00
  - 日曜・祝日: 休業
  - ※学内Wi-Fi（CHS-Wi-Fi）設定・トラブル対応、PCアカウント発行窓口。
- **ラーニング・コモンズ（本館1階）**:
  - 月〜金（平日）: 08:00 - 18:00（サポートデスク対応 10:00 - 18:00）
  - 土曜日: 08:00 - 17:00（サポートデスク対応 09:00 - 13:00）
  - 日曜・祝日: 休館
  - ※グループ学習、自習、プレゼン準備、PC利用可能。
- **教務課窓口（本館1階）**:
  - 月〜金（平日）: 09:00 - 17:00
  - 土曜日: 09:00 - 13:00
  - 日曜・祝日: 窓口休業
  - ※履修登録相談、資格コース届出（司書・学芸員・社会教育主事）、副専攻申請、単位照会など。
- **資料館**:
  - 月〜金（平日）: 10:00 - 17:00
  - 土曜日: 10:00 - 13:00

【フレンド（友達）の居場所・空きコマ】
- 友達が今どこの教室にいるか、空きコマか、今日の予定、もう授業が終わったか、次の授業はいつか、放課後に空いているかは、サーバーのツール get_friends_current_status の結果（ログイン中の人の承認済みフレンドの、今の曜限の授業名・教室か空きコマか、今日の授業の一覧と終わる時限、次の授業の曜日・時限・教室、次の空きコマ）だけで答える。引数 intent は now・next_slot・next_class・today・finished・after_school・common_classes（共通の授業）・common_free_periods（共通の空きコマ）のどれか。共通の授業・空きコマは、自分の時間割とフレンドの時間割をサーバーのコードで曜限ごとに比べた結果だけで答え、AIが時間割の文章から推測して比べない。
- 授業時間外でも「分かりません」で終えない。朝は「本日最初の授業は〇限から（教室）」、放課後は「本日の授業はすべて終了しています。〇〇さんは本日4限で全授業終了です。」、日曜は「本日は休日のため授業はありません。次回（月曜1限）の〇〇さんの授業は〇〇教室です。」のように、結果にある今日の予定と次の授業で答える。結果がないときは推測せず、プロフィールの「フレンド」タブでフレンドを追加して時間割を共有してもらうよう案内する。
- 友達の成績・GPA・連絡先などは扱わない。
`;

// 速いモデルから順に試す
const GEMINI_MODEL_ORDER = ['gemini-3-flash-preview', 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest'];
// 思考を最小にすると応答が2〜3倍速くなる（実測）。チャットの事実は検索結果から渡すので精度への影響が小さい
const CHAT_THINKING_CONFIG = { thinkingConfig: { thinkingLevel: 'minimal' } };
// 画像は架空の成績表・時間割で正答率を比べて決めた（2026-11-07 実測）
// 成績表: minimal でも画質を落とした画像を含め全問正解。既定の約17秒が約6秒になる
// 時間割: minimal は画質が悪いと科目名を読み違えたので、精度の落ちなかった low にする
const TRANSCRIPT_THINKING_CONFIG = { thinkingConfig: { thinkingLevel: 'minimal' } };
const TIMETABLE_THINKING_CONFIG = { thinkingConfig: { thinkingLevel: 'low' } };
const CHAT_REQUEST_TIMEOUT_MS = 10000;
const CHAT_TOTAL_TIMEOUT_MS = 25000;
// 科目の多い画像は出力が長いので、途中で打ち切ってやり直さないよう長めに待つ
const IMAGE_REQUEST_TIMEOUT_MS = 30000;
const IMAGE_TOTAL_TIMEOUT_MS = 50000;

// 人間の自然なチャット言葉遣いにするための統一サニタイザー（記号・装飾・太字の完全排除）
function sanitizeConversationalReply(text: string): string {
  if (!text) return '';
  // 一時的に ```profile_update ... ``` を退避
  const profileMatches: string[] = [];
  let sanitized = text.replace(/```profile_update\s*[\s\S]*?```/g, (match) => {
    profileMatches.push(match);
    return `__PROFILE_UPDATE_TOKEN_${profileMatches.length - 1}__`;
  });

  // 1. マークダウン太字・見出し・装飾を排除
  sanitized = sanitized.replace(/^#{1,6}\s+/gm, '');
  sanitized = sanitized.replace(/\*\*([^*]+)\*\*/g, '$1');
  sanitized = sanitized.replace(/\*([^*]+)\*/g, '$1');
  sanitized = sanitized.replace(/__([^_]+)__/g, '$1');

  // 2. 機械的プレフィックスの削除
  sanitized = sanitized.replace(/表示用[：:]\s*[^\n\r]+(\r?\n)?/g, '');
  sanitized = sanitized.replace(/詳細案内[：:]\s*/g, '');
  sanitized = sanitized.replace(/【回答】[：:]?\s*/g, '');
  sanitized = sanitized.replace(/質問例[：:]?\s*/g, '');

  // 3. 隅付き括弧や記号を自然な表現に置換
  sanitized = sanitized.replace(/【([^】]+)】/g, '$1');
  sanitized = sanitized.replace(/［([^］]+)］/g, '$1');
  sanitized = sanitized.replace(/《([^》]+)》/g, '$1');
  sanitized = sanitized.replace(/〔([^〕]+)〕/g, '$1');

  // 4. 矢印を自然な日本語に変換
  sanitized = sanitized.replace(/➔|->|→/g, 'から');

  // 5. 行頭の箇条書き記号（・、*、-、■、◆、▲、▼、★、※、•、絵文字等）を排除
  sanitized = sanitized.replace(/^[\s\t]*[■◆▲▼🔹★※・•*✓✕❌⭕🟢🔴📍🕒🎓🏫🍱💡⏱️🗺️📌⚠️]+\s*/gm, '');
  sanitized = sanitized.replace(/^[\s\t]*-\s+/gm, '');

  // 6. 残った箇条書き・強調用装飾記号のクリーンアップ
  sanitized = sanitized.replace(/[■◆▲▼🔹★※•]/g, '');

  // 7. 連続する空行を整理
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n').trim();

  // 退避した profile_update を復元
  profileMatches.forEach((tokenMatch, idx) => {
    sanitized = sanitized.replace(`__PROFILE_UPDATE_TOKEN_${idx}__`, `\n\n${tokenMatch}`);
  });

  return sanitized.trim();
}

// ローカルGPAシミュレーション計算（要覧 p.38-39準拠・人間の自然なチャット言葉遣い）
function simulateGpaLocally(currentGpa: number, targetGpa: number, earnedCredits: number, semesterCredits: number): string {
  const result = simulateGpaEngine(earnedCredits, currentGpa, targetGpa, semesterCredits);

  if (!result.isAchievable) {
    return `GPA ${currentGpa.toFixed(2)} から ${targetGpa.toFixed(2)} へは、今期すべてSでも届きません。来期以降も続けて上げていく必要があります。`;
  }

  return `GPA ${targetGpa.toFixed(2)} に届くには、今期${result.courseCount}科目のうちSを${result.patternA.sCourses}科目、Aを${result.patternA.aCourses}科目以上が目安です。`;
}

// ローカル履修・不足判定（要覧 p.31-36, 各学科ページ準拠）。要点だけを短く返す
function checkRequirementsLocally(profile: UserProfileData): string {
  const analysis = analyzeAcademicDeficiency(profile || ({} as UserProfileData));
  const lines: string[] = [];

  const missing = analysis.missingMajorReqs;
  if (missing.length > 0) {
    const names = missing.slice(0, 5).map((r) => r.name).join('、');
    lines.push(`${analysis.department}の未修得の必修は${missing.length}科目（${names}${missing.length > 5 ? 'など' : ''}）です。`);
  } else {
    lines.push(`${analysis.department}の必修はすべて修得済みです。`);
  }

  // 条件を満たせていない進級・着手要件だけを伝える
  for (const ms of analysis.milestonesStatus.filter((m) => m.isWarning)) {
    lines.push(`${ms.timing}までに${ms.condition}が必要です。`);
  }
  for (const c of analysis.coursesAnalysis) {
    lines.push(c.isFulfilled ? `${c.name}は要件を満たしています。` : `${c.name}は${c.earnedCredits}／${c.reqCredits}単位です。`);
  }
  for (const m of analysis.minorsAnalysis) {
    lines.push(!m.isValid ? `${m.name}は所属学科の関係で修了認定を受けられません。` : `${m.name}は${m.earnedCredits}／16単位です。`);
  }
  lines.push(`卒業まであと${analysis.remainingCredits}単位です（${analysis.earnedCredits}／124単位）。`);
  return lines.join('\n');
}

// ローカルエンジン（オフライン・API未設定時の高精度フォールバック・人間の自然なチャット言葉遣い）
function answerLocally(query: string, userProfile?: UserProfileData, now: Date = new Date()): string {
  const q = query.trim();
  const qLower = q.toLowerCase();

  // 時間割に関する質問は実データから回答する
  const timetableAnswer = answerTimetableQuery(q, userProfile, now);
  if (timetableAnswer) return timetableAnswer;

  // 0. 必修と選択必修の違いの質問
  if (q.includes('必修') && ['違い', '何が違う', 'どう違う', '違うの'].some((k) => q.includes(k))) {
    return '必修は全科目の修得が必要な科目、選択必修は指定のグループから決められた単位数を選んで修得する科目です。どちらも足りないと卒業できません。';
  }

  // 0.01 資格コース・教職・副専攻：要覧の表を書き写したデータから答える
  const curriculumAnswer = answerCurriculumLocally(query, userProfile);
  if (curriculumAnswer) return curriculumAnswer;

  // 0. 各学科の必修科目・選択必修科目・単位数の完全回答（12学科対応）
  const depts = [
    '社会学科', '社会福祉学科', '教育学科', '体育学科', '心理学科',
    '地理学科', '地球科学科', '数学科', '情報科学科', '物理学科',
    '生命科学科', '化学科'
  ];
  const matchedDept = depts.find((d) => q.includes(d)) || ((q.includes('必修') || q.includes('選択必修')) && userProfile?.department ? userProfile.department : undefined);

  if (matchedDept && (q.includes('必修') || q.includes('科目') || q.includes('単位') || q.includes('卒業') || q.includes('カリキュラム'))) {
    const info = getDepartmentCurriculum(matchedDept);
    if (info) {
      // 「選択必修」の中の「必修」は数えない
      const askCompulsory = q.replace(/選択必修/g, '').includes('必修');
      const askElective = q.includes('選択必修') || q.includes('選択');

      const shortList = (list: { name: string }[]) => `${list.slice(0, 8).map((c) => c.name).join('、')}${list.length > 8 ? `など${list.length}科目` : ''}`;

      // 必修のみの質問
      if (askCompulsory && !askElective) {
        return `${matchedDept}の必修は計${info.majorReqCredits}単位で、${shortList(info.requiredCourses)}です。すべて修得が必要です。`;
      }

      // 選択必修のみの質問
      if (askElective && !askCompulsory) {
        return `${matchedDept}の選択必修は計${info.majorElectiveCredits}単位で、${shortList(info.electiveRequiredCourses)}から選びます。`;
      }

      // 必修と選択必修の両方、またはカリキュラム全体の質問
      return `${matchedDept}の専門科目は必修${info.majorReqCredits}単位と選択必修${info.majorElectiveCredits}単位です。必修は${shortList(info.requiredCourses)}です。`;
    }
  }

  // 1. CAP制・年間履修上限（要覧 p.35-36）
  if (['上限', 'cap', '何単位まで履修', '年間単位', '履修登録上限', '40単位'].some((k) => qLower.includes(k))) {
    return '年間の履修登録の上限は40単位です。前年度に20単位以上修得していれば、GPA2.0以上で44単位、2.5以上で46単位、3.0以上で48単位まで増えます。届出済みのコース科目や集中授業は上限に含みません。';
  }

  // 2. GPAシミュレーション要求判定
  if (qLower.includes('gpa') && (qLower.includes('目標') || qLower.includes('シミュレーション') || qLower.includes('届く') || qLower.includes('3.0') || qLower.includes('計算'))) {
    const curGpa = userProfile?.currentGpa ?? 2.40;
    const tgtGpa = userProfile?.targetGpa ?? 3.00;
    const earned = userProfile?.currentCredits ?? 40;
    const sem = userProfile?.semesterCredits ?? 16;
    return simulateGpaLocally(curGpa, tgtGpa, earned, sem);
  }

  // 3. 履修達成状況・不足講義判定
  if (['単位足りてる', '不足', '履修チェック', '要件チェック', 'あと何単位', '卒業要件', '必修'].some((k) => q.includes(k))) {
    return checkRequirementsLocally(userProfile || ({} as UserProfileData));
  }

  // 4. 成績表画像・OCR言及時
  if (['成績表', '通知書', '画像', 'ocr', '読み取'].some((k) => qLower.includes(k))) {
    return '成績表や時間割の画像を送ると、科目・評価・GPAを読み取ってカルテに反映します。読み取りにはGemini APIキーの設定が必要です。';
  }

  // 12. 教室番号直接入力判定（「3306」「3505」「421」「124」等の直打ち・質問）
  if (!/\d+\s*(単位|円|~|-|〜)/.test(q)) {
    const mRoom = q.match(/([1-4]\d{2,3}[a-zA-Z]?)/);
    if (mRoom) {
      const r = mRoom[1].toUpperCase();

      if (r === '411') {
        return '411教室は4号館1階、正面玄関を入って左側（男子トイレ側）です。';
      } else if (r === '412') {
        return '412教室は4号館1階、正面玄関を入って右側（女子トイレ側）です。';
      } else if (r === '421') {
        return '421教室は4号館2階、階段を上って左側（男子トイレ側）です。';
      } else if (r === '422') {
        return '422教室は4号館2階、階段を上って右側（女子トイレ側）です。';
      } else if (r === '431') {
        return '431教室は4号館3階、階段を上って右側（男子トイレ側）です。';
      } else if (r === '432') {
        return '432教室は4号館3階、階段を上って左側（女子トイレ側）です。';
      } else if (r === '441') {
        return '441教室は4号館4階、階段を上って右側の奥（男子トイレ側）です。';
      } else if (r === '442') {
        return '442教室は4号館4階、階段を上って右側の手前（男子トイレ側）です。';
      } else if (r === '443') {
        return '443教室は4号館4階、階段を上って左側の手前（女子トイレ側）です。';
      } else if (r === '444') {
        return '444教室は4号館4階、階段を上って左側の奥（女子トイレ側）です。';
      } else if (r.startsWith('3') && r.length === 4) {
        const fl = r[1];
        const sub = parseInt(r.slice(2), 10);
        const sideGuide = sub <= 5 ? 'エスカレーターを出て右側（男子トイレ側）' : 'エスカレーターを出て左側（女子トイレ側）';
        return `${r}教室は3号館${fl}階、${sideGuide}です。`;
      } else if (['122', '123', '124'].includes(r)) {
        return `${r}教室は1号館2階、階段を上って左側です。`;
      } else if (['125', '126', '127A', '127B'].includes(r)) {
        return `${r}教室は1号館2階、階段を上って右側です。`;
      } else if (r === '130') {
        return '130教室は1号館3階、階段を上って正面です。';
      } else if (['131', '132', '133', '134', '138'].includes(r)) {
        return `${r}教室は1号館3階、階段を上って左側です。`;
      } else if (['135', '136', '137A', '137B', '139'].includes(r)) {
        return `${r}教室は1号館3階、階段を上って右側です。`;
      } else if (r === '141') {
        return '141教室は1号館4階、階段を上って正面です。4・5階にトイレはありません。';
      } else if (r === '151') {
        return '151教室は1号館5階、階段を上って正面です。4・5階にトイレはありません。';
      } else if (r.startsWith('2') && r.length === 4) {
        return `${r}教室は2号館${r[1]}階です。2号館には自販機とゴミ箱がありません。`;
      } else {
        return `${r}教室の場所は登録がありません。各号館の案内板で確認してください。`;
      }
    }
  }

  // 13. 施設営業時間案内
  if (['図書館', '図書室', '本を借りる', '地下書庫'].some((k) => qLower.includes(k))) {
    return '図書館は平日9:00〜20:00、土曜9:00〜19:00です（日曜・祝日は休館）。地下書庫と貸出は閉館30分前までです。';
  }

  if (['コンピュータセンター', 'コンセ', 'cc', 'wifi', 'wi-fi', '学内pc', 'パソコン室'].some((k) => qLower.includes(k))) {
    return 'コンピュータセンター（3号館）の窓口は平日9:00〜18:00、土曜9:00〜13:00です。Wi-Fiやアカウントの相談はここで受け付けています。';
  }

  if (['ラーニングコモンズ', 'ラーニング・コモンズ', 'コモンズ', 'lc'].some((k) => qLower.includes(k))) {
    return 'ラーニング・コモンズ（本館1階）は平日8:00〜18:00、土曜8:00〜17:00です。サポートデスクは平日10:00〜18:00です。';
  }

  if (['教務', '教務課', '事務', '事務窓口', '証明書', '学務'].some((k) => qLower.includes(k))) {
    return '教務課（本館1階）の窓口は平日9:00〜17:00、土曜9:00〜13:00です。証明書の自動発行機は窓口終了の15分前までです。';
  }

  if (['資料館', '博物館'].some((k) => qLower.includes(k))) {
    return '文理学部資料館（8号館）は平日10:00〜17:00、土曜10:00〜13:00で、入館無料です。';
  }

  // 14. コース科目案内
  const courseHit = GAKUBU_YORAN_COURSES.find(
    (c) => q.includes(c.name) || (c.name === '教職コース' && q.includes('教職'))
  );
  if (courseHit) {
    return `${courseHit.name}は${courseHit.target}のためのコースで、必要単位は${courseHit.requiredCredits}単位、窓口は${courseHit.window}です。主な科目は${courseHit.keyRequiredCourses.slice(0, 3).join('、')}などです。`;
  }

  // 15. 副専攻案内
  const minorHit = GAKUBU_YORAN_ALL_24_MINORS.find(
    (m) => q.includes(m.name) || (q.includes('副専攻') && q.includes(m.name.replace('副専攻', '')))
  );
  if (minorHit) {
    return `${minorHit.name}は指定科目を16単位以上修得すると、卒業時に修了証書がもらえます（窓口：${minorHit.window}）。${minorHit.ruleNotice}`;
  }

  if (q.includes('副専攻')) {
    return '副専攻は指定科目を16単位以上修得すると卒業時に修了認定を受けられる制度で、事前の登録は不要です。全24種あり、所属学科と同じ学科副専攻は取れません。';
  }

  // 16. 自販機・設備
  if (['給水', '冷水機', 'ウォーターサーバー'].some((k) => qLower.includes(k))) {
    return '使える給水所は4号館1階のエントランスホールだけです（2〜4階は停止中）。';
  }

  if (['ゴミ箱', 'ごみ箱', 'ゴミ', 'ごみ'].some((k) => qLower.includes(k))) {
    return 'ゴミ箱は1号館・3号館の各フロアと、4号館の各階トイレ前にあります。2号館にはありません。';
  }

  if (['クレカ', 'クレジットカード', 'タッチ決済', 'コンタクトレス'].some((k) => qLower.includes(k))) {
    return 'クレジットカードのタッチ決済は、3号館1階食堂側のコカ・コーラの赤い自販機で使えます。';
  }

  if (['コーラ', 'ペプシ', 'coca', 'pepsi'].some((k) => qLower.includes(k))) {
    return 'コーラは3号館1階の食堂側にあります。赤い自販機のコカ・コーラが140円、青い自販機のペプシコーラ生が100円です。';
  }

  if (q.includes('80円') || ['水', '天然水', 'ミネラルウォーター'].some((k) => qLower.includes(k))) {
    return '80円の天然水とZONeは、4号館1階と3号館1階食堂側の自販機で買えます。';
  }

  // デフォルト案内
  return '文理学部の履修アシスタントです。空き教室、必修や卒業要件、GPA、副専攻などを聞いてください。';
}

export async function GET() {
  const serverKey = (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '').trim();
  return NextResponse.json({
    hasServerKey: serverKey.length > 0,
    serverKeyPrefix: serverKey.length > 8 ? `${serverKey.slice(0, 6)}...` : undefined,
    availableModels: ['gemini-3-flash-preview', 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']
  });
}

/** Geminiの失敗を利用者向けの言葉にする */
function friendlyGeminiError(status: number | null, message: string | null): string {
  const lower = (message || '').toLowerCase();
  if (lower.includes('api_key') || lower.includes('api key')) {
    return 'APIキーが無効であるか、形式が正しくありません。Google AI Studio（aistudio.google.com）で取得した有効なキー（AIzaSy...）をご確認ください。';
  }
  if (status === 429) return 'Gemini APIの無料枠利用上限（レートリミット）に達しました。1〜2分お待ちいただくか、別のキーをお試しください。';
  if (status === 403) return 'APIアクセス権限がありません。Gemini APIが有効化されているGoogleアカウントのキーかご確認ください。';
  if (lower.includes('timeout') || lower.includes('aborted')) return '読み取りに時間がかかりすぎました。ページを分けるか、画像を小さくしてお試しください。';
  return message || '接続エラー';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = (body.query || '').trim();
    const apiKey = (body.apiKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '').trim();
    const history = body.history || [];
    const image = body.image || null;
    const userProfile: UserProfileData = body.userProfile || null;

    if (!query && !image) {
      return NextResponse.json({ reply: '質問内容または画像を入力してください。' }, { status: 400 });
    }

    // 話し方（「織田信長みたいに話して」）。端末に保存してもらい、元に戻すまで毎回送ってもらう
    let speakingStyle = sanitizeStyle(body.speakingStyle);
    const styleRequest = query && !image ? parseStyleRequest(query) : null;
    if (styleRequest?.type === 'reset') {
      return NextResponse.json({ reply: 'いつもの話し方に戻しますね。', source: 'local', speakingStyle: null });
    }
    if (styleRequest?.type === 'set') {
      speakingStyle = styleRequest.style;
      const greeting = apiKey ? await styleGreeting(apiKey, GEMINI_MODEL_ORDER, speakingStyle) : null;
      return NextResponse.json({
        reply: greeting
          ? sanitizeConversationalReply(greeting.text)
          : `話し方を「${speakingStyle}」風にしますね。AI（Gemini）が答えるときにこの話し方になります。「普通の話し方に戻して」と送れば元に戻ります。`,
        source: greeting ? 'gemini' : 'local',
        ...(greeting ? { model: greeting.model } : {}),
        speakingStyle
      });
    }

    // フレンドの居場所・空きコマ（ツール get_friends_current_status の結果だけで答え、AIに推測させない）
    if (query && !image && mayBeFriendStatusQuery(query)) {
      const me = await authenticate(req, body).catch(() => null);
      if (me) {
        const intent = friendQueryIntent(query);
        const result = await get_friends_current_status(me, requestTime(req), { withSchedule: intent === 'common_classes' || intent === 'common_free_periods' });
        if (isFriendStatusQuery(query, result.friends.map((f) => f.name))) {
          const myCourses = sanitizeSharedSchedule(userProfile?.enrolledCourses);
          let reply = answerFriendStatusQuery(query, result, myCourses, intent);
          // 話し方の指定があれば口調だけ書き換える（名前・教室・科目名・数字が消えたら元の文のまま）
          if (speakingStyle && apiKey) {
            const keep = [
              ...result.friends.flatMap((f) => [f.name, f.now.room, f.now.course, f.nextClass?.room, f.nextClass?.course, ...(f.schedule || []).flatMap((c) => [c.name, c.room])]),
              ...myCourses.flatMap((c) => [c.name, c.room])
            ].filter((x): x is string => !!x);
            reply = sanitizeConversationalReply(await restyleReply(apiKey, GEMINI_MODEL_ORDER, speakingStyle, reply, keep));
          }
          return NextResponse.json({
            reply,
            source: 'local',
            tool: 'get_friends_current_status',
            toolArgs: { intent }
          });
        }
      } else if (isFriendStatusQuery(query)) {
        return NextResponse.json({
          reply: '友達の空きコマや教室は、フレンド機能で調べられます。サーバーに登録したアカウントでログインし、プロフィールの「フレンド」タブで友達を追加してください（デモアカウントでは使えません）。',
          source: 'local'
        });
      }
    }

    // 成績表・時間割の読み取り（会話文なしでJSONだけを返させる）。images は縦長画像を分けたもの
    const extractKind: ExtractionKind | null = EXTRACTION_KINDS.includes(body.extract) ? body.extract : null;
    const mediaSource: unknown[] = Array.isArray(body.images) && body.images.length ? body.images : image ? [image] : [];
    const mediaParts: MediaPart[] = mediaSource
      .filter((m): m is { mimeType?: string; data: string } => !!m && typeof (m as { data?: unknown }).data === 'string')
      .slice(0, 10)
      .map((m) => ({ mimeType: String(m.mimeType || 'image/jpeg'), data: m.data.replace(/^data:[^;]+;base64,/, '') }));
    if (apiKey && extractKind && mediaParts.length > 0) {
      try {
        const result = await extractDocument({ apiKey, models: GEMINI_MODEL_ORDER, parts: mediaParts, kind: extractKind, timeoutMs: EXTRACTION_TIMEOUT_MS });
        console.info(`[extract] ${extractKind} model=${result.model} rows=${result.stats.rowCount} extracted=${result.stats.extracted} attempts=${result.stats.attempts} ms=${result.stats.ms}`);
        return NextResponse.json({
          reply: result.reply,
          source: 'gemini',
          model: result.model,
          profileUpdate: result.profileUpdate,
          extractionWarning: result.warning,
          extraction: result.stats
        });
      } catch (err) {
        if (err instanceof ExtractionError && err.code === 'no_courses') {
          return NextResponse.json({ reply: '科目の一覧が見つかりませんでした。', source: 'gemini', profileUpdate: null });
        }
        const status = err instanceof ExtractionError ? (err.status ?? null) : null;
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[extract] ${extractKind} failed: ${status ?? ''} ${message}`);
        const friendly = friendlyGeminiError(status, message);
        return NextResponse.json({ reply: `AIで読み取れませんでした（${friendly}）`, source: 'local', error: friendly, errorStatus: status, profileUpdate: null });
      }
    }

    // Google Gemini API呼び出し（APIキー設定時）
    if (apiKey) {
      const imageType = body.imageType || null;
      let userPromptText = query;
      // 読み取る書類によって思考量を変える
      let isTranscriptImage = false;
      if (image) {
        const isPast = imageType === 'past_timetable' || query.includes('過去') || query.includes('修得済み') || query.includes('前学期');
        const isTranscript = imageType === 'transcript' || query.includes('成績') || query.includes('通知書') || query.includes('GPA') || query.includes('評価');

        let imageInstruction = '';
        if (isPast) {
          imageInstruction = `【最重要：過去の時間割表OCR・ファイル解析】
添付された過去の時間割表（画像またはPDF/ファイル）から、履修した科目名と単位数をすべて抽出してください。
※重要ルール：時間割表には成績評価（S〜C等）は記載されていないため、勝手に成績を推測・捏造せず、評価は「修得」（または「-」）として登録してください。
回答本文で読み取った科目一覧（科目名・単位数）を分かりやすく案内した上で、必ず回答末尾に以下のJSONブロックを出力してください：
\`\`\`profile_update
{
  "action": "add_completed_timetable",
  "totalEarnedCredits": <加算後の総修得単位数(数値)>,
  "addCompletedCourses": [
    { "name": "<科目名>", "credits": <単位数>, "grade": "修得", "year": 1 }
  ]
}
\`\`\``;
        } else if (isTranscript) {
          isTranscriptImage = true;
          imageInstruction = `【最重要：成績通知書OCR解析】
添付された成績通知書（スマホ画面スクリーンショット、写真、PDF、またはテキスト）を解析し、記載されているすべての履修済み科目（科目名・単位数・評価）、総修得単位数、現在GPAを1科目も漏れなく読み取ってください。
※スマホのポータル画面（NU-Web等）のスクリーンショット等で総単位数やGPAの記載が見当たらない場合でも、画像内のすべての科目（科目名・単位数・評価）を completedCourses 配列に漏れなく出力してください（講義は2単位、体育・実験演習は1単位）。
※各科目は「科目名(name)・単位数(credits)・評価(grade)」の3つを必ずセットで出力してください。どれかが読めない科目も省かず、読めた値を入れてください。
※評価は S/A/B/C/D/E/F のいずれかにそろえてください（秀→S、優→A、良→B、可→C、不可→D）。履修中止は P、認定は N、合否のみの科目は「合格」と出力します。
※D/E/F は不合格（単位未修得）です。不合格の科目も省かずに評価どおり出力してください。再履修で同じ科目が複数回載っている場合も、すべての行をそのまま出力してください。
※年度・学期が書かれていれば takenYear（西暦の数値）と term（前期/後期/通年/集中）も入れてください。書かれていなければ省略します。
※totalEarnedCredits と currentGpa は成績表に書かれた値をそのまま入れ、書かれていなければ省略してください（自分で計算しない）。
回答本文で結果を要約した上で、必ず回答末尾に以下のJSONブロックを出力してください：
\`\`\`profile_update
{
  "action": "transcript",
  "totalEarnedCredits": <成績表に書かれた修得単位数(数値)>,
  "currentGpa": <成績表に書かれたGPA(数値)>,
  "completedCourses": [
    { "name": "<科目名>", "credits": <単位数>, "grade": "<S/A/B/C/D/E/F/P/N/合格>", "takenYear": <年度(数値・任意)>, "term": "<学期(任意)>" }
  ]
}
\`\`\``;
        } else {
          // デフォルト：今期の時間割表（履修中科目）
          imageInstruction = `【最重要：今期の時間割表OCR解析・履修中科目登録】
添付された【今期の時間割表】画像をマルチモーダルOCR解析し、画像内に記載されている全ての開講科目（曜日・時限・教室・科目名・担当教員名・単位数）を漏れなく読み取ってください。
回答本文で「月曜2限：3306 基礎プログラミング（2単位・山田先生）」のように曜日時限順に整理して分かりやすく案内した上で、**必ず回答の末尾に以下のJSONコードブロックを完全な形式で出力してください（厳守）**：
\`\`\`profile_update
{
  "action": "enroll_current_timetable",
  "semesterCredits": <今期の登録単位数合計(全科目の単位数の合算数値)>,
  "enrolledCourses": [
    { "name": "<正確な科目名>", "day": "<月/火/水/木/金/土>", "period": <1-5の時限数値>, "room": "<教室番号>", "teacher": "<教員名>", "credits": <単位数(講義2, 実習演習1)> }
  ]
}
\`\`\`
※学生が履修登録した全コマを1つ残らず enrolledCourses 配列に含めてください。`;
        }

        userPromptText = query ? `学生のメッセージ: ${query}\n\n${imageInstruction}` : imageInstruction;
      }

      const profileContext = userProfile
        ? `【ユーザープロフィール（『学部要覧』基準）】\n` +
          `・カリキュラム体系: ${userProfile.admissionYear === 'reiwa6_or_earlier' ? '令和6年度以前入学者（旧カリキュラム）' : '令和7年度以降入学者（新カリキュラム）'}\n` +
          `・所属学科: ${userProfile.department || '未設定'}\n` +
          `・学年: ${userProfile.grade || 1}年\n` +
          `・現在のGPA: ${userProfile.currentGpa ?? 2.40}\n` +
          `・目標GPA: ${userProfile.targetGpa ?? 3.00}\n` +
          `・修得済み総単位数: ${userProfile.currentCredits ?? 40}単位\n` +
          `・今期履修中単位数: ${userProfile.semesterCredits ?? 16}単位\n` +
          `・選択コース: ${(userProfile.selectedCourses || []).join(', ') || '未選択'}\n` +
          `・選択副専攻: ${(userProfile.selectedMinors || []).join(', ') || '未選択'}\n` +
          `・修得済み科目数: ${(userProfile.completedCourses || []).length}科目\n\n`
        : '';

      // 時間割の事実はAIに推測させず、検索した実データを渡す（画像解析では不要）
      const timetableContext = image ? '' : buildTimetableContext(query, userProfile, requestTime(req));
      // 資格コース・教職・副専攻の質問には、要覧の表から該当部分を渡す
      const curriculumContext = image ? '' : buildCurriculumContext(query, userProfile);
      const currentTurnParts: any[] = [
        { text: `${profileContext}${timetableContext}${curriculumContext}${userPromptText}` }
      ];

      if (image && image.data) {
        const cleanBase64 = image.data.replace(/^data:[^;]+;base64,/, '');
        const rawMime = (image.mimeType || '').toLowerCase();

        // CSVやテキストファイルの場合、base64をUTF-8文字列として復元してプロンプト本文に付加
        if (rawMime.includes('csv') || rawMime.includes('text') || rawMime.includes('plain')) {
          try {
            const decodedText = Buffer.from(cleanBase64, 'base64').toString('utf-8');
            currentTurnParts.push({
              text: `\n\n【添付ファイル内容（テキスト/CSV形式）】\n\`\`\`\n${decodedText}\n\`\`\``
            });
          } catch (e) {
            currentTurnParts.push({
              inlineData: { mimeType: 'text/plain', data: cleanBase64 }
            });
          }
        } else {
          // 画像またはPDF
          let validMime = image.mimeType || 'image/jpeg';
          if (!validMime.startsWith('image/') && validMime !== 'application/pdf') {
            validMime = 'image/jpeg';
          }
          currentTurnParts.push({
            inlineData: {
              mimeType: validMime,
              data: cleanBase64
            }
          });
        }
      }

      // Gemini APIは最初のターンが必ずrole: "user"である必要があり、かつ交互（user ➔ model ➔ user）でなければならない
      const contents: any[] = [];
      let lastRole: string | null = null;

      for (const h of history) {
        const text = (h.text || '').trim();
        if (!text) continue;
        const role = h.sender === 'user' ? 'user' : 'model';

        // 先頭のウェルカム文（assistant/model）はスキップして必ずuserから開始する
        if (!lastRole && role === 'model') {
          continue;
        }

        if (role === lastRole) {
          // 同一roleが連続する場合はpartsにテキストを追加
          const prevItem = contents[contents.length - 1];
          if (prevItem && Array.isArray(prevItem.parts)) {
            prevItem.parts.push({ text });
          }
        } else {
          contents.push({
            role,
            parts: [{ text }]
          });
          lastRole = role;
        }
      }

      // 現在のユーザーターンを追加（直前がuserの場合は統合）
      if (lastRole === 'user' && contents.length > 0) {
        contents[contents.length - 1].parts.push(...currentTurnParts);
      } else {
        contents.push({
          role: 'user',
          parts: currentTurnParts
        });
      }

      const isImageRequest = !!(image && image.data);
      // 思考も出力上限に含まれる。科目の多い画像で回答が途中で切れないよう余裕を持たせる
      const outputLimit = isImageRequest ? 8192 : 4096;
      const geminiPayload = {
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT.trim() + (speakingStyle && !isImageRequest ? styleInstruction(speakingStyle) : '') }]
        },
        contents,
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: outputLimit,
          ...(!isImageRequest ? CHAT_THINKING_CONFIG : isTranscriptImage ? TRANSCRIPT_THINKING_CONFIG : TIMETABLE_THINKING_CONFIG)
        }
      };

      const fetchSingleModel = async (model: string, timeoutMs: number = 7500): Promise<{ model: string; text: string }> => {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify(geminiPayload)
        });
        if (!res.ok) {
          let errText = `HTTP ${res.status}`;
          try {
            const errJson = await res.json();
            errText = errJson?.error?.message || errText;
          } catch {}
          const error: any = new Error(errText);
          error.status = res.status;
          throw error;
        }
        const data = await res.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const candidateText = parts.map((p: any) => p.text || '').filter(Boolean).join('\n');
        if (!candidateText) {
          throw new Error('Empty response from model');
        }
        return { model, text: candidateText };
      };

      let successfulResponse: { model: string; text: string } | null = null;
      let lastErrorStatus: number | null = null;
      let lastErrorMessage: string | null = null;

      // 速いモデルから順に試す。同時に呼ぶと無料枠を2倍使うので1つずつ呼ぶ（APIキー不正・権限エラー時は打ち切る）
      const requestTimeout = isImageRequest ? IMAGE_REQUEST_TIMEOUT_MS : CHAT_REQUEST_TIMEOUT_MS;
      const deadline = Date.now() + (isImageRequest ? IMAGE_TOTAL_TIMEOUT_MS : CHAT_TOTAL_TIMEOUT_MS);
      for (const model of GEMINI_MODEL_ORDER) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        try {
          successfulResponse = await fetchSingleModel(model, Math.min(requestTimeout, remaining));
          break;
        } catch (err: any) {
          lastErrorStatus = err?.status || lastErrorStatus;
          lastErrorMessage = err?.message || String(err);
          if (err?.status === 400 && lastErrorMessage?.toLowerCase().includes('api_key')) break;
          if (err?.status === 403) break;
        }
      }

      if (successfulResponse && successfulResponse.text) {
        const candidateText = successfulResponse.text;
        const profileUpdate = parseProfileUpdateFromText(candidateText, !!image);
        return NextResponse.json({
          reply: sanitizeConversationalReply(candidateText),
          source: 'gemini',
          model: successfulResponse.model,
          profileUpdate
        });
      }

      // APIキーが設定されたがGeminiがエラーになった場合のエラーメッセージ整形
      const friendlyError = friendlyGeminiError(lastErrorStatus, lastErrorMessage);

      const localReply = answerLocally(query || (image ? '成績表画像' : ''), userProfile, requestTime(req));
      let fallbackUpdate = parseProfileUpdateFromText(localReply, !!image);
      if (!fallbackUpdate && image && image.data) {
        const rawMime = (image.mimeType || '').toLowerCase();
        if (rawMime.includes('csv') || rawMime.includes('text') || rawMime.includes('plain')) {
          try {
            const cleanBase64 = image.data.replace(/^data:[^;]+;base64,/, '');
            const decoded = Buffer.from(cleanBase64, 'base64').toString('utf-8');
            fallbackUpdate = parseProfileUpdateFromText(decoded, true);
          } catch (e) {}
        }
      }
      return NextResponse.json({
        reply: sanitizeConversationalReply(`APIの接続状況を確認しました（${friendlyError}）。学内データをもとにお答えしますね！\n\n${localReply}`),
        source: 'local',
        error: friendlyError,
        errorStatus: lastErrorStatus,
        profileUpdate: fallbackUpdate
      });
    }

    // ローカルエンジンによる即時フォールバック（公式要覧準拠）
    const localReply = answerLocally(query || (image ? '成績表画像' : ''), userProfile, requestTime(req));
    let fallbackUpdate = parseProfileUpdateFromText(localReply, !!image);
    if (!fallbackUpdate && image && image.data) {
      const rawMime = (image.mimeType || '').toLowerCase();
      if (rawMime.includes('csv') || rawMime.includes('text') || rawMime.includes('plain')) {
        try {
          const cleanBase64 = image.data.replace(/^data:[^;]+;base64,/, '');
          const decoded = Buffer.from(cleanBase64, 'base64').toString('utf-8');
          fallbackUpdate = parseProfileUpdateFromText(decoded, true);
        } catch (e) {}
      }
    }
    return NextResponse.json({
      reply: sanitizeConversationalReply(localReply),
      source: 'local',
      // 画像・PDFはAIなしでは読めない。サーバーにも利用者にもキーがないことを画面に伝える
      ...(image && !fallbackUpdate ? { needsApiKey: true } : {}),
      profileUpdate: fallbackUpdate
    });
  } catch (error) {
    return NextResponse.json({
      reply: 'エラーが発生しました。もう一度入力してください。'
    }, { status: 500 });
  }
}
