// お問い合わせ・フィードバックの保存先（Redis）。新しい順に最大500件を残す
// ローカル開発でRedisがなければメモリに置く。Vercel上でRedisがなければ使えない扱いにする
import { randomBytes } from 'crypto';
import { deploymentEnv, redisCommand, redisSettings } from '../_lib/redis';

export const FEEDBACK_CATEGORIES = ['review', 'opinion', 'question', 'bug'] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];
export const FEEDBACK_STATUSES = ['new', 'in_progress', 'resolved', 'wontfix'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export interface FeedbackItem {
  id: string;
  createdAt: string;        // ISO（UTC）
  category: FeedbackCategory;
  message: string;
  rating?: number;          // レビューの評価（1〜5）
  email?: string;           // 返信先（任意）
  loginId?: string;         // 送信時にログインしていたID（本人の申告で、確認はしていない）
  userAgent?: string;       // 不具合の調査用
  status: FeedbackStatus;
  adminNote?: string;
  updatedAt?: string;
}

export class FeedbackStorageUnavailableError extends Error {}

const MAX_ITEMS = 500;
const memory = new Map<string, FeedbackItem>();
const hashKey = () => `enekoma:feedback:${deploymentEnv()}`;
const orderKey = () => `enekoma:feedback:${deploymentEnv()}:order`;

function backend() {
  const settings = redisSettings();
  if (settings) return { kind: 'redis' as const, settings };
  if (process.env.VERCEL) throw new FeedbackStorageUnavailableError('Redis is not configured');
  return { kind: 'memory' as const };
}

// 同じミリ秒に届いても受付順に並ぶよう、IDは「時刻・連番・乱数」にする（文字列の順＝受付順）
let sequence = 0;
function newId(time: number): string {
  sequence = (sequence + 1) % 36 ** 4;
  return `${time.toString(36).padStart(9, '0')}-${sequence.toString(36).padStart(4, '0')}-${randomBytes(3).toString('hex')}`;
}

export async function addFeedback(input: Omit<FeedbackItem, 'id' | 'createdAt' | 'status'>): Promise<FeedbackItem> {
  const now = new Date();
  const item: FeedbackItem = { ...input, id: newId(now.getTime()), createdAt: now.toISOString(), status: 'new' };
  const b = backend();
  if (b.kind === 'memory') {
    memory.set(item.id, item);
    const ids = [...memory.keys()].sort().reverse();
    for (const old of ids.slice(MAX_ITEMS)) memory.delete(old);
    return item;
  }
  await redisCommand(b.settings, ['HSET', hashKey(), item.id, JSON.stringify(item)]);
  await redisCommand(b.settings, ['ZADD', orderKey(), now.getTime(), item.id]);
  // 古いものから消して最大件数を保つ
  const count = Number(await redisCommand(b.settings, ['ZCARD', orderKey()]));
  if (count > MAX_ITEMS) {
    const stale = await redisCommand(b.settings, ['ZRANGE', orderKey(), 0, count - MAX_ITEMS - 1]);
    for (const id of Array.isArray(stale) ? stale.map(String) : []) {
      await redisCommand(b.settings, ['HDEL', hashKey(), id]);
      await redisCommand(b.settings, ['ZREM', orderKey(), id]);
    }
  }
  return item;
}

/** 新しい順 */
export async function listFeedback(): Promise<FeedbackItem[]> {
  const b = backend();
  if (b.kind === 'memory') return [...memory.values()].sort((x, y) => y.id.localeCompare(x.id));
  const ids = await redisCommand(b.settings, ['ZREVRANGE', orderKey(), 0, MAX_ITEMS - 1]);
  const list = Array.isArray(ids) ? ids.map(String) : [];
  if (list.length === 0) return [];
  const values = await redisCommand(b.settings, ['HMGET', hashKey(), ...list]);
  return (Array.isArray(values) ? values : []).flatMap((v) => {
    try {
      return v ? [JSON.parse(String(v)) as FeedbackItem] : [];
    } catch {
      return [];
    }
  });
}

export async function updateFeedback(id: string, fields: { status?: FeedbackStatus; adminNote?: string }): Promise<FeedbackItem | null> {
  const b = backend();
  const current = b.kind === 'memory'
    ? memory.get(id) || null
    : await redisCommand(b.settings, ['HGET', hashKey(), id]).then((v) => (typeof v === 'string' ? (JSON.parse(v) as FeedbackItem) : null));
  if (!current) return null;
  const next: FeedbackItem = { ...current, ...fields, updatedAt: new Date().toISOString() };
  if (b.kind === 'memory') memory.set(id, next);
  else await redisCommand(b.settings, ['HSET', hashKey(), id, JSON.stringify(next)]);
  return next;
}

export async function deleteFeedback(id: string): Promise<boolean> {
  const b = backend();
  if (b.kind === 'memory') return memory.delete(id);
  const removed = Number(await redisCommand(b.settings, ['HDEL', hashKey(), id]));
  await redisCommand(b.settings, ['ZREM', orderKey(), id]);
  return removed > 0;
}

export function clearFeedbackForTests() {
  memory.clear();
}
