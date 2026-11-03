import {
  VERIFIED_COURSES_CURRICULUM,
  VERIFIED_MINORS_CURRICULUM,
  getCourseCurriculum,
  getMinorCurriculum
} from '@/app/data/coursesAndMinorsCurriculum';
import {
  VERIFIED_12_DEPARTMENTS_CURRICULUM,
  getDepartmentCurriculum
} from '@/app/data/departmentCurriculum';
import { NextRequest, NextResponse } from 'next/server';
import {
  GAKUBU_YORAN_DEPARTMENTS,
  GAKUBU_YORAN_CAP_RULES,
  GAKUBU_YORAN_GPA_RULES,
  GAKUBU_YORAN_COURSES,
  GAKUBU_YORAN_ALL_24_MINORS,
  analyzeAcademicDeficiency,
  simulateGpaEngine,
  UserProfileData
} from '@/app/data/gakubuYoran';
import {
  findFreeRooms,
  checkCourseConflicts,
  suggestCoursesForFreePeriod,
  proposeAutomaticSchedule,
  calculateTransitOptimization,
  getRoomDailySchedule,
  getLectureDatabase,
  getCompactRoomLabel
} from '@/app/data/courses';
import { parseProfileUpdateFromText } from '@/app/data/studentAccounts';

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
   ・質問に対して必要な情報（教室名、時限、科目名、単位数、アドバイス等）は最後まで省略せずに丁寧に回答してください。
3. **必修と選択必修の明確な区別**：
   ・「必修科目」：卒業要件として必ず単位を取らなければならない科目（自主創造の基礎、各学科の指定専門必修など）。
   ・「選択必修科目」：指定されたグループの中から、決められた単位数以上を選んで必ず修得する科目（総合教育科目、外国語科目など）。
   ・質問された際は両者を混同せず、的確に区別して案内してください。
4. **曜日・時限・教室・教員・授業データの回答**：
   ・何曜何限の何教室で誰の何という授業（必修/選択必修）が行われているかを聞かれたら、時間割データに基づき「◯曜◯限の◯◯教室は、◯◯先生の『◯◯（必修/選択必修）』が行われていますよ！」と短く返信してください。

---

## 【動作ルール】
1. 要覧準拠の回答義務：履修・単位・卒業要件に関する相談は、文理学部要覧の基準に基づいて回答してください。
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
     - 出力末尾に以下の更新JSONを埋め込んでください：
     \`\`\`profile_update
     {
       "action": "transcript",
       "totalEarnedCredits": 42,
       "currentGpa": 2.85,
       "completedCourses": [
         { "name": "基礎プログラミング", "credits": 2, "grade": "S" },
         { "name": "線形代数1", "credits": 2, "grade": "A" }
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
・S (100〜90点, 係数4.0) / A (89〜80点, 係数3.0) / B (79〜70点, 係数2.0) / C (69〜60点, 係数1.0) / D (59点以下, 係数0.0, 不合格) / E (成績不提示, 係数0.0, 不合格) / P (履修中止, GPA除外) / N (認定, GPA除外)
・計算式：(4×S + 3×A + 2×B + 1×C) / 総履修単位(D,E含む)。小数第3位四捨五入。
・再履修時は最後の履修による成績・単位数のみを累積GPAに算入。

### 4. コース科目（全6コース・要覧 p.140-177）
・教職コース（教職センター / p.140-163）
・司書教諭コース（教職センター / 必修10単位 / p.164）
・司書コース（教務課 / 必修22単位＋選択必修4単位＝26単位 / p.165）
・学芸員コース（教務課 / 必修22単位＋選択16単位＝38単位 / p.166-167）
・社会教育主事コース（教務課 / 必修17単位＋選択必修8単位＝25単位 / p.168-169）
・日本語教育コース（教務課 / 必修11単位＋選択必修2単位含む計26単位 / p.170-171）

### 5. 副専攻（全24種・要覧 p.180-192）
指定科目16単位以上修得で修了証書。所属学科と同一の学科副専攻は修了認定不可。理系学科生は科学リテラシー副専攻不可。

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
  - ZONe スカッと透明: 80円（激安エナジードリンク！）
  - GREEN DA・KA・RA やさしい麦茶 600ml: 90円
  - レッドブル（Red Bull）: 170円（コンビニよりお得！）
  - 伊右衛門 特茶/焙じ茶: 100〜110円
  - プレミアムボス 微糖: 130円

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
`;

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
    return `現在のGPA ${currentGpa.toFixed(2)} から目標 ${targetGpa.toFixed(2)} には、今期全科目Sでも計算上届きません。来期以降も継続してS・Aを重ねて着実に上げていきましょう！`;
  }

  return `現在のGPA ${currentGpa.toFixed(2)} から目標 ${targetGpa.toFixed(2)} に到達するには、今期${result.courseCount}科目のうちS評価を${result.patternA.sCourses}科目、A評価を${result.patternA.aCourses}科目以上修得するのが目安です！`;
}

