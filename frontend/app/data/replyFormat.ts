// チャットの回答の形：1文目で結論、続けて「・**ラベル**：内容」の短い箇条書き、補足は「補足：」の行のあと。
// サーバー（ローカル応答の組み立て）と画面（結論・主な箇条書きは常に表示し、補足は折りたたむ）の両方で使う。

// 表示する情報量。すっきり＝要点だけ（補足は閉じる・AIの回答も短く）、すべて＝補足まで開いて表示
export type DisplayMode = 'simple' | 'detailed';
export const DISPLAY_MODE_KEY = 'enekoma_display_mode';
export const DEFAULT_DISPLAY_MODE: DisplayMode = 'simple';
export const DISPLAY_MODE_LABEL: Record<DisplayMode, string> = { simple: 'すっきり', detailed: 'すべて' };

export const isDisplayMode = (value: unknown): value is DisplayMode => value === 'simple' || value === 'detailed';

// 常に見せる箇条書きの数。これを超えた分は補足として折りたたむ
export const MAIN_ITEM_LIMIT: Record<DisplayMode, number> = { simple: 3, detailed: 6 };

// 画面上部のブロック（メニュー・空き教室検索・いつもの質問）と質問例を、初めに開いておくか
export const sectionOpenByDefault = (mode: DisplayMode): boolean => mode === 'detailed';
// 質問例のチップ（とカテゴリの絞り込み）を出すか。すっきりでは出さない
export const showsExampleChips = (mode: DisplayMode): boolean => mode === 'detailed';

// 補足の始まりを示す行
export const DETAILS_HEADING = '補足：';

/** 端末に保存した表示モード（なければ既定） */
export function readDisplayMode(): DisplayMode {
  try {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(DISPLAY_MODE_KEY) : null;
    return isDisplayMode(saved) ? saved : DEFAULT_DISPLAY_MODE;
  } catch {
    return DEFAULT_DISPLAY_MODE;
  }
}

export function writeDisplayMode(mode: DisplayMode): void {
  try {
    window.localStorage.setItem(DISPLAY_MODE_KEY, mode);
  } catch {
    // 保存できなくても、この画面では切り替わる
  }
}

// ---------------------------------------------------------------------------
// 組み立て（ローカル応答用）
// ---------------------------------------------------------------------------

/** 「・**ラベル**：内容」の1行。ラベルがなければ「・内容」 */
export function bulletLine(label: string | null | undefined, text: string): string {
  const body = text.trim();
  return label ? `・**${label}**：${body}` : `・${body}`;
}

/** 結論・箇条書き・補足から回答の文を作る */
export function composeReply(parts: { lead: string; items?: string[]; details?: string[] }): string {
  const asBullet = (line: string) => (/^・/.test(line) ? line : `・${line}`);
  const lines = [parts.lead.trim(), ...(parts.items || []).map(asBullet)];
  const details = (parts.details || []).filter((d) => d.trim());
  if (details.length > 0) lines.push(DETAILS_HEADING, ...details.map(asBullet));
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 読み取り（画面用）
// ---------------------------------------------------------------------------

export interface ReplyItem {
  label?: string;
  text: string;
}

export interface ParsedReply {
  // 結論（箇条書きより前の文。段落ごと）
  lead: string[];
  // 常に見せる箇条書き
  main: ReplyItem[];
  // 折りたたむ補足・一覧
  details: ReplyItem[];
}

const BULLET = /^\s*(?:[・•]|[-*＊](?=\s)|[0-9０-９]+[.)．）](?=\s))\s*(.+)$/;
const HEADING = /^\s*(?:\*\*)?(補足|詳細|詳細・補足|その他|関連|注意|ポイント)(?:\*\*)?\s*[：:]?\s*$/;
const BOLD_LABEL = /^\*\*(.+?)\*\*\s*[：:]?\s*(.*)$/;
const PLAIN_LABEL = /^([^：:。、！？!?\s]{1,12})[：:]\s*(.+)$/;

function toItem(body: string): ReplyItem {
  const bold = body.match(BOLD_LABEL);
  if (bold) return { label: bold[1].trim(), text: bold[2].trim() };
  const plain = body.match(PLAIN_LABEL);
  if (plain) return { label: plain[1].trim(), text: plain[2].trim() };
  return { text: body.trim() };
}

/** 回答を結論・主な箇条書き・補足に分ける */
export function parseReply(text: string, mode: DisplayMode = DEFAULT_DISPLAY_MODE): ParsedReply {
  const lead: string[] = [];
  const main: ReplyItem[] = [];
  const details: ReplyItem[] = [];
  let section: 'lead' | 'main' | 'details' = 'lead';
  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const joined = paragraph.join('\n');
    if (section === 'lead') lead.push(joined);
    else details.push({ text: joined });
    paragraph = [];
  };

  for (const raw of (text || '').replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    if (HEADING.test(line)) {
      flushParagraph();
      section = 'details';
      continue;
    }
    const bullet = line.match(BULLET);
    if (bullet) {
      flushParagraph();
      const item = toItem(bullet[1]);
      if (section === 'details') details.push(item);
      else {
        section = 'main';
        main.push(item);
      }
      continue;
    }
    // 箇条書きのあとの文は補足として扱う（結論の下に長い段落を並べない）
    paragraph.push(line);
  }
  flushParagraph();

  const limit = MAIN_ITEM_LIMIT[mode];
  if (main.length > limit) details.unshift(...main.splice(limit));
  return { lead, main, details };
}

/** コピー用：太字の記号を外した文 */
export function plainReplyText(text: string): string {
  return (text || '').replace(/\*\*(.+?)\*\*/g, '$1');
}

/** 文中の **太字** を分ける（画面で <strong> にする） */
export function splitBold(text: string): { text: string; bold: boolean }[] {
  const parts: { text: string; bold: boolean }[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), bold: false });
    parts.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), bold: false });
  return parts;
}
