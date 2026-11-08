// メール送信の記録。Vercel Hobbyの実行ログは約1時間で消えるため、直近50件を7日間Redisに残し、管理者画面から見られるようにする
// 宛先は伏せ字、本文・リンク・パスワードは保存しない
import { deploymentEnv, redisCommand, redisSettings } from '../_lib/redis';

export interface MailLogEntry {
  at: string;                                // 日本時間
  status: 'sent' | 'failed' | 'skipped';     // skipped は送信しなかった（理由は reason）
  provider?: string;
  to: string;                                // 伏せ字の宛先、または伏せ字のログインID
  subject?: string;
  response?: string;                         // Gmailなどの応答
  detail?: string;
  reason?: string;                           // 送信しなかった理由
}

const MAX_ENTRIES = 50;
const TTL_SECONDS = 7 * 24 * 60 * 60;
const memoryLog: MailLogEntry[] = [];
const key = () => `enekoma:maillog:${deploymentEnv()}`;

/** 宛先のユーザー名部分を伏せる（例: taro.yamada@example.com → ta***@example.com）。ドメインは配送の切り分けに使うので残す */
export function maskEmail(address: string): string {
  const at = address.lastIndexOf('@');
  if (at <= 0) return '***';
  const local = address.slice(0, at);
  return `${local.slice(0, Math.min(2, local.length - 1))}***${address.slice(at)}`;
}

/** メールアドレスならアドレスとして、それ以外はログインIDとして伏せる（例: 5424001 → 54***01） */
export function maskIdentifier(value: string): string {
  const v = String(value || '').trim();
  if (v.includes('@')) return maskEmail(v);
  if (v.length <= 4) return '***';
  return `${v.slice(0, 2)}***${v.slice(-2)}`;
}

export function jstTimestamp(date = new Date()): string {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().replace('Z', '+09:00');
}

// ログの値に改行が入ると1行にならないので、空白にまとめる
const oneLine = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);

/** 実行ログに1行出し、Redisにも残す。記録に失敗しても送信の結果には影響させない */
export async function recordMailLog(entry: Omit<MailLogEntry, 'at'>): Promise<void> {
  const full: MailLogEntry = {
    at: jstTimestamp(),
    ...Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, k === 'status' ? v : oneLine(v)]))
  } as MailLogEntry;

  const parts = [`[mail] ${full.status} at=${full.at}`];
  if (full.provider) parts.push(`provider=${full.provider}`);
  parts.push(`to=${full.to}`);
  if (full.subject) parts.push(`subject="${full.subject}"`);
  if (full.reason) parts.push(`reason=${full.reason}`);
  if (full.response) parts.push(`response="${full.response}"`);
  if (full.detail) parts.push(`detail="${full.detail}"`);
  const line = parts.join(' ');
  if (full.status === 'failed') console.error(line);
  else console.info(line);

  const settings = redisSettings();
  if (!settings) {
    // ローカル開発ではメモリに残す（Vercel上でRedisがなければ残さない）
    if (!process.env.VERCEL) {
      memoryLog.unshift(full);
      memoryLog.length = Math.min(memoryLog.length, MAX_ENTRIES);
    }
    return;
  }
  try {
    await redisCommand(settings, ['LPUSH', key(), JSON.stringify(full)]);
    await redisCommand(settings, ['LTRIM', key(), 0, MAX_ENTRIES - 1]);
    await redisCommand(settings, ['EXPIRE', key(), TTL_SECONDS]);
  } catch (error) {
    console.error('Failed to store mail log:', error);
  }
}

/** 新しい順に返す */
export async function readMailLog(): Promise<MailLogEntry[]> {
  const settings = redisSettings();
  if (!settings) return [...memoryLog];
  const raw = await redisCommand(settings, ['LRANGE', key(), 0, MAX_ENTRIES - 1]);
  return (Array.isArray(raw) ? raw : []).flatMap((item) => {
    try {
      return [JSON.parse(String(item)) as MailLogEntry];
    } catch {
      return [];
    }
  });
}

export function clearMailLogForTests() {
  memoryLog.length = 0;
}
