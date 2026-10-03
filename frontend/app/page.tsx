"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useSyncExternalStore,
  useCallback,
} from "react";

// 曜日定義（月〜金）
const DAYS = [
  { key: "mon", label: "月", fullLabel: "月曜日", en: "Mon" },
  { key: "tue", label: "火", fullLabel: "火曜日", en: "Tue" },
  { key: "wed", label: "水", fullLabel: "水曜日", en: "Wed" },
  { key: "thu", label: "木", fullLabel: "木曜日", en: "Thu" },
  { key: "fri", label: "金", fullLabel: "金曜日", en: "Fri" },
] as const;

// 時限定義（1〜5限）
const PERIODS = [
  { period: 1, time: "09:00 - 10:30" },
  { period: 2, time: "10:45 - 12:15" },
  { period: 3, time: "13:00 - 14:30" },
  { period: 4, time: "14:45 - 16:15" },
  { period: 5, time: "16:30 - 18:00" },
] as const;

// カラープリセット
const COLOR_THEMES = [
  {
    id: "emerald",
    name: "エメラルド",
    cardBg: "bg-emerald-50/90 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800/60",
    accent: "bg-emerald-500",
    textPrimary: "text-emerald-950 dark:text-emerald-100",
    textSecondary: "text-emerald-700 dark:text-emerald-300",
    badgeBg: "bg-emerald-100/90 dark:bg-emerald-900/50",
    badgeBorder: "border-emerald-300/60 dark:border-emerald-700/50",
  },
  {
    id: "sky",
    name: "スカイ",
    cardBg: "bg-sky-50/90 dark:bg-sky-950/40",
    border: "border-sky-200 dark:border-sky-800/60",
    accent: "bg-sky-500",
    textPrimary: "text-sky-950 dark:text-sky-100",
    textSecondary: "text-sky-700 dark:text-sky-300",
    badgeBg: "bg-sky-100/90 dark:bg-sky-900/50",
    badgeBorder: "border-sky-300/60 dark:border-sky-700/50",
  },
  {
    id: "indigo",
    name: "インディゴ",
    cardBg: "bg-indigo-50/90 dark:bg-indigo-950/40",
    border: "border-indigo-200 dark:border-indigo-800/60",
    accent: "bg-indigo-500",
    textPrimary: "text-indigo-950 dark:text-indigo-100",
    textSecondary: "text-indigo-700 dark:text-indigo-300",
    badgeBg: "bg-indigo-100/90 dark:bg-indigo-900/50",
    badgeBorder: "border-indigo-300/60 dark:border-indigo-700/50",
  },
  {
    id: "amber",
    name: "アンバー",
    cardBg: "bg-amber-50/90 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800/60",
    accent: "bg-amber-500",
    textPrimary: "text-amber-950 dark:text-amber-100",
    textSecondary: "text-amber-700 dark:text-amber-300",
    badgeBg: "bg-amber-100/90 dark:bg-amber-900/50",
    badgeBorder: "border-amber-300/60 dark:border-amber-700/50",
  },
  {
    id: "rose",
    name: "ローズ",
    cardBg: "bg-rose-50/90 dark:bg-rose-950/40",
    border: "border-rose-200 dark:border-rose-800/60",
    accent: "bg-rose-500",
    textPrimary: "text-rose-950 dark:text-rose-100",
    textSecondary: "text-rose-700 dark:text-rose-300",
    badgeBg: "bg-rose-100/90 dark:bg-rose-900/50",
    badgeBorder: "border-rose-300/60 dark:border-rose-700/50",
  },
  {
    id: "purple",
    name: "パープル",
    cardBg: "bg-purple-50/90 dark:bg-purple-950/40",
    border: "border-purple-200 dark:border-purple-800/60",
    accent: "bg-purple-500",
    textPrimary: "text-purple-950 dark:text-purple-100",
    textSecondary: "text-purple-700 dark:text-purple-300",
    badgeBg: "bg-purple-100/90 dark:bg-purple-900/50",
    badgeBorder: "border-purple-300/60 dark:border-purple-700/50",
  },
] as const;

// 1コマのデータ構造
export interface TimetableCellData {
  subject: string;
  roomNumber: string;
  locationDetail?: string;
  fullDisplay?: string;
  colorId?: string;
}

export type TimetableState = Record<string, TimetableCellData>;

const STORAGE_KEY = "enekoma_timetable";
const CUSTOM_EVENT_NAME = "enekoma-timetable-storage-sync";

// useSyncExternalStore 用の購読・スナップショット関数
function subscribeToTimetable(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(CUSTOM_EVENT_NAME, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CUSTOM_EVENT_NAME, callback);
  };
}