// ローカル履修・不足判定（要覧 p.31-36, 各学科ページ準拠・人間の自然なチャット言葉遣い）
function checkRequirementsLocally(profile: UserProfileData): string {
  const analysis = analyzeAcademicDeficiency(profile || ({} as UserProfileData));
  const deptData = GAKUBU_YORAN_DEPARTMENTS[analysis.department] || GAKUBU_YORAN_DEPARTMENTS['情報科学科'];

  const parts: string[] = [];
  parts.push(`${analysis.department}の${analysis.grade}年次の履修状況を確認しました！`);

  // 学科必修科目
  if (analysis.missingMajorReqs.length > 0) {
    const reqNames = analysis.missingMajorReqs.map((r) => `${r.name}（${r.credits}単位）`).join('、');
    parts.push(`まず学科の必修科目ですが、まだ修得できていない科目として ${reqNames} があります。次期の履修登録で優先して入れておくのが安心ですよ。`);
  } else {
    parts.push(`学科の主要な必修科目はすべて順調に修得できています！`);
  }

  // マイルストーン
  if (analysis.milestonesStatus.length > 0) {
    const warnings = analysis.milestonesStatus.map((ms) => `${ms.timing}に向けて ${ms.condition} が必要です（満たせないと${ms.consequence}）`).join('。');
    parts.push(`進級や卒業研究の条件として、${warnings}ので気をつけてくださいね。`);
  }

  // コース・副専攻
  if (analysis.coursesAnalysis.length > 0 || analysis.minorsAnalysis.length > 0) {
    const courseNotes = analysis.coursesAnalysis.map((c) => `${c.name}は${c.reqCredits}単位必要で、相談窓口は${c.window}です。${c.note}`).join(' ');
    const minorNotes = analysis.minorsAnalysis.map((m) => m.warning ? `${m.name}について、${m.warning}` : `${m.name}は修了に16単位以上必要です。${m.note}`).join(' ');
    parts.push(`選択しているコースや副専攻については、${courseNotes} ${minorNotes}`);
  }

  // 卒業単位
  parts.push(`卒業に必要な124単位のうち、現在は ${analysis.earnedCredits}単位 を修得しています。専門科目は必修${deptData.majorReq}単位と選択${deptData.majorOpt}単位（合計${deptData.majorTotal}単位）、総合教育科目12単位、外国語${deptData.gaikokugoReq}単位などが要件になっています。計画的に進めていきましょう！`);

  return parts.join('\n\n');
}

