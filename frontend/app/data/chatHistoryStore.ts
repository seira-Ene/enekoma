// チャット履歴の保存先。ログイン中の会話はそのアカウントの記録（chatHistory）だけに保存し、
// 端末共通の場所には置かない。以前は端末共通の 'enekoma_chat_history' にログイン中の会話（「登録完了」の
// 名前・GPA・修得単位など）も保存していたため、タブを閉じてログインが切れたあと、未ログインで開くと
// 前の人のカルテのメッセージがそのまま出ていた。

// 未ログイン（ゲスト）の会話だけを置く
export const GUEST_CHAT_KEY = 'enekoma_guest_chat_history';
// 以前の端末共通の履歴。ログイン中の会話が混ざっているので読まずに消す
export const LEGACY_SHARED_CHAT_KEY = 'enekoma_chat_history';

interface StoredMessage {
  id?: string;
  shortLabel?: string;
}

// アカウント用の案内（登録・ログインのあいさつ）。ゲストの履歴には残さない
const ACCOUNT_LABELS = new Set(['登録完了', 'ログイン完了', 'おかえりなさい']);
export function isAccountMessage(message: StoredMessage): boolean {
  if (message.shortLabel && ACCOUNT_LABELS.has(message.shortLabel)) return true;
  // 'welcome_<学籍番号>' や 'welcome_<時刻>' はアカウントのあいさつ（ゲストは welcome・welcome_guest・welcome_cleared）
  return /^welcome_\d/.test(message.id || '');
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** 以前の端末共通の履歴を消す（ログイン中の人の会話が入っているため） */
export function removeLegacySharedChat(): void {
  try {
    storage()?.removeItem(LEGACY_SHARED_CHAT_KEY);
  } catch {
    // 消せなくても読まないので問題ない
  }
}

/** ゲストの会話を読む。なければ空 */
export function loadGuestChat<T extends StoredMessage>(): T[] {
  removeLegacySharedChat();
  try {
    const raw = storage()?.getItem(GUEST_CHAT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return [];
    return (parsed as T[]).filter((m) => m && typeof m === 'object' && !isAccountMessage(m));
  } catch {
    return [];
  }
}

/** ゲストの会話を保存する（保存に失敗しても画面は落とさない） */
export function saveGuestChat(messages: StoredMessage[]): void {
  try {
    storage()?.setItem(GUEST_CHAT_KEY, JSON.stringify(messages.filter((m) => !isAccountMessage(m))));
  } catch (error) {
    console.warn('Failed to save chat history:', error);
  }
}

export function clearGuestChat(): void {
  try {
    storage()?.removeItem(GUEST_CHAT_KEY);
  } catch {
    // 何もしない
  }
  removeLegacySharedChat();
}
