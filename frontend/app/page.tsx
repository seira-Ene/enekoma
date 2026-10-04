'use client';

import React, { useState, useMemo } from 'react';

// ==========================================
// 1. 定義 ＆ マスターデータ
// ==========================================

const PERIODS_CONFIG = [
  { id: 1, name: '1限', time: '09:00 - 10:30' },
  { id: 2, name: '2限', time: '10:40 - 12:10' },
  { id: 'lunch', name: '昼休み', time: '12:10 - 13:00', isLunch: true },
  { id: 3, name: '3限', time: '13:00 - 14:30' },
  { id: 4, name: '4限', time: '14:40 - 16:10' },
  { id: 5, name: '5限', time: '16:20 - 17:50' },
];

const DAYS = [
  { key: 'mon', label: '月曜', short: '月' },
  { key: 'tue', label: '火曜', short: '火' },
  { key: 'wed', label: '水曜', short: '水' },
  { key: 'thu', label: '木曜', short: '木' },
  { key: 'fri', label: '金曜', short: '金' },
  { key: 'sat', label: '土曜', short: '土' },
];

const CHS_DEPARTMENTS = [
  '情報科学科', '国文学科', '英文学科', '哲学科', '史学科', '中国語中国文化学科',
  'ドイツ文学科', '社会学科', '社会福祉学科', '教育学科', '体育学科', '心理学科',
  '地理学科', '地球科学科', '数学科', '物理学科', '生命科学科', '化学科'
];

const CHS_MINORS = [
  'AI・データサイエンス副専攻',
  'グローバル主専攻・副専攻',
  '環境・サステナビリティ副専攻',
  '心身ウェルネス副専攻',
  '教職コース（中高免許）',
  '司書教諭コース',
  '司書コース',
  '学芸員コース',
  '社会教育主事コース',
  '日本語教育コース'
];

// 全学科共通6つのコース科目ガイドデータ
const SIX_COURSES_GUIDE = [
  {
    name: '教職コース',
    target: '中学校・高等学校教諭一種免許状（全学科共通）、特別支援学校教諭免許状（教育学科のみ）',
    window: '教職センター',
    windowColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: '各教科の専門指導法や教育実習を履修し、教員免許取得を目指すコース。',
    creditsRule: '修得単位は卒業に必要な「自由選択区分」に算入可能。※ただし「各教科教育法Ⅰ〜Ⅳ」「教育実習事前・事後指導」「教育実習Ⅰ・Ⅱ」「教職実践演習（中・高）」などの実習・実践系科目は、自由選択区分に算入できません。',
    gpaRule: '自由選択区分に算入可能なコース科目はすべてGPA算出対象に含まれます。',
    caution: '各学期始めに教職センターへ所定のコース履修届を提出して許可を得る必要があります。'
  },
  {
    name: '司書教諭コース',
    target: '学校図書館司書教諭資格の取得',
    window: '教職センター',
    windowColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: '小・中・高校等の学校図書館において読書指導や情報メディア活用を担う教諭資格。',
    creditsRule: '正規の手続きを経て修得したコース科目の単位は、卒業に必要な「自由選択区分」の単位として算入可能。',
    gpaRule: 'GPAの算出対象に含まれます。',
    caution: '教員免許状の取得が前提となります。教職センターへ申請届を提出してください。'
  },
  {
    name: '司書コース',
    target: '公共図書館等で勤務する司書資格の取得',
    window: '教務課',
    windowColor: 'bg-blue-100 text-blue-800 border-blue-300',
    description: '公共図書館や専門機関で図書・資料の収集・分類・情報サービスを提供する専門職員。',
    creditsRule: '修得単位は卒業に必要な「自由選択区分」に算入可能。',
    gpaRule: 'GPAの算出対象に含まれます。',
    caution: '申請先は教務課窓口です。受講にあたり配当年次・選考条件がある場合があります。'
  },
  {
    name: '学芸員コース',
    target: '博物館・美術館・資料館などで勤務する学芸員資格の取得',
    window: '教務課',
    windowColor: 'bg-blue-100 text-blue-800 border-blue-300',
    description: '文化遺産・学術資料の収集・保管・展示・調査研究を行う専門資格。文理学部資料館実習等あり。',
    creditsRule: '修得単位は卒業に必要な「自由選択区分」に算入可能。',
    gpaRule: 'GPAの算出対象に含まれます。',
    caution: '申請窓口は教務課です。3・4年次に文理学部資料館等での実習が課されます。'
  },
  {
    name: '社会教育主事コース',
    target: '地域社会教育の指導者（社会教育士等）に必要な資格取得',
    window: '教務課',
    windowColor: 'bg-blue-100 text-blue-800 border-blue-300',
    description: '公民館や生涯学習施設で市民の学習活動支援や地域コミュニティ形成をリードする専門職。',
    creditsRule: '修得単位は卒業に必要な「自由選択区分」に算入可能。',
    gpaRule: 'GPAの算出対象に含まれます。',
    caution: '各学期始めに教務課へコース履修届を提出してください。'
  },
  {
    name: '日本語教育コース',
    target: '国内外で日本語を教える日本語教員としての専門知識・技能の習得',
    window: '教務課',
    windowColor: 'bg-blue-100 text-blue-800 border-blue-300',
    description: '外国人留学生や海外での日本語教育に対応する理論・教授法・教育実習を体系的に学びます。',
    creditsRule: '修得単位は卒業に必要な「自由選択区分」に算入可能。',
    gpaRule: 'GPAの算出対象に含まれます。',
    caution: '申請窓口は教務課です。日本語学や異文化間教育の指定単位修得が必要です。'
  }
];

import { LECTURE_DATABASE, getCompactRoomLabel, LectureCourse } from './data/courses';

const ALL_CAMPUS_ROOMS = [
  '122', '123', '124', '125', '126', '130', '131', '132', '135',
  '3203', '3204', '3205', '3206',
  '3302', '3303', '3304', '3305', '3306', '3308',
  '3401', '3402', '3403', '3404', '3410',
  '3500', '3506',
  '411', '412', '421', '422', '431', '432', '441', '442', '443', '444'
];

// 施設デフォルトデータ
const DEFAULT_FACILITIES = [
  { id: 'library', name: '日本大学文理学部図書館', category: '図書・資料', weekday: '09:00 - 20:00', saturday: '09:00 - 19:00', sunday_holiday: '休館（授業なし日）', note: '地下書庫・貸出手続きは閉館30分前まで', location: '図書館棟' },
  { id: 'comp_center', name: 'コンピュータセンター（受付）', category: 'ICT・端末', weekday: '09:00 - 18:00', saturday: '09:00 - 13:00', sunday_holiday: '休業', note: 'アカウント・学内Wi-Fi問い合わせ対応', location: '3号館' },
  { id: 'museum', name: '日本大学文理学部資料館', category: '展示・文化', weekday: '10:00 - 17:00', saturday: '10:00 - 13:00', sunday_holiday: '休館', note: '入館無料 / 企画展示開催中', location: '8号館' },
  { id: 'learning_commons', name: 'ラーニング・コモンズ', category: '学習スペース', weekday: '08:00 - 18:00 (サポートデスク 10:00 - 18:00)', saturday: '08:00 - 17:00 (サポートデスク 09:00 - 13:00)', sunday_holiday: '休館', note: 'グループ学習・PC貸出・アカデミックコモンズ併設', location: '本館1階' },
  { id: 'academic_affairs', name: '事務窓口・教務課等', category: '各種手続き', weekday: '09:00 - 17:00', saturday: '09:00 - 13:00', sunday_holiday: '休み', note: '証明書自動発行機利用は閉口15分前まで / 教職コース届出は教職センターへ', location: '本館1階事務室' }
];

// 教室番号から詳細場所を瞬時に解析（構内ナビ互換）
function parseRoomDetail(room: string): string {
  const r = (room || '').trim().toUpperCase();
  if (!r) return '';
  if (['122', '123', '124'].includes(r)) return '1号館2F・階段登って左（左奥:女子トイレ）';
  if (['125', '126', '127A', '127B'].includes(r)) return '1号館2F・階段登って右（右手前:男子、右奥:女子）';
  if (r === '130') return '1号館3F・正面（左奥:男子、右奥:女子）';
  if (['131', '132', '133', '134'].includes(r)) return '1号館3F・階段登って左（左奥:男子トイレ）';
  if (['135', '136', '137A', '137B'].includes(r)) return '1号館3F・階段登って右（右奥:女子トイレ）';
  if (r === '411') return '4号館1F・正面入って左側（男子側 / 給水所あり）';
  if (r === '412') return '4号館1F・正面入って右側（女子側 / 給水所あり）';
  if (r === '421') return '4号館2F・左側（男子側）';
  if (r === '422') return '4号館2F・右側（女子側）';
  if (r === '431') return '4号館3F・右側（男子側）';
  if (r === '432') return '4号館3F・左側（女子側）';
  if (r.startsWith('3') && r.length === 4) {
    const floor = r[1];
    const sub = parseInt(r.slice(2), 10);
    if (sub >= 1 && sub <= 5) return `3号館${floor}F・エスカレーター右 (男子トイレ側)`;
    if (sub >= 6 && sub <= 10) return `3号館${floor}F・エスカレーター左 (女子トイレ側)`;
    return `3号館${floor}F`;
  }
  return '';
}

