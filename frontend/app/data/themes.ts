// アプリ全体のデザインテーマ。配色・フォント・角丸は globals.css の html[data-theme="..."] で定義する
// 選んだテーマは端末ごとに localStorage へ保存し、layout.tsx のスクリプトが描画前に適用する（再読み込みでもちらつかない）

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

/** <html data-theme> とアドレスバーの色を切り替える */
export function applyTheme(id: ThemeId) {
  if (typeof document === 'undefined') return;
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
  document.documentElement.setAttribute('data-theme', theme.id);
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute('content', theme.browserColor));
}

// layout.tsx の <head> で描画前に実行するスクリプト。上の applyTheme と同じ処理を、Reactの読み込みを待たずに行う
export const THEME_INIT_SCRIPT = `(function(){try{var c=${JSON.stringify(
  Object.fromEntries(THEMES.map((t) => [t.id, t.browserColor]))
)};var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(!c[t])return;document.documentElement.setAttribute('data-theme',t);document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute('content',c[t])})}catch(e){}})()`;