// ローカルエンジン（オフライン・API未設定時の高精度フォールバック・人間の自然なチャット言葉遣い）
function answerLocally(query: string, userProfile?: UserProfileData): string {
  const q = query.trim();
  const qLower = q.toLowerCase();

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
      const askCompulsory = q.includes('必修') && !q.includes('選択必修のみ');
      const askElective = q.includes('選択必修') || q.includes('選択');

      // 必修のみの質問
      if (askCompulsory && !askElective) {
        const reqList = info.requiredCourses.map((c) => `${c.name}（${c.credits}単位）`).join('、');
        return `${matchedDept}の必修科目は${info.requiredSummary}です。具体的には、${reqList}があり、すべて修得する必要がありますよ！`;
      }

      // 選択必修のみの質問
      if (askElective && !askCompulsory) {
        const eleList = info.electiveRequiredCourses.map((c) => `${c.name}（${c.credits}単位）`).join('、');
        return `${matchedDept}の選択必修科目は${info.electiveSummary}です。対象科目には、${eleList}があり、指定の群から必要な単位数を満たすように選択します！`;
      }

      // 必修と選択必修の両方、またはカリキュラム全体の質問
      const reqList = info.requiredCourses.slice(0, 10).map((c) => `${c.name}（${c.credits}単位）`).join('、');
      const eleList = info.electiveRequiredCourses.slice(0, 8).map((c) => `${c.name}（${c.credits}単位）`).join('、');
      return `${matchedDept}の専門科目は、必修科目（${info.majorReqCredits}単位）と選択必修科目（${info.majorElectiveCredits}単位）に明確に分かれています。必修科目は${info.requiredSummary}で、${reqList}などすべて修得が必須です。選択必修科目は${info.electiveSummary}で、${eleList}などの指定群から規定単位を選んで修得しますよ！`;
    }
  }

  // 0.01 資格コース（司書・学芸員等）の必修・単位数回答
  const courseKeys = Object.keys(VERIFIED_COURSES_CURRICULUM);
  const matchedCourse = courseKeys.find((k) => q.includes(k) || (k === '司書コース' && q.includes('司書') && !q.includes('教諭')));
  if (matchedCourse) {
    const cInfo = VERIFIED_COURSES_CURRICULUM[matchedCourse];
    if (cInfo) {
      if (cInfo.requiredCourses.length > 0 && (q.includes('必修') || q.includes('科目') || q.includes('単位') || q.includes('何単位') || q.includes('要件'))) {
        const reqList = cInfo.requiredCourses.map((c) => `${c.name}（${c.credits}単位）`).join('、');
        const eleCount = cInfo.electiveRequiredCourses.length;
        return `${cInfo.name}は${cInfo.description}。必修科目には、${reqList}があります！履修カルテの「資格コース」タブでチェックしながら進められますよ。`;
      }
    }
  }

  // 0.02 全24副専攻の修了要件・必修科目回答
  const minorKeys = Object.keys(VERIFIED_MINORS_CURRICULUM);
  const matchedMinor = minorKeys.find((k) => q.includes(k) || (k.replace('副専攻', '') && q.includes(k.replace('副専攻', '')) && q.includes('副専攻')));
  if (matchedMinor) {
    const mInfo = VERIFIED_MINORS_CURRICULUM[matchedMinor];
    if (mInfo) {
      const reqList = mInfo.requiredCourses.length > 0
        ? `必修科目として${mInfo.requiredCourses.map((c) => `${c.name}（${c.credits}単位）`).join('、')}の修得が必要です。`
        : '特定の全学科必修はなく、指定群から規定単位を選択します。';
      return `${mInfo.name}は、${mInfo.description}。${reqList}16単位修得で卒業時に修了証書が授与されますよ！`;
    }
  }

  // 0. 必修と選択必修の違いの質問
  if (q.includes('必修') && (q.includes('違い') || q.includes('選択必修') || q.includes('何が違う') || q.includes('どう違う'))) {
    return '必修科目は卒業のために絶対に修得しなければならない科目（自主創造の基礎や専門必修など）で、落とすと卒業できません。選択必修科目は指定されたグループの中から規定単位数以上を選んで必ず修得する科目ですよ。どちらも卒業に関わる重要科目なので、優先して履修してくださいね！';
  }

  // 0.1 曜日・時限・教室・教員・講義の逆引き検索（チャット式回答）
  const roomQueryMatch = q.match(/([1-4]\d{2,3}[a-zA-Z]?|8B\d{3}|88\d{3})/i);
  let dayInQuery: string | undefined = undefined;
  for (const d of ['月', '火', '水', '木', '金', '土']) {
    if (q.includes(`${d}曜`) || (q.length <= 15 && q.includes(d))) {
      dayInQuery = d;
      break;
    }
  }
  let periodInQuery: number | undefined = undefined;
  const pmq = q.match(/([1-5])\s*(?:限|コマ)/);
  if (pmq) periodInQuery = parseInt(pmq[1], 10);

  if (roomQueryMatch && (dayInQuery || periodInQuery || q.includes('授業') || q.includes('誰') || q.includes('何') || q.includes('先生') || q.includes('講義'))) {
    const rawR = roomQueryMatch[1].toUpperCase().replace('88', '8B');
    const db = getLectureDatabase(userProfile?.admissionYear);
    const hits = db.filter((c) => {
      const roomHit = c.room.toUpperCase().includes(rawR);
      const dayHit = dayInQuery ? c.day === dayInQuery : true;
      const periodHit = periodInQuery ? c.period === periodInQuery : true;
      return roomHit && dayHit && periodHit;
    });

    if (hits.length > 0) {
      const h = hits[0];
      const typeStr = h.type ? `（${h.type}）` : '';
      const whenStr = h.day && h.period ? `${h.day}曜${h.period}限` : '';
      return `${whenStr ? `${whenStr}の` : ''}${getCompactRoomLabel(rawR)}は、${h.teacher}先生の『${h.name}${typeStr}』が行われていますよ。${h.department ? `対象は${h.department}です。` : ''}`;
    }
  }

  // 1. CAP制・年間履修上限についての質問
  if (['上限', 'cap', '何単位まで履修', '年間単位', '履修登録上限', '40単位'].some((k) => qLower.includes(k))) {
    return (
      `文理学部では、学習効果を高めるために年間の履修登録上限が40単位と決められていますよ。これは修得単位ではなく、履修登録する単位数の上限です。\n\n` +
      `なお、教職科目や司書科目、集中講義などはこの40単位の上限に含まれない仕組みになっています。\n\n` +
      `また、前年度の成績でGPAが3.20以上ある場合など、成績優秀者には年間44単位まで登録できる特別措置も用意されています！`
    );
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
    return (
      `成績表や時間割の画像・ファイルを送っていただければ、履修科目やGPA、評価を自動で読み取ってプロフィールに反映できますよ！\n\n` +
      `右上のAPI設定からGemini APIキーを入れておくと自動解析がスムーズに動きます。もしAPIキーがなくても、右上のプロフィールから手動で単位数やGPAを設定すれば、いつでも不足単位の判定やGPAシミュレーションが使えますので安心してくださいね。`
    );
  }

  // 5. 指定日時・時限・現在の空き教室・自習スポット検索
  const isRoomFreeQuery =
    ['空き教室', '空いてる教室', '空いている教室', '自習室', '自習スポット', '自習できる', 'いま空い', '今空い', 'どこ空い', '教室空い', '空き部屋', '空いてる場所', '使える教室'].some((k) => qLower.includes(k)) ||
    (/(月|火|水|木|金|土)曜?[^。、！？\n]*([1-5]限|[1-5]コマ|\d{1,2}時)/.test(qLower));

  if (isRoomFreeQuery) {
    let dayMatch: string | undefined = undefined;
    for (const d of ['月', '火', '水', '木', '金', '土']) {
      if (q.includes(`${d}曜`) || q.includes(`${d}曜日`)) {
        dayMatch = d;
        break;
      }
    }
    if (!dayMatch) {
      const dm = q.match(/(月|火|水|木|金|土)(?=[の\s\d限])/);
      if (dm) dayMatch = dm[1];
    }

    let periodMatch: number | undefined = undefined;
    const pm = q.match(/([1-5])\s*(?:限|コマ)/);
    if (pm) {
      periodMatch = parseInt(pm[1], 10);
    } else {
      const tm = q.match(/(\d{1,2})(?:[:：](\d{2}))?\s*(?:時|分|頃|から)?/);
      if (tm) {
        const h = parseInt(tm[1], 10);
        const m = tm[2] ? parseInt(tm[2], 10) : 0;
        const total = h * 60 + m;
        if (h >= 8 && h <= 19) {
          if (total < 10 * 60 + 35) periodMatch = 1;
          else if (total < 12 * 60 + 10) periodMatch = 2;
          else if (total < 13 * 60) periodMatch = 2;
          else if (total < 14 * 60 + 35) periodMatch = 3;
          else if (total < 16 * 60 + 15) periodMatch = 4;
          else periodMatch = 5;
        }
      }
    }

    let buildingMatch: string | undefined = undefined;
    const bm = q.match(/([1-4])\s*号館/);
    if (bm) {
      buildingMatch = `${bm[1]}号館`;
    }

    return findFreeRooms(dayMatch, periodMatch, buildingMatch, userProfile?.admissionYear).formattedReport;
  }

  // 6. キャンパス移動・10分休みの最適化ナビ
  if (['移動', '10分休み', '間に合う', 'から', 'ルート', '行き方'].some((k) => qLower.includes(k))) {
    const rooms = q.match(/([1-4]\d{2,3}[a-zA-Z]?)/g);
    if (rooms && rooms.length >= 2) {
      return calculateTransitOptimization(rooms[0], rooms[1]);
    }
  }

  // 7. 教室の利用スケジュール・何限に使われているか
  if (['何限に使われ', '何限', '教室の予定', '教室の利用', '利用状況', '使われてる', '使用スケジュール'].some((k) => qLower.includes(k))) {
    const mRoom = q.match(/([1-4]\d{2,3}[a-zA-Z]?)/);
    if (mRoom) {
      const dayMatch = ['月', '火', '水', '木', '金', '土'].find((d) => q.includes(`${d}曜`) || q.includes(d));
      return getRoomDailySchedule(mRoom[1], dayMatch, userProfile?.admissionYear);
    }
  }

  // 8. 履修登録サポート＆「空きコマ」活用提案
  if (['空きコマ', '空いてるコマ', 'コマを埋め', '埋めたい', 'おすすめの総合', 'コマに入る'].some((k) => qLower.includes(k))) {
    const dayMatch = ['月', '火', '水', '木', '金', '土'].find((d) => q.includes(`${d}曜`) || q.includes(d)) || '火';
    const periodMatch = [1, 2, 3, 4, 5].find((p) => q.includes(`${p}限`) || q.includes(`${p}コマ`)) || 3;
    const cat = q.includes('総合') ? '総合' : q.includes('外国語') ? '外国語' : q.includes('基礎') ? '基礎' : '';
    return suggestCoursesForFreePeriod(dayMatch, periodMatch, cat, userProfile?.admissionYear);
  }

  // 9. 時間割重複（バッティング）チェック
  if (['被っ', '重複', 'バッティング', '重なって'].some((k) => qLower.includes(k))) {
    const db = getLectureDatabase(userProfile?.admissionYear);
    const candidateCourses: string[] = [];
    db.forEach((c) => {
      if (q.includes(c.name) && !candidateCourses.includes(c.name)) {
        candidateCourses.push(c.name);
      }
    });
    if (candidateCourses.length >= 2) {
      return checkCourseConflicts(candidateCourses, userProfile?.admissionYear).formattedReport;
    }
  }

  // 10. 学部要覧連動「必修組み込み済みの自動スケジュール提案」
  if (['時間割作って', '時間割提案', 'スケジュール作って', 'おすすめの時間割', '必修時間割', '基本時間割', '時間割を組んで'].some((k) => qLower.includes(k))) {
    const dept = userProfile?.department || '情報科学科';
    const grade = userProfile?.grade || 1;
    const reqs = GAKUBU_YORAN_DEPARTMENTS[dept]?.requiredCourses.map((c) => c.name) || [];
    return proposeAutomaticSchedule(dept, grade, userProfile?.admissionYear, reqs);
  }

  // 11. 講義・教員名の逆引き検索
  const db = getLectureDatabase(userProfile?.admissionYear);
  if (q.length >= 2 && ['先生', '教授', '講義', '授業', '開講', '何曜'].some((k) => q.includes(k))) {
    const cleanQ = q.replace(/(先生|教授|講義|授業|って|何曜|何限|いつ|どこ|教えて|の)/g, '').trim();
    if (cleanQ.length >= 2) {
      const hits = db.filter((c) => c.name.includes(cleanQ) || c.teacher.includes(cleanQ));
      if (hits.length > 0) {
        const lines = [`${cleanQ}についての講義をお調べしました！`, ''];
        hits.slice(0, 5).forEach((h) => {
          lines.push(`${h.name}（担当：${h.teacher}先生）は、${h.day}曜${h.period}限に${getCompactRoomLabel(h.room)}で開講されていますよ。`);
        });
        return lines.join('\n');
      }
    }
  }

  // 12. 教室番号直接入力判定（「3306」「3505」「421」「124」等の直打ち・質問）
  if (!/\d+\s*(単位|円|~|-|〜)/.test(q)) {
    const mRoom = q.match(/([1-4]\d{2,3}[a-zA-Z]?)/);
    if (mRoom) {
      const r = mRoom[1].toUpperCase();

      if (r === '411') {
        return '4号館の411教室ですね！4号館の1階にあって、正面玄関を入って左側（男子トイレ側）に進むとありますよ。1階には給水所（冷水機）やトイレ前のゴミ箱も設置されているので便利です。';
      } else if (r === '412') {
        return '4号館の412教室ですね！4号館の1階にあって、正面玄関を入って右側（女子トイレ側）に進むとありますよ。1階には給水所（冷水機）やトイレ前のゴミ箱も設置されています。';
      } else if (r === '421') {
        return '4号館の421教室ですね！4号館の2階にあって、階段を登って左側（男子トイレ側）にありますよ。トイレ前にゴミ箱があります。給水所は1階をご利用くださいね。';
      } else if (r === '422') {
        return '4号館の422教室ですね！4号館の2階にあって、階段を登って右側（女子トイレ側）にありますよ。トイレ前にゴミ箱があります。給水所は1階をご利用くださいね。';
      } else if (r === '431') {
        return '4号館の431教室ですね！4号館の3階にあって、階段を登って右側（男子トイレ側）にありますよ。トイレ前にゴミ箱が設置されています。';
      } else if (r === '432') {
        return '4号館の432教室ですね！4号館の3階にあって、階段を登って左側（女子トイレ側）にありますよ。トイレ前にゴミ箱が設置されています。';
      } else if (r === '441') {
        return '4号館の441教室ですね！4号館の4階にあって、階段を登って右側奥（男子トイレ側の奥）にありますよ。手前が442教室です。';
      } else if (r === '442') {
        return '4号館の442教室ですね！4号館の4階にあって、階段を登って右側手前（男子トイレ側の手前）にありますよ。奥が441教室です。';
      } else if (r === '443') {
        return '4号館の443教室ですね！4号館の4階にあって、階段を登って左側手前（女子トイレ側の手前）にありますよ。奥が444教室です。';
      } else if (r === '444') {
        return '4号館の444教室ですね！4号館の4階にあって、階段を登って左側奥（女子トイレ側の奥）にありますよ。手前が443教室です。';
      } else if (r.startsWith('3') && r.length === 4) {
        const fl = r[1];
        const sub = parseInt(r.slice(2), 10);
        const sideGuide = sub <= 5 ? 'エスカレーターを出て右側（男子トイレ側）' : 'エスカレーターを出て左側（女子トイレ側）';
        return `3号館の${r}教室ですね！3号館の${fl}階にあって、${sideGuide}に進むとありますよ。ゴミ箱は各フロアに設置されています。`;
      } else if (['122', '123', '124'].includes(r)) {
        return `1号館の${r}教室ですね！1号館の2階にあって、階段を登って左側に進むとありますよ（奥に女子トイレがあります）。`;
      } else if (['125', '126', '127A', '127B'].includes(r)) {
        return `1号館の${r}教室ですね！1号館の2階にあって、階段を登って右側に進むとありますよ（手前に男子トイレ、奥に女子トイレがあります）。`;
      } else if (r === '130') {
        return '1号館の130教室ですね！1号館の3階にあって、階段を登って正面にありますよ。左奥に男子トイレ、右奥に女子トイレがあります。';
      } else if (['131', '132', '133', '134', '138'].includes(r)) {
        return `1号館の${r}教室ですね！1号館の3階にあって、階段を登って左側に進むとありますよ（奥に男子トイレがあります）。`;
      } else if (['135', '136', '137A', '137B', '139'].includes(r)) {
        return `1号館の${r}教室ですね！1号館の3階にあって、階段を登って右側に進むとありますよ（奥に女子トイレがあります）。`;
      } else if (r === '141') {
        return '1号館の141教室ですね！1号館の4階にあって階段を登って正面にあります。なお、1号館の4階と5階にはトイレがありませんので、2階か3階のトイレを使ってくださいね。';
      } else if (r === '151') {
        return '1号館の151教室ですね！1号館の5階にあって階段を登って正面にあります。1号館の4階と5階にはトイレがありませんので、2階か3階のトイレを使ってくださいね。';
      } else if (r.startsWith('2') && r.length === 4) {
        return `2号館の${r}教室ですね！2号館の${r[1]}階にありますよ。注意点として、2号館の中には自販機やゴミ箱が置かれていないので他号館を利用してくださいね。`;
      } else {
        return `${r}教室ですね！キャンパス構内にありますので、各号館のフロア案内板もあわせて確認してみてくださいね。`;
      }
    }
  }

  // 13. 施設営業時間案内
  if (['図書館', '図書室', '本を借りる', '地下書庫'].some((k) => qLower.includes(k))) {
    return (
      '文理学部の図書館（図書館棟）の開館時間ですね！平日（月曜から金曜）は朝9時から夜20時まで、土曜日は朝9時から19時まで開いていますよ。日曜や祝日はお休みです。地下書庫の利用や貸出手続きは閉館の30分前までなので、時間に少し余裕を持って行ってみてくださいね。'
    );
  }

  if (['コンピュータセンター', 'コンセ', 'cc', 'wifi', 'wi-fi', '学内pc', 'パソコン室'].some((k) => qLower.includes(k))) {
    return (
      '3号館にあるコンピュータセンターの窓口ですね！平日は朝9時から18時まで、土曜日は朝9時から13時まで受付しています。日曜と祝日はお休みです。学内Wi-Fi（CHS-Wi-Fi）の接続設定やアカウントの相談、パソコン室の利用などで困ったときは窓口で気軽に相談できますよ。'
    );
  }

  if (['ラーニングコモンズ', 'ラーニング・コモンズ', 'コモンズ', 'lc'].some((k) => qLower.includes(k))) {
    return (
      '本館1階のラーニング・コモンズですね！平日は朝8時から18時まで、土曜日は朝8時から17時まで開放されています。日曜・祝日はお休みです。グループワークや自習、パソコンの利用、プレゼンの練習などにとても使いやすいスペースですよ。サポートデスクも平日の10時から18時まで開いています。'
    );
  }

  if (['教務', '教務課', '事務', '事務窓口', '証明書', '学務'].some((k) => qLower.includes(k))) {
    return (
      '本館1階の教務課・事務室ですね！窓口の受付時間は平日の朝9時から17時まで、土曜日は朝9時から13時までとなっています。日曜・祝日はお休みです。履修相談や各種届け出を受け付けていて、自動発行機で証明書を取る場合は窓口終了の15分前まで利用できますよ。'
    );
  }

  if (['資料館', '博物館'].some((k) => qLower.includes(k))) {
    return (
      '8号館にある文理学部資料館ですね！平日は10時から17時まで、土曜日は10時から13時まで開館していて、日曜・祝日はお休みです。入館は無料で、歴史や民俗、学術資料などの展示を見ることができますよ。'
    );
  }

  // 14. コース科目案内
  const courseHit = GAKUBU_YORAN_COURSES.find(
    (c) => q.includes(c.name) || (c.name === '教職コース' && q.includes('教職'))
  );
  if (courseHit) {
    return (
      `${courseHit.name}についてですね！${courseHit.target}を目指すコースです。申請や相談の窓口は本館1階の教務課（${courseHit.window}）になります。単位の取り扱いとしては${courseHit.creditsRule}となっていて、主な科目に${courseHit.keyRequiredCourses.slice(0, 3).join('や')}などがあります。受講を考えている場合は学期始めに忘れずに届出をしてくださいね。`
    );
  }

  // 15. 副専攻案内
  const minorHit = GAKUBU_YORAN_ALL_24_MINORS.find(
    (m) => q.includes(m.name) || (q.includes('副専攻') && q.includes(m.name.replace('副専攻', '')))
  );
  if (minorHit) {
    return (
      `${minorHit.name}についてですね！指定された科目を16単位以上修得して卒業時に申請すると、卒業証書と一緒に修了証書がもらえますよ。事前の履修届出は不要です。窓口は${minorHit.window}で、おすすめの科目として${minorHit.recommendedCourses.slice(0, 3).join('や')}などがあります。${minorHit.ruleNotice}という点に気をつけて履修を進めてみてくださいね。`
    );
  }

  if (q.includes('副専攻')) {
    return (
      `文理学部の副専攻制度ですね！主専攻の勉強に加えて、決められた科目を16単位以上修得すると卒業時に修了認定が受けられる制度です。事前の履修申請は不要なので、自分の興味に合わせて自由に挑戦できますよ。\n\n全学科の学生が履修できる学際副専攻として、グローバル・コミュニケーション、ダイバーシティ、データサイエンス、科学リテラシー、地域デザインの5つがあります。また、他学科の学びを深める19の学科副専攻も用意されています。自分の所属学科と同じ学科副専攻は取れないルールになっているので、他分野の科目を上手に取り入れてみてくださいね！`
    );
  }

  // 16. 自販機・設備
  if (['給水', '冷水機', 'ウォーターサーバー'].some((k) => qLower.includes(k))) {
    return (
      '学内の給水所（冷水機）ですね！現在は4号館の1階エントランスホールにある給水所が利用可能で、マイボトルに給水できますよ。なお、4号館の2階から4階の給水所は現在使えないので、1階のものをご利用くださいね。'
    );
  }

  if (['ゴミ箱', 'ごみ箱', 'ゴミ', 'ごみ'].some((k) => qLower.includes(k))) {
    return (
      '学内のゴミ箱の設置場所ですね！1号館と3号館は各フロアに設置されていて、4号館は各階のトイレ前に設置されています。気をつけていただきたい点として、2号館の中にはゴミ箱や自販機が置かれていないので、お隣の号館のものを使ってくださいね。'
    );
  }

  if (['クレカ', 'クレジットカード', 'タッチ決済', 'コンタクトレス'].some((k) => qLower.includes(k))) {
    return (
      'クレジットカードのタッチ決済が使える自販機をお探しですね！3号館の1階食堂側にあるコカ・コーラの赤い自販機で、VisaやMastercardなどのタッチ決済がそのまま使えますよ。サントリーの青い自販機も、ジハンピのQRコードからPayPayなどで支払うことができます。'
    );
  }

  if (['コーラ', 'ペプシ', 'coca', 'pepsi'].some((k) => qLower.includes(k))) {
    return (
      'コーラの自販機ですね！3号館1階の食堂側に2種類ありますよ。赤い自販機にはコカ・コーラ（140円）が入っていて、クレジットカードタッチや交通系IC、Coke ONが使えます。青い自販機にはペプシコーラ生（100円）が入っていてお得ですよ。'
    );
  }

  if (q.includes('80円') || ['水', '天然水', 'ミネラルウォーター'].some((k) => qLower.includes(k))) {
    return (
      '学内最安の80円ドリンクですね！サントリー天然水やZONeが80円で買える自販機は、4号館1階の自販機コーナーや、3号館1階の食堂側にありますよ。ジハンピ経由のPayPayや交通系IC、現金で購入できます。'
    );
  }

  // デフォルト案内
  return (
    '文理学部の学生アシスタントです！履修登録や卒業要件、CAP制の40単位制限、目標GPAのシミュレーション、全24種類の副専攻、キャンパスの空き教室や自販機の場所など、大学生活で気になることがあれば何でも聞いてくださいね。例えば「今空いてる教室ある？」「あと何単位必要？」「GPA3.0にするにはどうすればいい？」など、お気軽にチャットしてください！'
  );
}