function getTimetableSnapshot(): string {
  if (typeof window === "undefined") return "{}";
  return localStorage.getItem(STORAGE_KEY) || "{}";
}

function getServerTimetableSnapshot(): string {
  return "{}";
}

function saveTimetableToStorage(data: TimetableState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event(CUSTOM_EVENT_NAME));
  } catch (err) {
    console.error("Failed to save timetable to localStorage:", err);
  }
}

// ==========================================
// 校舎ナレッジベース（フロントエンドローカル解析・検索）
// ==========================================
export function parseRoomDetailLocal(room: string): string {
  const r = room.trim().toUpperCase();
  if (!r) return "詳細場所未登録";

  // 1号館 個別教室完全マッチング
  if (["122", "123", "124"].includes(r)) {
    return "1号館2階・階段登って左側（左奥に女子トイレ）";
  }
  if (["125", "126", "127A", "127B"].includes(r)) {
    return "1号館2階・階段登って右側（右手前に男子トイレ、右奥に女子トイレ）";
  }
  if (r === "130") {
    return "1号館3階・階段登って正面（左奥: 男子トイレ、右奥: 女子トイレ）";
  }
  if (["131", "132", "133", "134", "138"].includes(r)) {
    return "1号館3階・階段登って左側（左奥に男子トイレ）";
  }
  if (["135", "136", "137A", "137B", "139"].includes(r)) {
    return "1号館3階・階段登って右側（右奥に女子トイレ）";
  }
  if (r === "141") {
    return "1号館4階・階段登って正面（※4階・5階はトイレなし、2F/3Fを利用）";
  }
  if (r === "151") {
    return "1号館5階・階段登って正面（※4階・5階はトイレなし、2F/3Fを利用）";
  }

  // 4号館 個別教室完全マッチング
  if (r === "411") {
    return "4号館1階・正面から入って左側（男子トイレ側 / 給水所利用可能）";
  }
  if (r === "412") {
    return "4号館1階・正面から入って右側（女子トイレ側 / 給水所利用可能）";
  }
  if (r === "421") {
    return "4号館2階・階段登って左側（男子トイレ側 ※給水所使用不可）";
  }
  if (r === "422") {
    return "4号館2階・階段登って右側（女子トイレ側 ※給水所使用不可）";
  }
  if (r === "431") {
    return "4号館3階・階段登って右側（男子トイレ側 ※給水所使用不可）";
  }
  if (r === "432") {
    return "4号館3階・階段登って左側（女子トイレ側 ※給水所使用不可）";
  }
  if (r === "441") {
    return "4号館4階・階段登って右側奥（男子トイレ側・奥 ※給水所使用不可）";
  }
  if (r === "442") {
    return "4号館4階・階段登って右側手前（男子トイレ側・手前 ※給水所使用不可）";
  }
  if (r === "443") {
    return "4号館4階・階段登って左側手前（女子トイレ側・手前 ※給水所使用不可）";
  }
  if (r === "444") {
    return "4号館4階・階段登って左側奥（女子トイレ側・奥 ※給水所使用不可）";
  }

  // 3号館 (4桁: 3XXX)
  const m3 = r.match(/^3([1-5])(\d{2})$/);
  if (m3) {
    const floor = m3[1];
    const subNum = parseInt(m3[2], 10);
    if (subNum >= 1 && subNum <= 5) {
      return `3号館${floor}階・エスカレーター出て右 / エレベーター出て左（男子トイレ側）`;
    } else if (subNum >= 6 && subNum <= 10) {
      return `3号館${floor}階・エスカレーター出て左 / エレベーター出て右（女子トイレ側）`;
    }
    return `3号館${floor}階（下2桁01〜05: 男子トイレ側 / 06〜10: 女子トイレ側）`;
  }

  // 一般階フォールバック
  if (r.startsWith("1") && r.length >= 3 && /^\d$/.test(r[1])) {
    return `1号館${r[1]}階`;
  }
  if (r.startsWith("4") && r.length >= 3 && /^\d$/.test(r[1])) {
    return `4号館${r[1]}階`;
  }
  if (r.startsWith("2") && r.length === 4 && /^\d$/.test(r[1])) {
    return `2号館${r[1]}階`;
  }

  return "詳細場所未登録";
}