// 時間割コマデータ型
interface TimetableCell {
  subject: string;
  teacher?: string;
  room?: string;
}

// 集中講義型
interface IntensiveCourse {
  id: string;
  name: string;
  teacher: string;
  room: string;
  department?: string;
}

let globalIdCounter = 1000;
function getNextId(prefix: string = 'id'): string {
  globalIdCounter += 1;
  return `${prefix}_${globalIdCounter}`;
}

interface DegreeResult {
  department: string;
  total_earned: number;
  total_required: number;
  progress_rate: number;
  remaining_credits: {
    total: number;
    major_req?: number;
    zengaku?: number;
    sogo?: number;
    gaikokugo?: number;
    kisho?: number;
    major_opt?: number;
    [key: string]: number | undefined;
  };
  minor_status?: {
    name: string;
    earned_credits: number;
    required_credits: number;
    remaining_credits: number;
    window?: string;
    credit_rule?: string;
    gpa_rule?: string;
  };
  missing_requirements: string[];
  ai_advice: string;
}

interface FriendFreeSlot {
  day: string;
  period: string;
  key?: string;
}

interface FriendComparison {
  friend_name: string;
  friend_code?: string;
  common_free_count: number;
  common_free_slots: FriendFreeSlot[];
}

type ActiveTabType = 'timetable' | 'navigator' | 'academic' | 'facilities' | 'schedules' | 'mypage';
type ThemeColor = 'emerald' | 'blue' | 'purple' | 'amber';

