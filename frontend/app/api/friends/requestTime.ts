// 判定に使う時刻。テストでは ENEKOMA_ALLOW_TIME_OVERRIDE=1 のときだけ x-enekoma-now ヘッダーの時刻を使う（本番では無視）
export function requestTime(request: { headers: { get(name: string): string | null } }): Date {
  if (process.env.ENEKOMA_ALLOW_TIME_OVERRIDE === '1' && process.env.VERCEL_ENV !== 'production') {
    const value = request.headers.get('x-enekoma-now');
    const parsed = value ? new Date(value) : null;
    if (parsed && !Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}
