// 「フレンドに今の状況を共有する」の表示を決める。
// 本当の値はサーバー（アカウント）にあるが、読み込み中・読み込みに失敗したときにOFFと表示しないよう、
// 最後に確かめた値を端末にも置いておく（真偽値だけ。キーはアカウントごと）
const CACHE_PREFIX = 'enekoma_share_status:';

// 切り替えた直後は、それより前に送った読み込みや、反映前の古い値（Redisの読み取り）より、切り替えた結果を信じる
export const SHARE_WRITE_GRACE_MS = 15_000;

export const shareCacheKey = (loginId: string) => `${CACHE_PREFIX}${loginId.toLowerCase()}`;

/** 端末に置いた最後の値。なければ null（不明） */
export function readCachedShare(loginId: string, storage: Pick<Storage, 'getItem'> | null = safeLocalStorage()): boolean | null {
  try {
    const raw = storage?.getItem(shareCacheKey(loginId));
    // 文字列の "false" を真と取り違えないよう、決めた2つの値だけを読む
    if (raw === '1') return true;
    if (raw === '0') return false;
    return null;
  } catch {
    return null;
  }
}

export function writeCachedShare(loginId: string, share: boolean, storage: Pick<Storage, 'setItem'> | null = safeLocalStorage()) {
  try {
    storage?.setItem(shareCacheKey(loginId), share ? '1' : '0');
  } catch {
    // 保存できない端末（プライベートモードなど）では、サーバーの値だけで表示する
  }
}

export interface ShareWrite {
  value: boolean;
  // サーバーが切り替えを受け付けた時刻（端末の時計）
  at: number;
}

/**
 * サーバーから読み込んだ値をそのまま使ってよいか。
 * 切り替えより前に送った読み込みの結果や、切り替えの直後に返ってきた逆の値は、切り替えた値で置き換える
 */
export function resolveServerShare(server: boolean, requestedAt: number, lastWrite: ShareWrite | null, now: number): boolean {
  if (!lastWrite) return server;
  if (requestedAt < lastWrite.at) return lastWrite.value;
  if (server !== lastWrite.value && now - lastWrite.at < SHARE_WRITE_GRACE_MS) return lastWrite.value;
  return server;
}

/** 画面に出す値。サーバーの値 → 端末に置いた値の順。どちらもなければ null（確認中） */
export const displayedShare = (server: boolean | undefined, cached: boolean | null): boolean | null =>
  typeof server === 'boolean' ? server : cached;

function safeLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
