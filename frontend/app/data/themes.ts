// アプリ全体のデザインテーマ。配色・フォント・角丸は globals.css の html[data-theme="..."] で定義する
// 選んだテーマは端末ごとに localStorage へ保存し、layout.tsx のスクリプトが描画前に適用する（再読み込みでもちらつかない）
// テーマとは別に「メインの色」を選べる。色相（--accent-h）と鮮やかさ（--accent-k）だけを変え、
// 明るさは globals.css の html[data-accent] で段階ごとに固定するので、どの色でも文字が読める

export type ThemeId = 'default' | 'cute' | 'cool';

export interface ThemeOption {
  id: ThemeId;
  label: string;
  description: string;
  // 選択画面の見本に使う色（背景・メイン・アクセント）
  swatch: [string, string, string];
  // スマホのアドレスバーの色（<meta name="theme-color">）
  browserColor: string;
}

export const THEME_STORAGE_KEY = 'enekoma_theme';
export const ACCENT_STORAGE_KEY = 'enekoma_accent';
export const DEFAULT_THEME: ThemeId = 'default';

export const THEMES: ThemeOption[] = [
  {
    id: 'default',
    label: 'デフォルト',
    description: 'すっきりしたネイビーとグレー',
    swatch: ['#f8fafc', '#0f172a', '#10b981'],
    browserColor: '#0f172a'
  },
  {
    id: 'cute',
    label: 'かわいい',
    description: 'ピンクとラベンダー、丸ゴシック',
    swatch: ['#fff5fa', '#6b1346', '#f6339a'],
    browserColor: '#6b1346'
  },
  {
    id: 'cool',
    label: 'かっこいい',
    description: 'ダークネイビーとシアン、角ばったゴシック',
    swatch: ['#030817', '#f1f5f9', '#00d3f2'],
    browserColor: '#030817'
  }
];

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

export function readStoredTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(id: ThemeId) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // プライベートモードなどで保存できなくても、今の画面には適用する
  }
}

// ---- メインの色 ----

export interface AccentPreset {
  hex: string;
  label: string;
}

// 選択画面のおすすめの色（見本の色。実際の画面は明るさを段階ごとにそろえて使う）
export const ACCENT_PRESETS: AccentPreset[] = [
  { hex: '#2563eb', label: 'ブルー' },
  { hex: '#0ea5e9', label: 'スカイ' },
  { hex: '#0d9488', label: 'ティール' },
  { hex: '#16a34a', label: 'グリーン' },
  { hex: '#ca8a04', label: 'イエロー' },
  { hex: '#ea580c', label: 'オレンジ' },
  { hex: '#dc2626', label: 'レッド' },
  { hex: '#db2777', label: 'ピンク' },
  { hex: '#9333ea', label: 'パープル' },
  { hex: '#92400e', label: 'ブラウン' },
  { hex: '#6b7280', label: 'グレー' }
];

export interface AccentColor {
  hex: string;
  // OKLCH の色相（度）
  h: number;
  // 鮮やかさ（0〜1）。0 ならグレー
  k: number;
  // アドレスバーの色（明るいテーマ用・かっこいい用）
  light: string;
  dark: string;
}

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;
// 選んだ色の鮮やかさ（OKLCH の C）がこれ以上なら k=1
const FULL_CHROMA = 0.12;

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;

function hexToOklch(hex: string): { l: number; c: number; h: number } {
  const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h };
}

function oklchToHex(lightness: number, chroma: number, hue: number): string {
  const rad = (hue * Math.PI) / 180;
  const A = chroma * Math.cos(rad);
  const B = chroma * Math.sin(rad);
  const l = (lightness + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (lightness - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (lightness - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ];
  return (
    '#' +
    rgb
      .map((v) => {
        const encoded = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
        return Math.round(Math.min(1, Math.max(0, encoded)) * 255).toString(16).padStart(2, '0');
      })
      .join('')
  );
}

/** 色（#rrggbb）から、画面に使う色相と鮮やかさを求める。形式が違えば null */
export function makeAccent(hex: string): AccentColor | null {
  if (!HEX_PATTERN.test(hex)) return null;
  const { c, h } = hexToOklch(hex);
  const k = round(Math.min(1, c / FULL_CHROMA), 3);
  const hue = round(h, 1);
  // globals.css の slate-900（明るいテーマ）と slate-50（かっこいい）に合わせる
  return { hex: hex.toLowerCase(), h: hue, k, light: oklchToHex(0.32, 0.13 * k, hue), dark: oklchToHex(0.14, 0.04 * k, hue) };
}

export function accentLabel(accent: AccentColor | null): string {
  if (!accent) return 'テーマの色';
  return ACCENT_PRESETS.find((p) => p.hex === accent.hex)?.label ?? 'カスタム';
}

export function readStoredAccent(): AccentColor | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = JSON.parse(window.localStorage.getItem(ACCENT_STORAGE_KEY) || 'null');
    return stored && typeof stored.hex === 'string' ? makeAccent(stored.hex) : null;
  } catch {
    return null;
  }
}

export function saveAccent(accent: AccentColor | null) {
  try {
    if (accent) window.localStorage.setItem(ACCENT_STORAGE_KEY, JSON.stringify(accent));
    else window.localStorage.removeItem(ACCENT_STORAGE_KEY);
  } catch {
    // 保存できなくても、今の画面には適用する
  }
}

/** <html data-theme>・メインの色・アドレスバーの色を切り替える */
export function applyTheme(id: ThemeId, accent: AccentColor | null = null) {
  if (typeof document === 'undefined') return;
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
  const root = document.documentElement;
  root.setAttribute('data-theme', theme.id);
  if (accent) {
    root.style.setProperty('--accent-h', String(accent.h));
    root.style.setProperty('--accent-k', String(accent.k));
    root.setAttribute('data-accent', '');
  } else {
    root.style.removeProperty('--accent-h');
    root.style.removeProperty('--accent-k');
    root.removeAttribute('data-accent');
  }
  const barColor = accent ? (theme.id === 'cool' ? accent.dark : accent.light) : theme.browserColor;
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute('content', barColor));
}

// layout.tsx の <head> で描画前に実行するスクリプト。上の applyTheme と同じ処理を、Reactの読み込みを待たずに行う
export const THEME_INIT_SCRIPT = `(function(){try{var c=${JSON.stringify(
  Object.fromEntries(THEMES.map((t) => [t.id, t.browserColor]))
)};var d=document.documentElement;var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(!c[t])t=${JSON.stringify(
  DEFAULT_THEME
)};d.setAttribute('data-theme',t);var bar=c[t];var a=JSON.parse(localStorage.getItem(${JSON.stringify(
  ACCENT_STORAGE_KEY
)})||'null');if(a&&isFinite(a.h)&&isFinite(a.k)){d.style.setProperty('--accent-h',String(+a.h));d.style.setProperty('--accent-k',String(+a.k));d.setAttribute('data-accent','');var b=t==='cool'?a.dark:a.light;if(/^#[0-9a-f]{6}$/i.test(b))bar=b}document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute('content',bar)})}catch(e){}})()`;