export function answerNavigatorQueryLocal(query: string): string {
  const q = query.trim();
  const qLower = q.toLowerCase();

  const roomMatch = q.match(/\b([1-4]\d{2,3}[A-Ba-b]?)\b/);
  if (roomMatch) {
    const roomCode = roomMatch[1].toUpperCase();
    const detail = parseRoomDetailLocal(roomCode);
    if (detail !== "詳細場所未登録") {
      return `📍 【教室案内: ${roomCode}】\n場所: ${detail}\n※エネコマ時間割にもこのまま登録できます！`;
    }
  }

  if (["水飲み場", "給水所", "給水", "水飲み", "冷水機"].some((k) => q.includes(k))) {
    return (
      "🚰 【給水所（水飲み場）のご案内】\n" +
      "・現在使用可能な場所: **4号館 1階** のみ\n" +
      "※注意: 4号館 2階〜4階の給水所は現在使用不可となっています。"
    );
  }

  if (q.includes("ゴミ箱") || q.includes("ごみ箱") || q.includes("ゴミ")) {
    return (
      "🗑️ 【ゴミ箱の設置場所】\n" +
      "・1号館、2号館、3号館、4号館の **全館・各階** に設置されています。\n" +
      "・4号館は **各階トイレ前** に設置されています。"
    );
  }

  if (q.includes("トイレ") || q.includes("お手洗い") || q.includes("便所")) {
    if (q.includes("1号館") || q.includes("1号")) {
      return (
        "🚻 【1号館のトイレ情報】\n" +
        "・1階: 正面左手前（女子）、左奥（男子）、右手前奥（男子）\n" +
        "・2階: 左奥（女子）、右手前（男子）、右奥（女子）\n" +
        "・3階: 左奥（男子）、右奥（女子）\n" +
        "⚠️ 注意: 4階・5階にはトイレがありません。2階または3階をご利用ください。"
      );
    } else if (q.includes("3号館") || q.includes("3号")) {
      return (
        "🚻 【3号館のトイレ情報（各階共通）】\n" +
        "・男子トイレ: エスカレーター出て右 / エレベーター出て左（教室01〜05側）\n" +
        "・女子トイレ: エスカレーター出て左 / エレベーター出て右（教室06〜10側）"
      );
    } else if (q.includes("4号館") || q.includes("4号")) {
      return (
        "🚻 【4号館のトイレ情報】\n" +
        "・1階: 左側（男子 / 411側）、右側（女子 / 412側）\n" +
        "・2階: 左側（男子 / 421側）、右側（女子 / 422側）\n" +
        "・3階: 右側（男子 / 431側）、左側（女子 / 432側）\n" +
        "・4階: 右側（男子 / 441・442側）、左側（女子 / 443・444側）"
      );
    }
    return (
      "🚻 【各館トイレのご案内】\n" +
      "・3号館 (各階): 男子=エスカレーター右(01-05側) / 女子=エスカレーター左(06-10側)\n" +
      "・4号館 (各階): 階ごとに左右配置（1F/2Fは左男子・右女子、3F/4Fは右男子・左女子）\n" +
      "・1号館: 1F〜3Fに設置（※4階・5階にはトイレがありません）\n" +
      "・2号館: 各階に設置"
    );
  }

  if (["クレジット", "クレカ", "タッチ決済", "コンタクトレス", "visa", "master"].some((k) => q.includes(k))) {
    return (
      "💳 【クレジットカードタッチ決済が使える自販機】\n" +
      "・設置場所: **3号館 1階 食堂側**\n" +
      "・対象自販機: **コカ・コーラ（赤）**\n" +
      "・対応ブランド: Visa / Mastercard コンタクトレス決済対応\n" +
      "※他のサントリー自販機ではクレカ直接タッチは利用できません。"
    );
  }

  if (qLower.includes("paypay") || q.includes("ペイペイ")) {
    return (
      "📱 【PayPayが使える自販機】\n" +
      "学内のすべての自販機でPayPayが利用可能です！\n\n" +
      "1. **3号館 1階 食堂側 コカ・コーラ自販機（赤）**\n" +
      "   → 『Coke ON Pay』アプリ連携でPayPay決済可能\n" +
      "2. **3号館 1階 食堂側 サントリー自販機（計3台）＆ 4号館 1階 自販機**\n" +
      "   → サントリー『ジハンピ』アプリ連携でPayPay決済可能"
    );
  }

  if (["交通系", "suica", "pasmo", "icカード"].some((k) => qLower.includes(k))) {
    return (
      "🚃 【交通系IC（Suica/PASMO等）が使える自販機】\n" +
      "⚠️ 注意: 学内自販機は**物理カードの直接タッチには非対応**です。各社アプリ経由で決済できます。\n\n" +
      "・**3号館 1階 コカ・コーラ（赤）**: 『Coke ON Pay』連携で利用可能\n" +
      "・**3号館・4号館 サントリー各台**: 『ジハンピ』アプリ連携で利用可能"
    );
  }

  if (q.includes("100円以下") || q.includes("100円で買える") || q.includes("安い")) {
    return (
      "🪙 【100円以下で購入できるお得な商品】\n\n" +
      "【80円（最安値！）】\n" +
      "・サントリー天然水 (4号館1F / 3号館1F水メイン)\n" +
      "・ZONe スカッと透明 (4号館1F)\n" +
      "・ZONe NOPE (3号館1F青)\n\n" +
      "【90円】\n" +
      "・やさしい麦茶 (4号館1F / 3号館1F各台)\n" +
      "・レモン強炭酸水 (3号館1Fスポーツ系)\n\n" +
      "【100円】\n" +
      "・マウンテンデュー / デカビタC GABA / ペプシコーラ生\n" +
      "・伊右衛門緑茶・焙じ茶 / プリン缶 / レモンスカッシュ / アイスティー\n" +
      "・ジョージア缶コーヒー各種 / BOSS缶コーヒー各種"
    );
  }

  const drinkKeywords = [
    { kw: "レッドブル", name: "レッドブル", price: 170, loc: "4号館1F, 3号館1F(スポーツ系/青)" },
    { kw: "モンスター", name: "モンスターエナジー各種", price: "180〜190", loc: "3号館1F 食堂側（スポーツ系）" },
    { kw: "zone", name: "ZONe(スカッと透明/NOPE)", price: 80, loc: "4号館1F(スカッと透明) / 3号館1F(青/NOPE)" },
    { kw: "天然水", name: "サントリー天然水", price: 80, loc: "4号館1F / 3号館1F(水メイン)" },
    { kw: "いろはす", name: "い・ろ・は・す", price: "100〜110", loc: "3号館1F 食堂側（コカ・コーラ赤）" },
    { kw: "麦茶", name: "やさしい麦茶 / やかんの麦茶", price: "90〜110", loc: "4号館1F(90円), 3号館1F各台" },
    { kw: "緑茶", name: "伊右衛門 / 綾鷹", price: "100〜110", loc: "4号館1F, 3号館1F各台" },
    { kw: "コーラ", name: "コカ・コーラ(140円) / ペプシ生(100円)", price: "100〜140", loc: "3号館1F 食堂側" },
    { kw: "ミルクティー", name: "リプトン白の贅沢 / 紅茶花伝", price: 110, loc: "4号館1F, 3号館1F各台" },
    { kw: "コーヒー", name: "BOSS各種 / ジョージア各種", price: "90〜140", loc: "4号館1F, 3号館1F各台" },
    { kw: "プリン", name: "ぷるぷるプリン缶", price: 100, loc: "3号館1F 食堂側（水メイン／スポーツ系）" },
  ];

  for (const item of drinkKeywords) {
    if (qLower.includes(item.kw)) {
      return (
        `🥤 【「${item.name}」の自販機情報】\n` +
        `・価格目安: **${item.price}円**\n` +
        `・購入できる場所: **${item.loc}**\n` +
        `・決済方法: 現金、PayPay(ジハンピ/Coke ON連携)、交通系IC(アプリ連携)、3号館赤ならクレカタッチもOK！`
      );
    }
  }

  return (
    "🎓 【キャンパス構内ナビゲーターAI】\n" +
    "校舎ナレッジベースに基づき、以下の内容をご案内できます：\n\n" +
    "1. **教室案内**: 「3505はどこ？」「411教室」「124の場所」など\n" +
    "2. **自販機案内**: 「レッドブルはどこ？」「100円以下の飲み物」「PayPay/クレカが使える自販機」\n" +
    "3. **設備案内**: 「水飲み場・給水所」「ゴミ箱の場所」「3号館のトイレ」\n\n" +
    "質問したい内容をお気軽に入力してください！"
  );
}

