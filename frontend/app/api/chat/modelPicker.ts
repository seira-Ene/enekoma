// Geminiのモデルを順に試す。上限（429）に達したモデルは、Googleが返す待ち時間まで飛ばす。
// 無料枠は1モデル1日20回ほどで、使い切ったモデルに毎回問い合わせると、429や応答待ちで返事が数十秒遅れていた。
// 記録はサーバーのインスタンスのメモリだけ（再起動・別インスタンスでは1回だけ問い合わせ直す）

export type ModelFailureKind = 'quota' | 'timeout' | 'auth' | 'server' | 'empty' | 'other';

export interface ModelFailure {
  model: string;
  kind: ModelFailureKind;
  status: number | null;
  message: string;
}

export class ModelCallError extends Error {
  status: number | null;
  retryDelaySec: number | null;
  constructor(message: string, status: number | null, retryDelaySec: number | null = null) {
    super(message);
    this.status = status;
    this.retryDelaySec = retryDelaySec;
  }
}

// 上限に達した・応答しなかったモデルを、いつまで飛ばすか（ミリ秒の時刻）
const cooldownUntil = new Map<string, number>();

const QUOTA_COOLDOWN_DEFAULT_SEC = 60;
const QUOTA_COOLDOWN_MAX_SEC = 6 * 60 * 60;
// 応答しなかったモデルは少しだけ飛ばす（次の質問で同じだけ待たせないため）
const TIMEOUT_COOLDOWN_SEC = 90;

export function classifyFailure(err: unknown): ModelFailureKind {
  const status = err instanceof ModelCallError ? err.status : null;
  const name = (err as { name?: string })?.name || '';
  const message = String((err as { message?: string })?.message || err || '').toLowerCase();
  if (status === 429 || message.includes('quota') || message.includes('resource_exhausted')) return 'quota';
  if (name === 'TimeoutError' || name === 'AbortError' || message.includes('timeout') || message.includes('aborted')) return 'timeout';
  if (status === 403 || ((status === 400 || status === 401) && message.includes('api key')) || message.includes('api_key')) return 'auth';
  if (status !== null && status >= 500) return 'server';
  if (message.includes('empty response')) return 'empty';
  return 'other';
}

/** Gemini のエラー本文から「何秒後に再試行してよいか」を読む（"retryDelay": "3277s"） */
export function parseRetryDelaySec(errorJson: unknown): number | null {
  const details = (errorJson as { error?: { details?: { retryDelay?: string }[] } })?.error?.details;
  const delay = details?.find((d) => typeof d?.retryDelay === 'string')?.retryDelay;
  const m = delay?.match(/^(\d+(?:\.\d+)?)s$/);
  return m ? Math.ceil(Number(m[1])) : null;
}

/** 休ませ中の記録の名前（キーのハッシュ＋モデル名） */
export const cooldownId = (scope: string | undefined, model: string) => (scope ? `${scope}:${model}` : model);

export function isCoolingDown(model: string, now: number = Date.now()): boolean {
  const until = cooldownUntil.get(model);
  if (until === undefined) return false;
  if (until <= now) {
    cooldownUntil.delete(model);
    return false;
  }
  return true;
}

// 休ませ始めたときに呼ぶ（ほかのインスタンスと共有するため。cooldownStore.ts が登録する）
let onCooldownStart: ((model: string, untilMs: number) => void) | null = null;
export function setCooldownListener(fn: ((model: string, untilMs: number) => void) | null) {
  onCooldownStart = fn;
}

function startCooldown(model: string, seconds: number, now: number) {
  const until = now + Math.min(QUOTA_COOLDOWN_MAX_SEC, Math.max(1, seconds)) * 1000;
  cooldownUntil.set(model, until);
  onCooldownStart?.(model, until);
}

/** ほかのインスタンスが記録した休ませ中のモデルを取り込む（長いほうを残す） */
export function applyCooldowns(entries: [string, number][]) {
  for (const [model, until] of entries) {
    if (until > (cooldownUntil.get(model) ?? 0)) cooldownUntil.set(model, until);
  }
}

export function resetCooldownsForTests() {
  cooldownUntil.clear();
}

export interface PickResult<T> {
  value: T | null;
  model: string | null;
  failures: ModelFailure[];
  // 飛ばしたモデル（上限・応答なしで休ませ中）
  skipped: string[];
}

/**
 * 1つずつ順に試す（同時に呼ぶと無料枠を2倍使うため並列にしない）。
 * 1回あたり perRequestMs、全体で budgetMs まで。APIキーの不備・権限エラーはほかのモデルでも同じなので打ち切る
 */
export async function callModelsInOrder<T>(
  models: string[],
  call: (model: string, timeoutMs: number) => Promise<T>,
  // scope: 上限はAPIキーごとなので、キーのハッシュで分ける（利用者が自分のキーを入れたときに、サーバーのキーの上限で飛ばさない）
  opts: { perRequestMs: number; budgetMs: number; now?: () => number; scope?: string }
): Promise<PickResult<T>> {
  const now = opts.now ?? Date.now;
  const id = (model: string) => cooldownId(opts.scope, model);
  const deadline = now() + opts.budgetMs;
  const failures: ModelFailure[] = [];
  const skipped: string[] = [];
  const available = models.filter((m) => !isCoolingDown(id(m), now()));
  skipped.push(...models.filter((m) => !available.includes(m)));
  for (const model of available) {
    const remaining = deadline - now();
    // 残りが短すぎると、どのモデルも答えきれないので打ち切る
    if (remaining < 1500) break;
    try {
      const value = await call(model, Math.min(opts.perRequestMs, remaining));
      return { value, model, failures, skipped };
    } catch (err) {
      const kind = classifyFailure(err);
      const status = err instanceof ModelCallError ? err.status : null;
      failures.push({ model, kind, status, message: String((err as Error)?.message || err) });
      if (kind === 'quota') startCooldown(id(model), (err instanceof ModelCallError && err.retryDelaySec) || QUOTA_COOLDOWN_DEFAULT_SEC, now());
      if (kind === 'timeout') startCooldown(id(model), TIMEOUT_COOLDOWN_SEC, now());
      if (kind === 'auth') break;
    }
  }
  return { value: null, model: null, failures, skipped };
}

/** すべて失敗したときの理由（チャット向けの短い言葉にするため） */
export function summarizeFailure(result: Pick<PickResult<unknown>, 'failures' | 'skipped'>): ModelFailureKind {
  const kinds = result.failures.map((f) => f.kind);
  if (kinds.includes('auth')) return 'auth';
  if (kinds.length === 0 && result.skipped.length > 0) return 'quota';
  if (kinds.every((k) => k === 'quota')) return 'quota';
  if (kinds.includes('timeout')) return 'timeout';
  if (kinds.includes('quota')) return 'quota';
  return kinds[kinds.length - 1] ?? 'other';
}
