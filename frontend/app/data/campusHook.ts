// スマホの自動化（到着・出発）で、EneKomaを開いていない間も自動出欠をつけるための画面側の処理。
// 自動化用の鍵はこの端末の localStorage にだけ置き（URLを見直せるように）、サーバーにはハッシュだけがある
import type { CampusObservation } from './attendance';

export interface CampusHookEvent {
  t: number;
  on: boolean;
}

const tokenKey = (accountId: string) => `enekoma_campus_hook:${accountId}`;

export function readHookToken(accountId: string): string | null {
  if (typeof window === 'undefined' || !accountId) return null;
  try {
    return localStorage.getItem(tokenKey(accountId));
  } catch {
    return null;
  }
}

export function saveHookToken(accountId: string, token: string | null): void {
  if (typeof window === 'undefined' || !accountId) return;
  try {
    if (token) localStorage.setItem(tokenKey(accountId), token);
    else localStorage.removeItem(tokenKey(accountId));
  } catch {
    // 保存できなくても、作ったURLはこの画面で使える
  }
}

/** 自動化に貼るURL（到着用・出発用） */
export function hookUrl(token: string, event: 'arrive' | 'leave', origin: string = typeof window === 'undefined' ? '' : window.location.origin): string {
  return `${origin}/api/campus-hook?t=${encodeURIComponent(token)}&e=${event}`;
}

/** 届いた到着・出発を、自動出欠の判定に使う形にする */
export function toObservations(events: CampusHookEvent[]): CampusObservation[] {
  return events.map((e) => ({ t: e.t, on: e.on, kind: 'transition' as const }));
}

async function call<T>(sessionToken: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/campus-hook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.message || '通信に失敗しました。しばらくしてからお試しください。');
  return data as T;
}

export const createHook = (sessionToken: string) => call<{ token: string }>(sessionToken, { action: 'create' });
export const revokeHook = (sessionToken: string) => call<{ ok: true }>(sessionToken, { action: 'revoke' });
export const fetchHookEvents = (sessionToken: string) => call<{ active: boolean; events: CampusHookEvent[] }>(sessionToken, { action: 'events' });