export default function TimetablePage() {
  const rawTimetableJson = useSyncExternalStore(
    subscribeToTimetable,
    getTimetableSnapshot,
    getServerTimetableSnapshot
  );

  const timetable: TimetableState = useMemo(() => {
    try {
      const parsed = JSON.parse(rawTimetableJson);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }, [rawTimetableJson]);

  // モーダル管理ステート
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    dayKey: string;
    dayLabel: string;
    period: number;
    time: string;
  } | null>(null);

  // キャンパスナビゲーターモーダル
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(false);
  const [navQuery, setNavQuery] = useState("");
  const [navHistory, setNavHistory] = useState<
    Array<{ q: string; a: string; time: string }>
  >([]);
  const [isNavSearching, setIsNavSearching] = useState(false);

  // フォームステート
  const [formSubject, setFormSubject] = useState("");
  const [formRoomNumber, setFormRoomNumber] = useState("");
  const [formColorId, setFormColorId] = useState<string>("emerald");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 通知バナー用ステート
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: "success" | "info";
  } | null>(null);

  // 本日の曜日（月:1 〜 金:5）
  const [todayKey] = useState<string | null>(() => {
    const dayOfWeek = new Date().getDay();
    const dayMap: Record<number, string> = {
      1: "mon",
      2: "tue",
      3: "wed",
      4: "thu",
      5: "fri",
    };
    return dayMap[dayOfWeek] || null;
  });

  // モーダルを閉じる
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedSlot(null);
    setFormSubject("");
    setFormRoomNumber("");
    setFormError(null);
  }, []);

  // コマをクリックしたときのハンドラ
  const handleCellClick = useCallback(
    (dayKey: string, dayLabel: string, period: number, time: string) => {
      const slotKey = `${dayKey}-${period}`;
      const existing = timetable[slotKey];

      setSelectedSlot({ dayKey, dayLabel, period, time });
      setFormError(null);

      if (existing) {
        setFormSubject(existing.subject);
        setFormRoomNumber(existing.roomNumber);
        setFormColorId(existing.colorId || "emerald");
      } else {
        setFormSubject("");
        setFormRoomNumber("");
        const defaultColors = [
          "emerald",
          "sky",
          "indigo",
          "amber",
          "rose",
          "purple",
        ];
        const pickedColor =
          defaultColors[(period + dayKey.charCodeAt(0)) % defaultColors.length];
        setFormColorId(pickedColor);
      }
      setIsModalOpen(true);
    },
    [timetable]
  );

  // トーストの自動消去
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isNavigatorOpen) {
          setIsNavigatorOpen(false);
        } else if (isModalOpen) {
          closeModal();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, isNavigatorOpen, closeModal]);

  // ナビゲーター検索処理
  const handleNavigatorSubmit = async (queryText?: string) => {
    const textToSearch = (queryText !== undefined ? queryText : navQuery).trim();
    if (!textToSearch) return;

    setIsNavSearching(true);
    const apiBaseUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      (typeof window !== "undefined" && window.location.hostname !== "localhost"
        ? ""
        : "http://localhost:8000");

    let reply = "";
    try {
      const res = await fetch(`${apiBaseUrl}/api/navigator/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: textToSearch }),
      });
      if (res.ok) {
        const data = await res.json();
        reply = data.reply;
      } else {
        reply = answerNavigatorQueryLocal(textToSearch);
      }
    } catch {
      reply = answerNavigatorQueryLocal(textToSearch);
    }

    const timeStr = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    setNavHistory((prev) => [
      { q: textToSearch, a: reply, time: timeStr },
      ...prev,
    ]);
    setNavQuery("");
    setIsNavSearching(false);
  };

  // 保存処理 (FastAPI連携 & localStorage永続化)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;

    const trimmedSubject = formSubject.trim();
    const trimmedRoom = formRoomNumber.trim();

    if (!trimmedSubject) {
      setFormError("講義名を入力してください。");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const apiBaseUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      (typeof window !== "undefined" && window.location.hostname !== "localhost"
        ? ""
        : "http://localhost:8000");

    let locationDetail = "";
    let fullDisplay = "";
    let apiSuccess = false;

    try {
      const response = await fetch(`${apiBaseUrl}/api/timetable/parse`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: trimmedSubject,
          room_number: trimmedRoom,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: status ${response.status}`);
      }

      const data = await response.json();
      locationDetail = data.location_detail || "";
      fullDisplay = data.full_display || "";
      apiSuccess = true;
    } catch (err) {
      console.warn("Backend API unavailable or error. Using client fallback:", err);

      locationDetail = parseRoomDetailLocal(trimmedRoom);
      fullDisplay = locationDetail
        ? `${trimmedSubject} （${trimmedRoom}：${locationDetail}）`
        : trimmedRoom
        ? `${trimmedSubject} （${trimmedRoom}）`
        : trimmedSubject;
    }

    const slotKey = `${selectedSlot.dayKey}-${selectedSlot.period}`;
    const updatedTimetable: TimetableState = {
      ...timetable,
      [slotKey]: {
        subject: trimmedSubject,
        roomNumber: trimmedRoom,
        locationDetail,
        fullDisplay,
        colorId: formColorId,
      },
    };

    saveTimetableToStorage(updatedTimetable);
    setIsSubmitting(false);
    closeModal();

    if (apiSuccess) {
      setToastMessage({
        text: `「${trimmedSubject}」を保存しました（校舎ナレッジ解析完了）`,
        type: "success",
      });
    } else {
      setToastMessage({
        text: `「${trimmedSubject}」をローカルに保存しました`,
        type: "info",
      });
    }
  };

  // コマ削除処理
  const handleDelete = () => {
    if (!selectedSlot) return;
    const slotKey = `${selectedSlot.dayKey}-${selectedSlot.period}`;
    const currentSubject = timetable[slotKey]?.subject;
    const updated = { ...timetable };
    delete updated[slotKey];

    saveTimetableToStorage(updated);
    closeModal();
    if (currentSubject) {
      setToastMessage({
        text: `「${currentSubject}」を削除しました`,
        type: "info",
      });
    }
  };

  const registeredCount = Object.keys(timetable).length;

  const getTheme = (colorId?: string) => {
    return (
      COLOR_THEMES.find((c) => c.id === colorId) || COLOR_THEMES[0]
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white pb-12">
      {/* トースト通知 */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-lg border text-xs sm:text-sm font-medium flex items-center gap-2 ${
              toastMessage.type === "success"
                ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20"
                : "bg-slate-800 text-white border-slate-700 shadow-slate-900/30"
            }`}
          >
            <span>{toastMessage.type === "success" ? "✓" : "ℹ"}</span>
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* ===== ヘッダー ===== */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-sky-400 flex items-center justify-center shadow-md shadow-emerald-500/20 text-white font-black text-xl tracking-tighter">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">
                  EneKoma
                </h1>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  エネコマ
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-normal hidden sm:block">
                スマートキャンパス時間割 ＆ 構内ナビゲーター
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* キャンパスナビボタン */}
            <button
              type="button"
              onClick={() => setIsNavigatorOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-xs shadow-emerald-500/20 transition-all cursor-pointer active:scale-95"
              title="教室・自販機・トイレ検索"
            >
              <span>🧭</span>
              <span className="hidden xs:inline">キャンパスナビ</span>
            </button>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>
                登録:{" "}
                <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  {registeredCount}
                </strong>{" "}
                / 25コマ
              </span>
            </div>

            {registeredCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      "すべてのコマをリセットしますか？この操作は元に戻せません。"
                    )
                  ) {
                    saveTimetableToStorage({});
                    setToastMessage({
                      text: "時間割をリセットしました",
                      type: "info",
                    });
                  }
                }}
                className="text-xs px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 transition-colors"
                title="全コマをクリア"
              >
                クリア
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ===== メインコンテンツ ===== */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-2 sm:px-6 pt-4 sm:pt-6">
        {/* PWA案内 & キャンパスナビ起動バナー */}
        <div className="mb-4 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-sky-500/10 dark:from-emerald-950/40 dark:via-teal-950/40 dark:to-sky-950/40 rounded-2xl p-3.5 sm:p-4 border border-emerald-200/60 dark:border-emerald-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <span className="shrink-0 w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-base">
              🧭
            </span>
            <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                校舎ナレッジベース搭載！
              </span>
              教室番号（例: 3505, 411, 124）を入れると正確な場所やトイレ位置を自動表示。自販機や給水所も
              <button
                type="button"
                onClick={() => setIsNavigatorOpen(true)}
                className="text-emerald-600 dark:text-emerald-400 font-semibold underline underline-offset-2 ml-1 hover:text-emerald-700"
              >
                キャンパスナビ
              </button>
              で検索できます。
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            {todayKey && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-600 text-white shadow-xs">
                📅 今日: {DAYS.find((d) => d.key === todayKey)?.fullLabel}
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsNavigatorOpen(true)}
              className="text-xs font-semibold px-3 py-1 rounded-full bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 shadow-xs hover:bg-emerald-50 transition-colors"
            >
              AIに質問する 🔍
            </button>
          </div>
        </div>

        {/* ===== 時間割グリッド ===== */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[700px] select-none">
              {/* テーブルヘッダー（曜日行） */}
              <div className="grid grid-cols-[80px_repeat(5,_1fr)] border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 sticky top-0">
                <div className="p-3 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 flex items-center justify-center border-r border-slate-200/60 dark:border-slate-800/60">
                  時限
                </div>
                {DAYS.map((day) => {
                  const isToday = day.key === todayKey;
                  return (
                    <div
                      key={day.key}
                      className={`p-3 text-center border-r last:border-r-0 border-slate-200/60 dark:border-slate-800/60 transition-colors ${
                        isToday
                          ? "bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                          : "text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-base font-bold">{day.label}</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                          ({day.en})
                        </span>
                        {isToday && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* テーブルボディ（時限 × 曜日） */}
              {PERIODS.map((periodObj) => (
                <div
                  key={periodObj.period}
                  className="grid grid-cols-[80px_repeat(5,_1fr)] border-b last:border-b-0 border-slate-200/70 dark:border-slate-800/70 min-h-[110px]"
                >
                  {/* 時限ラベル列 */}
                  <div className="p-2 sm:p-3 border-r border-slate-200/60 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-900/40 flex flex-col items-center justify-center text-center">
                    <span className="w-7 h-7 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm flex items-center justify-center mb-1">
                      {periodObj.period}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono leading-tight whitespace-nowrap">
                      {periodObj.time.split(" - ")[0]}
                      <br />
                      {periodObj.time.split(" - ")[1]}
                    </span>
                  </div>

                  {/* 曜日ごとのコマ */}
                  {DAYS.map((day) => {
                    const slotKey = `${day.key}-${periodObj.period}`;
                    const cell = timetable[slotKey];
                    const theme = cell ? getTheme(cell.colorId) : null;
                    const isToday = day.key === todayKey;

                    return (
                      <div
                        key={slotKey}
                        onClick={() =>
                          handleCellClick(
                            day.key,
                            day.label,
                            periodObj.period,
                            periodObj.time
                          )
                        }
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleCellClick(
                              day.key,
                              day.label,
                              periodObj.period,
                              periodObj.time
                            );
                          }
                        }}
                        className={`p-2 border-r last:border-r-0 border-slate-200/60 dark:border-slate-800/60 cursor-pointer transition-all duration-150 flex flex-col justify-between group relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:z-10 ${
                          isToday && !cell
                            ? "bg-emerald-500/[0.02] dark:bg-emerald-950/[0.15]"
                            : ""
                        } ${
                          cell
                            ? `${theme?.cardBg} ${theme?.border} border shadow-xs hover:shadow-md hover:scale-[1.01] active:scale-[0.99]`
                            : "hover:bg-slate-100/70 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        {cell ? (
                          <>
                            {/* 登録済みコマ */}
                            <div className="flex-1 flex flex-col gap-1.5">
                              {/* 講義名 */}
                              <div
                                className={`font-bold text-sm sm:text-[15px] leading-tight line-clamp-2 tracking-tight ${theme?.textPrimary}`}
                              >
                                {cell.subject}
                              </div>

                              {/* 教室番号 & 詳細メモ */}
                              {(cell.roomNumber || cell.locationDetail) && (
                                <div className="mt-auto pt-1">
                                  <div
                                    className={`inline-flex flex-wrap items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium leading-tight ${theme?.badgeBg} ${theme?.badgeBorder} ${theme?.textSecondary}`}
                                  >
                                    <span className="font-bold tracking-wide">
                                      📍 {cell.roomNumber}
                                    </span>
                                    {cell.locationDetail && (
                                      <span className="opacity-90">
                                        （{cell.locationDetail}）
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* ホバー時の編集示唆アイコン */}
                            <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-slate-800/90 rounded-md p-1 shadow-xs border border-slate-200/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-300">
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                />
                              </svg>
                            </div>
                          </>
                        ) : (
                          /* 未登録の空コマ */
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors py-4">
                            <span className="text-xl font-light leading-none mb-1">
                              ＋
                            </span>
                            <span className="text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                              登録
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 下部補足・フッター */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 dark:text-slate-500 gap-2 px-2">
          <div>
            ※ 時間割データはブラウザ（localStorage: enekoma_timetable）に安全に自動保存されます
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsNavigatorOpen(true)}
              className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline"
            >
              🧭 キャンパス構内ナビを開く
            </button>
            <span>Powered by EneKoma FastAPI & Next.js</span>
          </div>
        </div>
      </main>

      {/* ===== 登録・編集モーダル ===== */}
      {isModalOpen && selectedSlot && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
            {/* モーダルヘッダー */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 mb-1 border border-emerald-200/80 dark:border-emerald-800">
                  <span>📅</span>
                  <span>
                    {selectedSlot.dayLabel}曜日 {selectedSlot.period}限
                  </span>
                  <span className="opacity-60 font-mono text-[10px]">
                    ({selectedSlot.time})
                  </span>
                </div>
                <h2
                  id="modal-title"
                  className="text-lg font-bold text-slate-900 dark:text-white"
                >
                  {timetable[`${selectedSlot.dayKey}-${selectedSlot.period}`]
                    ? "講義情報の編集"
                    : "新しいコマの登録"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>

            {/* モーダルフォーム */}
            <form onSubmit={handleSave} className="p-6 space-y-5">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                  {formError}
                </div>
              )}

              {/* 講義名 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  講義名 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="例: プログラミング基礎"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>

              {/* 教室番号 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    教室番号
                  </label>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    例: 3505, 411, 124, 130
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm">
                    📍
                  </span>
                  <input
                    type="text"
                    placeholder="例: 3505"
                    value={formRoomNumber}
                    onChange={(e) => setFormRoomNumber(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>
                {/* リアルタイム解析プレビュー */}
                {formRoomNumber && (
                  <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900">
                    場所: {parseRoomDetailLocal(formRoomNumber)}
                  </p>
                )}
              </div>

              {/* カラー選択 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  コマのカラーテーマ
                </label>
                <div className="flex items-center gap-2.5">
                  {COLOR_THEMES.map((theme) => {
                    const isSelected = formColorId === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => setFormColorId(theme.id)}
                        className={`w-7 h-7 rounded-full ${theme.accent} transition-transform flex items-center justify-center shadow-xs cursor-pointer ${
                          isSelected
                            ? "scale-110 ring-2 ring-offset-2 ring-emerald-500 dark:ring-offset-slate-900"
                            : "opacity-70 hover:opacity-100 hover:scale-105"
                        }`}
                        title={theme.name}
                      >
                        {isSelected && (
                          <span className="text-white text-xs font-bold">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ボタンエリア */}
              <div className="pt-2 flex items-center justify-between gap-3">
                {timetable[`${selectedSlot.dayKey}-${selectedSlot.period}`] ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="px-4 py-2.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-semibold border border-rose-200 dark:border-rose-900 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    削除
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    キャンセル
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="hidden sm:inline-block px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    閉じる
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        <span>解析・保存中...</span>
                      </>
                    ) : (
                      <>
                        <span>保存する</span>
                        <span>→</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== キャンパス構内ナビゲーターAIモーダル ===== */}
      {isNavigatorOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="navigator-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsNavigatorOpen(false);
          }}
        >
          <div className="w-full max-w-xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col transform transition-all animate-in zoom-in-95 duration-200">
            {/* ナビヘッダー */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-50/50 via-teal-50/30 to-transparent dark:from-emerald-950/30 dark:via-teal-950/20">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center text-lg shadow-sm">
                  🧭
                </span>
                <div>
                  <h2
                    id="navigator-title"
                    className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"
                  >
                    キャンパス構内ナビゲーターAI
                    <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                      校舎ナレッジ対応
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    教室の場所・トイレ・自販機（商品・価格・決済方法）を案内します
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNavigatorOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>

            {/* ナビコンテンツ（チャット＆検索結果） */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* クイック質問チップス */}
              <div>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  ワンタップで質問・検索
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "3505はどこ？",
                    "411教室",
                    "124教室",
                    "レッドブル",
                    "モンスター",
                    "100円以下",
                    "PayPay使える自販機",
                    "クレカ使える自販機",
                    "給水所どこ？",
                    "3号館のトイレ",
                    "ゴミ箱の場所",
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleNavigatorSubmit(chip)}
                      className="px-2.5 py-1 rounded-lg text-xs bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-slate-800 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 transition-colors cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* チャット履歴 */}
              {navHistory.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700/60 text-center">
                  <div className="text-3xl mb-2">🎓</div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    何でも聞いてください！
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                    「3505教室はどこ？」「レッドブルはどこで買える？」「SuicaやPayPay使える？」「給水所は？」など、構内の設備を正確にご案内します。
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {navHistory.map((item, idx) => (
                    <div
                      key={idx}
                      className="space-y-2 animate-in fade-in duration-200"
                    >
                      {/* ユーザーの質問 */}
                      <div className="flex justify-end">
                        <div className="max-w-[85%] px-3.5 py-2 rounded-2xl rounded-tr-sm bg-emerald-600 text-white text-xs sm:text-sm font-medium shadow-xs">
                          {item.q}
                        </div>
                      </div>

                      {/* AIの回答 */}
                      <div className="flex justify-start">
                        <div className="max-w-[95%] p-3.5 sm:p-4 rounded-2xl rounded-tl-sm bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 text-slate-800 dark:text-slate-200 text-xs sm:text-sm leading-relaxed whitespace-pre-line shadow-xs">
                          {item.a}
                          <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
                            <span>校舎ナレッジベース照会</span>
                            <span>{item.time}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ナビ入力エリア */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleNavigatorSubmit();
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm">
                    🔍
                  </span>
                  <input
                    type="text"
                    placeholder="質問を入力（例: 3505 / レッドブル / 給水所 / 100円）"
                    value={navQuery}
                    onChange={(e) => setNavQuery(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-slate-800 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isNavSearching || !navQuery.trim()}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isNavSearching ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <span>送信</span>
                      <span>➤</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