export async function GET() {
  const serverKey = (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '').trim();
  return NextResponse.json({
    hasServerKey: serverKey.length > 0,
    serverKeyPrefix: serverKey.length > 8 ? `${serverKey.slice(0, 6)}...` : undefined,
    availableModels: ['gemini-3-flash-preview', 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']
  });
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

    // Google Gemini API呼び出し（APIキー設定時）
    if (apiKey) {
      const imageType = body.imageType || null;
      let userPromptText = query;
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
          imageInstruction = `【最重要：成績通知書OCR解析】
添付された成績通知書（スマホ画面スクリーンショット、写真、PDF、またはテキスト）を解析し、記載されているすべての履修済み科目（科目名・単位数・評価）、総修得単位数、現在GPAを1科目も漏れなく読み取ってください。
※スマホのポータル画面（NU-Web等）のスクリーンショット等で総単位数やGPAの記載が見当たらない場合でも、画像内のすべての科目（科目名・単位数・評価）を completedCourses 配列に漏れなく出力してください（講義は2単位、体育・実験演習は1単位）。
※評価は S/A/B/C/D/秀/優/良/可/合格/認定/修得 の形式で正確に出力してください。
回答本文で結果を要約した上で、必ず回答末尾に以下のJSONブロックを出力してください：
\`\`\`profile_update
{
  "action": "transcript",
  "totalEarnedCredits": <総修得単位数(数値)>,
  "currentGpa": <現在GPA(数値)>,
  "completedCourses": [
    { "name": "<科目名>", "credits": <単位数>, "grade": "<S/A/B/C/D/合格/認定/修得>" }
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

      const currentTurnParts: any[] = [
        { text: `${profileContext}${userPromptText}` }
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

      // 高速モデル（gemini-3-flash-preview, gemini-3.5-flash）を並列レースさせて最短2〜3秒で返答
      const outputLimit = 4096;
      const geminiPayload = {
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT.trim() }]
        },
        contents,
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: outputLimit
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

      // 1. 最速の2モデルを並列レース（最速で応答した方が即座に採用される）
      try {
        successfulResponse = await Promise.any([
          fetchSingleModel('gemini-3-flash-preview', 12000),
          fetchSingleModel('gemini-3.5-flash', 12000)
        ]);
      } catch (raceErr: any) {
        if (raceErr && Array.isArray(raceErr.errors)) {
          for (const e of raceErr.errors) {
            if (e?.status) lastErrorStatus = e.status;
            if (e?.message) lastErrorMessage = e.message;
          }
        }
      }

      // 2. レースで両方エラーになった場合の順次フォールバック（APIキー不正・権限エラー時は即スキップ）
      const isAuthError = (lastErrorStatus === 400 && lastErrorMessage?.toLowerCase().includes('api_key')) || lastErrorStatus === 403;
      if (!successfulResponse && !isAuthError) {
        const FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest'];
        for (const model of FALLBACK_MODELS) {
          try {
            successfulResponse = await fetchSingleModel(model, 12000);
            if (successfulResponse) break;
          } catch (err: any) {
            lastErrorStatus = err?.status || lastErrorStatus;
            lastErrorMessage = err?.message || String(err);
            if (err?.status === 400 && lastErrorMessage?.toLowerCase().includes('api_key')) break;
            if (err?.status === 403) break;
          }
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
      let friendlyError = lastErrorMessage || '接続エラー';
      if (lastErrorMessage?.toLowerCase().includes('api_key') || lastErrorStatus === 400) {
        friendlyError = 'APIキーが無効であるか、形式が正しくありません。Google AI Studio（aistudio.google.com）で取得した有効なキー（AIzaSy...）をご確認ください。';
      } else if (lastErrorStatus === 429) {
        friendlyError = 'Gemini APIの無料枠利用上限（レートリミット）に達しました。1〜2分お待ちいただくか、別のキーをお試しください。';
      } else if (lastErrorStatus === 403) {
        friendlyError = 'APIアクセス権限がありません。Gemini APIが有効化されているGoogleアカウントのキーかご確認ください。';
      }

      const localReply = answerLocally(query || (image ? '成績表画像' : ''), userProfile);
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
        profileUpdate: fallbackUpdate
      });
    }

    // ローカルエンジンによる即時フォールバック（公式要覧準拠）
    const localReply = answerLocally(query || (image ? '成績表画像' : ''), userProfile);
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
      profileUpdate: fallbackUpdate
    });
  } catch (error) {
    return NextResponse.json({
      reply: 'エラーが発生しました。もう一度入力してください。'
    }, { status: 500 });
  }
}
