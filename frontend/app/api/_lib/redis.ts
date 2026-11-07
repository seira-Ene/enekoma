// Upstash Redis（REST API）の共通処理。メンテナンス設定とアカウント情報の保存で使う

export interface RedisSettings {
  url: string;
  token: string;
}

export function redisSettings(): RedisSettings | null {
  // Vercel Marketplaceの連携方法によって変数名が異なるので両方を受け付ける
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}

// Previewでの操作が本番に影響しないよう、キーにはこの値を入れて環境ごとに分ける
export function deploymentEnv(): string {
  return process.env.VERCEL_ENV || 'local';
}

export async function redisCommand(settings: RedisSettings, command: (string | number)[]): Promise<unknown> {
  const response = await fetch(settings.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${settings.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command.map(String)),
    cache: 'no-store',
    signal: AbortSignal.timeout(3000)
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(`Redis error: ${response.status}`);
  }
  return data.result;
}
