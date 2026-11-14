// 上限に達したGeminiのモデルを、サーバーのインスタンスをまたいで共有する（Redis）。
// Vercelは新しいインスタンスをよく起動するので、メモリだけだと毎回使い切ったモデルに問い合わせてしまう。
// Redisが遅い・ないときは待たずに進む（チャットを遅くしない）
import { deploymentEnv, redisCommand, redisSettings } from '../_lib/redis';
import { createHash } from 'crypto';
import { applyCooldowns, cooldownId, setCooldownListener } from './modelPicker';

const REDIS_WAIT_MS = 400;
const key = (id: string) => `gemini_cooldown:${deploymentEnv()}:${id}`;

/** APIキーの短いハッシュ（キーそのものは保存しない） */
export const apiKeyScope = (apiKey: string) => createHash('sha256').update(apiKey).digest('hex').slice(0, 12);

function withinTime<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]).catch(() => null);
}

/** Redisに残っている休ませ中のモデルを、このインスタンスのメモリに取り込む */
export async function loadSharedCooldowns(scope: string, models: string[]): Promise<void> {
  const settings = redisSettings();
  if (!settings || models.length === 0) return;
  const ids = models.map((m) => cooldownId(scope, m));
  const values = await withinTime(redisCommand(settings, ['MGET', ...ids.map(key)]), REDIS_WAIT_MS);
  if (!Array.isArray(values)) return;
  const entries: [string, number][] = [];
  values.forEach((v, i) => {
    const until = Number(v);
    if (Number.isFinite(until) && until > Date.now()) entries.push([ids[i], until]);
  });
  applyCooldowns(entries);
}

/** 休ませ始めたモデルをRedisに書く（待たない） */
export function saveSharedCooldown(id: string, untilMs: number): void {
  const settings = redisSettings();
  const ttl = untilMs - Date.now();
  if (!settings || ttl <= 0) return;
  void withinTime(redisCommand(settings, ['SET', key(id), String(untilMs), 'PX', Math.ceil(ttl)]), 2000);
}

// 読み込まれたら、休ませ始めたモデルを自動でRedisに書く
setCooldownListener(saveSharedCooldown);
