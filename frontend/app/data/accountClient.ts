// /api/account を呼ぶ。通信できなかったときも同じ形で返す
import type { ServerAccountView } from './studentAccounts';

export type AccountAction =
  | 'register'
  | 'login'
  | 'request_password_reset'
  | 'request_login_id'
  | 'reset_password'
  | 'verify_email'
  | 'set_email'
  | 'change_password';

export interface AccountApiResult {
  ok: boolean;
  error?: string;
  message?: string;
  account?: ServerAccountView | null;
  loginId?: string;
  verificationSent?: boolean;
  mailConfigured?: boolean;
  // サーバーに届かなかった（オフライン・タイムアウト）
  network?: boolean;
}

export async function callAccountApi(action: AccountAction, payload: Record<string, unknown>): Promise<AccountApiResult> {
  try {
    const response = await fetch('/api/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
      signal: AbortSignal.timeout(15000)
    });
    const data = (await response.json().catch(() => ({}))) as AccountApiResult;
    if (typeof data.ok !== 'boolean') return { ok: false, network: true, message: 'サーバーから正しい応答がありませんでした。' };
    return data;
  } catch {
    return { ok: false, network: true, message: 'サーバーに接続できませんでした。通信環境を確認して、もう一度お試しください。' };
  }
}

// サーバーの障害でログイン照合ができないとき（旧方式のアカウントは端末内で照合してよい）
export const isServerUnavailable = (r: AccountApiResult) => !!r.network || r.error === 'storage_unavailable';
