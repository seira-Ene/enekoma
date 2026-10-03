'use client';

import React, { useState, useCallback } from 'react';

// 時限定義（修正後）
const PERIODS_CONFIG = [
  { id: 1, name: '1限', time: '09:00 - 10:30' },
  { id: 2, name: '2限', time: '10:40 - 12:10' },
  { id: 'lunch', name: '昼休み', time: '12:10 - 13:00', isLunch: true },
  { id: 3, name: '3限', time: '13:00 - 14:30' },
  { id: 4, name: '4限', time: '14:40 - 16:10' },
  { id: 5, name: '5限', time: '16:20 - 17:50' },
];

const DAYS = [
  { key: 'mon', label: '月曜' },
  { key: 'tue', label: '火曜' },
  { key: 'wed', label: '水曜' },
  { key: 'thu', label: '木曜' },
  { key: 'fri', label: '金曜' },
];

const CHS_DEPARTMENTS = [
  '情報科学科', '国文学科', '英文学科', '哲学科', '史学科', '中国語中国文化学科',
  'ドイツ文学科', '社会学科', '社会福祉学科', '教育学科', '体育学科', '心理学科',
  '地理学科', '地球科学科', '数学科', '物理学科', '生命科学科', '化学科'
];

const CHS_MINORS = [
  'AI・データサイエンス副専攻', 'グローバル主専攻・副専攻', '環境・サステナビリティ副専攻',
  '心身ウェルネス副専攻', '教職コース（中高免許）', '司書教諭コース', '学芸員コース'
];

interface FacilityItem {
  id: string;
  name: string;
  category: string;
  weekday: string;
  saturday: string;
  sunday_holiday: string;
  note: string;
  location: string;
}

const DEFAULT_FACILITIES: FacilityItem[] = [
  {
    id: 'library',
    name: '日本大学文理学部図書館',
    category: '図書・資料',
    weekday: '09:00 - 20:00',
    saturday: '09:00 - 19:00',
    sunday_holiday: '休館（授業なし日）',
    note: '地下書庫・貸出手続きは閉館30分前まで',
    location: '図書館棟'
  },
  {
    id: 'comp_center',
    name: 'コンピュータセンター（受付）',
    category: 'ICT・端末',
    weekday: '09:00 - 18:00',
    saturday: '09:00 - 13:00',
    sunday_holiday: '休業',
    note: 'アカウント・学内Wi-Fi問い合わせ対応',
    location: '3号館'
  },
  {
    id: 'museum',
    name: '日本大学文理学部資料館',
    category: '展示・文化',
    weekday: '10:00 - 17:00',
    saturday: '10:00 - 13:00',
    sunday_holiday: '休館',
    note: '入館無料 / 企画展示開催中',
    location: '8号館'
  },
  {
    id: 'learning_commons',
    name: 'ラーニング・コモンズ',
    category: '学習スペース',
    weekday: '08:00 - 18:00 (サポートデスク 10:00 - 18:00)',
    saturday: '08:00 - 17:00 (サポートデスク 09:00 - 13:00)',
    sunday_holiday: '休館',
    note: 'グループ学習・PC貸出・アカデミックコモンズ併設',
    location: '本館1階'
  },
  {
    id: 'academic_affairs',
    name: '事務窓口・教務課等',
    category: '各種手続き',
    weekday: '09:00 - 17:00',
    saturday: '09:00 - 13:00',
    sunday_holiday: '休み',
    note: '証明書自動発行機利用は閉口15分前まで',
    location: '本館1階事務室'
  }
];

// APIベースURLを動的に判定
const getApiBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return '';
  }
  return 'http://localhost:8000';
};

interface DegreeCheckResult {
  department: string;
  total_earned: number;
  total_required: number;
  progress_rate: number;
  remaining_credits: {
    zengaku: number;
    sogo: number;
    gaikokugo: number;
    kisho: number;
    major_req: number;
    major_opt: number;
    total: number;
  };
  minor_status: {
    name: string;
    earned_credits: number;
    required_credits: number;
    remaining_credits: number;
    recommended_courses: string[];
  };
  missing_requirements: string[];
  ai_advice: string;
}

