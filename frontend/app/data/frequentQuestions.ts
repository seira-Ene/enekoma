// 「💡 いつもの質問」：この端末で送った質問の回数と最後に使った日時を、アカウントごとに記録する。
// 記録は localStorage だけに置き、サーバーには送らない

export const FREQUENT_QUESTIONS_KEY = 'enekoma_user_frequent_questions';

export interface FrequentQuestion {
  text: string; // 最後に送ったときの文（チップに出す）
  count: number;
  lastUsedAt: number;
}

// 正規化した文 → 記録
export type FrequentQuestionStore = Record<string, FrequentQuestion>;

export const FREQUENT_RULES = {
  minCount: 2, // 2回以上送った質問だけ出す
  limit: 4, // 上位4件
  maxAgeDays: 60, // 60日以上使っていない質問は出さない
  maxLength: 60, // 長い文はチップに向かないので記録しない
  maxEntries: 100 // 保存する件数の上限（古いものから消す）
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 同じ質問として数えるための形。全角・半角、空白、末尾の「？」「。」などの違いは無視する
 */
export function normalizeQuestion(text: string): string {
  return String(text || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[?？!！。．.、,\s]+$/u, '')
    .toLowerCase();
}

/**
 * 記録しない文：空、長すぎる、メールアドレス・電話番号・学籍番号のような7桁以上の数字を含む
 * （チップとして画面に出るので、個人の情報は残さない）
 */
export function isRecordableQuestion(text: string): boolean {
  const t = String(text || '').normalize('NFKC').trim();
  if (!t || t.length > FREQUENT_RULES.maxLength) return false;
  if (/@|\d[\d-]{6,}/.test(t)) return false;
  return normalizeQuestion(t).length > 0;
}

/** 質問を1回送ったことを記録した、新しい記録を返す（元の記録は変えない） */
export function recordQuestion(store: FrequentQuestionStore, text: string, now: number = Date.now()): FrequentQuestionStore {
  if (!isRecordableQuestion(text)) return store;
  const key = normalizeQuestion(text);
  const prev = store[key];
  const next: FrequentQuestionStore = { ...store, [key]: { text: text.trim(), count: (prev?.count || 0) + 1, lastUsedAt: now } };
  const keys = Object.keys(next);
  if (keys.length <= FREQUENT_RULES.maxEntries) return next;
  // 上限を超えたら、最後に使ったのが古いものから消す
  keys
    .sort((a, b) => next[a].lastUsedAt - next[b].lastUsedAt)
    .slice(0, keys.length - FREQUENT_RULES.maxEntries)
    .forEach((k) => delete next[k]);
  return next;
}

/** 2回以上送った、60日以内に使った質問のうち、回数の多い順（同じなら最近使った順）に4件 */
export function topFrequentQuestions(
  store: FrequentQuestionStore,
  now: number = Date.now(),
  { minCount, limit, maxAgeDays } = FREQUENT_RULES
): FrequentQuestion[] {
  return Object.values(store)
    .filter((q) => q.count >= minCount && now - q.lastUsedAt <= maxAgeDays * DAY_MS)
    .sort((a, b) => b.count - a.count || b.lastUsedAt - a.lastUsedAt)
    .slice(0, limit);
}

/** 履歴から消した、新しい記録を返す */
export function removeQuestion(store: FrequentQuestionStore, text: string): FrequentQuestionStore {
  const key = normalizeQuestion(text);
  if (!(key in store)) return store;
  const next = { ...store };
  delete next[key];
  return next;
}

// ---- 端末への保存（アカウントごと。共用PCで他の人の質問が出ないように） ----
const storageKey = (accountId: string) => `${FREQUENT_QUESTIONS_KEY}:${accountId || 'guest'}`;

function isEntry(v: unknown): v is FrequentQuestion {
  const e = v as FrequentQuestion;
  return !!e && typeof e.text === 'string' && typeof e.count === 'number' && typeof e.lastUsedAt === 'number';
}

export function readFrequentQuestions(accountId: string): FrequentQuestionStore {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(accountId)) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, v]) => isEntry(v))) as FrequentQuestionStore;
  } catch {
    return {};
  }
}

export function saveFrequentQuestions(accountId: string, store: FrequentQuestionStore): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(accountId), JSON.stringify(store));
  } catch {
    // 保存できなくてもチャットは使える
  }
}
