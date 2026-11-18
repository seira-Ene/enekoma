// 回答の後処理：「結論＋・**ラベル**：内容 の箇条書き」の形にそろえる（data/replyFormat.ts）。
// 箇条書きの「・」と太字は残し、見出し・飾りの記号・システムタグを除く
export function sanitizeConversationalReply(text: string): string {
  if (!text) return '';
  // 一時的に ```profile_update ... ``` を退避
  const profileMatches: string[] = [];
  let sanitized = text.replace(/```profile_update\s*[\s\S]*?```/g, (match) => {
    profileMatches.push(match);
    return `__PROFILE_UPDATE_TOKEN_${profileMatches.length - 1}__`;
  });

  // 1. 見出しを外し、行頭の「- 」「* 」「• 」「1. 」の箇条書きを「・」にそろえる
  sanitized = sanitized.replace(/^#{1,6}\s+/gm, '');
  sanitized = sanitized.replace(/^[ \t]*(?:[-*•]|\d+[.)])[ \t]+/gm, '・');
  sanitized = sanitized.replace(/^[ \t]+・/gm, '・');
  // * 1つの強調は外す（**ラベル** は残す）
  sanitized = sanitized.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1$2');
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

  // 5. 行頭の飾りの記号・絵文字（■◆★※など）は「・」にする（箇条書きの形を保つ）
  sanitized = sanitized.replace(/^[ \t]*[■◆▲▼🔹★※•✓✕❌⭕🟢🔴📍🕒🎓🏫🍱💡⏱️🗺️📌⚠️]+[ \t]*/gm, '・');
  sanitized = sanitized.replace(/^・{2,}/gm, '・');

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
