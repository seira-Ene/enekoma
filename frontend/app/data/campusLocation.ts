// 位置情報（GPS）による「校内 / 校外」の判定。緯度・経度はこの端末の中だけで使い、サーバーやフレンドには送らない
// （送るのは「校内か校外か」だけ）

/**
 * 日本大学文理学部（〒156-8550 東京都世田谷区桜上水3-25-40）のジオフェンス。
 * 敷地は南北約550m・東西約300m（OpenStreetMap の敷地の範囲 35.6607〜35.6656, 139.6329〜139.6363）。
 * その四隅は中心から308〜318mあるので、半径350mを校内とする（校舎の中でGPSが少しずれても校外にしない）。
 * 誤差の見込み（最大75m）を足しても425mで、桜上水駅（約610m）・下高井戸駅（約720m）は校外になる
 */
export const CAMPUS = { name: '文理学部', lat: 35.6632, lng: 139.6346, radiusM: 350 };
// GPSの誤差はこの範囲まで校内側に見込む
const MAX_ACCURACY_ALLOWANCE_M = 75;
// これより誤差が大きい測位は「校内」とは判定しない（誤差の円がまるごと校外にあるときだけ「校外」にする）
export const MAX_USABLE_ACCURACY_M = 500;

/** 2点間の距離（m、球面の近似） */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface CampusJudgement {
  onCampus: boolean | null;
  distanceM: number;
  accuracyM: number;
  // 判定に使った境界（半径＋誤差の見込み）
  limitM: number;
}

/**
 * 校内にいるかを、キャンパスの中心からの距離と誤差で決める。
 * - 距離 ≤ 半径＋誤差の見込み（最大75m）なら校内
 * - 誤差が500mを超える測位は、誤差の円がまるごと校外にあるときだけ校外、それ以外は判定しない（null）
 */
export function judgeCampus(pos: { lat: number; lng: number; accuracy?: number }): CampusJudgement {
  const accuracyM = Number.isFinite(pos.accuracy) ? Math.max(0, pos.accuracy as number) : 0;
  if (!Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) return { onCampus: null, distanceM: NaN, accuracyM, limitM: CAMPUS.radiusM };
  const distanceM = distanceMeters(pos, CAMPUS);
  const limitM = CAMPUS.radiusM + Math.min(accuracyM, MAX_ACCURACY_ALLOWANCE_M);
  if (accuracyM > MAX_USABLE_ACCURACY_M) {
    return { onCampus: distanceM - accuracyM > CAMPUS.radiusM ? false : null, distanceM, accuracyM, limitM };
  }
  return { onCampus: distanceM <= limitM, distanceM, accuracyM, limitM };
}

/** 校内にいるか。判定できない測位は null */
export function isOnCampus(pos: { lat: number; lng: number; accuracy?: number }): boolean | null {
  return judgeCampus(pos).onCampus;
}

export type LocationState =
  | { kind: 'off' }
  | { kind: 'checking' }
  | { kind: 'on_campus'; at: number }
  | { kind: 'off_campus'; at: number }
  | { kind: 'error'; reason: 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'inaccurate' };

/** 位置情報が使えないときの案内（権限が拒否されたときは、設定の直し方まで伝える） */
export function describeLocationError(reason: 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'inaccurate'): string {
  switch (reason) {
    case 'denied':
      return '位置情報の利用が許可されていません。iPhoneは「設定 → プライバシーとセキュリティ → 位置情報サービス → Safari（またはお使いのブラウザ）→ 使用中のみ許可」、Androidとパソコンはアドレスバーの鍵マーク →「位置情報」→「許可」にしてから、もう一度オンにしてください。';
    case 'unsupported':
      return 'このブラウザでは位置情報を使えません。SafariやChromeの最新版でお試しください。';
    case 'timeout':
      return '位置情報の取得に時間がかかっています。屋外や窓の近くで、もう一度お試しください。';
    case 'inaccurate':
      return '位置情報の誤差が大きいため、校内か校外かを判定できませんでした。端末の「正確な位置情報」をオンにしてお試しください。';
    default:
      return '位置情報を取得できませんでした。端末の位置情報サービスがオンになっているか確認してください。';
  }
}

/** GeolocationPositionError のコード（1: 拒否, 2: 取得できない, 3: 時間切れ）を理由にする */
export function geoErrorReason(code: number): 'denied' | 'unavailable' | 'timeout' {
  return code === 1 ? 'denied' : code === 3 ? 'timeout' : 'unavailable';
}

// 「位置情報で校内/校外を判定する」をオンにしたか（端末ごと）
export const LOCATION_ENABLED_KEY = 'enekoma_location_enabled';

export function readLocationEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(LOCATION_ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveLocationEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) localStorage.setItem(LOCATION_ENABLED_KEY, '1');
    else localStorage.removeItem(LOCATION_ENABLED_KEY);
  } catch {
    // 保存できなくても、この画面を開いている間は使える
  }
}
