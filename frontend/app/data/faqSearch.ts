// FAQ（公開済みの回答・解決手順）の検索。画面とサーバーで同じ処理を使う
//   keyword : 検索窓の語句をすべて含むもの（スペース区切りでAND）。ひらがな・カタカナの違いは無視する
//   similar : フォームに書いた文と似た質問（漢字・カタカナ・英数字の2文字の並びの重なり）。入力中のサジェストに使う

export type FaqCategory = 'review' | 'opinion' | 'question' | 'bug';

export interface PublicFaq {
  id: string;
  title: string;      // 管理者が付けたタイトル（なければ質問の冒頭）
  question: string;   // 利用者の質問・報告（個人情報は伏せ済み）
  answer: string;     // 管理者の回答・解決手順
  category: FaqCategory;
  resolved: boolean;  // 対応済み
  date: string;       // 投稿日（YYYY-MM-DD）
}

export const FAQ_CATEGORY_LABELS: Record<FaqCategory, string> = {
  bug: '🐛 不具合',
  question: '❓ 質問',
  opinion: '💡 ご意見',
  review: '⭐ レビュー'
};

/** 全角半角・大文字小文字・カタカナとひらがなの違いをそろえる */
export function normalizeForSearch(text: string): string {
  return String(text || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

const isHiragana = (c: string) => c >= 'ぁ' && c <= 'ゟ';
const isWordChar = (c: string) => /[\p{L}\p{N}]/u.test(c);

/** 似ている文を探すための2文字の並び。ひらがなだけの並び（「です」「して」など）は数えない */
export function contentBigrams(text: string): Set<string> {
  const chars = [...String(text || '').normalize('NFKC').toLowerCase()].filter(isWordChar);
  const grams = new Set<string>();
  for (let i = 0; i < chars.length - 1; i++) {
    if (isHiragana(chars[i]) && isHiragana(chars[i + 1])) continue;
    grams.add(chars[i] + chars[i + 1]);
  }
  return grams;
}

const searchable = (f: PublicFaq) => `${f.title}\n${f.question}\n${f.answer}`;

export interface FaqFilter {
  category?: FaqCategory | 'all';
  resolvedOnly?: boolean;
}

function applyFilter(items: PublicFaq[], filter: FaqFilter = {}): PublicFaq[] {
  return items.filter((f) => (!filter.category || filter.category === 'all' || f.category === filter.category) && (!filter.resolvedOnly || f.resolved));
}

/** 検索窓：すべての語句を含むもの。タイトルに含むものを先に並べる */
export function searchFaqByKeyword(items: PublicFaq[], query: string, filter: FaqFilter = {}): PublicFaq[] {
  const terms = normalizeForSearch(query).split(/[\s　、。,.!?！？]+/).filter(Boolean);
  const pool = applyFilter(items, filter);
  if (terms.length === 0) return pool;
  return pool
    .map((f) => {
      const body = normalizeForSearch(searchable(f));
      if (!terms.every((t) => body.includes(t))) return null;
      const title = normalizeForSearch(f.title);
      return { f, score: terms.filter((t) => title.includes(t)).length };
    })
    .filter((x): x is { f: PublicFaq; score: number } => x !== null)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.f);
}

/** 入力中の文と似たFAQ。重なりが少ないものは出さない */
export function findSimilarFaq(items: PublicFaq[], text: string, limit = 3, filter: FaqFilter = {}): PublicFaq[] {
  const query = contentBigrams(text);
  if (query.size < 2) return [];
  return applyFilter(items, filter)
    .map((f) => {
      const doc = contentBigrams(searchable(f));
      let shared = 0;
      for (const g of query) if (doc.has(g)) shared++;
      return { f, shared, ratio: shared / query.size };
    })
    .filter((x) => x.shared >= 2 && x.ratio >= 0.2)
    .sort((a, b) => b.ratio - a.ratio || b.shared - a.shared)
    .slice(0, limit)
    .map((x) => x.f);
}
