// チャット1回ごとに、Geminiへ渡すプロンプトの量と出力の上限を決める（応答を速くするため）。
// ふだんの質問（「計算機室はどこ？」など）には、画像・成績表の読み取り用の規則（JSONの見本つきで長い）を渡さない。

// 出力の上限（思考の分も含む）。ふだんの答えは2〜4文で数百トークンなので1024で足りる。
// プロフィール更新のJSON（科目の一覧）を出しうるときは、途中で切れないよう広くとる
export const CHAT_OUTPUT_LIMIT = 1024;
export const PROFILE_UPDATE_OUTPUT_LIMIT = 4096;
export const IMAGE_OUTPUT_LIMIT = 8192;

// 成績・時間割の内容を文章で貼り付けた・登録を頼んだ、と分かる言葉
const PROFILE_DATA_HINT = /成績表|成績通知|成績証明|時間割表|貼り付け|貼りつけ|はりつけ|登録して|登録したい|追加して|反映して|カルテに|profile_update|履修中の科目|修得済みの科目/i;
// 科目と評価・単位が並んでいる（例：「線形代数1 2単位 A」）
const COURSE_ROW = /(単位|[SABCDEF]評価|\b[SABCDEF]\b|秀|優|良|可|不可).*\n.*(単位|[SABCDEF]評価|\b[SABCDEF]\b|秀|優|良|可|不可)/;
// これより長い文は、貼り付けたデータの可能性があるので規則を渡す
const LONG_QUERY_CHARS = 120;

/** 画像・成績表・時間割の登録規則（profile_update の書き方）をプロンプトに含めるか */
export function needsProfileUpdateRules(query: string, hasImage: boolean): boolean {
  if (hasImage) return true;
  const text = (query || '').trim();
  if (text.length >= LONG_QUERY_CHARS) return true;
  return PROFILE_DATA_HINT.test(text) || COURSE_ROW.test(text);
}

/** 出力の上限トークン数 */
export function chatOutputLimit(hasImage: boolean, profileRules: boolean): number {
  if (hasImage) return IMAGE_OUTPUT_LIMIT;
  return profileRules ? PROFILE_UPDATE_OUTPUT_LIMIT : CHAT_OUTPUT_LIMIT;
}