export default function CampusNavigatorPage() {
  // タブ管理
  const [activeTab, setActiveTab] = useState<ActiveTabType>('timetable');

  // ① 年度・学期切り替え
  const [selectedYear, setSelectedYear] = useState('2026年度');
  const [selectedSemester, setSelectedSemester] = useState('前期');

  // ② 時間割ステート（年度・学期ごとに独立管理）
  const [timetable, setTimetable] = useState<Record<string, TimetableCell>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('enekoma_tt_2026年度_前期');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // 旧文字列形式との後方互換対応
          const converted: Record<string, TimetableCell> = {};
          Object.keys(parsed).forEach((k) => {
            if (typeof parsed[k] === 'string') {
              converted[k] = { subject: parsed[k] };
            } else {
              converted[k] = parsed[k];
            }
          });
          return converted;
        } catch {
          // ignore
        }
      }
    }
    return {
      mon_1: { subject: '細胞生物学1', teacher: '安原 徳子', room: '3306' },
      wed_3: { subject: '情報理論1', teacher: '古市 茂', room: '3308' },
      thu_2: { subject: 'データベース論', teacher: '杉本 雅弘', room: '3306' },
      fri_2: { subject: '健康・スポーツ教育実習', teacher: '本田 孝文', room: '体育館' },
    };
  });

  // 集中講義ステート
  const [intensiveList, setIntensiveList] = useState<IntensiveCourse[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('enekoma_intensive_2026年度_前期');
      if (saved) {
        try { return JSON.parse(saved); } catch { /* ignore */ }
      }
    }
    return [
      { id: '1', name: 'データサイエンスの世界', teacher: 'オンデマンド', room: '遠隔', department: '情報科学科/副専攻' },
      { id: '2', name: '恐竜学', teacher: '藤原 慎一', room: '3410', department: '地球科学科' }
    ];
  });

  // コマ登録／検索モーダルステート
  const [modalTarget, setModalTarget] = useState<{ day: string; dayLabel: string; period: number | 'lunch' | '集中' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [manualSubject, setManualSubject] = useState('');
  const [manualTeacher, setManualTeacher] = useState('');
  const [manualRoom, setManualRoom] = useState('');
  const [colorTheme, setColorTheme] = useState<ThemeColor>('emerald');

  // ③ リアルタイム空き教室案内 ステート & 計算
  const [freeRoomDay, setFreeRoomDay] = useState<string>(() => {
    if (typeof window === 'undefined') return '月';
    const now = new Date();
    const dayMap = ['日', '月', '火', '水', '木', '金', '土'];
    const currentD = dayMap[now.getDay()];
    return currentD !== '日' ? currentD : '月';
  });

  const [freeRoomPeriod, setFreeRoomPeriod] = useState<number>(() => {
    if (typeof window === 'undefined') return 2;
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeVal = hours * 60 + minutes;
    if (timeVal < 10 * 60 + 30) return 1;
    if (timeVal < 12 * 60 + 10) return 2;
    if (timeVal < 14 * 60 + 30) return 3;
    if (timeVal < 16 * 60 + 10) return 4;
    return 5;
  });

  const [bubbleExpanded, setBubbleExpanded] = useState<boolean>(false);
  const [isBubbleDismissed, setIsBubbleDismissed] = useState<boolean>(false);

  // 選択されたコマでの空き教室を算出
  const freeRooms = useMemo(() => {
    const occupied = LECTURE_DATABASE
      .filter((c) => c.day === freeRoomDay && c.period === freeRoomPeriod)
      .map((c) => c.room);
    return ALL_CAMPUS_ROOMS.filter((r) => !occupied.includes(r));
  }, [freeRoomDay, freeRoomPeriod]);

  // ④ 構内ナビAI ステート
  const [navQuery, setNavQuery] = useState('');
  const [navMessages, setNavMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string }>>([
    {
      sender: 'ai',
      text: '🤖 こんにちは！日本大学文理学部 構内ナビゲーターAIです。\n教室の場所（例: 3402, 411, 124）、トイレや給水所の位置、自販機の商品（レッドブル、モンスター等）や価格・クレカ決済方法などを質問してください！'
    }
  ]);

  // ⑤ 履修・卒業ナビ ステート
  const [department, setDepartment] = useState('情報科学科');
  const [grade, setGrade] = useState(2);
  const [selectedMinor, setSelectedMinor] = useState('AI・データサイエンス副専攻');
  const [earnedCredits, setEarnedCredits] = useState({
    zengaku: 2, sogo: 8, gaikokugo: 8, kisho: 5, major_req: 18, major_opt: 12, free_opt: 8
  });
  const [degreeResult, setDegreeResult] = useState<DegreeResult | null>(null);

  // ⑥ 施設営業時間 ステート
  const [facilityQuery, setFacilityQuery] = useState('');
  const [facilityData, setFacilityData] = useState<typeof DEFAULT_FACILITIES>(DEFAULT_FACILITIES);
  const [facilityAiAnswer, setFacilityAiAnswer] = useState('');

  // ⑦ スケジュール ＆ 通知 ステート
  const [pushEnabled, setPushEnabled] = useState(false);
  const [tasks, setTasks] = useState([
    { id: '1', title: '情報科学演習 レポート提出', date: '2026-10-09', period: '3限', course_name: '情報科学演習', type: 'task' },
    { id: '2', title: 'データ構造 中間テスト', date: '2026-10-15', period: '2限', course_name: 'データ構造', type: 'exam' }
  ]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskType, setNewTaskType] = useState('task');

  // ⑧ マイページ ＆ フレンド共有 ステート
  const [userName, setUserName] = useState('文理 太郎');
  const [myShareCode] = useState('ENE-7829-CHS');
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [friendComparison, setFriendComparison] = useState<FriendComparison | null>(null);

  // 年度・学期変更ハンドラ
  const handleTermChange = (newYear: string, newSemester: string) => {
    setSelectedYear(newYear);
    setSelectedSemester(newSemester);
    if (typeof window !== 'undefined') {
      const storageKey = `enekoma_tt_${newYear}_${newSemester}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const converted: Record<string, TimetableCell> = {};
          Object.keys(parsed).forEach((k) => {
            if (typeof parsed[k] === 'string') converted[k] = { subject: parsed[k] };
            else converted[k] = parsed[k];
          });
          setTimetable(converted);
        } catch {
          setTimetable({});
        }
      } else {
        setTimetable({});
      }

      const intensiveKey = `enekoma_intensive_${newYear}_${newSemester}`;
      const savedIntensive = localStorage.getItem(intensiveKey);
      if (savedIntensive) {
        try { setIntensiveList(JSON.parse(savedIntensive)); } catch { setIntensiveList([]); }
      } else {
        setIntensiveList([]);
      }
    }
  };

  // ワンタップ登録モーダルを開く
  const openClassModal = (day: string, dayLabel: string, period: number | 'lunch' | '集中') => {
    setModalTarget({ day, dayLabel, period });
    setSearchQuery('');
    setManualSubject('');
    setManualTeacher('');
    setManualRoom('');
  };

  // ワンタップ講義登録（サジェストから選択）
  const handleSelectLecture = (lecture: LectureCourse) => {
    if (!modalTarget) return;

    if (modalTarget.period === '集中') {
      const newIntensive: IntensiveCourse = {
        id: getNextId('int'),
        name: lecture.name,
        teacher: lecture.teacher,
        room: lecture.room,
        department: lecture.department
      };
      const updated = [...intensiveList, newIntensive];
      setIntensiveList(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`enekoma_intensive_${selectedYear}_${selectedSemester}`, JSON.stringify(updated));
      }
    } else {
      const slotKey = `${modalTarget.day}_${modalTarget.period}`;
      const updated = {
        ...timetable,
        [slotKey]: {
          subject: lecture.name,
          teacher: lecture.teacher,
          room: lecture.room
        }
      };
      setTimetable(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`enekoma_tt_${selectedYear}_${selectedSemester}`, JSON.stringify(updated));
      }
    }
    setModalTarget(null);
  };

  // 手動入力登録
  const handleManualSave = () => {
    if (!modalTarget || !manualSubject.trim()) return;

    if (modalTarget.period === '集中') {
      const newIntensive: IntensiveCourse = {
        id: getNextId('int'),
        name: manualSubject.trim(),
        teacher: manualTeacher.trim(),
        room: manualRoom.trim()
      };
      const updated = [...intensiveList, newIntensive];
      setIntensiveList(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`enekoma_intensive_${selectedYear}_${selectedSemester}`, JSON.stringify(updated));
      }
    } else {
      const slotKey = `${modalTarget.day}_${modalTarget.period}`;
      const updated = {
        ...timetable,
        [slotKey]: {
          subject: manualSubject.trim(),
          teacher: manualTeacher.trim(),
          room: manualRoom.trim()
        }
      };
      setTimetable(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`enekoma_tt_${selectedYear}_${selectedSemester}`, JSON.stringify(updated));
      }
    }
    setModalTarget(null);
  };

  // コマ削除
  const handleRemoveSlot = (slotKey: string) => {
    const updated = { ...timetable };
    delete updated[slotKey];
    setTimetable(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`enekoma_tt_${selectedYear}_${selectedSemester}`, JSON.stringify(updated));
    }
  };

  // 集中講義削除
  const handleRemoveIntensive = (id: string) => {
    const updated = intensiveList.filter((x) => x.id !== id);
    setIntensiveList(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`enekoma_intensive_${selectedYear}_${selectedSemester}`, JSON.stringify(updated));
    }
  };

  // モーダル検索でのフィルタリング講義一覧
  const filteredLectures = useMemo(() => {
    if (!modalTarget) return [];
    const q = searchQuery.toLowerCase().trim();
    return LECTURE_DATABASE.filter((c) => {
      const matchPeriod = modalTarget.period === '集中' ? c.day === '集中' : (c.day === modalTarget.dayLabel.replace('曜', '') && c.period === modalTarget.period);
      const matchQ = !q || c.name.toLowerCase().includes(q) || c.teacher.toLowerCase().includes(q) || c.room.toLowerCase().includes(q) || (c.department && c.department.toLowerCase().includes(q));
      return matchPeriod && matchQ;
    });
  }, [modalTarget, searchQuery]);

  // 構内ナビ チャット送信
  // クライアント側ナビゲーター即時判定（オフライン・フェイルセーフ対応）
  const getClientNavigatorReply = (rawQ: string): string => {
    const q = rawQ.trim();
    const qLower = q.toLowerCase();

    // 1. 価格帯検索
    const rangeMatch = q.match(/(\d{2,3})\s*[-~〜]\s*(\d{2,3})\s*円?/);
    const exactMatch = q.match(/(\d{2,3})\s*円/);
    const underMatch = q.match(/(\d{2,3})\s*円?\s*(以下|未満)/);

    let minP: number | null = null;
    let maxP: number | null = null;
    if (rangeMatch) {
      minP = parseInt(rangeMatch[1], 10);
      maxP = parseInt(rangeMatch[2], 10);
    } else if (underMatch) {
      minP = 0;
      maxP = parseInt(underMatch[1], 10);
    } else if (exactMatch) {
      minP = parseInt(exactMatch[1], 10);
      maxP = minP;
    } else if (['安い', '最安', '格安'].some((k) => q.includes(k))) {
      minP = 0;
      maxP = 100;
    } else if (/^\d{2,3}$/.test(q)) {
      const val = parseInt(q, 10);
      if ([80, 90, 100, 110, 120, 130, 140, 150, 170, 180, 190].includes(val)) {
        minP = val;
        maxP = val;
      }
    }

    if (minP !== null && maxP !== null) {
      if (minP <= 80 && maxP >= 80) {
        return (
          `【${minP === maxP ? `${minP}円` : `${minP}〜${maxP}円`}で買える商品】\n\n` +
          `■ 4号館 1階（サントリー自販機 / ジハンピ）:\n` +
          `・サントリー天然水 (80円) (上段・最安！)\n` +
          `・ZONe スカッと透明 (80円) (中段・激安エナジー)\n\n` +
          `■ 3号館 1階（食堂側・サントリー白・水メイン）:\n` +
          `・サントリー天然水 (80円)\n\n` +
          `■ 3号館 1階（食堂側・サントリー青）:\n` +
          `・ZONe NOPE (80円)`
        );
      }
      return (
        `【${minP === maxP ? `${minP}円` : `${minP}〜${maxP}円`}で買える商品】\n\n` +
        `■ 4号館 1階（サントリー / ジハンピ）:\n` +
        `・やさしい麦茶 (90円)、マウンテンデュー (100円)、デカビタC GABA (100円)、伊右衛門 焙じ茶 (100円)、伊右衛門 緑茶 (110円)、リプトン 白の贅沢ミルクティー (110円)\n\n` +
        `■ 3号館 1階（サントリー白・青・コカコーラ赤）:\n` +
        `・ぷるぷるプリン缶 (100円)、レモンスカッシュ (100円)、ペプシコーラ生 (100円)、い・ろ・は・す (100〜110円)、綾鷹 (110円)、リアルゴールド (110〜120円)`
      );
    }

    // 2. 設備検索
    if (['給水', '冷水機', 'ウォーターサーバー'].some((k) => qLower.includes(k))) {
      return (
        `【構内 給水所（冷水機）のご案内】\n` +
        `・**4号館 1階 エントランスホールのみ使用可能**！マイボトルへの給水が可能です。\n` +
        `⚠️ 注意: 4号館の2階〜4階の給水所は現在使用不可となっています。1階をご利用ください。`
      );
    }

    if (['ゴミ箱', 'ごみ箱', 'ゴミ', 'ごみ'].some((k) => qLower.includes(k))) {
      return (
        `【ゴミ箱の設置場所】\n` +
        `・1号館：各階に設置\n` +
        `・3号館：各階に設置\n` +
        `・4号館：各階トイレ前に設置\n` +
        `⚠️ 注意: **2号館内にはゴミ箱および自動販売機は設置されていません**。他号館をご利用ください。`
      );
    }

    if (['トイレ', 'お手洗い', '化粧室', '便所'].some((k) => qLower.includes(k))) {
      return (
        `【トイレ位置関係ガイド】\n` +
        `■ 1号館: 1F〜3Fに設置（⚠️4階・5階にはトイレがありませんので2F/3Fをご利用ください）\n` +
        `■ 3号館: 下2桁01〜05＝男子トイレ側（エスカレーター右/EV左）、06〜10＝女子トイレ側（エスカレーター左/EV右）\n` +
        `■ 4号館: 各階トイレ前にゴミ箱あり（1F左男子/右女子、2F左男子/右女子、3F右男子/左女子、4F右男子/左女子）`
      );
    }

    if (['クレカ', 'クレジットカード', 'タッチ決済', 'コンタクトレス'].some((k) => qLower.includes(k))) {
      return (
        `【クレジットカード（タッチ決済）が使える自販機】\n` +
        `・場所: 3号館 1階（食堂側・コカ・コーラ赤自販機）\n` +
        `・決済アプリ: Coke ON（Coke ON Pay）\n` +
        `・対応カード: Visa、Mastercard 等のクレジットカードタッチ決済に対応しています！`
      );
    }

    if (['paypay', 'ペイペイ', '交通系ic', 'suica', 'pasmo', 'ジハンピ', 'coke on', '決済', '支払い'].some((k) => qLower.includes(k))) {
      return (
        `【自動販売機の決済方法・対応アプリ一覧】\n` +
        `■ 4号館 1階 サントリー自販機:\n` +
        `・アプリ: ジハンピ（PayPay〇、交通系ICモバイル〇、※物理カード直タッチ×、現金〇）\n\n` +
        `■ 3号館 1階 サントリー自販機（計3台）:\n` +
        `・アプリ: ジハンピ（PayPay〇、交通系ICモバイル〇、※物理カード直タッチ×、現金〇）\n\n` +
        `■ 3号館 1階 コカ・コーラ赤自販機:\n` +
        `・アプリ: Coke ON（クレカタッチ決済〇、PayPay〇、交通系ICモバイル〇、現金〇）`
      );
    }

    // 3. 教室番号直接入力
    const roomMatch = q.match(/([1-4]\d{2,3}[a-zA-Z]?)/);
    if (roomMatch) {
      const r = roomMatch[1].toUpperCase();
      let shortLabel = `${r}`;
      let detail = '';

      if (r === '411') {
        shortLabel = '4号館411(男子側)';
        detail = '4号館411教室は 4号館 1階 です。正面を入って左側（男子トイレ側）にあります。給水所（冷水機）が利用可能です。トイレ前にゴミ箱が設置されています。';
      } else if (r === '412') {
        shortLabel = '4号館412(女子側)';
        detail = '4号館412教室は 4号館 1階 です。正面を入って右側（女子トイレ側）にあります。給水所（冷水機）が利用可能です。トイレ前にゴミ箱が設置されています。';
      } else if (r === '421') {
        shortLabel = '4号館421(男子側)';
        detail = '4号館421教室は 4号館 2階 です。階段を登って左側（男子トイレ側）にあります。トイレ前にゴミ箱が設置されています。（※給水所は1階のみ使用可）';
      } else if (r === '422') {
        shortLabel = '4号館422(女子側)';
        detail = '4号館422教室は 4号館 2階 です。階段を登って右側（女子トイレ側）にあります。トイレ前にゴミ箱が設置されています。（※給水所は1階のみ使用可）';
      } else if (r === '431') {
        shortLabel = '4号館431(男子側)';
        detail = '4号館431教室は 4号館 3階 です。階段を登って右側（男子トイレ側）にあります。トイレ前にゴミ箱が設置されています。（※給水所は1階のみ使用可）';
      } else if (r === '432') {
        shortLabel = '4号館432(女子側)';
        detail = '4号館432教室は 4号館 3階 です。階段を登って左側（女子トイレ側）にあります。トイレ前にゴミ箱が設置されています。（※給水所は1階のみ使用可）';
      } else if (r === '441') {
        shortLabel = '4号館441(男子側)';
        detail = '4号館441教室は 4号館 4階 です。階段を登って右側奥（男子トイレ側・奥）にあります。手前が442教室です。トイレ前にゴミ箱が設置されています。（※給水所は1階のみ使用可）';
      } else if (r === '442') {
        shortLabel = '4号館442(男子側)';
        detail = '4号館442教室は 4号館 4階 です。階段を登って右側手前（男子トイレ側・手前）にあります。奥が441教室です。トイレ前にゴミ箱が設置されています。（※給水所は1階のみ使用可）';
      } else if (r === '443') {
        shortLabel = '4号館443(女子側)';
        detail = '4号館443教室は 4号館 4階 です。階段を登って左側手前（女子トイレ側・手前）にあります。奥が444教室です。トイレ前にゴミ箱が設置されています。（※給水所は1階のみ使用可）';
      } else if (r === '444') {
        shortLabel = '4号館444(女子側)';
        detail = '4号館444教室は 4号館 4階 です。階段を登って左側奥（女子トイレ側・奥）にあります。手前が443教室です。トイレ前にゴミ箱が設置されています。（※給水所は1階のみ使用可）';
      } else if (r.startsWith('3') && r.length === 4) {
        const fl = r[1];
        const sub = parseInt(r.slice(2), 10);
        const subStr = r.slice(1);
        const side = sub >= 1 && sub <= 5 ? '男子側' : sub >= 6 && sub <= 10 ? '女子側' : '中央';
        shortLabel = `3号館${fl}${sub.toString().padStart(2, '0')}(${side})`;
        detail = `3号館${subStr}教室は 3号館 ${fl}階 です。エスカレーターを出て${sub <= 5 ? '右側（エレベーターを出て左側）の 男子トイレ側' : '左側（エレベーターを出て右側）の 女子トイレ側'} にあります。ゴミ箱は各階に設置されています。`;
      } else if (['122', '123', '124'].includes(r)) {
        shortLabel = `1号館${r}(左側)`;
        detail = `1号館${r}教室は 1号館 2階 です。階段を登って左側（奥に女子トイレ）にあります。ゴミ箱は各階に設置されています。`;
      } else if (['125', '126', '127A', '127B'].includes(r)) {
        shortLabel = `1号館${r}(右側)`;
        detail = `1号館${r}教室は 1号館 2階 です。階段を登って右側（手前に男子トイレ、奥に女子トイレ）にあります。ゴミ箱は各階に設置されています。`;
      } else if (r === '130') {
        shortLabel = '1号館130(正面)';
        detail = '1号館130教室は 1号館 3階 です。階段を登って正面にあります（左奥に男子トイレ、右奥に女子トイレ）。ゴミ箱は各階に設置されています。';
      } else if (['131', '132', '133', '134', '138'].includes(r)) {
        shortLabel = `1号館${r}(左側)`;
        detail = `1号館${r}教室は 1号館 3階 です。階段を登って左側（奥に男子トイレ）にあります。ゴミ箱は各階に設置されています。`;
      } else if (['135', '136', '137A', '137B', '139'].includes(r)) {
        shortLabel = `1号館${r}(右側)`;
        detail = `1号館${r}教室は 1号館 3階 です。階段を登って右側（奥に女子トイレ）にあります。ゴミ箱は各階に設置されています。`;
      } else if (r === '141') {
        shortLabel = '1号館141(4F)';
        detail = '1号館141教室は 1号館 4階 です。階段を登って正面にあります。※注意：1号館の4階・5階にはトイレがありませんので、2階または3階のトイレをご利用ください。';
      } else if (r === '151') {
        shortLabel = '1号館151(5F)';
        detail = '1号館151教室は 1号館 5階 です。階段を登って正面にあります。※注意：1号館の4階・5階にはトイレがありませんので、2階または3階のトイレをご利用ください。';
      } else {
        shortLabel = r.slice(0, 12);
        detail = `${r}教室はキャンパス構内にあります。詳細は各号館のフロア案内板をご確認ください。`;
      }

      return `表示用：${shortLabel}\n詳細案内：${detail}`;
    }

    // 4. 商品名検索
    if (['コーラ', 'ペプシ', 'coca', 'pepsi'].some((k) => qLower.includes(k))) {
      return (
        `【コカ・コーラ（140円）】\n` +
        `場所：3号館 1階（食堂側・コカ・コーラ赤自販機）\n` +
        `決済：Coke ON（PayPay、交通系IC）、クレジットカードタッチ決済\n\n` +
        `【ペプシコーラ生（100円）】\n` +
        `場所：3号館 1階（食堂側・サントリー青自販機）\n` +
        `決済：ジハンピ（PayPay、交通系IC）`
      );
    }

    if (['レッドブル', 'red bull', 'redbull'].some((k) => qLower.includes(k))) {
      return (
        `【レッドブル（170円）】※学内格安！\n` +
        `・4号館 1階（サントリー自販機 中段）/ アプリ：ジハンピ\n` +
        `・3号館 1階（食堂側・白スポーツ/エナジー系自販機）/ アプリ：ジハンピ\n` +
        `・3号館 1階（食堂側・青自販機）/ アプリ：ジハンピ\n` +
        `決済：PayPay〇、交通系IC（モバイル）〇、※物理カード直タッチ×、現金〇`
      );
    }

    if (['天然水', 'いろはす', 'い・ろ・は・す'].some((k) => qLower.includes(k)) || qLower === '水' || qLower.includes('お水')) {
      return (
        `【サントリー天然水（80円）】※学内最安値！\n` +
        `場所：\n` +
        `・4号館 1階（サントリー自販機 上段）\n` +
        `・3号館 1階（食堂側・サントリー白・水メイン自販機）\n` +
        `決済：アプリ「ジハンピ」連携（PayPay、モバイル交通系IC、現金）\n\n` +
        `【い・ろ・は・す（100〜110円）】\n` +
        `場所：3号館 1階（食堂側・コカ・コーラ赤自販機）\n` +
        `決済：Coke ON（PayPay、モバイル交通系IC）、クレジットカードタッチ決済`
      );
    }

    return (
      `【キャンパス構内ナビゲーターAI】\n` +
      `教室番号（3505、421、124等）、自販機商品（コーラ、レッドブル、天然水等）、価格帯（80円、100~110円等）、設備（給水所、ゴミ箱、トイレ、クレカ決済）について直接入力すると即座にご案内します。\n\n` +
      `質問例:\n` +
      `• 「3505」または「421」\n` +
      `• 「コーラ」または「レッドブル」\n` +
      `• 「80円」または「100~110円」\n` +
      `• 「給水所」または「ゴミ箱」\n` +
      `• 「クレカ」または「PayPay」`
    );
  };

  // 構内ナビ チャット送信
  const handleSendNav = async (overrideQ?: string) => {
    const query = overrideQ || navQuery;
    if (!query.trim()) return;

    const newMessages = [...navMessages, { sender: 'user' as const, text: query }];
    setNavMessages(newMessages);
    if (!overrideQ) setNavQuery('');

    try {
      const res = await fetch('/api/navigator/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      if (res.ok) {
        const data = await res.json();
        setNavMessages([...newMessages, { sender: 'ai', text: data.reply }]);
        return;
      }
    } catch {
      // ignore
    }

    // クライアント側フォールバック応答
    const reply = getClientNavigatorReply(query);
    setNavMessages([...newMessages, { sender: 'ai', text: reply }]);
  };

  // 時間割から単位数を自動計算
  const handleAutoCalculateCredits = () => {
    const registeredSubjects = [
      ...Object.values(timetable).map((c) => c.subject).filter(Boolean),
      ...intensiveList.map((c) => c.name).filter(Boolean),
    ];

    let zengaku = 0;
    let sogo = 0;
    let gaikokugo = 0;
    let kisho = 0;
    let major_req = 0;
    let major_opt = 0;
    const free_opt = earnedCredits.free_opt;

    registeredSubjects.forEach((sub) => {
      const s = sub.trim();
      if (s.includes('自主創造')) {
        zengaku += 2;
      } else if (['英語', '中国語', 'ドイツ語', 'フランス語', 'スペイン語', 'ロシア語', '韓国'].some((l) => s.includes(l))) {
        gaikokugo += 2;
      } else if (s.includes('情報リテラシー') || s.includes('健康・スポーツ')) {
        kisho += 2;
      } else if (s.includes('総合研究') || s.includes('データサイエンスの世界') || s.includes('キャリアデザイン')) {
        sogo += 2;
      } else if (department === '情報科学科') {
        const csReqList = ['基礎微分積分', '線形代数', '基礎プログラミング', '情報科学実習', 'データ構造', 'アルゴリズム', '情報理論', '情報科学研究'];
        if (csReqList.some((req) => s.includes(req))) {
          major_req += 2;
        } else {
          major_opt += 2;
        }
      } else {
        major_req += 2;
      }
    });

    const newCredits = {
      zengaku: Math.max(earnedCredits.zengaku, zengaku),
      sogo: Math.max(earnedCredits.sogo, sogo),
      gaikokugo: Math.max(earnedCredits.gaikokugo, gaikokugo),
      kisho: Math.max(earnedCredits.kisho, kisho),
      major_req: Math.max(earnedCredits.major_req, major_req),
      major_opt: Math.max(earnedCredits.major_opt, major_opt),
      free_opt: free_opt,
    };

    setEarnedCredits(newCredits);
    runDegreeCheck(newCredits, registeredSubjects);
  };

  // 卒業AI判定
  const runDegreeCheck = async (customCredits?: typeof earnedCredits, customTaken?: string[]) => {
    const creditsToUse = customCredits || earnedCredits;
    const takenCourses = customTaken || [
      ...Object.values(timetable).map((c) => c.subject).filter(Boolean),
      ...intensiveList.map((c) => c.name).filter(Boolean),
    ];

    try {
      const res = await fetch('/api/academic/degree-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department,
          grade: Number(grade),
          earned_credits: creditsToUse,
          selected_minor: selectedMinor,
          taken_courses: takenCourses
        })
      });
      if (res.ok) {
        const data = await res.json();
        setDegreeResult(data);
        return;
      }
    } catch {
      // ignore
    }

    // クライアント側フォールバック
    const totalEarned = Object.values(creditsToUse).reduce((a, b) => a + Number(b), 0);
    const progressRate = Math.min(100, Math.round((totalEarned / 124) * 100));
    setDegreeResult({
      department,
      total_earned: totalEarned,
      total_required: 124,
      progress_rate: progressRate,
      remaining_credits: { total: Math.max(0, 124 - totalEarned), major_req: Math.max(0, 38 - creditsToUse.major_req) },
      minor_status: { name: selectedMinor, earned_credits: 4, required_credits: 16, remaining_credits: 12 },
      missing_requirements: totalEarned < 124 ? [`全学共通または専門必修科目の残りがあります`] : [],
      ai_advice: `達成率は${progressRate}%です。${grade}年次として卒業論文・専門必修科目を優先して履修登録しましょう。`
    });
  };

  // 施設営業時間検索
  const searchFacilities = async (qText?: string) => {
    const q = qText !== undefined ? qText : facilityQuery;
    try {
      const res = await fetch(`/api/facilities/hours?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setFacilityData(data.facilities || DEFAULT_FACILITIES);
        setFacilityAiAnswer(data.ai_response || '');
        return;
      }
    } catch {
      // ignore
    }

    const filtered = DEFAULT_FACILITIES.filter((f) => !q || f.name.includes(q) || f.category.includes(q) || f.location.includes(q));
    setFacilityData(filtered.length ? filtered : DEFAULT_FACILITIES);
    setFacilityAiAnswer(`検索条件「${q || '全施設'}」の施設案内です。図書館は平日20:00まで、ラーニングコモンズは8:00〜18:00開館しています。`);
  };

  // フレンド時間割比較
  const compareFriend = async () => {
    if (!friendCodeInput) return;
    try {
      const res = await fetch('/api/friends/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friend_code: friendCodeInput, my_timetable: timetable })
      });
      if (res.ok) {
        const data = await res.json();
        setFriendComparison(data);
        return;
      }
    } catch {
      // ignore
    }

    setFriendComparison({
      friend_name: `サクラ (${friendCodeInput})`,
      common_free_count: 3,
      common_free_slots: [
        { day: '火曜', period: '1限' },
        { day: '木曜', period: '3限' },
        { day: '金曜', period: '4限' }
      ]
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24">
      {/* 画面上部ヘッダー */}
      <header className="bg-emerald-700 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black tracking-tight flex items-center gap-1.5">
              <span>⚡</span> EneKoma
            </span>
            <span className="text-xs bg-emerald-800/90 text-emerald-200 px-2.5 py-1 rounded-full border border-emerald-600 font-medium">
              日本大学文理学部 (CHS) 完全対応
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* 構内ナビAI クイック起動ボタン */}
            <button
              onClick={() => setActiveTab('navigator')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors border border-emerald-400"
            >
              <span>🧭</span>
              <span>校舎構内ナビ</span>
            </button>

            {/* 年度・学期セレクター */}
            <div className="flex items-center gap-2 bg-emerald-800/80 p-1 rounded-lg border border-emerald-600">
              <select
                value={selectedYear}
                onChange={(e) => handleTermChange(e.target.value, selectedSemester)}
                className="bg-white text-slate-800 text-xs font-bold py-1 px-2.5 rounded shadow-sm focus:outline-none"
              >
                <option value="2026年度">2026年度</option>
                <option value="2025年度">2025年度</option>
                <option value="2024年度">2024年度</option>
              </select>
              <select
                value={selectedSemester}
                onChange={(e) => handleTermChange(selectedYear, e.target.value)}
                className="bg-white text-slate-800 text-xs font-bold py-1 px-2.5 rounded shadow-sm focus:outline-none"
              >
                <option value="前期">前期</option>
                <option value="後期">後期</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* タブナビゲーション */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex overflow-x-auto gap-1">
          {[
            { id: 'timetable', label: '📅 時間割' },
            { id: 'navigator', label: '🧭 構内ナビ' },
            { id: 'academic', label: '🎓 履修・卒業ナビ' },
            { id: 'facilities', label: '🏛 施設営業時間' },
            { id: 'schedules', label: '⏰ スケジュール' },
            { id: 'mypage', label: '👤 マイページ / フレンド' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ActiveTabType)}
              className={`py-3 px-3.5 font-bold text-xs sm:text-sm border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50/60'
                  : 'border-transparent text-slate-600 hover:text-emerald-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 py-6">

        {/* -------------------------------------------------------------
            TAB 1: 📅 時間割（新時限時間・＋ワンタップ検索登録・集中講義）
        ------------------------------------------------------------- */}
        {activeTab === 'timetable' && (
          <div className="space-y-6">
            {/* 上部ステータスバー */}
            <div className="flex flex-wrap justify-between items-center bg-white border border-slate-200 rounded-xl p-4 shadow-sm gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>📅 時間割表</span>
                  <span className="text-emerald-700 font-extrabold text-sm">（{selectedYear} {selectedSemester}）</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  コマの「＋」を押すと講義名や先生の名前からワンタップで簡単登録できます。
                </p>
              </div>

              {/* テーマカラー選択 */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-semibold">カラー:</span>
                {[
                  { id: 'emerald', bg: 'bg-emerald-600' },
                  { id: 'blue', bg: 'bg-sky-600' },
                  { id: 'purple', bg: 'bg-purple-600' },
                  { id: 'amber', bg: 'bg-amber-600' }
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setColorTheme(c.id as ThemeColor)}
                    className={`w-5 h-5 rounded-full ${c.bg} transition-transform ${colorTheme === c.id ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'opacity-70 hover:opacity-100'}`}
                  />
                ))}
              </div>
            </div>

            {/* 時間割グリッド（月〜土 / 1〜5限 + 昼休み） */}
            <div className="overflow-x-auto bg-white rounded-xl shadow border border-slate-200">
              <table className="w-full min-w-[760px] border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 text-xs sm:text-sm">
                    <th className="py-3 px-2 w-28 text-center font-bold">時限 / 時間</th>
                    {DAYS.map((d) => (
                      <th key={d.key} className="py-3 px-2 text-center font-bold border-l border-slate-200">
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERIODS_CONFIG.map((p) => {
                    if (p.isLunch) {
                      return (
                        <tr key="lunch" className="bg-amber-50/70 border-b border-amber-200/60 text-amber-900 text-xs">
                          <td className="py-2 px-2 text-center font-bold bg-amber-100/60 border-r border-amber-200">
                            {p.name}<br /><span className="font-normal text-[10px] text-amber-800">{p.time}</span>
                          </td>
                          <td colSpan={6} className="py-2.5 text-center font-semibold tracking-wider text-amber-900">
                            🍱 昼休み（12:10 〜 13:00）食堂・ラーニングコモンズ利用可
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={p.id} className="border-b border-slate-200 text-sm hover:bg-slate-50/30">
                        <td className="py-3 px-2 text-center font-bold bg-slate-50 text-slate-700 border-r border-slate-200">
                          <div className="text-base text-emerald-800 font-black">{p.name}</div>
                          <div className="text-[10px] text-slate-500 font-normal">{p.time}</div>
                        </td>
                        {DAYS.map((d) => {
                          const slotKey = `${d.key}_${p.id}`;
                          const cell = timetable[slotKey];
                          const roomDetail = cell?.room ? parseRoomDetail(cell.room) : '';

                          return (
                            <td
                              key={slotKey}
                              className="py-2 px-2 border-r border-slate-200 text-center align-top h-24 relative group"
                            >
                              {cell && cell.subject ? (
                                <div className={`h-full rounded-lg p-2 flex flex-col justify-between text-left shadow-sm border transition-all ${
                                  colorTheme === 'blue' ? 'bg-sky-50 border-sky-300 text-sky-950' :
                                  colorTheme === 'purple' ? 'bg-purple-50 border-purple-300 text-purple-950' :
                                  colorTheme === 'amber' ? 'bg-amber-50 border-amber-300 text-amber-950' :
                                  'bg-emerald-50 border-emerald-300 text-emerald-950'
                                }`}>
                                  <div>
                                    <div className="flex justify-between items-start gap-1">
                                      <h4 className="font-bold text-xs leading-snug line-clamp-2">{cell.subject}</h4>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveSlot(slotKey);
                                        }}
                                        className="text-slate-400 hover:text-red-500 text-xs font-bold leading-none p-0.5"
                                        title="コマを削除"
                                      >
                                        ×
                                      </button>
                                    </div>
                                    {cell.teacher && (
                                      <p className="text-[11px] text-slate-600 mt-1 line-clamp-1">👤 {cell.teacher}</p>
                                    )}
                                  </div>

                                  {cell.room && (
                                    <div className="mt-1.5 flex items-center justify-between gap-1">
                                      <span
                                        className="inline-block bg-slate-800 text-white text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer truncate max-w-full hover:bg-slate-700 transition-colors"
                                        title={roomDetail ? `${cell.room}: ${roomDetail}` : `${cell.room}教室`}
                                        onClick={() => {
                                          setActiveTab('navigator');
                                          handleSendNav(`${cell.room}はどこ？`);
                                        }}
                                      >
                                        📍 {getCompactRoomLabel(cell.room)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <button
                                  onClick={() => openClassModal(d.key, d.label, p.id as number)}
                                  className="w-full h-full border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-slate-300 hover:text-emerald-600 hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors"
                                  title="講義をワンタップ登録"
                                >
                                  <span className="text-xl leading-none">＋</span>
                                  <span className="text-[10px] mt-0.5 font-medium">登録</span>
                                </button>
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

            {/* 集中講義・実習セクション */}
            <div className="bg-white rounded-xl shadow border border-slate-200 p-5 space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-3 border-b pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">☀️</span>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">集中講義・野外実習・オンデマンド科目</h3>
                    <p className="text-xs text-slate-500">不定期開講の集中講義や資格実習・オンデマンド授業を管理できます。</p>
                  </div>
                </div>
                <button
                  onClick={() => openClassModal('集中', '集中', '集中')}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  <span>＋</span>
                  <span>集中講義を追加</span>
                </button>
              </div>

              {intensiveList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {intensiveList.map((item) => (
                    <div key={item.id} className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3 relative flex flex-col justify-between">
                      <button
                        onClick={() => handleRemoveIntensive(item.id)}
                        className="absolute top-2 right-2 text-slate-400 hover:text-red-500 text-xs font-bold leading-none"
                      >
                        ×
                      </button>
                      <div>
                        <span className="text-[10px] font-bold bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded">
                          集中講義
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 mt-1 leading-snug">{item.name}</h4>
                        {item.teacher && (
                          <p className="text-xs text-slate-600 mt-1">👤 担当: {item.teacher}</p>
                        )}
                      </div>
                      <div className="mt-2 pt-2 border-t border-emerald-200/60 flex justify-between items-center text-xs">
                        <span className="text-[11px] text-emerald-800 font-semibold truncate max-w-[130px]" title={item.room}>
                          📍 {getCompactRoomLabel(item.room) || '学内/遠隔'}
                        </span>
                        {item.department && (
                          <span className="text-[10px] text-slate-500 truncate max-w-[110px]" title={item.department}>{item.department}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs">
                  登録された集中講義はありません。「＋ 集中講義を追加」から登録してください。
                </div>
              )}
            </div>

            {/* クイック検索・ワンタップ登録モーダル */}
            {modalTarget && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
                <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl max-h-[85vh] flex flex-col space-y-4">
                  <div className="flex justify-between items-center border-b pb-3">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                        <span>🔍 講義を選択してワンタップ登録</span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        対象: <strong className="text-emerald-700">{modalTarget.period === '集中' ? '集中講義' : `${modalTarget.dayLabel} ${modalTarget.period}限`}</strong>
                      </p>
                    </div>
                    <button
                      onClick={() => setModalTarget(null)}
                      className="text-slate-400 hover:text-slate-700 text-xl font-bold leading-none p-1"
                    >
                      ×
                    </button>
                  </div>

                  {/* インクリメンタル検索入力 */}
                  <div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="講義名、教授名、教室番号（例: 物理、安原、3306）を入力..."
                      className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm"
                      autoFocus
                    />
                  </div>

                  {/* 講義サジェスト一覧 */}
                  <div className="overflow-y-auto flex-1 max-h-60 space-y-2 pr-1">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      開講科目候補（全{filteredLectures.length}件・タップして即座に登録）:
                    </p>
                    {filteredLectures.length > 0 ? (
                      filteredLectures.map((lec, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleSelectLecture(lec)}
                          className="bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-400 rounded-xl p-3 cursor-pointer transition-all flex justify-between items-center group"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-slate-900 group-hover:text-emerald-800">
                                {lec.name}
                              </span>
                              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded truncate max-w-[140px]">
                                {lec.department}
                              </span>
                              {lec.semester && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                                  {lec.semester}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                              <span>👤 担当: {lec.teacher}</span>
                              <span className="font-semibold text-emerald-700">
                                📍 {getCompactRoomLabel(lec.room)}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                ({lec.day}{lec.period === 0 ? '集中' : `${lec.period}限`})
                              </span>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-emerald-600 bg-white border border-emerald-200 px-3 py-1.5 rounded-lg shadow-2xs group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                            登録
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        該当する講義が見つかりません。下の手動フォームから直接入力も可能です。
                      </div>
                    )}
                  </div>

                  {/* 手動入力アコーディオン */}
                  <div className="border-t pt-3 space-y-2">
                    <p className="text-[11px] font-bold text-slate-500">または手動で入力して登録:</p>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="科目名"
                        value={manualSubject}
                        onChange={(e) => setManualSubject(e.target.value)}
                        className="border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                      <input
                        type="text"
                        placeholder="教員名"
                        value={manualTeacher}
                        onChange={(e) => setManualTeacher(e.target.value)}
                        className="border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                      <input
                        type="text"
                        placeholder="教室 (例: 3402)"
                        value={manualRoom}
                        onChange={(e) => setManualRoom(e.target.value)}
                        className="border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {/* ボタン */}
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <button
                      onClick={() => setModalTarget(null)}
                      className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-300"
                    >
                      閉じる
                    </button>
                    <button
                      onClick={handleManualSave}
                      disabled={!manualSubject.trim()}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg shadow transition-colors"
                    >
                      手動入力で登録
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 2: 🧭 構内ナビ（教室番号解析・自販機・トイレ・ゴミ箱・給水）
        ------------------------------------------------------------- */}
        {activeTab === 'navigator' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 左側: チャット画面 */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow border border-slate-200 flex flex-col h-[600px]">
              <div className="p-4 border-b border-slate-200 bg-emerald-700 text-white rounded-t-xl flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <span>🧭</span> キャンパス構内ナビゲーターAI
                  </h3>
                  <p className="text-xs text-emerald-100">文理学部（1〜4号館）の教室、自販機、トイレ、給水所を案内します。</p>
                </div>
                <span className="text-[10px] bg-emerald-800 text-emerald-200 px-2.5 py-1 rounded-full border border-emerald-600">
                  オンライン
                </span>
              </div>

              {/* チャット履歴 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {navMessages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm whitespace-pre-line leading-relaxed shadow-sm ${
                        m.sender === 'user'
                          ? 'bg-emerald-600 text-white rounded-br-none'
                          : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* 質問サジェストチップ */}
              <div className="px-4 py-2 border-t border-slate-100 flex flex-wrap gap-1.5 bg-slate-50">
                {[
                  '3505',
                  '421',
                  'コーラ',
                  '80円',
                  '100~110円',
                  'クレカ',
                  '給水所',
                  'ゴミ箱',
                  'データ構造'
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSendNav(s)}
                    className="text-[11px] bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 px-2.5 py-1 rounded-full border border-slate-200 transition-colors shadow-2xs"
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* 入力フォーム */}
              <div className="p-3 border-t border-slate-200 flex gap-2">
                <input
                  type="text"
                  value={navQuery}
                  onChange={(e) => setNavQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendNav();
                  }}
                  placeholder="質問を入力（例: 3505、421、コーラ、80円、100~110円、給水所、クレカ）..."
                  className="flex-1 border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <button
                  onClick={() => handleSendNav()}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow transition-colors"
                >
                  送信
                </button>
              </div>
            </div>

            {/* 右側: キャンパス重要情報カード */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow border border-slate-200 p-5 space-y-3">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <span>🏢</span> 校舎番号の規則性
                </h4>
                <ul className="text-xs space-y-2 text-slate-600">
                  <li className="p-2 bg-slate-50 rounded-lg">
                    <strong className="text-slate-800">1号館 (3桁: 1〇〇)</strong>: 1桁目=1号館、2桁目=階数、3桁目=教室番号（※4F/5Fトイレなし）
                  </li>
                  <li className="p-2 bg-slate-50 rounded-lg">
                    <strong className="text-slate-800">3号館 (4桁: 3〇〇〇)</strong>: 1桁目=3号館、2桁目=階数。<br />
                    • 下2桁 <code className="bg-blue-100 text-blue-800 px-1 rounded">01〜05</code>: 男子トイレ側<br />
                    • 下2桁 <code className="bg-rose-100 text-rose-800 px-1 rounded">06〜10</code>: 女子トイレ側
                  </li>
                  <li className="p-2 bg-slate-50 rounded-lg">
                    <strong className="text-slate-800">4号館 (3桁: 4〇〇)</strong>: 1桁目=4号館、2桁目=階数。<br />
                    • <strong className="text-emerald-700">給水所は1階のみ利用可能</strong>
                  </li>
                </ul>
              </div>

              <div className="bg-emerald-900 text-white rounded-xl shadow p-5 space-y-2">
                <h4 className="font-bold text-sm text-emerald-200 flex items-center gap-1.5">
                  <span>💳</span> 自販機 ＆ 決済Tips
                </h4>
                <p className="text-xs text-emerald-50 leading-relaxed">
                  • <strong>クレカタッチ決済</strong>: 3号館1階 食堂側（赤のコカ・コーラ自販機）が対応。<br />
                  • <strong>PayPay決済</strong>: 3号館・4号館全自販機でアプリ（ジハンピ/Coke ON）連携で利用可能。<br />
                  • <strong>最安値80円〜</strong>: 4号館・3号館の天然水やZONeが80円！
                </p>
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 3: 🎓 履修・卒業ナビAI ＆ 全学科共通6コース科目詳細
        ------------------------------------------------------------- */}
        {activeTab === 'academic' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 左側: ステータス設定 */}
              <div className="bg-white rounded-xl shadow border border-slate-200 p-5 space-y-4">
                <h2 className="text-lg font-bold text-slate-900 border-b pb-2 flex items-center gap-2">
                  <span>🎓</span> 履修ステータス設定
                </h2>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">所属学科（全18学科対応）</label>
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
                    <label className="block text-xs font-bold text-slate-700 mb-1">副専攻 / 資格コース</label>
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

                <div className="space-y-2 pt-2 border-t">
                  <h3 className="text-xs font-bold text-slate-600">区分別 取得単位数（手入力）</h3>
                  {[
                    { key: 'zengaku', label: '全学共通 (必修2)' },
                    { key: 'sogo', label: '総合教育 (必修12)' },
                    { key: 'gaikokugo', label: '外国語教育 (必修8〜18)' },
                    { key: 'kisho', label: '基礎教育 (必修5)' },
                    { key: 'major_req', label: '学科専門必修' },
                    { key: 'major_opt', label: '学科専門選択' },
                    { key: 'free_opt', label: '自由選択区分（コース算入可）' },
                  ].map((item) => (
                    <div key={item.key} className="flex justify-between items-center text-xs">
                      <span className="text-slate-600">{item.label}</span>
                      <input
                        type="number"
                        value={earnedCredits[item.key as keyof typeof earnedCredits]}
                        onChange={(e) => setEarnedCredits({ ...earnedCredits, [item.key]: Number(e.target.value) })}
                        className="w-16 border border-slate-300 rounded p-1 text-right font-bold"
                      />
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAutoCalculateCredits}
                  className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-300 transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <span>📅</span>
                  <span>時間割の登録科目から単位数を自動計算</span>
                </button>

                <button
                  onClick={() => runDegreeCheck()}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow transition-colors"
                >
                  🎓 卒業・副専攻AI判定を実行
                </button>
              </div>

              {/* 右側: 判定結果 */}
              <div className="lg:col-span-2 space-y-6">
                {degreeResult ? (
                  <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow border border-slate-200 p-6 space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-slate-900">卒業要件達成度 ({degreeResult.department})</h3>
                        <span className="text-2xl font-black text-emerald-600">{degreeResult.progress_rate}%</span>
                      </div>

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
                          <div className="text-xl font-bold text-amber-800">{degreeResult.remaining_credits?.total ?? 0} 単位</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-emerald-900 text-white rounded-xl p-6 shadow-md space-y-3">
                      <h4 className="font-bold text-emerald-200 text-sm flex items-center gap-2">🤖 AIアドバイザーの診断コメント</h4>
                      <p className="text-sm whitespace-pre-line leading-relaxed text-emerald-50">{degreeResult.ai_advice}</p>
                    </div>

                    {degreeResult.missing_requirements && degreeResult.missing_requirements.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-2">
                        <h4 className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
                          <span>⚠️</span>
                          <span>不足している卒業・専攻要件</span>
                        </h4>
                        <ul className="text-xs space-y-1.5 text-amber-800 list-disc list-inside">
                          {degreeResult.missing_requirements.map((item, idx) => (
                            <li key={idx} className="leading-relaxed">{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {department === '情報科学科' && (
                      <div className="bg-white rounded-xl shadow border border-slate-200 p-5 space-y-4">
                        <div className="flex justify-between items-center border-b pb-2">
                          <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                            <span>💻</span>
                            <span>情報科学科 専門カリキュラム修得チェック</span>
                          </h4>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">令和8年度 時間割連動</span>
                        </div>
                        <p className="text-xs text-slate-500">
                          時間割（月〜土／集中）に登録されている講義は自動的に「✓ 登録済」としてハイライトされます。
                        </p>
                        <div>
                          <span className="text-xs font-bold text-emerald-800 block mb-2">■ 専門必修科目（13科目・卒業必須）</span>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              '基礎微分積分1', '基礎微分積分2', '線形代数1', '線形代数2',
                              '基礎プログラミング1', '基礎プログラミング2', '情報科学実習1', '情報科学実習2',
                              'データ構造', 'アルゴリズム', '情報理論1', '情報科学研究1', '情報科学研究2'
                            ].map((sub) => {
                              const isTaken = Object.values(timetable).some(c => c.subject?.includes(sub)) || intensiveList.some(c => c.name.includes(sub));
                              return (
                                <span
                                  key={sub}
                                  className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                                    isTaken
                                      ? 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold shadow-2xs'
                                      : 'bg-slate-50 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  {isTaken ? '✓ ' : ''}{sub}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <div className="pt-2 border-t">
                          <span className="text-xs font-bold text-sky-800 block mb-2">■ 専門選択科目（代表科目・選択必修含む）</span>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              'オブジェクト指向プログラミング', '離散数学', 'Webプログラミング',
                              'データベース', 'マルチメディア表現', 'データ科学1', 'データ科学2',
                              'コンピューティング1', 'コンピューティング2', '数理計画', '実践プログラミング1',
                              '情報理論2', '暗号理論', '情報可視化', 'オートマトンと形式言語'
                            ].map((sub) => {
                              const isTaken = Object.values(timetable).some(c => c.subject?.includes(sub)) || intensiveList.some(c => c.name.includes(sub));
                              return (
                                <span
                                  key={sub}
                                  className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                                    isTaken
                                      ? 'bg-sky-100 text-sky-900 border-sky-400 font-bold shadow-2xs'
                                      : 'bg-slate-50 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  {isTaken ? '✓ ' : ''}{sub}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow border border-slate-200 p-12 text-center space-y-3">
                    <div className="text-4xl">🎓</div>
                    <h3 className="font-bold text-slate-800">履修・卒業判定を開始</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      左側のフォームで取得単位数を入力し、「卒業・副専攻AI判定を実行」を押すと、学部要覧基準（124単位）に基づき不足単位とAIアドバイスを生成します。
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 全学科共通 6つのコース科目ガイド（詳細資料に基づく情報） */}
            <div className="bg-white rounded-xl shadow border border-slate-200 p-6 space-y-4">
              <div className="border-b pb-3">
                <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded">文理学部要覧</span>
                <h3 className="text-lg font-bold text-slate-900 mt-2">全学科共通 6つのコース科目 ＆ 申請窓口ガイド</h3>
                <p className="text-xs text-slate-500 mt-1">
                  各種資格の取得や専門領域の深化を目指す全学科共通コースです。各学期始めに所定の窓口へコース履修届を提出してください。
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {SIX_COURSES_GUIDE.map((c) => (
                  <div key={c.name} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2.5 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-bold text-sm text-slate-900">{c.name}</h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${c.windowColor}`}>
                          窓口: {c.window}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{c.description}</p>
                    </div>

                    <div className="space-y-1.5 text-[11px] pt-2 border-t border-slate-200">
                      <div className="bg-white p-2 rounded border border-slate-200">
                        <strong className="text-emerald-800">自由選択への算入:</strong>
                        <p className="text-slate-600 mt-0.5 leading-normal">{c.creditsRule}</p>
                      </div>
                      <div className="bg-white p-2 rounded border border-slate-200">
                        <strong className="text-blue-800">GPAへの反映:</strong>
                        <p className="text-slate-600 mt-0.5">{c.gpaRule}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 4: 🏛 施設営業時間案内AI
        ------------------------------------------------------------- */}
        {activeTab === 'facilities' && (
          <div className="space-y-6">
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
                  onClick={() => searchFacilities()}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-lg shadow"
                >
                  検索
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {['図書館', 'ラーニング・コモンズ', 'コンピュータセンター', '教務課窓口', '資料館'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      setFacilityQuery(tag);
                      searchFacilities(tag);
                    }}
                    className="text-xs bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 px-3 py-1.5 rounded-full border border-slate-200 transition-colors"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>

            {facilityAiAnswer && (
              <div className="bg-slate-900 text-slate-100 rounded-xl p-5 shadow font-mono text-xs whitespace-pre-line leading-relaxed border-l-4 border-emerald-500">
                {facilityAiAnswer}
              </div>
            )}

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
            TAB 5: ⏰ スケジュール ＆ 通知
        ------------------------------------------------------------- */}
        {activeTab === 'schedules' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white rounded-xl p-6 shadow-md flex flex-wrap justify-between items-center gap-4">
              <div>
                <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Next Class Countdown</span>
                <h2 className="text-xl font-bold mt-1">次の授業 [3限: 情報理論1] 開始まで あと 35分</h2>
              </div>
              <button
                onClick={() => {
                  if (!('Notification' in window)) {
                    alert('お使いのブラウザは通知に対応していません。');
                    return;
                  }
                  if (Notification.permission === 'granted') {
                    setPushEnabled(!pushEnabled);
                  } else {
                    Notification.requestPermission().then((p) => {
                      if (p === 'granted') {
                        setPushEnabled(true);
                        new Notification('EneKoma', { body: 'リマインダー通知が有効になりました。' });
                      }
                    });
                  }
                }}
                className={`px-4 py-2.5 rounded-lg font-bold text-xs shadow transition-colors ${
                  pushEnabled ? 'bg-amber-500 text-white' : 'bg-white text-slate-800 hover:bg-slate-100'
                }`}
              >
                {pushEnabled ? '🔔 Web Push通知: 有効' : '🔕 ブラウザ通知を有効化'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow border border-slate-200 p-5 space-y-4">
                <h3 className="font-bold text-sm text-slate-900">新しい予定・課題の登録</h3>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">件名</label>
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="例: 情報理論 レポート提出"
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
                  onClick={() => {
                    if (!newTaskTitle) return;
                    setTasks([...tasks, {
                      id: getNextId('task'),
                      title: newTaskTitle,
                      date: newTaskDate || '2026-10-20',
                      period: '3限',
                      course_name: '関連科目',
                      type: newTaskType
                    }]);
                    setNewTaskTitle('');
                  }}
                  className="w-full py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 shadow"
                >
                  登録する
                </button>
              </div>

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
                      onClick={() => setTasks(tasks.filter((x) => x.id !== t.id))}
                      className="text-xs text-red-500 hover:text-red-700 font-bold px-2 py-1"
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
            TAB 6: 👤 マイページ ＆ フレンド時間割共有
        ------------------------------------------------------------- */}
        {activeTab === 'mypage' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  onClick={compareFriend}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow"
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
                    {friendComparison.common_free_slots.map((slot: FriendFreeSlot, idx: number) => (
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

      {/* -------------------------------------------------------------
          リアルタイム空き教室 吹き出しウィジェット（画面右下固定）
      ------------------------------------------------------------- */}
      {!isBubbleDismissed && (
        <aside
          aria-label="空き教室案内ウィジェット"
          className="fixed bottom-5 right-5 z-40 max-w-sm w-full sm:w-auto animate-in slide-in-from-bottom duration-300"
        >
          <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-700/80 relative">
            {/* ウィジェットヘッダー */}
            <div className="flex justify-between items-center gap-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 text-base">💡</span>
                <span className="font-bold text-xs text-sky-400">今の時間の空き教室案内</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setBubbleExpanded(!bubbleExpanded)}
                  className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded bg-slate-800"
                >
                  {bubbleExpanded ? '縮小' : '詳細'}
                </button>
                <button
                  onClick={() => setIsBubbleDismissed(true)}
                  className="text-slate-400 hover:text-white text-sm leading-none p-1"
                  title="閉じる"
                >
                  ×
                </button>
              </div>
            </div>

            {/* 曜日・時限セレクター */}
            <div className="flex items-center gap-1.5 pt-2 text-[11px]">
              <span className="text-slate-400">表示時限:</span>
              <div className="flex gap-1 overflow-x-auto">
                {['月', '火', '水', '木', '金', '土'].map((d) => (
                  <button
                    key={d}
                    onClick={() => setFreeRoomDay(d)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${freeRoomDay === d ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <select
                value={freeRoomPeriod}
                onChange={(e) => setFreeRoomPeriod(Number(e.target.value))}
                className="bg-slate-800 text-emerald-300 font-bold px-1.5 py-0.5 rounded text-[10px] border border-slate-700 focus:outline-none"
              >
                {[1, 2, 3, 4, 5].map((p) => (
                  <option key={p} value={p}>{p}限</option>
                ))}
              </select>
            </div>

            {/* 空き教室の吹き出しメッセージ */}
            <div className="pt-2 text-xs leading-relaxed text-slate-200">
              <span>ただいま（<b>{freeRoomDay}曜 {freeRoomPeriod}限</b>）空いている教室:</span>
              <div className="mt-1 font-bold text-amber-300 text-sm tracking-wide">
                {freeRooms.slice(0, 6).join(', ')} など <span className="text-xs font-normal text-slate-300">（全{freeRooms.length}室）</span>
              </div>
            </div>

            {/* 詳細展開（号館別分類） */}
            {bubbleExpanded && (
              <div className="mt-3 pt-3 border-t border-slate-800 text-xs space-y-2 max-h-48 overflow-y-auto">
                <div>
                  <span className="text-[10px] font-bold text-emerald-400">■ 3号館の空き教室:</span>
                  <p className="text-slate-300 font-mono text-[11px] mt-0.5">
                    {freeRooms.filter((r) => r.startsWith('3')).join(', ') || '満室'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-sky-400">■ 4号館の空き教室:</span>
                  <p className="text-slate-300 font-mono text-[11px] mt-0.5">
                    {freeRooms.filter((r) => r.startsWith('4')).join(', ') || '満室'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-purple-400">■ 1号館の空き教室:</span>
                  <p className="text-slate-300 font-mono text-[11px] mt-0.5">
                    {freeRooms.filter((r) => r.startsWith('1')).join(', ') || '満室'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* 閉じたときの再表示フローティングボタン */}
      {isBubbleDismissed && (
        <button
          onClick={() => setIsBubbleDismissed(false)}
          className="fixed bottom-5 right-5 z-40 bg-slate-900 text-amber-400 border border-slate-700 p-3 rounded-full shadow-2xl hover:scale-105 transition-transform flex items-center gap-1.5 text-xs font-bold"
          title="空き教室案内を表示"
        >
          <span>💡</span>
          <span className="text-white hidden sm:inline">空き教室を見る</span>
        </button>
      )}

    </div>
  );
}