interface FriendComparisonResult {
  friend_name: string;
  friend_code: string;
  friend_timetable: Record<string, string>;
  common_free_slots: Array<{ key: string; day: string; period: string }>;
  common_free_count: number;
}

export default function CampusNavigatorPage() {
  // ① 年度・学期切り替えステート
  const [selectedYear, setSelectedYear] = useState('2026年度');
  const [selectedSemester, setSelectedSemester] = useState('前期');

  // タブ管理
  const [activeTab, setActiveTab] = useState<'timetable' | 'academic' | 'facilities' | 'schedules' | 'mypage'>('timetable');

  // ② 時間割ステート（年度・学期ごとに独立管理、遅延初期化でlocalStorageから読込）
  const [timetable, setTimetable] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') {
      return {
        mon_1: '情報科学概論', wed_3: '情報科学演習', thu_2: 'データベース論', fri_2: '健康・スポーツ教育実習'
      };
    }
    const saved = localStorage.getItem('enekoma_tt_2026年度_前期');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return {
      mon_1: '情報科学概論', wed_3: '情報科学演習', thu_2: 'データベース論', fri_2: '健康・スポーツ教育実習'
    };
  });
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // 年度・学期の切替ハンドラ
  const handleYearChange = (newYear: string) => {
    setSelectedYear(newYear);
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`enekoma_tt_${newYear}_${selectedSemester}`);
      if (saved) {
        try {
          setTimetable(JSON.parse(saved));
          return;
        } catch {}
      }
      setTimetable({
        mon_1: '情報科学概論', wed_3: '情報科学演習', thu_2: 'データベース論', fri_2: '健康・スポーツ教育実習'
      });
    }
  };

  const handleSemesterChange = (newSemester: string) => {
    setSelectedSemester(newSemester);
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`enekoma_tt_${selectedYear}_${newSemester}`);
      if (saved) {
        try {
          setTimetable(JSON.parse(saved));
          return;
        } catch {}
      }
      setTimetable({
        mon_1: '情報科学概論', wed_3: '情報科学演習', thu_2: 'データベース論', fri_2: '健康・スポーツ教育実習'
      });
    }
  };

  // ③ 履修・卒業ナビ ステート
  const [department, setDepartment] = useState('情報科学科');
  const [grade, setGrade] = useState(2);
  const [selectedMinor, setSelectedMinor] = useState('AI・データサイエンス副専攻');
  const [earnedCredits, setEarnedCredits] = useState({
    zengaku: 2, sogo: 8, gaikokugo: 8, kisho: 5, major_req: 18, major_opt: 12, free_opt: 8
  });
  const [degreeResult, setDegreeResult] = useState<DegreeCheckResult | null>(null);

  // ④ 施設営業時間 AI ステート
  const [facilityQuery, setFacilityQuery] = useState('');
  const [facilityData, setFacilityData] = useState<FacilityItem[]>(DEFAULT_FACILITIES);
  const [facilityAiAnswer, setFacilityAiAnswer] = useState('');

  // ⑤ スケジュール ＆ 通知 ステート
  const [pushEnabled, setPushEnabled] = useState(false);
  const [tasks, setTasks] = useState([
    { id: '1', title: '情報科学演習 レポート提出', date: '2026-10-09', period: '3限', course_name: '情報科学演習', type: 'task', completed: false },
    { id: '2', title: 'データ構造 中間テスト', date: '2026-10-15', period: '2限', course_name: 'データ構造', type: 'exam', completed: false }
  ]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskType, setNewTaskType] = useState('task');

  // ⑥ マイページ ＆ フレンド共有 ステート
  const [userName, setUserName] = useState('文理 太郎');
  const [myShareCode] = useState('ENE-7829-CHS');
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [friendComparison, setFriendComparison] = useState<FriendComparisonResult | null>(null);

  // 時間割保存
  const saveTimetableSlot = () => {
    if (!editingSlot) return;
    const updated = { ...timetable, [editingSlot]: editingText };
    setTimetable(updated);
    const storageKey = `enekoma_tt_${selectedYear}_${selectedSemester}`;
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setEditingSlot(null);
    setEditingText('');
  };

  // 卒業AI判定実行
  const runDegreeCheck = async () => {
    const apiBase = getApiBaseUrl();
    try {
      const res = await fetch(`${apiBase}/api/academic/degree-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department,
          grade: Number(grade),
          earned_credits: earnedCredits,
          selected_minor: selectedMinor,
          taken_courses: ['データ処理基礎', 'ビッグデータサイエンス']
        })
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setDegreeResult(data);
    } catch (err) {
      console.warn('API fallback for degree check:', err);
      const totalEarned = Object.values(earnedCredits).reduce((a, b) => a + b, 0);
      const totalRequired = 124;
      const progress = Math.min(100, Math.round((totalEarned / totalRequired) * 100));
      setDegreeResult({
        department,
        total_earned: totalEarned,
        total_required: totalRequired,
        progress_rate: progress,
        remaining_credits: {
          zengaku: Math.max(0, 2 - earnedCredits.zengaku),
          sogo: Math.max(0, 12 - earnedCredits.sogo),
          gaikokugo: Math.max(0, 8 - earnedCredits.gaikokugo),
          kisho: Math.max(0, 5 - earnedCredits.kisho),
          major_req: Math.max(0, 38 - earnedCredits.major_req),
          major_opt: Math.max(0, 22 - earnedCredits.major_opt),
          total: Math.max(0, totalRequired - totalEarned)
        },
        minor_status: {
          name: selectedMinor,
          earned_credits: 4,
          required_credits: 16,
          remaining_credits: 12,
          recommended_courses: ['人工知能概論', 'データサイエンス演習']
        },
        missing_requirements: [
          '総合教育科目: 残り要件あり',
          '学科専門必修: 残り要件あり'
        ],
        ai_advice: `卒業条件達成率は ${progress}% です。次学期は学科専門必修科目を優先して登録してください。`
      });
    }
  };

  // 施設営業時間AI検索実行
  const searchFacilities = useCallback(async (qText?: string) => {
    const query = qText !== undefined ? qText : facilityQuery;
    const apiBase = getApiBaseUrl();
    try {
      const res = await fetch(`${apiBase}/api/facilities/hours?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setFacilityData(data.facilities);
      setFacilityAiAnswer(data.ai_response);
    } catch (err) {
      console.warn('Facility API offline fallback:', err);
      const filtered = query
        ? DEFAULT_FACILITIES.filter(
            (f) =>
              f.name.includes(query) ||
              f.category.includes(query) ||
              f.location.includes(query)
          )
        : DEFAULT_FACILITIES;
      setFacilityData(filtered);
      setFacilityAiAnswer(
        `【文理学部 施設営業時間案内AI】\n検索条件: 「${query || '全施設'}」の回答結果です。`
      );
    }
  }, [facilityQuery]);

  // Web Push/ブラウザ通知トグル
  const toggleNotification = () => {
    if (!('Notification' in window)) {
      alert('お使いのブラウザは通知機能に対応していません。');
      return;
    }
    if (Notification.permission === 'granted') {
      setPushEnabled(!pushEnabled);
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          setPushEnabled(true);
          new Notification('EneKoma Campus Navigator', { body: 'リマインダー通知が有効化されました。' });
        }
      });
    }
  };

  // フレンド時間割比較実行
  const compareFriend = async () => {
    if (!friendCodeInput) return;
    const apiBase = getApiBaseUrl();
    try {
      const res = await fetch(`${apiBase}/api/friends/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          friend_code: friendCodeInput,
          my_timetable: timetable
        })
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setFriendComparison(data);
    } catch (err) {
      console.warn('Friends API fallback:', err);
      const dummySlots = [
        { key: 'mon_2', day: '月曜', period: '2限' },
        { key: 'tue_3', day: '火曜', period: '3限' },
        { key: 'wed_2', day: '水曜', period: '2限' },
        { key: 'thu_4', day: '木曜', period: '4限' },
      ];
      setFriendComparison({
        friend_name: `フレンド (${friendCodeInput.toUpperCase()})`,
        friend_code: friendCodeInput.toUpperCase(),
        friend_timetable: { mon_1: '総合教養', tue_2: '専門演習' },
        common_free_slots: dummySlots,
        common_free_count: dummySlots.length
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* 画面上部ヘッダー & 年度/学期セレクター */}
      <header className="bg-emerald-700 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black tracking-tight">EneKoma</span>
            <span className="text-xs bg-emerald-800 px-2.5 py-1 rounded-full border border-emerald-600">日本大学文理学部公式対応</span>
          </div>

          {/* ③ 年度・学期切り替えドロップダウン */}
          <div className="flex items-center gap-3 bg-emerald-800/80 p-1.5 rounded-lg border border-emerald-600">
            <label className="text-xs font-semibold text-emerald-100 pl-2">表示対象:</label>
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className="bg-white text-slate-800 text-sm font-bold py-1 px-3 rounded shadow-sm focus:outline-none"
            >
              <option value="2026年度">2026年度</option>
              <option value="2025年度">2025年度</option>
              <option value="2024年度">2024年度</option>
            </select>
            <select
              value={selectedSemester}
              onChange={(e) => handleSemesterChange(e.target.value)}
              className="bg-white text-slate-800 text-sm font-bold py-1 px-3 rounded shadow-sm focus:outline-none"
            >
              <option value="前期">前期</option>
              <option value="後期">後期</option>
            </select>
          </div>
        </div>
      </header>

      {/* タブナビゲーション */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex overflow-x-auto gap-2">
          {[
            { id: 'timetable', label: '📅 時間割' },
            { id: 'academic', label: '🎓 履修・卒業ナビ' },
            { id: 'facilities', label: '🏛 施設営業時間' },
            { id: 'schedules', label: '⏰ スケジュール' },
            { id: 'mypage', label: '👤 マイページ / フレンド' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'timetable' | 'academic' | 'facilities' | 'schedules' | 'mypage')}
              className={`py-3.5 px-4 font-bold text-sm border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                  : 'border-transparent text-slate-600 hover:text-emerald-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* メインコンテンツエリア */}
      <main className="max-w-7xl mx-auto px-4 py-6">

        {/* -------------------------------------------------------------
            TAB 1: 📅 時間割（更新後の時限時刻・年度学期保存対応）
        ------------------------------------------------------------- */}
        {activeTab === 'timetable' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div>
                <h2 className="text-lg font-bold text-emerald-900">時間割ビュー（{selectedYear} {selectedSemester}）</h2>
                <p className="text-xs text-emerald-700">コマをクリックして授業名を入力・保存できます。</p>
              </div>
              <span className="text-xs font-bold bg-emerald-600 text-white px-3 py-1.5 rounded-full">
                5時限制＋昼休み構成
              </span>
            </div>

            {/* 時間割グリッド */}
            <div className="overflow-x-auto bg-white rounded-xl shadow border border-slate-200">
              <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 text-sm">
                    <th className="py-3 px-3 w-28 text-center font-bold">時限 / 時間</th>
                    {DAYS.map((d) => (
                      <th key={d.key} className="py-3 px-3 text-center font-bold border-l border-slate-200">{d.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERIODS_CONFIG.map((p) => {
                    if (p.isLunch) {
                      return (
                        <tr key="lunch" className="bg-amber-50/60 border-b border-amber-200/60 text-amber-900 text-xs">
                          <td className="py-2 px-3 text-center font-bold bg-amber-100/50">
                            {p.name}<br /><span className="font-normal text-[10px]">{p.time}</span>
                          </td>
                          <td colSpan={5} className="py-2 text-center font-semibold tracking-widest text-amber-800">
                            🍱 昼休み（12:10 〜 13:00）
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={p.id} className="border-b border-slate-200 text-sm hover:bg-slate-50/50">
                        <td className="py-3 px-2 text-center font-bold bg-slate-50 text-slate-700 border-r border-slate-200">
                          <div className="text-base text-emerald-800">{p.name}</div>
                          <div className="text-[11px] text-slate-500 font-normal">{p.time}</div>
                        </td>
                        {DAYS.map((d) => {
                          const slotKey = `${d.key}_${p.id}`;
                          const course = timetable[slotKey] || '';
                          return (
                            <td
                              key={slotKey}
                              onClick={() => {
                                setEditingSlot(slotKey);
                                setEditingText(course);
                              }}
                              className="py-3 px-3 border-r border-slate-200 text-center cursor-pointer hover:bg-emerald-50/60 transition-colors h-20 align-top"
                            >
                              {course ? (
                                <div className="bg-emerald-100/80 text-emerald-900 p-2 rounded-lg font-bold text-xs shadow-sm border border-emerald-300">
                                  {course}
                                </div>
                              ) : (
                                <div className="text-slate-300 text-xs pt-4 font-light">＋ 登録</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 授業登録モーダル */}
            {editingSlot && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
                  <h3 className="text-lg font-bold text-slate-900">授業・コマ情報の編集</h3>
                  <p className="text-xs text-slate-500">選択スロット: {editingSlot}</p>
                  <input
                    type="text"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    placeholder="講義名（例: 情報科学演習）"
                    autoFocus
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingSlot(null)}
                      className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-300 cursor-pointer"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={saveTimetableSlot}
                      className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 shadow cursor-pointer"
                    >
                      保存する
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 2: 🎓 履修・卒業ナビAI（文理学部要覧基準 & 副専攻判定）
        ------------------------------------------------------------- */}
        {activeTab === 'academic' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 左側: ステータス設定フォーム */}
            <div className="bg-white rounded-xl shadow border border-slate-200 p-5 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 border-b pb-2">履修ステータス設定</h2>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">所属学科</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm font-semibold"
                >
                  {CHS_DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">学年</label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm font-semibold"
                  >
                    {[1, 2, 3, 4].map((g) => (
                      <option key={g} value={g}>{g}年次</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">副専攻/コース</label>
                  <select
                    value={selectedMinor}
                    onChange={(e) => setSelectedMinor(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm font-semibold"
                  >
                    {CHS_MINORS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-bold text-slate-600">区分別 取得単位数</h3>
                {[
                  { key: 'zengaku' as const, label: '全学共通 (必修2)' },
                  { key: 'sogo' as const, label: '総合教育 (必修12)' },
                  { key: 'gaikokugo' as const, label: '外国語教育 (必修8~18)' },
                  { key: 'kisho' as const, label: '基礎教育 (必修5)' },
                  { key: 'major_req' as const, label: '学科専門必修' },
                  { key: 'major_opt' as const, label: '学科専門選択' },
                  { key: 'free_opt' as const, label: '自由選択区分' },
                ].map((item) => (
                  <div key={item.key} className="flex justify-between items-center text-xs">
                    <span className="text-slate-600">{item.label}</span>
                    <input
                      type="number"
                      value={earnedCredits[item.key]}
                      onChange={(e) => setEarnedCredits({ ...earnedCredits, [item.key]: Number(e.target.value) })}
                      className="w-16 border border-slate-300 rounded p-1 text-right font-bold"
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={runDegreeCheck}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow transition-colors cursor-pointer"
              >
                🎓 卒業・副専攻AI判定を実行
              </button>
            </div>

            {/* 右側: AI判定結果 ＆ 進捗バー */}
            <div className="lg:col-span-2 space-y-6">
              {degreeResult ? (
                <div className="space-y-6">
                  {/* 全体達成度カード */}
                  <div className="bg-white rounded-xl shadow border border-slate-200 p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-bold text-slate-900">卒業要件達成度 ({degreeResult.department})</h3>
                      <span className="text-2xl font-black text-emerald-600">{degreeResult.progress_rate}%</span>
                    </div>

                    {/* 進捗バー */}
                    <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${degreeResult.progress_rate}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-center pt-2">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <span className="text-xs text-slate-500">取得済総単位</span>
                        <div className="text-xl font-bold text-slate-800">{degreeResult.total_earned} / 124 単位</div>
                      </div>
                      <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                        <span className="text-xs text-amber-700">残り必要単位数</span>
                        <div className="text-xl font-bold text-amber-800">{degreeResult.remaining_credits.total} 単位</div>
                      </div>
                    </div>
                  </div>

                  {/* AIアドバイスカード */}
                  <div className="bg-emerald-900 text-white rounded-xl p-6 shadow-md space-y-3">
                    <h4 className="font-bold text-emerald-200 text-sm flex items-center gap-2">🤖 AI履修アドバイザーの診断コメント</h4>
                    <p className="text-sm whitespace-pre-line leading-relaxed text-emerald-50">{degreeResult.ai_advice}</p>
                  </div>

                  {/* 未充足要件リスト */}
                  <div className="bg-white rounded-xl shadow border border-slate-200 p-6 space-y-3">
                    <h4 className="font-bold text-slate-900 text-sm">⚠️ 残り履修が必要な要件</h4>
                    {degreeResult.missing_requirements.length > 0 ? (
                      <ul className="space-y-2">
                        {degreeResult.missing_requirements.map((item: string, idx: number) => (
                          <li key={idx} className="text-xs bg-red-50 text-red-800 border border-red-200 p-2.5 rounded-lg flex items-center gap-2">
                            <span>•</span> {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-emerald-600 font-bold">🎉 基本必修要件はすべて達成しています！</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow border border-slate-200 p-12 text-center space-y-3">
                  <div className="text-4xl">🎓</div>
                  <h3 className="font-bold text-slate-800">履修・卒業判定を開始</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    左側のフォームで取得単位数を入力し、「卒業・副専攻AI判定を実行」を押すと、日本大学文理学部の要覧基準に基づき不足単位とAIアドバイスを生成します。
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 3: 🏛 施設営業時間案内AI
        ------------------------------------------------------------- */}
        {activeTab === 'facilities' && (
          <div className="space-y-6">
            {/* 検索入力 */}
            <div className="bg-white rounded-xl shadow border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">キャンパス施設 営業時間案内AI</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={facilityQuery}
                  onChange={(e) => setFacilityQuery(e.target.value)}
                  placeholder="例: 図書館, ラーニングコモンズ, 土曜日, 閉館時間"
                  className="flex-1 border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => searchFacilities()}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-lg shadow cursor-pointer"
                >
                  検索
                </button>
              </div>

              {/* クイック検索タグ */}
              <div className="flex flex-wrap gap-2 pt-1">
                {['図書館', 'ラーニング・コモンズ', 'コンピュータセンター', '教務課窓口', '資料館'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setFacilityQuery(tag);
                      searchFacilities(tag);
                    }}
                    className="text-xs bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 px-3 py-1.5 rounded-full border border-slate-200 transition-colors cursor-pointer"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>

            {/* AI自然言語応答 */}
            {facilityAiAnswer && (
              <div className="bg-slate-900 text-slate-100 rounded-xl p-5 shadow font-mono text-xs whitespace-pre-line leading-relaxed border-l-4 border-emerald-500">
                {facilityAiAnswer}
              </div>
            )}

            {/* 施設カードグリッド */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {facilityData.map((f) => (
                <div key={f.id} className="bg-white rounded-xl shadow border border-slate-200 p-5 space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded">
                      {f.category}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">{f.location}</span>
                  </div>
                  <h3 className="font-bold text-base text-slate-900">{f.name}</h3>

                  <div className="space-y-1 text-xs text-slate-600 border-t pt-3">
                    <div className="flex justify-between">
                      <span>月〜金 (平日):</span>
                      <span className="font-bold text-slate-800">{f.weekday}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>土曜日:</span>
                      <span className="font-bold text-slate-800">{f.saturday}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>日曜・祝日:</span>
                      <span className="font-bold text-red-600">{f.sunday_holiday}</span>
                    </div>
                  </div>

                  <p className="text-xs bg-amber-50 text-amber-900 p-2 rounded border border-amber-200 mt-2">
                    💡 {f.note}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 4: ⏰ スケジュール・課題管理 ＆ 通知
        ------------------------------------------------------------- */}
        {activeTab === 'schedules' && (
          <div className="space-y-6">
            {/* カウントダウン・通知バナー */}
            <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white rounded-xl p-6 shadow-md flex flex-wrap justify-between items-center gap-4">
              <div>
                <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Next Class Countdown</span>
                <h2 className="text-xl font-bold mt-1">次の授業 [3限: 情報科学演習] 開始まで あと 35分</h2>
              </div>
              <button
                type="button"
                onClick={toggleNotification}
                className={`px-4 py-2.5 rounded-lg font-bold text-xs shadow transition-colors cursor-pointer ${
                  pushEnabled ? 'bg-amber-500 text-white' : 'bg-white text-slate-800 hover:bg-slate-100'
                }`}
              >
                {pushEnabled ? '🔔 Web Push通知: 有効' : '🔕 ブラウザ通知を有効化'}
              </button>
            </div>

            {/* 新規課題追加 ＆ タスク一覧 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow border border-slate-200 p-5 space-y-4">
                <h3 className="font-bold text-sm text-slate-900">新しい予定・課題の登録</h3>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">件名</label>
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="例: 卒業論文要旨の提出"
                    className="w-full border border-slate-300 rounded p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">期日</label>
                  <input
                    type="date"
                    value={newTaskDate}
                    onChange={(e) => setNewTaskDate(e.target.value)}
                    className="w-full border border-slate-300 rounded p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">種別</label>
                  <select
                    value={newTaskType}
                    onChange={(e) => setNewTaskType(e.target.value)}
                    className="w-full border border-slate-300 rounded p-2 text-xs font-semibold"
                  >
                    <option value="task">📝 レポート・課題</option>
                    <option value="exam">✏️ テスト・試験</option>
                    <option value="event">🎉 イベント・行事</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!newTaskTitle) return;
                    setTasks([...tasks, {
                      id: String(Date.now()),
                      title: newTaskTitle,
                      date: newTaskDate || '2026-10-20',
                      period: 'コマ紐付けあり',
                      course_name: '関連科目',
                      type: newTaskType,
                      completed: false
                    }]);
                    setNewTaskTitle('');
                  }}
                  className="w-full py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 shadow cursor-pointer"
                >
                  登録する
                </button>
              </div>

              {/* タスクカード一覧 */}
              <div className="md:col-span-2 space-y-3">
                <h3 className="font-bold text-sm text-slate-900">登録済みスケジュール・課題一覧</h3>
                {tasks.map((t) => (
                  <div key={t.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          t.type === 'exam' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {t.type === 'exam' ? 'テスト' : '課題締切'}
                        </span>
                        <span className="text-xs text-slate-500">{t.date} ({t.period})</span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-800">{t.title}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTasks(tasks.filter((x) => x.id !== t.id))}
                      className="text-xs text-red-500 hover:text-red-700 font-bold px-2 py-1 cursor-pointer"
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 5: 👤 マイページ ＆ フレンド時間割共有
        ------------------------------------------------------------- */}
        {activeTab === 'mypage' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* プロフィール設定 */}
            <div className="bg-white rounded-xl shadow border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 border-b pb-2">マイプロフィール</h2>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-emerald-600 text-white rounded-full flex items-center justify-center font-black text-2xl shadow">
                  文
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{userName}</h3>
                  <p className="text-xs text-slate-500">{department} {grade}年次</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ユーザー名変更</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full border border-slate-300 rounded p-2 text-xs"
                />
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-1">
                <span className="text-xs text-slate-500 font-semibold">あなたのフレンド共有ID</span>
                <div className="font-mono font-bold text-emerald-800 text-lg">{myShareCode}</div>
                <p className="text-[11px] text-slate-400">友達にこのコードを教えると、空きコマを相互比較できます。</p>
              </div>
            </div>

            {/* フレンド時間割比較 */}
            <div className="bg-white rounded-xl shadow border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 border-b pb-2">フレンド時間割・空きコマ比較</h2>
              <p className="text-xs text-slate-500">友達の共有IDを入力して時間割の空き状況を比較します。</p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={friendCodeInput}
                  onChange={(e) => setFriendCodeInput(e.target.value)}
                  placeholder="例: ENE-1001"
                  className="flex-1 border border-slate-300 rounded p-2 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={compareFriend}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow cursor-pointer"
                >
                  照合・比較
                </button>
              </div>

              {friendComparison && (
                <div className="space-y-3 pt-2">
                  <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
                    <span className="text-xs text-emerald-800 font-bold">比較対象: {friendComparison.friend_name}</span>
                    <div className="text-sm font-black text-emerald-900 mt-1">
                      ✨ 空きコマ一致: 全 {friendComparison.common_free_count} コマ
                    </div>
                  </div>

                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {friendComparison.common_free_slots.map((slot, idx) => (
                      <div key={idx} className="text-xs bg-slate-50 p-2 rounded border border-slate-200 flex justify-between">
                        <span className="font-bold text-slate-700">{slot.day} {slot.period}</span>
                        <span className="text-emerald-600 font-semibold">互いに空きコマ（ラーニング・コモンズ利用可）</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
