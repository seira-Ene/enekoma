'use client';

import {
  VERIFIED_COURSES_CURRICULUM,
  VERIFIED_MINORS_CURRICULUM,
  getCourseCurriculum,
  getMinorCurriculum
} from '@/app/data/coursesAndMinorsCurriculum';
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  GAKUBU_YORAN_DEPARTMENTS,
  GAKUBU_YORAN_COURSES,
  GAKUBU_YORAN_ALL_24_MINORS,
  GAKUBU_YORAN_CAP_RULES,
  GAKUBU_YORAN_GPA_RULES,
  analyzeAcademicDeficiency,
  simulateGpaEngine,
  CourseRecord,
  EnrolledCourseItem,
  UserProfileData
} from '@/app/data/gakubuYoran';
import {
  findFreeRooms,
  getCompactRoomLabel
} from '@/app/data/courses';
import {
  StudentAccount,
  INITIAL_DEMO_ACCOUNTS,
  loadAllAccounts,
  saveStudentAccount,
  getCurrentStudent,
  setCurrentStudentId,
  rememberLogin,
  REMEMBER_LOGIN_DAYS,
  authenticateStudent,
  checkLocalPassword,
  isDemoAccountId,
  linkServerAccount,
  PASSWORD_MIN_LENGTH,
  registerNewStudent,
  parseProfileUpdateFromText,
  extractCompletedCoursesFromText
} from '@/app/data/studentAccounts';
import { callAccountApi, isServerUnavailable } from '@/app/data/accountClient';
import { prepareFileForUpload } from '@/app/data/imageUpload';
import { THEMES, ThemeId, applyTheme, readStoredTheme, saveTheme } from '@/app/data/themes';
import { calculateGpa, isEarnedGrade, isFailingGrade, isSameCourseName, normalizeGrade, resolveRetakes, sumEarnedCredits, toCourseRecord } from '@/app/data/courseGrades';
import type { GroupStatus } from '@/app/data/programProgress';

// メッセージ型定義
interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  shortLabel?: string;
  imagePreview?: string;
  imageTypeLabel?: string;
  source?: 'gemini' | 'local';
  model?: string;
  timestamp: string;
}

// ユーザープロフィール型定義
export interface UserProfile extends UserProfileData {
  completedCourses: CourseRecord[];
  enrolledCourses: EnrolledCourseItem[];
}

const DEFAULT_PROFILE: UserProfile = {
  admissionYear: 'reiwa7_or_later',
  department: '情報科学科',
  grade: 1,
  currentCredits: 0,
  currentGpa: 0.00,
  targetGpa: 0.00,
  semesterCredits: 0,
  selectedCourses: [],
  selectedMinors: [],
  enrolledCourses: [],
  completedCourses: []
};

// メンテナンス設定型
// 画像データを履歴に含めると保存容量（約5MB）をすぐ超えるので、保存時は取り除く
function withoutImagePreviews<T>(messages: T[]): T[] {
  return messages.map((message) => ({ ...message, imagePreview: undefined }));
}

// 保存に失敗しても画面を落とさない（履歴が残らないだけで利用は続けられる）
function saveChatHistory(messages: unknown[]): void {
  try {
    localStorage.setItem('enekoma_chat_history', JSON.stringify(messages));
  } catch (error) {
    console.warn('Failed to save chat history:', error);
  }
}

// メンテナンス設定の保存先に問題があるときに管理者へ伝える文言
function describeMaintenanceStorage(data: { persistent?: boolean; storageError?: boolean }): string | null {
  if (data.storageError) return '保存先に接続できません。表示中の設定は最新でない可能性があり、更新もできません。';
  if (data.persistent === false) return '保存先が未設定です。この設定は再デプロイやサーバーの再起動で元に戻ります。';
  return null;
}

interface MaintenanceConfig {
  isActive: boolean;
  startDateTime: string;
  endDateTime: string;
  startDisplay: string;
  endDisplay: string;
  targetServices: string;
  noticeMessage?: string;
  updatedAt?: string;
}

const CHS_DEPARTMENTS = Object.keys(GAKUBU_YORAN_DEPARTMENTS);

// 管理者画面に出すメール送信の記録（app/api/account/mailLog.ts の MailLogEntry と同じ形）
interface MailLogView {
  at: string;
  status: 'sent' | 'failed' | 'skipped';
  provider?: string;
  to: string;
  subject?: string;
  response?: string;
  detail?: string;
  reason?: string;
}

// コース・副専攻の科目群（a群から4単位以上、A又はB など）の達成状況
function RequirementGroups({ groups }: { groups: GroupStatus[] }) {
  if (groups.length === 0) return null;
  return (
    <ul className="space-y-1 text-[11px]">
      {groups.map((g) => (
        <li key={g.label} className={`flex items-start gap-1.5 ${g.met ? 'text-emerald-700' : 'text-amber-900'}`}>
          <span aria-hidden="true">{g.met ? '✓' : '・'}</span>
          <span>
            {g.label}
            {!g.met && g.shortfall && <span className="ml-1 font-bold">（{g.shortfall}）</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

// 要覧の注意書き
function RequirementNotes({ notes }: { notes?: string[] }) {
  if (!notes || notes.length === 0) return null;
  return (
    <ul className="space-y-1 text-[10px] leading-relaxed text-slate-500 list-disc pl-4">
      {notes.map((n) => <li key={n}>{n}</li>)}
    </ul>
  );
}

// 質問クイックチップ
interface QuickChip {
  label: string;
  query: string;
  category: 'rooms' | 'timetable' | 'academic' | 'campus';
}

const QUICK_CHIPS: QuickChip[] = [
  // 空き教室（曜日・時限別）
  { label: '月曜2限の空き教室', query: '月曜2限の空き教室を教えて', category: 'rooms' },
  { label: '火曜3限 3号館の空き教室', query: '火曜3限 3号館で空いている教室は？', category: 'rooms' },
  { label: '水曜4限の空き教室', query: '水曜4限の空き教室を教えて', category: 'rooms' },
  { label: '木曜の14:00〜空いてる教室', query: '木曜14時頃に使える空き教室は？', category: 'rooms' },
  { label: '金曜5限の空き教室', query: '金曜5限の空き教室を教えて', category: 'rooms' },
  { label: '421教室の利用状況', query: '421教室は何限に使われている？', category: 'rooms' },

  // 時間割・履修サポート
  { label: '時間割画像から履修中登録', query: '今期の時間割画像を読み取って、履修中科目に登録してください。', category: 'timetable' },
  { label: '過去の時間割から修得済み追加', query: '過去の時間割画像を読み取って、修得済み科目に追加してください。', category: 'timetable' },
  { label: '火曜3限の空きコマ科目', query: '火曜3限の空きコマにおすすめの科目は？', category: 'timetable' },
  { label: '必修を組んだ時間割作成', query: '必修科目を組み込んだおすすめ時間割を作って', category: 'timetable' },
  { label: '履修の重複チェック', query: '英語と情報リテラシーの時間が重複していないかチェックして', category: 'timetable' },
  { label: '3505→122教室（10分移動）', query: '3505教室から122教室へ10分で移動できる？', category: 'timetable' },

  // 履修要綱・単位・GPA
  { label: '卒業要件・不足科目の確認', query: '単位足りてる？不足している科目を教えて', category: 'academic' },
  { label: '目標GPA 3.0の目安計算', query: '目標GPA3.0にするには今期どうすればいい？', category: 'academic' },
  { label: '成績表を画像解析', query: '添付した成績通知書を読み取って、修得単位とGPAを反映してください。', category: 'academic' },
  { label: 'CAP制（年間40単位上限）', query: '年間で何単位まで履修登録できる？（CAP制ルール）', category: 'academic' },
  { label: '教職コースの要件・窓口', query: '教職コースの要件と申請窓口は？', category: 'academic' },
  { label: 'データサイエンス副専攻', query: 'データサイエンス副専攻の要件と科目は？', category: 'academic' },
  { label: '🔑 APIキー取得・設定', query: 'APIキーの取得方法と設定を教えて', category: 'academic' },

  // キャンパス・施設・自販機
  { label: '3306教室の場所', query: '3306', category: 'campus' },
  { label: '421教室の場所', query: '421', category: 'campus' },
  { label: 'クレカ対応の自販機', query: 'クレジットカードが使える自販機はどこ？', category: 'campus' },
  { label: '学内最安80円ドリンク', query: '80円の飲み物', category: 'campus' },
  { label: '図書館の開館時間', query: '図書館の営業時間は？', category: 'campus' },
  { label: 'コンピュータセンター', query: 'コンピュータセンターは何時まで？', category: 'campus' },
  { label: '教務課窓口の受付時間', query: '教務課の受付時間は？', category: 'campus' },
  { label: '給水所・ゴミ箱の場所', query: '給水所とゴミ箱の場所を教えて', category: 'campus' },
];

export default function UnifiedAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 添付ファイル（画像・PDF・CSV・文書などすべてのファイル形式に対応）
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    size: number;
    mimeType: string;
    data: string; // base64
    previewUrl?: string;
    fileType: 'image' | 'pdf' | 'csv' | 'document';
    imageType: 'current_timetable' | 'past_timetable' | 'transcript' | 'auto';
  } | null>(null);

  // ユーザープロフィール
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  // デザインテーマ（端末ごとに localStorage に保存。初回の描画前に layout.tsx のスクリプトが適用済み）
  const [theme, setTheme] = useState<ThemeId>(() => readStoredTheme());
  // 開発時の Strict Mode の再マウントなどで data-theme が消えても付け直す
  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);
  const changeTheme = (id: ThemeId) => {
    setTheme(id);
    saveTheme(id);
  };
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileTab, setProfileTab] = useState<'timetable' | 'completed' | 'reqCourses' | 'basic' | 'courses' | 'minors'>('timetable');
  const [reqCourseFilter, setReqCourseFilter] = useState<'all' | 'compulsory' | 'elective'>('all');
  const [profileNotification, setProfileNotification] = useState<string | null>(null);
  const [showTranscriptPasteBox, setShowTranscriptPasteBox] = useState(false);
  const [transcriptPasteText, setTranscriptPasteText] = useState('');

  // 学生アカウント管理ステート（個別アカウント対応）
  const [currentStudent, setCurrentStudent] = useState<StudentAccount | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register' | 'switch' | 'info' | 'forgot' | 'reset'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  // 旧方式（端末内だけ）のアカウントでパスワードが短いとき、サーバーに移す前に新しいパスワードを決めてもらう
  const [migrationAccount, setMigrationAccount] = useState<StudentAccount | null>(null);
  const [migrationPassword, setMigrationPassword] = useState('');
  // パスワード・IDを忘れたとき
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  // 基本設定のメール連携・パスワード変更
  const [accountEmailInput, setAccountEmailInput] = useState('');
  const [accountCurrentPassword, setAccountCurrentPassword] = useState('');
  const [accountNewPassword, setAccountNewPassword] = useState('');
  const [accountMessage, setAccountMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // ログインフォーム入力
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);

  // 新規登録フォーム入力
  const [regApiKey, setRegApiKey] = useState('');
  const [regKeyTestResult, setRegKeyTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [regId, setRegId] = useState('');
  const [regName, setRegName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regDept, setRegDept] = useState('情報科学科');
  const [regGrade, setRegGrade] = useState<number>(1);
  const [regAdmissionYear, setRegAdmissionYear] = useState<'reiwa7_or_later' | 'reiwa6_or_earlier'>('reiwa7_or_later');
  const [regCourses, setRegCourses] = useState<string[]>([]);
  const [regMinors, setRegMinors] = useState<string[]>([]);
  const [regTimetableFile, setRegTimetableFile] = useState<{ name: string; size: number; mimeType: string; data: string } | null>(null);
  const [regTranscriptFile, setRegTranscriptFile] = useState<{ name: string; size: number; mimeType: string; data: string } | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [regStatusText, setRegStatusText] = useState<string | null>(null);
  const [isAnalyzingTimetable, setIsAnalyzingTimetable] = useState(false);
  const [isAnalyzingTranscript, setIsAnalyzingTranscript] = useState(false);

  // 空き教室検索ツール（人間が使うための直感的なUI）
  const [showRoomSearchTool, setShowRoomSearchTool] = useState(false);
  const [searchDay, setSearchDay] = useState<string>('月');
  const [searchPeriod, setSearchPeriod] = useState<number>(2);
  const [searchBuilding, setSearchBuilding] = useState<string>('all');

  // API設定モーダル
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiSaveStatus, setApiSaveStatus] = useState<string | null>(null);
  const [hasServerKey, setHasServerKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // 管理者およびシステムメンテナンス状態
  const [maintenanceConfig, setMaintenanceConfig] = useState<MaintenanceConfig | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  // 管理者用：メール送信の記録
  const [showMailLogModal, setShowMailLogModal] = useState(false);
  const [mailLogEntries, setMailLogEntries] = useState<MailLogView[] | null>(null);
  const [mailLogError, setMailLogError] = useState<string | null>(null);
  const [isLoadingMailLog, setIsLoadingMailLog] = useState(false);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState<boolean>(false);
  const [adminCodeInput, setAdminCodeInput] = useState<string>('');
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [showAdminControlModal, setShowAdminControlModal] = useState<boolean>(false);
  const [isSavingMaintenance, setIsSavingMaintenance] = useState<boolean>(false);
  const [maintenanceStorageWarning, setMaintenanceStorageWarning] = useState<string | null>(null);
  const [editMaintActive, setEditMaintActive] = useState<boolean>(false);
  const [editMaintStart, setEditMaintStart] = useState<string>('2026年10月27日(火) 01:00');
  const [editMaintEnd, setEditMaintEnd] = useState<string>('2026年10月27日(火) 06:00');
  const [editMaintServices, setEditMaintServices] = useState<string>('全機能（空き教室検索、時間割管理、AIチャット、アカウント機能）');
  const [editMaintMessage, setEditMaintMessage] = useState<string>('現在、新機能の追加および学部要覧・時間割データの更新作業を行っております。');

  // 要覧早見表モーダル
  const [showDrawer, setShowDrawer] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'credits' | 'courses' | 'minors' | 'rooms' | 'vending' | 'hours'>('credits');

  // カテゴリチップフィルター
  const [activeChipCategory, setActiveChipCategory] = useState<'all' | 'rooms' | 'timetable' | 'academic' | 'campus'>('all');

  // 手動科目追加ステート（プロフィールモーダル内）
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseDay, setNewCourseDay] = useState('月');
  const [newCoursePeriod, setNewCoursePeriod] = useState(1);
  const [newCourseRoom, setNewCourseRoom] = useState('');
  const [newCourseCredits, setNewCourseCredits] = useState(2);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初期化：localStorageと環境キー・学生アカウントの取得
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('enekoma_gemini_api_key') || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
      if (savedKey) {
        setApiKey(savedKey);
        setRegApiKey(savedKey);
      }

      fetch('/api/chat')
        .then((res) => res.json())
        .then((data) => {
          if (data?.hasServerKey) {
            setHasServerKey(true);
          }
        })
        .catch(() => {});

      // 0. 管理者認証状態のセッション復元
      if (sessionStorage.getItem('enekoma_admin_auth') === 'true' && sessionStorage.getItem('enekoma_admin_code')) {
        setIsAdmin(true);
      }

      // メンテナンス設定の同期取得
      fetch('/api/admin/maintenance')
        .then((res) => res.json())
        .then((data) => {
          if (data?.maintenance) {
            setMaintenanceStorageWarning(describeMaintenanceStorage(data));
            setMaintenanceConfig(data.maintenance);
            setEditMaintActive(!!data.maintenance.isActive);
            if (data.maintenance.startDisplay) setEditMaintStart(data.maintenance.startDisplay);
            if (data.maintenance.endDisplay) setEditMaintEnd(data.maintenance.endDisplay);
            if (data.maintenance.targetServices) setEditMaintServices(data.maintenance.targetServices);
            if (data.maintenance.noticeMessage) setEditMaintMessage(data.maintenance.noticeMessage);
          }
        })
        .catch(() => {});

      // 永続ログインの持ち越しを完全防止：古いlocalStorageの学籍番号は破棄
      localStorage.removeItem('enekoma_current_student_id');

      // 1. ログイン中の学生アカウントの読み込み（sessionStorageのみ）
      const loggedStudent = getCurrentStudent();
      if (loggedStudent) {
        setCurrentStudent(loggedStudent);
        setUserProfile({
          ...DEFAULT_PROFILE,
          ...loggedStudent.profile,
          enrolledCourses: loggedStudent.profile.enrolledCourses || [],
          completedCourses: loggedStudent.profile.completedCourses || []
        });
        if (loggedStudent.chatHistory && loggedStudent.chatHistory.length > 0) {
          setMessages(loggedStudent.chatHistory);
          return;
        }
      } else {
        // 2. ゲストモード：初期状態はすべて0（他人の成績や時間割の自動ログイン混入を防止）
        setUserProfile(DEFAULT_PROFILE);
        localStorage.removeItem('enekoma_user_profile');
      }

      const savedChat = localStorage.getItem('enekoma_chat_history');
      if (savedChat) {
        try {
          const parsed = JSON.parse(savedChat);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
            return;
          }
        } catch {
          // ignore
        }
      }

      // デフォルトウェルカムメッセージ
      setMessages([
        {
          id: 'welcome',
          sender: 'assistant',
          text: `文理学部の学生ポータル「EneKoma（エネコマ）」へようこそ！\n\n大学生活や履修登録をサポートする学生アシスタントです。空き教室の検索や時間割の相談、あと何単位で卒業できるかのチェック、目標GPAのシミュレーション、学内の自販機や教室の場所案内など、気になることがあれば何でも気軽に聞いてくださいね。\n\n時間割や成績表の写真・ファイルもそのまま送っていただければ読み取れますよ！画面上部の検索バーや下のボタンから、お気軽に話しかけてみてくださいね。`,
          shortLabel: '準備完了',
          source: 'local',
          timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, []);

  // 履歴保存（個別学生アカウントにも自動同期）
  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      const storableMessages = withoutImagePreviews(messages);
      saveChatHistory(storableMessages);
      if (currentStudent) {
        const updatedStudent: StudentAccount = {
          ...currentStudent,
          chatHistory: storableMessages
        };
        saveStudentAccount(updatedStudent);
      }
    }
  }, [messages, currentStudent]);

  // プロフィール保存（個別学生アカウントにも自動同期）
  const saveProfile = (newProfile: UserProfile) => {
    setUserProfile(newProfile);
    if (typeof window !== 'undefined') {
      localStorage.setItem('enekoma_user_profile', JSON.stringify(newProfile));
      if (currentStudent) {
        const updatedStudent: StudentAccount = {
          ...currentStudent,
          profile: newProfile
        };
        setCurrentStudent(updatedStudent);
        saveStudentAccount(updatedStudent);
      }
    }
  };

  // スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // ファイル選択（画像・PDF・CSV・表計算・文書など全形式対応）
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name;
    const lower = fileName.toLowerCase();
    let fileType: 'image' | 'pdf' | 'csv' | 'document' = 'document';
    let mimeType = file.type || 'application/octet-stream';

    if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(lower)) {
      fileType = 'image';
      mimeType = file.type || 'image/jpeg';
    } else if (file.type === 'application/pdf' || lower.endsWith('.pdf')) {
      fileType = 'pdf';
      mimeType = 'application/pdf';
    } else if (file.type.includes('csv') || lower.endsWith('.csv')) {
      fileType = 'csv';
      mimeType = 'text/csv';
    } else if (file.type.includes('text') || lower.endsWith('.txt')) {
      fileType = 'document';
      mimeType = 'text/plain';
    } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      fileType = 'document';
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    e.target.value = '';
    prepareFileForUpload(file, mimeType)
      .then((prepared) => {
        setAttachedFile({
          name: fileName,
          size: file.size,
          mimeType: prepared.mimeType,
          data: prepared.data,
          previewUrl: fileType === 'image' ? prepared.data : undefined,
          fileType,
          imageType: 'current_timetable' // 初期値：今期の時間割
        });
      })
      .catch(() => {
        setProfileNotification('⚠️ ファイルを読み込めませんでした。');
        setTimeout(() => setProfileNotification(null), 5000);
      });
  };

  // レスポンス整形（チャットUI向けに記号や装飾を除去し自然な言葉遣いに）
  const parseResponse = (raw: string) => {
    let shortLabel: string | undefined = undefined;
    let mainText = raw || '';

    mainText = mainText.replace(/```profile_update[\s\S]*?(?:```|$)/g, '').trim();

    const labelMatch = mainText.match(/表示用[：:]\s*([^\n\r]+)/);
    if (labelMatch) {
      shortLabel = labelMatch[1].trim();
      mainText = mainText.replace(/表示用[：:]\s*[^\n\r]+(\r?\n)?/, '').replace(/詳細案内[：:]\s*/, '').trim();
    }

    // チャット表示向けに記号や太字装飾をクリーンアップ
    mainText = mainText
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/【([^】]+)】/g, '$1')
      .replace(/［([^］]+)］/g, '$1')
      .replace(/《([^》]+)》/g, '$1')
      .replace(/〔([^〕]+)〕/g, '$1')
      .replace(/➔|->|→/g, 'から')
      .replace(/^[\s\t]*[■◆▲▼🔹★※・•*✓✕❌⭕🟢🔴📍🕒🎓🏫🍱💡⏱️🗺️📌⚠️]+\s*/gm, '')
      .replace(/^[\s\t]*-\s+/gm, '')
      .replace(/[■◆▲▼🔹★※•]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return { shortLabel, mainText };
  };

  // UTF-8対応Base64デコード（日本語の文字化けを完全防止）
  const decodeBase64Utf8 = (base64Str: string): string => {
    try {
      const clean = base64Str.replace(/^data:[^;]+;base64,/, '');
      const binStr = atob(clean);
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        bytes[i] = binStr.charCodeAt(i);
      }
      return new TextDecoder('utf-8').decode(bytes);
    } catch {
      try {
        const clean = base64Str.replace(/^data:[^;]+;base64,/, '');
        return decodeURIComponent(escape(atob(clean)));
      } catch {
        return '';
      }
    }
  };

  // プロフィール更新処理（履修中・修得済み・成績表の確実な反映）
  const applyProfileUpdate = (update: any): boolean => {
    if (!update) return false;
    let updatedProf = { ...userProfile };
    const notifs: string[] = [];
    let modified = false;

    // 1. 今期の時間割（履修中）
    if (update.action === 'enroll_current_timetable' || Array.isArray(update.enrolledCourses)) {
      const rawCourses: any[] = Array.isArray(update.enrolledCourses) ? update.enrolledCourses : [];
      if (rawCourses.length > 0) {
        const validatedCourses: EnrolledCourseItem[] = rawCourses.map((c) => ({
          name: String(c.name || '未定科目').trim(),
          day: (['月', '火', '水', '木', '金', '土'].includes(c.day) ? c.day : '月') as any,
          period: Number(c.period) >= 1 && Number(c.period) <= 5 ? Number(c.period) : 1,
          room: String(c.room || '').trim(),
          credits: Number(c.credits) || 2,
          teacher: c.teacher ? String(c.teacher).trim() : undefined
        }));

        const semCr = Number(update.semesterCredits) || validatedCourses.reduce((sum, c) => sum + (c.credits || 2), 0);
        updatedProf = {
          ...updatedProf,
          enrolledCourses: validatedCourses,
          semesterCredits: semCr
        };
        notifs.push(`今期時間割を登録しました（${validatedCourses.length}科目 / ${semCr}単位を履修中に反映）`);
        modified = true;
      }
    }

    // 2. 過去の時間割（修得済みに加算：勝手な評価はつけず「修得」として登録）
    if (update.action === 'add_completed_timetable' || Array.isArray(update.addCompletedCourses)) {
      // 時間割表には成績がないので評価は付けない（GPAを歪めない）
      const toAdd: CourseRecord[] = (update.addCompletedCourses || [])
        .map((c: any) => toCourseRecord({ ...c, grade: '修得' }))
        .filter((c: CourseRecord | null): c is CourseRecord => c !== null);

      if (toAdd.length > 0) {
        const before = updatedProf.completedCourses;
        // 成績表から登録済みの科目は成績の記録を優先する（不合格のあとに再履修した科目は修得に置き換わる）
        const newCompleted = resolveRetakes([...before, ...toAdd]).courses;
        const newlyAdded = newCompleted.length - before.length;
        const addedCredits = sumEarnedCredits(newCompleted) - sumEarnedCredits(before);
        const newTotal = Math.max(0, updatedProf.currentCredits + addedCredits);
        updatedProf = {
          ...updatedProf,
          completedCourses: newCompleted,
          currentCredits: newTotal
        };
        notifs.push(`過去の時間割から${newlyAdded}科目を修得済みに登録（+${addedCredits}単位・評価なし）`);
        modified = true;
      }
    }

    // 3. 成績表・成績通知書（科目名・単位数・評価の高精度統合）
    if (update.action === 'transcript' || Array.isArray(update.completedCourses) || (update.totalEarnedCredits !== undefined && update.currentGpa !== undefined)) {
      let newCompleted = updatedProf.completedCourses || [];
      let replacedCount = 0;
      const hasIncoming = Array.isArray(update.completedCourses) && update.completedCourses.length > 0;
      if (hasIncoming) {
        const incoming: CourseRecord[] = update.completedCourses
          .map((c: any) => toCourseRecord(c))
          .filter((c: CourseRecord | null): c is CourseRecord => c !== null);

        // 既存の記録→今回の成績表の順に並べ、同名科目は最後の履修だけを残す（再履修で合格した科目の古い不合格を除外）
        const resolved = resolveRetakes([...newCompleted, ...incoming]);
        newCompleted = resolved.courses;
        // 成績表の中で整理した分（パーサーが数える）と、既存の記録を置き換えた分
        replacedCount = (Number(update.retakesResolved) || 0) + resolved.replaced.filter((c) => !isEarnedGrade(c.grade)).length;
      }

      // 修得単位は合格した科目だけを合計する（D/E/F・履修中止は数えない。再履修の二重カウントもしない）
      const parsedCredits = Number(update.totalEarnedCredits);
      const hasParsedCredits = update.totalEarnedCredits !== undefined && !isNaN(parsedCredits) && parsedCredits > 0;
      const calculatedCredits = sumEarnedCredits(newCompleted);
      const newCredits = newCompleted.length > 0 ? calculatedCredits : (hasParsedCredits ? parsedCredits : updatedProf.currentCredits);

      const parsedGpa = Number(update.currentGpa);
      const autoGpa = calculateGpa(newCompleted);
      const newGpa = autoGpa ?? ((!isNaN(parsedGpa) && parsedGpa >= 0) ? parsedGpa : updatedProf.currentGpa);

      updatedProf = {
        ...updatedProf,
        currentCredits: newCredits,
        currentGpa: newGpa,
        completedCourses: newCompleted
      };
      const failedCount = newCompleted.filter((c) => isFailingGrade(c.grade)).length;
      const details = [
        `${newCompleted.length}科目`,
        `修得 ${newCredits}単位`,
        `GPA ${newGpa.toFixed(2)}`,
        failedCount > 0 ? `未修得 ${failedCount}科目` : '',
        replacedCount > 0 ? `再履修で${replacedCount}科目を最新の成績に更新` : ''
      ].filter(Boolean).join(' / ');
      notifs.push(`成績通知書から反映しました（${details}）`);
      if (hasIncoming && hasParsedCredits && parsedCredits !== calculatedCredits) {
        notifs.push(`成績表に書かれた修得単位（${parsedCredits}単位）と科目の合計（${calculatedCredits}単位）が違います。読み取り漏れがないか一覧を確認してください`);
      }
      modified = true;
    }

    if (modified) {
      saveProfile(updatedProf);
      if (notifs.length > 0) {
        setProfileNotification(`✓ ${notifs.join(' ｜ ')}`);
        setTimeout(() => setProfileNotification(null), 8000);
      }
    }
    return modified;
  };

  // 学生アカウント切り替え
  const handleSwitchToStudent = (account: StudentAccount) => {
    setCurrentStudentId(account.id);
    setCurrentStudent(account);
    const prof: UserProfile = {
      ...DEFAULT_PROFILE,
      ...account.profile,
      enrolledCourses: account.profile.enrolledCourses || [],
      completedCourses: account.profile.completedCourses || []
    };
    setUserProfile(prof);
    if (typeof window !== 'undefined') {
      localStorage.setItem('enekoma_user_profile', JSON.stringify(prof));
    }

    if (account.chatHistory && account.chatHistory.length > 0) {
      setMessages(account.chatHistory);
      if (typeof window !== 'undefined') {
        saveChatHistory(withoutImagePreviews(account.chatHistory));
      }
    } else {
      setMessages([
        {
          id: `welcome_${account.id}`,
          sender: 'assistant',
          text: `こんにちは、${account.name}さん（${account.department} ${account.grade}年）。\n\nあなた専用の履修カルテが有効になりました。時間割・成績表の登録や空き教室検索など何でも聞いてください。`,
          shortLabel: 'ログイン完了',
          source: 'local',
          timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
    setShowAuthModal(false);
    setProfileNotification(`✓ ${account.name}さん（${account.department} ${account.grade}年）としてログインしました`);
    setTimeout(() => setProfileNotification(null), 5000);
  };

  const finishLogin = (acc: StudentAccount) => {
    handleSwitchToStudent(acc);
    if (keepLoggedIn) rememberLogin(acc.id);
    setLoginId('');
    setLoginPassword('');
    setKeepLoggedIn(false);
    setMigrationAccount(null);
    setMigrationPassword('');
    setAuthNotice(null);
  };

  // 旧方式（端末内だけ）のアカウントをサーバーに登録する。サーバーに届かなければ、端末内で照合済みなので今回はそのままログインする
  const migrateLegacyAccount = async (local: StudentAccount, password: string): Promise<{ account?: StudentAccount; error?: string; offline?: boolean }> => {
    const res = await callAccountApi('register', {
      loginId: local.id, password, name: local.name, department: local.department, grade: local.grade, admissionYear: local.admissionYear
    });
    if (res.ok && res.account) return { account: linkServerAccount(res.account) };
    if (res.error === 'id_taken') {
      // 別の端末で先に登録していた場合は、同じパスワードならそのまま紐付ける
      const login = await callAccountApi('login', { loginId: local.id, password });
      if (login.ok && login.account) return { account: linkServerAccount(login.account) };
      return { error: 'このIDは別の端末でサーバーに登録済みで、パスワードが違います。そのときのパスワードでログインするか、「パスワード・IDを忘れた方」から再設定してください。' };
    }
    if (isServerUnavailable(res)) return { account: local, offline: true };
    return { error: res.message || 'サーバーに登録できませんでした。' };
  };

  // 管理者用：メール送信の記録を読み込む
  const loadMailLog = async () => {
    setIsLoadingMailLog(true);
    setMailLogError(null);
    try {
      const res = await fetch('/api/admin/mail-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminCode: sessionStorage.getItem('enekoma_admin_code') || '' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMailLogError(data.error || '読み込めませんでした。');
        return;
      }
      setMailLogEntries(data.entries || []);
    } catch {
      setMailLogError('サーバーに接続できませんでした。');
    } finally {
      setIsLoadingMailLog(false);
    }
  };

  // ログインフォーム送信
  const handleStudentLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError(null);
    setAuthNotice(null);

    const id = loginId.trim();
    if (!id) {
      setAuthError('学籍番号またはIDを入力してください。');
      return;
    }
    if (isDemoAccountId(id)) {
      const demo = authenticateStudent(id, loginPassword);
      if (!demo) {
        setAuthError('デモアカウントのパスワードは 1234 です。下のボタンからパスワードなしでも切り替えられます。');
        return;
      }
      finishLogin(demo);
      return;
    }

    setIsAuthBusy(true);
    try {
      const legacy = checkLocalPassword(id, loginPassword);
      if (legacy) {
        if (loginPassword.trim().length < PASSWORD_MIN_LENGTH) {
          setMigrationAccount(legacy);
          return;
        }
        const result = await migrateLegacyAccount(legacy, loginPassword.trim());
        if (result.error || !result.account) {
          setAuthError(result.error || 'ログインできませんでした。');
          return;
        }
        finishLogin(result.account);
        return;
      }

      const res = await callAccountApi('login', { loginId: id, password: loginPassword });
      if (res.ok && res.account) {
        finishLogin(linkServerAccount(res.account));
        return;
      }
      setAuthError(res.message || 'ログインIDまたはパスワードが違います。');
    } finally {
      setIsAuthBusy(false);
    }
  };

  // 旧方式のアカウントに新しいパスワードを設定して、サーバーに移す
  const handleMigrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!migrationAccount) return;
    setAuthError(null);
    const next = migrationPassword.trim();
    if (next.length < PASSWORD_MIN_LENGTH) {
      setAuthError(`新しいパスワードは${PASSWORD_MIN_LENGTH}文字以上にしてください。`);
      return;
    }
    setIsAuthBusy(true);
    try {
      const result = await migrateLegacyAccount(migrationAccount, next);
      if (result.error || !result.account) {
        setAuthError(result.error || 'ログインできませんでした。');
        return;
      }
      finishLogin(result.account);
      if (result.offline) {
        setProfileNotification('⚠️ サーバーに接続できなかったため、新しいパスワードはまだ登録されていません。今回はこれまでのパスワードでログインしました。');
        setTimeout(() => setProfileNotification(null), 8000);
      }
    } finally {
      setIsAuthBusy(false);
    }
  };

  // パスワード再設定メール・ログインIDのお知らせメールを申し込む
  const handleForgotRequest = async (kind: 'request_password_reset' | 'request_login_id') => {
    setAuthError(null);
    setAuthNotice(null);
    const identifier = (kind === 'request_login_id' ? forgotEmail : forgotIdentifier).trim();
    if (!identifier) {
      setAuthError(kind === 'request_login_id' ? '登録したメールアドレスを入力してください。' : 'ログインIDかメールアドレスを入力してください。');
      return;
    }
    setIsAuthBusy(true);
    try {
      const res = await callAccountApi(kind, { identifier });
      if (res.ok) setAuthNotice(res.message || 'メールを送りました。');
      else setAuthError(res.message || '送信できませんでした。');
    } finally {
      setIsAuthBusy(false);
    }
  };

  // メールのリンクから新しいパスワードを設定する
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (resetPassword.trim().length < PASSWORD_MIN_LENGTH) {
      setAuthError(`新しいパスワードは${PASSWORD_MIN_LENGTH}文字以上にしてください。`);
      return;
    }
    if (resetPassword !== resetPasswordConfirm) {
      setAuthError('確認用のパスワードが一致しません。');
      return;
    }
    setIsAuthBusy(true);
    try {
      const res = await callAccountApi('reset_password', { token: resetToken, newPassword: resetPassword.trim() });
      if (!res.ok) {
        setAuthError(res.message || 'パスワードを変更できませんでした。');
        return;
      }
      setResetToken(null);
      setResetPassword('');
      setResetPasswordConfirm('');
      setLoginId(res.loginId || '');
      setLoginPassword('');
      setAuthTab('login');
      setAuthNotice('パスワードを変更しました。新しいパスワードでログインしてください。');
    } finally {
      setIsAuthBusy(false);
    }
  };

  // 基本設定：メールアドレスを登録（確認メールを送る）
  const handleSetAccountEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStudent) return;
    setAccountMessage(null);
    setIsAuthBusy(true);
    try {
      const res = await callAccountApi('set_email', { loginId: currentStudent.id, password: accountCurrentPassword, email: accountEmailInput.trim() });
      if (!res.ok || !res.account) {
        setAccountMessage({ ok: false, text: res.message || '登録できませんでした。' });
        return;
      }
      const updated = { ...currentStudent, email: res.account.email, pendingEmail: res.account.pendingEmail };
      saveStudentAccount(updated);
      setCurrentStudent(updated);
      setAccountEmailInput('');
      setAccountCurrentPassword('');
      setAccountMessage({ ok: true, text: `${res.account.pendingEmail}に確認メールを送りました。メールのリンクを開くと登録が完了します（24時間以内）。` });
    } finally {
      setIsAuthBusy(false);
    }
  };

  // 基本設定：パスワード変更
  const handleChangeAccountPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStudent) return;
    setAccountMessage(null);
    if (accountNewPassword.trim().length < PASSWORD_MIN_LENGTH) {
      setAccountMessage({ ok: false, text: `新しいパスワードは${PASSWORD_MIN_LENGTH}文字以上にしてください。` });
      return;
    }
    setIsAuthBusy(true);
    try {
      const res = await callAccountApi('change_password', { loginId: currentStudent.id, password: accountCurrentPassword, newPassword: accountNewPassword.trim() });
      if (!res.ok) {
        setAccountMessage({ ok: false, text: res.message || '変更できませんでした。' });
        return;
      }
      setAccountCurrentPassword('');
      setAccountNewPassword('');
      setAccountMessage({ ok: true, text: 'パスワードを変更しました。' });
    } finally {
      setIsAuthBusy(false);
    }
  };

  // メールのリンク（パスワード再設定・メールアドレス確認）を開いたとき
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reset = params.get('reset_password');
    const verify = params.get('verify_email');
    if (!reset && !verify) return;
    // トークンを履歴やブックマークに残さない
    params.delete('reset_password');
    params.delete('verify_email');
    const rest = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);

    void (async () => {
      if (reset) {
        setResetToken(reset);
        setAuthTab('reset');
        setShowAuthModal(true);
        return;
      }
      const res = await callAccountApi('verify_email', { token: verify });
      if (res.ok && res.account) {
        const local = loadAllAccounts()[res.account.loginId];
        if (local) {
          const updated = { ...local, email: res.account.email, pendingEmail: res.account.pendingEmail };
          saveStudentAccount(updated);
          setCurrentStudent((cur) => (cur?.id === updated.id ? updated : cur));
        }
        setProfileNotification(`✓ メールアドレス（${res.account.email}）の確認が完了しました。パスワードやログインIDを忘れたときに使えます。`);
      } else {
        setProfileNotification(`⚠️ ${res.message || 'メールアドレスを確認できませんでした。'}`);
      }
      setTimeout(() => setProfileNotification(null), 8000);
    })();
  }, []);

  // 新規登録時の添付ファイル選択
  const handleRegFileSelect = (e: React.ChangeEvent<HTMLInputElement>, target: 'timetable' | 'transcript') => {
    const file = e.target.files?.[0];
    if (!file) return;

    let mimeType = file.type || 'application/octet-stream';
    const lower = file.name.toLowerCase();
    if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(lower)) {
      mimeType = file.type || 'image/jpeg';
    } else if (file.type === 'application/pdf' || lower.endsWith('.pdf')) {
      mimeType = 'application/pdf';
    } else if (file.type.includes('csv') || lower.endsWith('.csv')) {
      mimeType = 'text/csv';
    } else if (file.type.includes('text') || lower.endsWith('.txt')) {
      mimeType = 'text/plain';
    }

    e.target.value = '';
    prepareFileForUpload(file, mimeType)
      .then((prepared) => {
        const item = {
          name: file.name,
          size: file.size,
          mimeType: prepared.mimeType,
          data: prepared.data
        };
        if (target === 'timetable') {
          setRegTimetableFile(item);
        } else {
          setRegTranscriptFile(item);
        }
      })
      .catch(() => {
        setAuthError('ファイルを読み込めませんでした。');
      });
  };

  // 学生履修プロフィールモーダル内からの直接ファイル添付・AI一括読み込み
  const handleProfileFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'timetable' | 'transcript') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isTimetable = target === 'timetable';
    if (isTimetable) setIsAnalyzingTimetable(true);
    else setIsAnalyzingTranscript(true);

    setProfileNotification(isTimetable ? '時間割ファイルをAI解析中（履修科目を抽出しています）...' : '成績通知書ファイルをAI解析中（単位・GPA・科目を抽出しています）...');

    let mimeType = file.type || 'application/octet-stream';
    const lower = file.name.toLowerCase();
    if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(lower)) {
      mimeType = file.type || 'image/jpeg';
    } else if (file.type === 'application/pdf' || lower.endsWith('.pdf')) {
      mimeType = 'application/pdf';
    } else if (file.type.includes('csv') || lower.endsWith('.csv')) {
      mimeType = 'text/csv';
    } else if (file.type.includes('text') || lower.endsWith('.txt')) {
      mimeType = 'text/plain';
    }

    e.target.value = '';
    try {
      const { data: dataUrl, mimeType: uploadMimeType } = await prepareFileForUpload(file, mimeType);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: isTimetable
            ? `【学生履修プロフィール：時間割登録】添付ファイル（${file.name}）を解析し、今期履修中科目のenrolledCourses配列のJSONを出力してください。`
            : `【学生履修プロフィール：成績通知書登録】添付ファイル（${file.name}）を解析し、totalEarnedCredits、currentGpa、completedCourses配列のJSONを出力してください。`,
          apiKey: apiKey.trim(),
          image: { mimeType: uploadMimeType, data: dataUrl },
          imageType: isTimetable ? 'current_timetable' : 'transcript',
          userProfile
        })
      });

      if (res.ok) {
        const data = await res.json();
        let update = data.profileUpdate || parseProfileUpdateFromText(data.reply, true);

        // CSV・テキスト・TSVの直接解析フォールバック（UTF-8日本語完全対応）
        if (!update && (mimeType === 'text/csv' || mimeType === 'text/plain' || lower.endsWith('.txt') || lower.endsWith('.csv') || lower.endsWith('.tsv'))) {
          try {
            const decoded = decodeBase64Utf8(dataUrl);
            update = parseProfileUpdateFromText(decoded, true);
          } catch (e) {}
        }

        if (update) {
          const applied = applyProfileUpdate(update);
          if (applied) {
            setProfileNotification(isTimetable ? '✓ 時間割を読み込み、履修中科目・今期単位数を更新しました！' : '✓ 成績通知書を読み込み、修得単位・GPAを更新しました！');
            setTimeout(() => setProfileNotification(null), 6000);
          } else {
            setProfileNotification('⚠️ 解析結果をカルテに反映できませんでした。');
          }
        } else {
          setProfileNotification('⚠️ ファイルから科目を読み取れませんでした。画像や文字が鮮明かご確認ください。');
        }
      } else {
        setProfileNotification('⚠️ 解析サーバーとの通信に失敗しました。');
      }
    } catch (err: any) {
      setProfileNotification(`⚠️ 解析エラー: ${err?.message || '不明なエラー'}`);
    } finally {
      if (isTimetable) setIsAnalyzingTimetable(false);
      else setIsAnalyzingTranscript(false);
    }
  };

  // 新規登録フォーム送信（時間割・成績表の自動解析付き）
  const handleStudentRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    // 0. APIキーの検証と保存（新規ログイン・登録に必須）
    const effectiveKey = regApiKey.trim() || apiKey.trim();
    if (!effectiveKey && !hasServerKey) {
      setAuthError('Gemini APIキーの取得と入力が必要です。「Google AI Studioで無料APIキーを取得する」からキーを取得して貼り付けてください（完全無料・約1分）。');
      return;
    }
    if (effectiveKey) {
      setApiKey(effectiveKey);
      if (typeof window !== 'undefined') {
        localStorage.setItem('enekoma_gemini_api_key', effectiveKey);
      }
    }

    if (!regId.trim()) {
      setAuthError('学籍番号またはIDを入力してください。');
      return;
    }
    if (!regName.trim()) {
      setAuthError('お名前またはニックネームを入力してください。');
      return;
    }
    if (regPassword.trim().length < PASSWORD_MIN_LENGTH) {
      setAuthError(`パスワードは${PASSWORD_MIN_LENGTH}文字以上にしてください。パスワードを忘れたときはメールで再設定できます。`);
      return;
    }

    setIsRegistering(true);
    let initialProfile: any = {};

    try {
      setRegStatusText('アカウントを登録中...');
      const serverRes = await callAccountApi('register', {
        loginId: regId.trim(),
        password: regPassword.trim(),
        name: regName.trim(),
        department: regDept,
        grade: regGrade,
        admissionYear: regAdmissionYear,
        email: regEmail.trim() || undefined
      });
      if (!serverRes.ok || !serverRes.account) {
        setAuthError(serverRes.message || 'アカウントを登録できませんでした。');
        return;
      }
      const registeredAccount = serverRes.account;
      const mailNotice = regEmail.trim()
        ? serverRes.verificationSent
          ? `${regEmail.trim()}に確認メールを送りました。リンクを開くと、パスワードを忘れたときに使えるようになります。`
          : 'メールアドレスは登録しましたが、確認メールを送れませんでした。あとで基本設定から送り直せます。'
        : '';

      // 1. 今期の時間割ファイルが添付されている場合、AIに解析させて登録科目を抽出
      if (regTimetableFile) {
        setRegStatusText('時間割ファイルをAI解析中（科目を抽出しています）...');
        try {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: '【新規学生登録】添付された今期の時間割表から開講科目（曜日・時限・科目名・教室・教員・単位数）をすべて読み取り、enrolledCourses配列のJSONを出力してください。',
              apiKey: effectiveKey,
              image: { mimeType: regTimetableFile.mimeType, data: regTimetableFile.data },
              imageType: 'current_timetable',
              userProfile: { department: regDept, grade: regGrade, admissionYear: regAdmissionYear }
            })
          });
          if (res.ok) {
            const data = await res.json();
            let update = data.profileUpdate || parseProfileUpdateFromText(data.reply, true);

            // CSV/テキストファイルのクライアント側即時フォールバック
            if (!update && (regTimetableFile.mimeType === 'text/csv' || regTimetableFile.mimeType === 'text/plain')) {
              try {
                const b64 = regTimetableFile.data.split('base64,')[1];
                const decoded = atob(b64);
                update = parseProfileUpdateFromText(decoded, true);
              } catch (e) {}
            }

            if (update && Array.isArray(update.enrolledCourses) && update.enrolledCourses.length > 0) {
              const validated = update.enrolledCourses.map((c: any) => ({
                name: String(c.name || '未定科目').trim(),
                day: (['月', '火', '水', '木', '金', '土'].includes(c.day) ? c.day : '月') as any,
                period: Number(c.period) >= 1 && Number(c.period) <= 5 ? Number(c.period) : 1,
                room: String(c.room || '').trim(),
                credits: Number(c.credits) || 2,
                teacher: c.teacher ? String(c.teacher).trim() : undefined
              }));
              initialProfile.enrolledCourses = validated;
              initialProfile.semesterCredits = Number(update.semesterCredits) || validated.reduce((sum: number, c: any) => sum + (c.credits || 2), 0);
            }
          }
        } catch (e) {
          console.warn('Timetable parse error during register:', e);
        }
      }

      // 2. 成績通知書ファイルが添付されている場合、AIに解析させて単位・GPA・科目を抽出
      if (regTranscriptFile) {
        setRegStatusText('成績通知書ファイルをAI解析中（修得単位とGPAを抽出しています）...');
        try {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: '【新規学生登録】添付された成績通知書から修得単位数合計、現在GPA、修得済み科目一覧を読み取り、JSONを出力してください。',
              apiKey: effectiveKey,
              image: { mimeType: regTranscriptFile.mimeType, data: regTranscriptFile.data },
              imageType: 'transcript',
              userProfile: { department: regDept, grade: regGrade, admissionYear: regAdmissionYear }
            })
          });
          if (res.ok) {
            const data = await res.json();
            let update = data.profileUpdate || parseProfileUpdateFromText(data.reply, true);

            // CSV/テキストファイルのクライアント側即時フォールバック（UTF-8日本語完全対応）
            if (!update && (regTranscriptFile.mimeType === 'text/csv' || regTranscriptFile.mimeType === 'text/plain' || regTranscriptFile.name.endsWith('.txt') || regTranscriptFile.name.endsWith('.csv') || regTranscriptFile.name.endsWith('.tsv'))) {
              try {
                const decoded = decodeBase64Utf8(regTranscriptFile.data);
                update = parseProfileUpdateFromText(decoded, true);
              } catch (e) {}
            }

            if (update) {
              if (update.totalEarnedCredits !== undefined) {
                initialProfile.currentCredits = Number(update.totalEarnedCredits);
              }
              if (update.currentGpa !== undefined) {
                initialProfile.currentGpa = Number(update.currentGpa);
              }
              if (Array.isArray(update.completedCourses) && update.completedCourses.length > 0) {
                const records = update.completedCourses
                  .map((c: any) => toCourseRecord(c))
                  .filter((c: CourseRecord | null): c is CourseRecord => c !== null);
                initialProfile.completedCourses = resolveRetakes(records).courses;
                // 修得単位とGPAは合格した科目・最後の履修から計算し直す
                initialProfile.currentCredits = sumEarnedCredits(initialProfile.completedCourses);
                initialProfile.currentGpa = calculateGpa(initialProfile.completedCourses) ?? initialProfile.currentGpa;
              }
            }
          }
        } catch (e) {
          console.warn('Transcript parse error during register:', e);
        }
      }

      setRegStatusText('学生カルテを作成中...');
      const newAcc = registerNewStudent({
        id: regId.trim(),
        name: regName.trim(),
        department: regDept,
        grade: regGrade,
        admissionYear: regAdmissionYear,
        selectedCourses: regCourses,
        selectedMinors: regMinors,
        initialProfile
      });

      handleSwitchToStudent({ ...newAcc, ...linkServerAccount(registeredAccount) });
      if (mailNotice) {
        setProfileNotification(`✓ 登録が完了しました。${mailNotice}`);
        setTimeout(() => setProfileNotification(null), 10000);
      }
      setRegId('');
      setRegName('');
      setRegPassword('');
      setRegEmail('');
      setRegCourses([]);
      setRegMinors([]);
      setRegTimetableFile(null);
      setRegTranscriptFile(null);
      setRegKeyTestResult(null);
    } catch (err: any) {
      setAuthError(`登録中にエラーが発生しました: ${err?.message || '不明なエラー'}`);
    } finally {
      setIsRegistering(false);
      setRegStatusText(null);
    }
  };

  // ログアウト
  const handleStudentLogout = () => {
    if (confirm('ログアウトしてゲストモードに戻りますか？現在の履修データと会話履歴は学籍番号ごとに保存されています。')) {
      setCurrentStudentId(null);
      setCurrentStudent(null);
      setUserProfile(DEFAULT_PROFILE);
      if (typeof window !== 'undefined') {
        localStorage.setItem('enekoma_user_profile', JSON.stringify(DEFAULT_PROFILE));
      }
      setMessages([
        {
          id: 'welcome_guest',
          sender: 'assistant',
          text: `ログアウトしました（ゲストモード）。\n\n再度ログインするには画面右上の「🔑 ログイン / 学生登録」を押してください。`,
          shortLabel: 'ゲストモード',
          source: 'local',
          timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setShowAuthModal(false);
      setProfileNotification('ログアウトしました（ゲストモード）');
      setTimeout(() => setProfileNotification(null), 4000);
    }
  };

  // 管理者ログイン
  const handleAdminLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAdminAuthError(null);
    try {
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminCode: adminCodeInput, action: 'verify' })
      });
      const data = await res.json();
      if (!res.ok || !data.isAdmin) {
        setAdminAuthError(data.error || '管理者コードが正しくありません。');
        return;
      }
      setIsAdmin(true);
      sessionStorage.setItem('enekoma_admin_auth', 'true');
      sessionStorage.setItem('enekoma_admin_code', adminCodeInput);
      setShowAdminLoginModal(false);
      setAdminCodeInput('');
      if (data.maintenance) {
        setMaintenanceStorageWarning(describeMaintenanceStorage(data));
        setMaintenanceConfig(data.maintenance);
        setEditMaintActive(!!data.maintenance.isActive);
        if (data.maintenance.startDisplay) setEditMaintStart(data.maintenance.startDisplay);
        if (data.maintenance.endDisplay) setEditMaintEnd(data.maintenance.endDisplay);
        if (data.maintenance.targetServices) setEditMaintServices(data.maintenance.targetServices);
        if (data.maintenance.noticeMessage) setEditMaintMessage(data.maintenance.noticeMessage);
      }
    } catch {
      setAdminAuthError('認証通信に失敗しました。');
    }
  };

  // 管理者ログアウト
  const handleAdminLogout = () => {
    if (confirm('管理者モードを終了しますか？')) {
      setIsAdmin(false);
      sessionStorage.removeItem('enekoma_admin_auth');
      sessionStorage.removeItem('enekoma_admin_code');
      setShowAdminControlModal(false);
    }
  };

  // メンテナンス設定保存
  const handleSaveMaintenance = async () => {
    setIsSavingMaintenance(true);
    try {
      const updatedConfig: MaintenanceConfig = {
        isActive: editMaintActive,
        startDateTime: editMaintStart,
        endDateTime: editMaintEnd,
        startDisplay: editMaintStart,
        endDisplay: editMaintEnd,
        targetServices: editMaintServices,
        noticeMessage: editMaintMessage
      };
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminCode: sessionStorage.getItem('enekoma_admin_code') || '',
          action: 'update',
          config: updatedConfig
        })
      });
      const data = await res.json();
      if (res.ok && data.maintenance) {
        setMaintenanceStorageWarning(describeMaintenanceStorage(data));
        setMaintenanceConfig(data.maintenance);
        setShowAdminControlModal(false);
        alert(editMaintActive ? 'メンテナンスモードを【開始（画面表示中）】に設定しました。' : 'メンテナンスモードを【解除（通常稼働）】に設定しました。');
      } else {
        alert('更新に失敗しました: ' + (data.error || '不明なエラー'));
      }
    } catch {
      alert('サーバーとの通信に失敗しました。');
    } finally {
      setIsSavingMaintenance(false);
    }
  };

  // メッセージ送信
  const handleSend = async (queryToSend?: string, overrideImageType?: 'current_timetable' | 'past_timetable' | 'transcript' | 'auto') => {
    const text = (queryToSend ?? inputText).trim();

    if (text === 'APIキーの取得方法と設定を教えて' || text === 'APIキー取得' || text === 'APIキー' || text === 'API設定') {
      setShowApiModal(true);
    }

    const currentFile = attachedFile;
    const finalImageType = overrideImageType || currentFile?.imageType || 'auto';

    if ((!text && !currentFile) || isLoading) return;

    let userDisplayText = text;
    if (!userDisplayText && currentFile) {
      const fileLabel = currentFile.name || '添付ファイル';
      if (finalImageType === 'current_timetable') {
        userDisplayText = `今期の時間割（${fileLabel}）を送信しました（履修中科目に登録）`;
      } else if (finalImageType === 'past_timetable') {
        userDisplayText = `過去の時間割（${fileLabel}）を送信しました（修得済み科目に追加・評価なし）`;
      } else if (finalImageType === 'transcript') {
        userDisplayText = `成績通知書（${fileLabel}）を送信しました（単位・GPA・評価を反映）`;
      } else {
        userDisplayText = `ファイル（${fileLabel}）を送信しました`;
      }
    }

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: userDisplayText,
      imagePreview: currentFile?.previewUrl,
      imageTypeLabel: currentFile
        ? finalImageType === 'current_timetable'
          ? '今期の時間割'
          : finalImageType === 'past_timetable'
          ? '過去の時間割（修得）'
          : finalImageType === 'transcript'
          ? '成績通知書'
          : '添付ファイル'
        : undefined,
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!queryToSend) setInputText('');
    setAttachedFile(null);
    setIsLoading(true);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        sender: m.sender,
        text: m.text
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: text,
          apiKey: apiKey.trim(),
          history: historyPayload,
          image: currentFile ? { mimeType: currentFile.mimeType, data: currentFile.data } : null,
          imageType: currentFile ? finalImageType : null,
          userProfile
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned status: ${res.status}`);
      }

      const data = await res.json();
      const rawReply = data.reply || '回答を取得できませんでした。';
      const { shortLabel, mainText } = parseResponse(rawReply);

      // プロフィール自動更新の確実な適用
      let updatedViaProfile = false;
      if (data.profileUpdate) {
        updatedViaProfile = applyProfileUpdate(data.profileUpdate);
      }

      // ユーザー入力テキスト自体からの直接抽出（コピペした「科目名\t単位数\t評価」や時間割）
      if (!updatedViaProfile) {
        const directTextUpdate = parseProfileUpdateFromText(text, !!currentFile);
        if (directTextUpdate) {
          updatedViaProfile = applyProfileUpdate(directTextUpdate);
        }
      }

      // サーバーで profileUpdate が解析されなかった場合でも、回答テキストからマルチステージ抽出を実行
      if (!updatedViaProfile && (currentFile || text.includes('時間割') || text.includes('成績') || text.includes('単位') || text.includes('評価') || text.includes('\t'))) {
        const extracted = parseProfileUpdateFromText(rawReply, !!currentFile);
        if (extracted) {
          applyProfileUpdate(extracted);
        }
      }

      const assistantMessage: ChatMessage = {
        id: `assistant_${Date.now()}`,
        sender: 'assistant',
        text: mainText,
        shortLabel,
        source: data.source || (apiKey.trim() || hasServerKey ? 'gemini' : 'local'),
        model: data.model,
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      // サーバー通信でエラーが発生した場合、APIキーがあればブラウザから直接Geminiを試行
      const cleanedKey = apiKey.trim();
      let recovered = false;

      if (cleanedKey) {
        try {
          let directRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${cleanedKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: AbortSignal.timeout(10000),
              body: JSON.stringify({
                systemInstruction: {
                  parts: [{ text: 'あなたは日本大学文理学部（CHS）公式アシスタント「EneKoma」です。時間割表やファイルを受け取った場合は科目を読み取り、必ず末尾に ```profile_update JSONコードブロックを出力してください。' }]
                },
                contents: [{
                  role: 'user',
                  parts: [
                    { text: `【ユーザープロフィール】学科: ${userProfile.department}、学年: ${userProfile.grade}年、現在GPA: ${userProfile.currentGpa}、修得単位: ${userProfile.currentCredits}単位\n\n質問: ${text}` },
                    ...(currentFile?.data ? [{
                      inlineData: {
                        mimeType: currentFile.mimeType || 'image/jpeg',
                        data: currentFile.data.replace(/^data:[^;]+;base64,/, '')
                      }
                    }] : [])
                  ]
                }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 8192 }
              })
            }
          );
          if (!directRes.ok) {
            directRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${cleanedKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(10000),
                body: JSON.stringify({
                  systemInstruction: {
                    parts: [{ text: 'あなたは日本大学文理学部（CHS）公式アシスタント「EneKoma」です。' }]
                  },
                  contents: [{ role: 'user', parts: [{ text }] }],
                  generationConfig: { temperature: 0.2, maxOutputTokens: 8192 }
                })
              }
            );
          }
          if (directRes.ok) {
            const directData = await directRes.json();
            const candText = directData?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (candText) {
              const { shortLabel, mainText } = parseResponse(candText);

              // Direct fallbackでもプロフィール更新を確実に抽出・反映
              const extracted = parseProfileUpdateFromText(candText, !!currentFile);
              if (extracted) {
                applyProfileUpdate(extracted);
              }

              const assistantMessage: ChatMessage = {
                id: `assistant_${Date.now()}`,
                sender: 'assistant',
                text: mainText,
                shortLabel,
                source: 'gemini',
                model: 'gemini-direct',
                timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
              };
              setMessages((prev) => [...prev, assistantMessage]);
              recovered = true;
            }
          }
        } catch (e) {
          // fallback to error message below
        }
      }

      if (!recovered) {
        const errorMessage: ChatMessage = {
          id: `assistant_err_${Date.now()}`,
          sender: 'assistant',
          text: `通信エラーが発生しました。（${err?.message || '接続できませんでした'}）\n画面右上の「⚙️ API設定」より接続テストをお試しいただくか、APIキーをご確認ください。`,
          shortLabel: '通信エラー',
          source: 'local',
          timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 空き教室検索バーからの直接実行
  const handleDirectRoomSearch = () => {
    const bldText = searchBuilding !== 'all' ? `${searchBuilding}の` : '';
    const query = `${searchDay}曜 ${searchPeriod}限 ${bldText}空き教室`;
    handleSend(query);
  };

  // テキストエリア自動調整
  const handleInputTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    if (confirm('チャットの会話履歴をクリアしますか？')) {
      localStorage.removeItem('enekoma_chat_history');
      setMessages([
        {
          id: 'welcome_cleared',
          sender: 'assistant',
          text: '履歴をクリアしました。空き教室検索、時間割の登録、不足単位の確認など、お気軽に入力してください。',
          shortLabel: '準備完了',
          source: 'local',
          timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  };

  // 新規登録時のGemini APIキー接続テスト
  const handleTestRegApiKey = async () => {
    const keyToTest = regApiKey.trim() || apiKey.trim();
    if (!keyToTest && !hasServerKey) {
      setRegKeyTestResult({ success: false, message: 'Gemini APIキーを入力してください。' });
      return;
    }
    setIsTestingKey(true);
    setRegKeyTestResult(null);

    let testSucceeded = false;
    let replyModel = 'Gemini';
    let errorMessage = '';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: '日大文理学部の魅力を1行で教えてください。',
          apiKey: keyToTest,
          userProfile
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.source === 'gemini') {
          testSucceeded = true;
          replyModel = data.model || 'Gemini Flash';
        } else if (data?.error) {
          errorMessage = data.error;
        } else if (data?.reply?.startsWith('⚠️')) {
          errorMessage = data.reply;
        } else {
          testSucceeded = true;
        }
      } else {
        errorMessage = `HTTP ${res.status}`;
      }
    } catch (e: any) {
      errorMessage = e?.message || 'サーバー未接続';
    }

    if (!testSucceeded && keyToTest) {
      try {
        const directRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${keyToTest}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(6000),
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: '日大文理' }] }]
            })
          }
        );
        if (directRes.ok) {
          testSucceeded = true;
          replyModel = 'Gemini 3 Flash';
        } else {
          const errData = await directRes.json().catch(() => ({}));
          const googleMsg = errData?.error?.message || `HTTP ${directRes.status}`;
          if (directRes.status === 400) {
            errorMessage = `APIキーが無効です（${googleMsg}）。Google AI Studioで作成されたキー（AIzaSy...）をご確認ください。`;
          } else if (directRes.status === 429) {
            errorMessage = 'Gemini APIの利用制限に達しています。数分お待ちいただくか別のキーをお試しください。';
          } else {
            errorMessage = `Google APIエラー: ${googleMsg}`;
          }
        }
      } catch (e: any) {
        errorMessage = `通信エラー: Google APIサーバーに接続できませんでした（${e?.message || 'オフライン'}）`;
      }
    }

    if (testSucceeded) {
      setRegKeyTestResult({
        success: true,
        message: `✓ 接続成功！Gemini API（${replyModel}）が正常に応答しました。このまま登録を完了できます。`
      });
      setApiKey(keyToTest);
      if (typeof window !== 'undefined') {
        localStorage.setItem('enekoma_gemini_api_key', keyToTest);
      }
    } else {
      setRegKeyTestResult({
        success: false,
        message: errorMessage || 'Geminiへの接続テストに失敗しました。APIキーをご確認ください。'
      });
    }
    setIsTestingKey(false);
  };

  const handleSaveApiKey = () => {
    const cleaned = apiKey.trim();
    if (typeof window !== 'undefined') {
      localStorage.setItem('enekoma_gemini_api_key', cleaned);
    }
    setApiSaveStatus('設定を保存しました。Gemini連携が有効になりました。');
    if (cleaned) {
      handleTestApiKey();
    }
    setTimeout(() => {
      setApiSaveStatus(null);
    }, 3000);
  };

  const handleTestApiKey = async () => {
    const keyToTest = apiKey.trim();
    if (!keyToTest && !hasServerKey) {
      setKeyTestResult({ success: false, message: 'APIキーを入力してください。' });
      return;
    }
    setIsTestingKey(true);
    setKeyTestResult(null);

    let testSucceeded = false;
    let replyModel = '1.5 Flash';
    let errorMessage = '';

    // 1. サーバー側（/api/chat）のテスト
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: '日大文理学部の魅力を1行で教えてください。',
          apiKey: keyToTest,
          userProfile
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.source === 'gemini') {
          testSucceeded = true;
          replyModel = data.model || 'Gemini Flash';
        } else if (data?.error) {
          errorMessage = data.error;
        } else if (data?.reply?.startsWith('⚠️')) {
          errorMessage = data.reply;
        }
      } else {
        errorMessage = `HTTP ${res.status}`;
      }
    } catch (e: any) {
      errorMessage = e?.message || 'サーバー未接続';
    }

    // 2. サーバー側でエラーだった場合、ブラウザからGoogle APIへ直接テスト（高速flash-liteモデルを使用）
    if (!testSucceeded && keyToTest) {
      try {
        let directRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${keyToTest}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(6000),
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: '日大文理' }] }]
            })
          }
        );
        if (!directRes.ok) {
          directRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${keyToTest}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: AbortSignal.timeout(6000),
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: '日大文理' }] }]
              })
            }
          );
        }
        if (directRes.ok) {
          testSucceeded = true;
          replyModel = 'Gemini 3 Flash';
        } else {
          const errData = await directRes.json().catch(() => ({}));
          const googleMsg = errData?.error?.message || `HTTP ${directRes.status}`;
          if (directRes.status === 400) {
            errorMessage = `APIキーが無効です（${googleMsg}）。Google AI Studioで作成されたキー（AIzaSy...）をもう一度ご確認ください。`;
          } else if (directRes.status === 429) {
            errorMessage = 'Gemini APIの利用制限（レートリミット）に達しています。数分お待ちいただくか別のキーをお試しください。';
          } else {
            errorMessage = `Google APIエラー: ${googleMsg}`;
          }
        }
      } catch (e: any) {
        errorMessage = `通信エラー: Google APIサーバーに接続できませんでした（${e?.message || 'オフライン'}）`;
      }
    }

    if (testSucceeded) {
      setKeyTestResult({
        success: true,
        message: `✓ 接続成功：Gemini API（${replyModel}）が正常に応答しました。自然言語対話および時間割・成績表の画像読取が利用可能です。`
      });
    } else {
      setKeyTestResult({
        success: false,
        message: errorMessage || 'Geminiへの接続テストに失敗しました。APIキーをご確認ください。'
      });
    }
    setIsTestingKey(false);
  };

  // 手動で履修中科目を追加
  const handleAddEnrolledCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim()) return;

    const newItem: EnrolledCourseItem = {
      name: newCourseName.trim(),
      day: newCourseDay,
      period: newCoursePeriod,
      room: newCourseRoom.trim() || '未定',
      credits: Number(newCourseCredits) || 2
    };

    const updatedCourses = [...userProfile.enrolledCourses, newItem];
    const updatedSemCredits = updatedCourses.reduce((sum, c) => sum + c.credits, 0);

    saveProfile({
      ...userProfile,
      enrolledCourses: updatedCourses,
      semesterCredits: updatedSemCredits
    });

    setNewCourseName('');
    setNewCourseRoom('');
  };

  // 履修中科目の削除
  const handleDeleteEnrolledCourse = (index: number) => {
    const updatedCourses = userProfile.enrolledCourses.filter((_, i) => i !== index);
    const updatedSemCredits = updatedCourses.reduce((sum, c) => sum + c.credits, 0);
    saveProfile({
      ...userProfile,
      enrolledCourses: updatedCourses,
      semesterCredits: updatedSemCredits
    });
  };

  // 要覧の科目を修得済みか（不合格は除き、全角半角・Ⅰと1・（含演習）の違いは同じ科目とみなす）
  const hasEarnedCourse = (courseName: string, aliases: string[] = []) =>
    userProfile.completedCourses.some((c) => isEarnedGrade(c.grade) && [courseName, ...aliases].some((n) => isSameCourseName(c.name, n)));

  // 修得済み科目のトグル（チェックで追加する科目は成績が分からないので評価は「修得」にし、GPAに影響させない）
  const toggleCourseCompleted = (courseName: string, credits: number, year: number) => {
    const isCompleted = hasEarnedCourse(courseName);
    let updated: CourseRecord[];

    if (isCompleted) {
      // 合格の記録だけを外す（不合格の記録は成績表の履歴として残す）
      updated = userProfile.completedCourses.filter((c) => !(isEarnedGrade(c.grade) && isSameCourseName(c.name, courseName)));
    } else {
      updated = resolveRetakes([
        ...userProfile.completedCourses,
        { name: courseName, credits, grade: '修得', year }
      ]).courses;
    }
    const deltaCredits = sumEarnedCredits(updated) - sumEarnedCredits(userProfile.completedCourses);

    const newCredits = Math.max(0, userProfile.currentCredits + deltaCredits);
    saveProfile({
      ...userProfile,
      currentCredits: newCredits,
      completedCourses: updated
    });
  };

  const liveDeficiency = analyzeAcademicDeficiency(userProfile);
  const liveDeptData = GAKUBU_YORAN_DEPARTMENTS[userProfile.department] || GAKUBU_YORAN_DEPARTMENTS['情報科学科'];
  const liveGpaSim = simulateGpaEngine(
    userProfile.currentCredits,
    userProfile.currentGpa,
    userProfile.targetGpa,
    userProfile.semesterCredits
  );

  const filteredChips = QUICK_CHIPS.filter(
    (chip) => activeChipCategory === 'all' || chip.category === activeChipCategory
  );

  return (
    <div className="flex flex-col h-[100dvh] min-h-[100dvh] bg-slate-50 text-slate-800 font-sans antialiased overflow-hidden">
      {/* ========================================================
          メンテナンス画面（管理者以外に表示・指定文面完全準拠）
      ======================================================== */}
      {maintenanceConfig?.isActive && !isAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-8 border border-slate-200 text-center animate-in fade-in zoom-in-95 duration-200 my-auto">
            <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl shadow-xs">
              🛠️
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 tracking-tight">
              ただいまシステムメンテナンス中です
            </h2>

            <div className="text-xs sm:text-sm text-slate-700 space-y-4 mb-6 text-left leading-relaxed">
              <p>
                いつもEneKomaをご利用いただきありがとうございます。<br />
                {maintenanceConfig.noticeMessage || '現在、新機能の追加および学部要覧・時間割データの更新作業を行っております。'}
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <p className="font-semibold text-slate-900">
                  作業予定時間： <span className="text-amber-800 font-bold">{maintenanceConfig.startDisplay} 〜 {maintenanceConfig.endDisplay}（予定）</span>
                </p>
                <p className="font-semibold text-slate-900">
                  対象サービス： <span className="font-normal text-slate-700">{maintenanceConfig.targetServices}</span>
                </p>
              </div>

              <div className="text-[11px] sm:text-xs text-amber-900 bg-amber-50 border border-amber-200/80 rounded-xl p-3 space-y-1">
                <p className="font-medium">※作業状況により、終了時刻が前後する場合がございます。</p>
                <p>急ぎの休講情報や教室変更については、大学公式の「COMITS2」または教務課掲示板をご確認ください。</p>
              </div>

              <p className="text-xs text-slate-500">
                ご不便をおかけいたしますが、ご理解とご協力をお願い申し上げます。
              </p>
            </div>

            {/* 管理者コード直接入力エリア */}
            <div className="border-t border-slate-100 pt-4 mt-2">
              <div className="text-[11px] text-slate-400 mb-2">管理者はこちらから認証して管理画面を開けます：</div>
              <form onSubmit={handleAdminLogin} className="flex flex-col sm:flex-row gap-2 items-center justify-center">
                <input
                  type="password"
                  value={adminCodeInput}
                  onChange={(e) => setAdminCodeInput(e.target.value)}
                  placeholder="管理者認証コードを入力"
                  className="w-full sm:w-64 px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50 focus:bg-white"
                />
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2 text-xs bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition shadow-xs shrink-0 cursor-pointer"
                >
                  管理者画面を開く
                </button>
              </form>
              {adminAuthError && (
                <p className="text-rose-600 text-xs mt-2 font-medium">{adminAuthError}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          管理者モードバー（管理者認証時のみ表示）
      ======================================================== */}
      {isAdmin && (
        <div className="bg-amber-400 text-slate-900 px-4 py-1.5 text-xs font-semibold flex items-center justify-between border-b border-amber-500 shadow-xs z-40">
          <div className="flex items-center space-x-2">
            <span>👑 管理者モード</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${maintenanceConfig?.isActive ? 'bg-rose-600 text-white' : 'bg-emerald-700 text-white'}`}>
              {maintenanceConfig?.isActive ? '🛠️ メンテ中（一般ユーザー遮断）' : '🟢 通常稼働中'}
            </span>
            <span className="hidden md:inline font-normal text-slate-900/80 text-[11px]">
              （一般ユーザーには{maintenanceConfig?.isActive ? 'メンテナンス告知が表示中' : '通常画面が表示中'}）
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                setShowMailLogModal(true);
                void loadMailLog();
              }}
              className="px-2.5 py-1 bg-white text-slate-900 rounded font-bold hover:bg-slate-100 transition shadow-2xs text-xs cursor-pointer"
            >
              📧 メール送信ログ
            </button>
            <button
              type="button"
              onClick={() => setShowAdminControlModal(true)}
              className="px-2.5 py-1 bg-white text-slate-900 rounded font-bold hover:bg-slate-100 transition shadow-2xs text-xs cursor-pointer"
            >
              ⚙️ メンテナンス設定
            </button>
            <button
              type="button"
              onClick={handleAdminLogout}
              className="px-2 py-1 bg-slate-900 text-white rounded font-medium hover:bg-slate-800 transition text-xs cursor-pointer"
            >
              ログアウト
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          ヘッダー：落ち着いた大学ポータルデザイン
      ======================================================== */}
      <header className="bg-white border-b border-slate-200 px-2.5 sm:px-4 py-2 sticky top-0 z-30 flex items-center justify-between shadow-xs shrink-0">
        {/* ヘッダー左側：ロゴ・大学名 */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0 min-w-0">
          {/* 学章・ポータルアイコン */}
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white font-serif font-bold text-xs sm:text-sm tracking-wider shadow-xs shrink-0">
            CHS
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight whitespace-nowrap shrink-0">EneKoma</h1>
              <span className="hidden sm:inline-block text-[11px] px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap shrink-0">
                日本大学文理学部ポータル
              </span>
              <span className="sm:hidden text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap shrink-0">
                文理学部
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden md:block truncate">
              時間割・空き教室案内 ｜ 履修要綱・卒業判定 ｜ キャンパス施設
            </p>
          </div>
        </div>

        {/* ヘッダー右側：PC版ナビゲーション（スマホ版は下部の専用クイックメニューに完全統合） */}
        <div className="hidden sm:flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {/* 学生個別アカウント切替・ログインボタン */}
          {currentStudent ? (
            <button
              onClick={() => {
                setAuthTab('info');
                setShowAuthModal(true);
              }}
              className="flex items-center space-x-1.5 px-2 py-1.5 sm:px-2.5 sm:py-1.5 rounded-md text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 border border-slate-700 transition shadow-xs whitespace-nowrap shrink-0"
              title="学生カルテ・アカウント切替"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
              <span className="max-w-[70px] xs:max-w-[110px] sm:max-w-none truncate">{currentStudent.name}</span>
              <span className="hidden lg:inline text-slate-300 font-normal">
                ({currentStudent.department.replace('学科', '')} {currentStudent.grade}年)
              </span>
            </button>
          ) : (
            <button
              onClick={() => {
                setAuthTab('login');
                setShowAuthModal(true);
              }}
              className="flex items-center space-x-1 px-2 py-1.5 sm:px-2.5 sm:py-1.5 rounded-md text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition whitespace-nowrap shrink-0"
              title="学生アカウントでログインまたは新規登録"
            >
              <span>🔑</span>
              <span className="hidden sm:inline whitespace-nowrap">ログイン / 登録</span>
              <span className="sm:hidden whitespace-nowrap font-medium">ログイン</span>
            </button>
          )}

          {/* Gemini連携ボタン (スマホでも見切れないようログインボタンの直後に配置＆スクロール可能) */}
          <button
            onClick={() => setShowApiModal(true)}
            className={`flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border transition whitespace-nowrap shrink-0 shadow-2xs ${
              apiKey.trim() || hasServerKey
                ? 'bg-slate-50 text-slate-800 border-slate-300 hover:bg-slate-100'
                : 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200 font-bold'
            }`}
            title="Google Gemini APIキーの取得・設定"
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${apiKey.trim() || hasServerKey ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className="whitespace-nowrap">Gemini連携</span>
          </button>

          {/* 今期履修中単位バッジ (デスクトップのみ) */}
          <button
            onClick={() => {
              setProfileTab('timetable');
              setShowProfileModal(true);
            }}
            className="hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition whitespace-nowrap shrink-0"
            title="今期の履修中科目を確認・編集"
          >
            <span className="text-slate-400">📅</span>
            <span>今期: <strong>{userProfile.semesterCredits}単位</strong></span>
            <span className="text-[11px] text-slate-400">({userProfile.enrolledCourses.length}科目)</span>
          </button>

          {/* 総単位進捗バッジ */}
          <button
            onClick={() => {
              setProfileTab('completed');
              setShowProfileModal(true);
            }}
            className="flex items-center space-x-1 px-1.5 py-1.5 sm:px-2.5 sm:py-1.5 rounded-md text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition whitespace-nowrap shrink-0"
            title="修得済み単位と卒業要件を確認"
          >
            <span className="text-slate-400">🎓</span>
            <span className="hidden sm:inline">修得: <strong>{userProfile.currentCredits}</strong> / 124単位</span>
            <span className="sm:hidden text-[11px] font-semibold text-slate-800">
              {userProfile.currentCredits}<span className="text-slate-400 font-normal">/124</span>
            </span>
          </button>

          {/* プロフィール設定ボタン */}
          <button
            onClick={() => setShowProfileModal(true)}
            className="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100 border border-slate-200 sm:border-transparent transition shrink-0 text-sm"
            title="学生履修プロフィールの編集"
          >
            👤
          </button>

          {/* 要覧早見表 */}
          <button
            onClick={() => setShowDrawer(true)}
            className="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100 border border-slate-200 sm:border-transparent transition shrink-0 text-sm"
            title="学部要覧の早見表を開く"
          >
            📋
          </button>

          {/* 管理者ボタン */}
          <button
            onClick={() => {
              if (isAdmin) {
                setShowAdminControlModal(true);
              } else {
                setShowAdminLoginModal(true);
              }
            }}
            className={`flex items-center space-x-1 w-8 h-8 sm:w-auto sm:px-2 sm:py-1.5 justify-center rounded-md text-xs font-semibold border transition cursor-pointer shrink-0 ${
              isAdmin
                ? 'bg-amber-400 text-slate-900 border-amber-500 shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
            title="管理者コントロールパネル"
          >
            <span>⚙️</span>
            <span className="hidden sm:inline whitespace-nowrap">管理設定</span>
          </button>

          {/* 会話履歴クリア (デスクトップ) */}
          <button
            onClick={handleClearHistory}
            className="hidden sm:flex w-8 h-8 items-center justify-center text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition shrink-0"
            title="チャット履歴を消去"
          >
            🗑️
          </button>
        </div>
      </header>

      {/* プロフィール自動反映時の通知トースト */}
      {profileNotification && (
        <div className="bg-slate-800 text-white text-xs sm:text-sm py-2 px-4 text-center font-medium shadow-sm transition">
          {profileNotification}
        </div>
      )}

      {/* ========================================================
          スマホ専用クイック操作メニューバー（「CHS EneKoma」と「空き教室検索」の間）
          ログイン、Gemini連携、取得済み単位数、学生履修プロフィール、要覧早見表、メンテナンス設定
      ======================================================== */}
      <div className="sm:hidden bg-slate-100/95 border-b border-slate-200 shrink-0 shadow-2xs">
        {/* スクロール案内表示 */}
        <div className="flex items-center justify-between px-2.5 pt-1.5 pb-0.5 text-[10px] text-slate-500 font-medium">
          <span className="text-slate-700 font-bold flex items-center space-x-1">
            <span>⚡</span>
            <span>クイックメニュー</span>
          </span>
          <span className="text-slate-500 flex items-center space-x-1 bg-white/80 border border-slate-200/80 px-1.5 py-0.5 rounded-full text-[10px]">
            <span>⇄ 左右にスクロールしてね</span>
            <span className="animate-pulse">👉</span>
          </span>
        </div>
        <nav aria-label="モバイルクイックメニュー" className="px-2.5 py-1.5 overflow-x-auto no-scrollbar flex items-center space-x-1.5 overscroll-x-contain">
        {/* 1. ログイン */}
        {currentStudent ? (
          <button
            onClick={() => {
              setAuthTab('info');
              setShowAuthModal(true);
            }}
            className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 shadow-2xs active:scale-95 transition"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="max-w-[80px] truncate">{currentStudent.name}</span>
          </button>
        ) : (
          <button
            onClick={() => {
              setAuthTab('login');
              setShowAuthModal(true);
            }}
            className="flex items-center space-x-1 px-2.5 py-1.5 bg-white text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 shadow-2xs active:scale-95 transition hover:bg-slate-50"
          >
            <span>🔑</span>
            <span>ログイン</span>
          </button>
        )}

        {/* 2. Gemini連携 */}
        <button
          onClick={() => setShowApiModal(true)}
          className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 border transition shadow-2xs active:scale-95 ${
            apiKey.trim() || hasServerKey
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : 'bg-amber-100 text-amber-900 border-amber-300'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${apiKey.trim() || hasServerKey ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <span>Gemini連携</span>
        </button>

        {/* 3. 取得済み単位数（〇/124） */}
        <button
          onClick={() => {
            setProfileTab('completed');
            setShowProfileModal(true);
          }}
          className="flex items-center space-x-1 px-2.5 py-1.5 bg-white text-slate-800 border border-slate-200 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 shadow-2xs active:scale-95 transition hover:bg-slate-50"
        >
          <span>🎓</span>
          <span>取得済み単位数（<strong>{userProfile.currentCredits}</strong>/124）</span>
        </button>

        {/* 4. 学生履修プロフィール */}
        <button
          onClick={() => setShowProfileModal(true)}
          className="flex items-center space-x-1 px-2.5 py-1.5 bg-white text-slate-800 border border-slate-200 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 shadow-2xs active:scale-95 transition hover:bg-slate-50"
        >
          <span>👤</span>
          <span>学生履修プロフィール</span>
        </button>

        {/* 5. 日本大学文理学部『学部要覧』早見表 */}
        <button
          onClick={() => setShowDrawer(true)}
          className="flex items-center space-x-1 px-2.5 py-1.5 bg-white text-slate-800 border border-slate-200 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 shadow-2xs active:scale-95 transition hover:bg-slate-50"
        >
          <span>📋</span>
          <span>『学部要覧』早見表</span>
        </button>

        {/* 6. システムメンテナンス管理設定 */}
        <button
          onClick={() => {
            if (isAdmin) {
              setShowAdminControlModal(true);
            } else {
              setShowAdminLoginModal(true);
            }
          }}
          className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 border transition shadow-2xs active:scale-95 ${
            isAdmin
              ? 'bg-amber-400 text-slate-900 border-amber-500 font-bold'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>⚙️</span>
          <span>システムメンテナンス管理設定</span>
        </button>
        </nav>
      </div>

      {/* ========================================================
          空き教室クイック検索ツールバー（人間が使うための直感UI）
      ======================================================== */}
      <section className="bg-white border-b border-slate-200 px-2.5 sm:px-4 py-2 shrink-0">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
            <span className="font-semibold text-slate-900 flex items-center space-x-1 whitespace-nowrap shrink-0">
              <span>🏫</span>
              <span className="whitespace-nowrap font-bold">空き教室検索:</span>
            </span>

            {/* 曜日選択 */}
            <div className="flex items-center space-x-0.5 sm:space-x-1 bg-slate-100 p-0.5 rounded-md border border-slate-200 shrink-0">
              {['月', '火', '水', '木', '金', '土'].map((d) => (
                <button
                  key={d}
                  onClick={() => setSearchDay(d)}
                  className={`w-6 h-6 sm:w-auto sm:px-2 sm:py-1 flex items-center justify-center rounded text-xs font-medium transition shrink-0 ${
                    searchDay === d ? 'bg-slate-800 text-white shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            {/* 時限選択 */}
            <select
              value={searchPeriod}
              onChange={(e) => setSearchPeriod(Number(e.target.value))}
              className="px-2 py-1 bg-white border border-slate-300 rounded-md font-medium text-slate-700 text-xs shrink-0"
            >
              <option value={1}>1限 (9:00〜)</option>
              <option value={2}>2限 (10:40〜)</option>
              <option value={3}>3限 (13:00〜)</option>
              <option value={4}>4限 (14:40〜)</option>
              <option value={5}>5限 (16:20〜)</option>
            </select>

            {/* 号館選択 (sm以上で表示) */}
            <select
              value={searchBuilding}
              onChange={(e) => setSearchBuilding(e.target.value)}
              className="px-2.5 py-1 bg-white border border-slate-300 rounded-md font-medium text-slate-700 text-xs hidden sm:block shrink-0"
            >
              <option value="all">全号館</option>
              <option value="3号館">3号館</option>
              <option value="4号館">4号館</option>
              <option value="1号館">1号館</option>
              <option value="2号館">2号館</option>
            </select>

            {/* 検索実行ボタン */}
            <button
              onClick={handleDirectRoomSearch}
              disabled={isLoading}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-md font-medium transition flex items-center space-x-1 disabled:opacity-50 whitespace-nowrap shrink-0 ml-auto sm:ml-0 shadow-2xs"
            >
              <span>🔍</span>
              <span>表示</span>
            </button>
          </div>
        </div>
      </section>

      {/* API未設定時の案内バナー（スマホでもワンタップで取得・設定可能） */}
      {!(apiKey.trim() || hasServerKey) && (
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-b border-amber-200/80 px-3 py-2 text-xs flex items-center justify-between text-amber-900 shrink-0 shadow-2xs">
          <div className="flex items-center space-x-1.5 min-w-0 mr-2">
            <span className="text-sm shrink-0">✨</span>
            <span className="truncate text-[11px] sm:text-xs">
              <strong>無料のGemini APIキー</strong>を設定すると、回答速度向上＆時間割写真のOCR解析が有効になります
            </span>
          </div>
          <button
            onClick={() => setShowApiModal(true)}
            className="px-2.5 py-1 bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold rounded-md text-[11px] whitespace-nowrap shrink-0 shadow-2xs transition active:scale-95"
          >
            Gemini連携
          </button>
        </div>
      )}

      {/* ========================================================
          メインコンテンツ：チャット表示エリア
      ======================================================== */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 max-w-4xl w-full mx-auto flex flex-col space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[92%] sm:max-w-[85%] rounded-xl p-4 shadow-2xs relative ${
                msg.sender === 'user'
                  ? 'bg-slate-800 text-slate-100 rounded-tr-xs'
                  : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs'
              }`}
            >
              {/* アシスタントヘッダー */}
              {msg.sender === 'assistant' && (
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-xs text-slate-500">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-900">EneKoma</span>
                    {msg.source === 'gemini' ? (
                      <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200">
                        Gemini {msg.model || '1.5 Flash'}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                        要覧ナレッジ
                      </span>
                    )}
                  </div>
                  {msg.shortLabel && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200">
                      {msg.shortLabel}
                    </span>
                  )}
                </div>
              )}

              {/* 添付画像プレビュー（ユーザー側） */}
              {msg.imagePreview && (
                <div className="mb-2 rounded-lg overflow-hidden border border-slate-300 max-w-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={msg.imagePreview} alt="送信画像" className="max-h-56 w-auto object-contain bg-slate-900/5" />
                  {msg.imageTypeLabel && (
                    <div className="text-[11px] py-1 px-2 bg-slate-700 text-slate-200">
                      種別：{msg.imageTypeLabel}
                    </div>
                  )}
                </div>
              )}

              {/* メッセージ本文 */}
              <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {msg.text}
              </div>

              {/* フッター */}
              <div
                className={`mt-2.5 flex items-center justify-between text-[11px] pt-1.5 border-t ${
                  msg.sender === 'user' ? 'border-slate-700 text-slate-400' : 'border-slate-100 text-slate-400'
                }`}
              >
                <span>{msg.timestamp}</span>
                {msg.sender === 'assistant' && (
                  <button
                    onClick={() => handleCopy(msg.id, msg.text)}
                    className="hover:text-slate-800 flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-slate-100 transition"
                  >
                    <span>{copiedId === msg.id ? '✓ コピー済み' : 'コピー'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* 思考中ローディング */}
        {isLoading && (
          <div className="flex flex-col items-start">
            <div className="bg-white border border-slate-200 rounded-xl rounded-tl-xs px-4 py-3 shadow-2xs flex items-center space-x-2.5">
              <div className="w-2 h-2 bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="text-xs text-slate-500 ml-1">要覧データおよび時間割を照合中...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* ========================================================
          入力ツールバー ＆ クイックサジェスト
      ======================================================== */}
      <footer className="bg-white border-t border-slate-200 px-3 sm:px-6 pt-2 pb-[max(12px,env(safe-area-inset-bottom,16px))] max-w-4xl w-full mx-auto shrink-0 z-20">
        {/* カテゴリフィルターチップ */}
        <div className="flex items-center space-x-1.5 pb-1.5 overflow-x-auto no-scrollbar overscroll-x-contain">
          <span className="text-[11px] font-medium text-slate-400 mr-1 whitespace-nowrap shrink-0">質問例:</span>
          <button
            onClick={() => setActiveChipCategory('all')}
            className={`text-xs px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0 transition ${
              activeChipCategory === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            すべて
          </button>
          <button
            onClick={() => setActiveChipCategory('rooms')}
            className={`text-xs px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0 transition ${
              activeChipCategory === 'rooms' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            🏫 空き教室
          </button>
          <button
            onClick={() => setActiveChipCategory('timetable')}
            className={`text-xs px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0 transition ${
              activeChipCategory === 'timetable' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            📅 時間割・空きコマ
          </button>
          <button
            onClick={() => setActiveChipCategory('academic')}
            className={`text-xs px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0 transition ${
              activeChipCategory === 'academic' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            🎓 履修・卒業・GPA
          </button>
          <button
            onClick={() => setActiveChipCategory('campus')}
            className={`text-xs px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0 transition ${
              activeChipCategory === 'campus' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            🏢 施設・自販機
          </button>
        </div>

        {/* チップボタン一覧 */}
        <div className="flex items-center space-x-1.5 py-1 overflow-x-auto no-scrollbar pb-2 overscroll-x-contain">
          {filteredChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(chip.query)}
              disabled={isLoading}
              className="text-xs px-2.5 py-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 whitespace-nowrap shrink-0 transition shadow-2xs"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* 添付ファイルプレビュー＆読み取り種別セレクター */}
        {attachedFile && (
          <div className="mb-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center space-x-2.5 min-w-0">
              {attachedFile.previewUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={attachedFile.previewUrl} alt="添付ファイル" className="w-10 h-10 object-cover rounded-lg border border-slate-300 shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg border border-slate-300 bg-white flex flex-col items-center justify-center text-slate-700 shadow-2xs shrink-0">
                  <span className="text-lg">
                    {attachedFile.fileType === 'pdf' ? '📄' : attachedFile.fileType === 'csv' ? '📊' : '📁'}
                  </span>
                  <span className="text-[8px] font-bold uppercase tracking-tight text-slate-500">
                    {attachedFile.fileType}
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 flex items-center space-x-1.5">
                  <span className="truncate max-w-[160px] sm:max-w-xs">{attachedFile.name}</span>
                  <span className="text-[10px] text-slate-400 font-normal shrink-0">
                    ({Math.max(1, Math.round(attachedFile.size / 1024))} KB)
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">解析種別を選択：</div>
                {/* 種別切り替えタブ */}
                <div className="flex flex-wrap gap-1 mt-1">
                  <button
                    type="button"
                    onClick={() => setAttachedFile({ ...attachedFile, imageType: 'current_timetable' })}
                    className={`text-[10px] px-2 py-0.5 rounded border transition whitespace-nowrap shrink-0 ${
                      attachedFile.imageType === 'current_timetable'
                        ? 'bg-slate-800 text-white border-slate-800 font-medium'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    📅 今期の時間割
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttachedFile({ ...attachedFile, imageType: 'past_timetable' })}
                    className={`text-[10px] px-2 py-0.5 rounded border transition whitespace-nowrap shrink-0 ${
                      attachedFile.imageType === 'past_timetable'
                        ? 'bg-slate-800 text-white border-slate-800 font-medium'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    📜 過去の時間割
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttachedFile({ ...attachedFile, imageType: 'transcript' })}
                    className={`text-[10px] px-2 py-0.5 rounded border transition whitespace-nowrap shrink-0 ${
                      attachedFile.imageType === 'transcript'
                        ? 'bg-slate-800 text-white border-slate-800 font-medium'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    📊 成績通知書
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={() => setAttachedFile(null)}
              className="self-end sm:self-center text-slate-400 hover:text-slate-700 text-xs px-2 py-1"
              title="添付を解除"
            >
              ✕ 解除
            </button>
          </div>
        )}

        {/* 入力フォーム */}
        <div className="flex items-end space-x-2 pt-1">
          {/* ファイル添付ボタン */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-600 transition shrink-0 active:scale-95"
            title="時間割表・成績表・PDF・CSV・文書ファイル等を添付"
          >
            📎
          </button>

          {/* テキスト入力エリア (iOS Safari自動ズーム防止のためtext-base sm:text-sm) */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={handleInputTextChange}
              onKeyDown={handleKeyDown}
              placeholder="質問を入力（例: 月曜2限の空き教室 / 単位足りてる？ / 目標GPA3.0）"
              className="w-full resize-none px-3.5 py-2 text-base sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 bg-white leading-normal shadow-2xs"
            />
          </div>

          {/* 送信ボタン */}
          <button
            onClick={() => handleSend()}
            disabled={(!inputText.trim() && !attachedFile) || isLoading}
            className="h-10 px-4 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white rounded-xl font-medium text-sm transition flex items-center justify-center shrink-0 active:scale-95"
          >
            送信
          </button>
        </div>
      </footer>

      {/* ========================================================
          学生履修プロフィールモーダル（Web履修ポータル風）
      ======================================================== */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4 backdrop-blur-2xs">
          {/* タブを切り替えても位置が動かないよう高さを固定する */}
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full h-[96dvh] sm:h-[90dvh] flex flex-col border border-slate-200">
            {/* ヘッダー */}
            <div className="shrink-0 flex items-center justify-between px-4 py-2.5 sm:py-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">学生履修プロフィール</h3>
                <p className="text-xs text-slate-500">
                  {userProfile.department} {userProfile.grade}年 ｜ {userProfile.admissionYear === 'reiwa6_or_earlier' ? '令和6年度以前入学者（旧カリ）' : '令和7年度以降入学者（新カリ）'}
                </p>
              </div>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg px-2"
              >
                ✕
              </button>
            </div>

            {/* タブ切り替え（縮めず、横スクロールなしで全タブを常に表示する） */}
            <div role="tablist" aria-label="学生履修プロフィールの項目" className="shrink-0 grid grid-cols-3 sm:grid-cols-6 border-b border-slate-200 bg-slate-50">
              {[
                { id: 'timetable', label: '📅 今期履修中', detail: `${userProfile.semesterCredits}単位` },
                { id: 'completed', label: '📜 修得済み科目', detail: `${userProfile.completedCourses.length}件` },
                { id: 'reqCourses', label: '📌 学科必修​チェック', detail: liveDeficiency.missingMajorReqs.length === 0 ? '完修' : `残${liveDeficiency.missingMajorReqs.length}` },
                { id: 'basic', label: '⚙️ 基本設定・GPA', detail: THEMES.find((t) => t.id === theme)?.label },
                { id: 'courses', label: '🏅 資格コース' },
                { id: 'minors', label: '🌐 副専攻', detail: '24種' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={profileTab === tab.id}
                  onClick={() => setProfileTab(tab.id as typeof profileTab)}
                  className={`min-h-11 px-1 py-1.5 text-[11px] leading-tight break-keep font-semibold border-b-2 flex flex-col items-center justify-center text-center transition ${
                    profileTab === tab.id
                      ? 'border-slate-800 text-slate-900 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.detail && <span className="font-normal text-[10px]">{tab.detail}</span>}
                </button>
              ))}
            </div>

            {/* モーダル本文（タブごとに作り直して、切り替え時に先頭へ戻す） */}
            <div key={profileTab} role="tabpanel" className="flex-1 min-h-0 p-4 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-700">
              {/* TAB 1: 今期履修中（時間割） */}
              {profileTab === 'timetable' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">今学期の履修中科目一覧</h4>
                      <p className="text-[11px] text-slate-500">
                        時間割画像を送ることで自動登録されるほか、手動での追加・削除も可能です。
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        今期登録単位数: {userProfile.semesterCredits}単位
                      </span>
                    </div>
                  </div>

                  {/* 時間割ファイル添付・AI一括自動登録 */}
                  <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <div className="text-xs font-bold text-indigo-950 flex items-center space-x-1.5">
                        <span>📅</span>
                        <span>時間割ファイルからAI一括読み込み</span>
                      </div>
                      <p className="text-[11px] text-indigo-700">
                        時間割の画像・PDF・CSVを添付すると、AIが曜日・時限・教室・科目名を自動登録します。
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <label className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-900 text-white rounded-md text-xs font-semibold hover:bg-indigo-800 cursor-pointer transition shadow-2xs">
                        <span>📎</span>
                        <span>{isAnalyzingTimetable ? 'AI解析中...' : '時間割ファイルを添付'}</span>
                        <input
                          type="file"
                          accept="*/*"
                          disabled={isAnalyzingTimetable}
                          onChange={(e) => handleProfileFileUpload(e, 'timetable')}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* 登録科目一覧テーブル */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-2.5">曜日・時限</th>
                          <th className="py-2 px-2.5">科目名</th>
                          <th className="py-2 px-2.5">教室</th>
                          <th className="py-2 px-2.5">単位</th>
                          <th className="py-2 px-2.5 text-center">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {userProfile.enrolledCourses.length > 0 ? (
                          userProfile.enrolledCourses.map((c, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="py-2 px-2.5 font-medium whitespace-nowrap">
                                {c.day}曜 {c.period}限
                              </td>
                              <td className="py-2 px-2.5 font-semibold text-slate-900">
                                {c.name}
                                {c.teacher && <span className="ml-1 text-[11px] font-normal text-slate-500">({c.teacher})</span>}
                              </td>
                              <td className="py-2 px-2.5 text-slate-600 whitespace-nowrap">{c.room || '-'}</td>
                              <td className="py-2 px-2.5 text-slate-600 whitespace-nowrap">{c.credits}単位</td>
                              <td className="py-2 px-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteEnrolledCourse(i)}
                                  className="text-rose-600 hover:text-rose-800 text-[11px]"
                                >
                                  削除
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-4 text-center text-slate-400">
                              今期の履修中科目はまだ登録されていません。時間割画像を送信するか、下のフォームから追加してください。
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 手動追加フォーム */}
                  <form onSubmit={handleAddEnrolledCourse} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                    <div className="font-semibold text-slate-800 text-xs">＋ 科目を手動で追加</div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <select
                        value={newCourseDay}
                        onChange={(e) => setNewCourseDay(e.target.value)}
                        className="px-2 py-1.5 bg-white border border-slate-300 rounded text-xs"
                      >
                        {['月', '火', '水', '木', '金', '土'].map((d) => (
                          <option key={d} value={d}>{d}曜日</option>
                        ))}
                      </select>
                      <select
                        value={newCoursePeriod}
                        onChange={(e) => setNewCoursePeriod(Number(e.target.value))}
                        className="px-2 py-1.5 bg-white border border-slate-300 rounded text-xs"
                      >
                        {[1, 2, 3, 4, 5].map((p) => (
                          <option key={p} value={p}>{p}限</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="科目名"
                        value={newCourseName}
                        onChange={(e) => setNewCourseName(e.target.value)}
                        className="col-span-2 px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                      />
                      <input
                        type="text"
                        placeholder="教室 (例: 3306)"
                        value={newCourseRoom}
                        onChange={(e) => setNewCourseRoom(e.target.value)}
                        className="px-2 py-1.5 bg-white border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-3 py-1 bg-slate-800 text-white rounded text-xs font-medium hover:bg-slate-900"
                      >
                        時間割に追加
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 2: 修得済み科目一覧 */}
              {profileTab === 'completed' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">修得済み科目一覧（計 {userProfile.currentCredits}単位）</h4>
                      <p className="text-[11px] text-slate-500">
                        卒業要件（全学科共通124単位）までの進捗：あと {Math.max(0, 124 - userProfile.currentCredits)}単位
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                        達成率: {Math.min(100, Math.round((userProfile.currentCredits / 124) * 100))}%
                      </span>
                    </div>
                  </div>

                  {/* 成績通知書（添付 ＆ コピペテキスト直接貼付） */}
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2.5 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-emerald-950 flex items-center space-x-1.5">
                          <span>📊</span>
                          <span>成績通知書から自動読み込み（画像・PDF・テキスト）</span>
                        </div>
                        <p className="text-[11px] text-emerald-700">
                          写真・スクリーンショット・PDF添付、またはポータルの表をコピー＆ペーストで即座に反映できます。
                        </p>
                      </div>
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowTranscriptPasteBox(!showTranscriptPasteBox)}
                          className="px-2.5 py-1.5 bg-white border border-emerald-300 text-emerald-800 rounded-md text-xs font-semibold hover:bg-emerald-50 transition shadow-2xs flex items-center space-x-1"
                        >
                          <span>📋</span>
                          <span>{showTranscriptPasteBox ? '貼付欄を閉じる' : 'テキスト貼付'}</span>
                        </button>
                        <label className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-900 text-white rounded-md text-xs font-semibold hover:bg-emerald-800 cursor-pointer transition shadow-2xs">
                          <span>📎</span>
                          <span>{isAnalyzingTranscript ? 'AI解析中...' : '成績表を添付'}</span>
                          <input
                            type="file"
                            accept="*/*"
                            disabled={isAnalyzingTranscript}
                            onChange={(e) => handleProfileFileUpload(e, 'transcript')}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {/* コピペ用テキスト入力欄（スマホ・PC両対応） */}
                    {showTranscriptPasteBox && (
                      <div className="p-2.5 bg-white border border-emerald-200 rounded-lg space-y-2 mt-2">
                        <label className="block text-[11px] font-bold text-slate-800">
                          📋 成績テキストを貼り付け（科目名・単位数・評価）
                        </label>
                        <p className="text-[10px] text-slate-500">
                          大学ポータル（NU-Web等）の成績画面からコピーしたテキスト（タブ区切り、CSV、スペース区切り等）をそのまま貼り付けてください。
                        </p>
                        <textarea
                          rows={4}
                          value={transcriptPasteText}
                          onChange={(e) => setTranscriptPasteText(e.target.value)}
                          placeholder={'例（ポータル表からそのままペースト）：\n科目名\t単位数\t評価\n日本語表現法\t2\tA\nキャリアデザイン\t2\tS\n情報リテラシー\t2\tB\n体育実技\t1\t合格'}
                          className="w-full p-2 border border-slate-300 rounded-md text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-700 bg-slate-50/50"
                        />
                        <div className="flex justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              setTranscriptPasteText('');
                              setShowTranscriptPasteBox(false);
                            }}
                            className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800"
                          >
                            キャンセル
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!transcriptPasteText.trim()) return;
                              const update = parseProfileUpdateFromText(transcriptPasteText.trim(), false);
                              if (update && Array.isArray(update.completedCourses) && update.completedCourses.length > 0) {
                                applyProfileUpdate(update);
                                setTranscriptPasteText('');
                                setShowTranscriptPasteBox(false);
                              } else {
                                setProfileNotification('⚠️ 有効な科目名・単位数・評価を検出できませんでした。');
                                setTimeout(() => setProfileNotification(null), 5000);
                              }
                            }}
                            className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-md text-xs font-semibold shadow-2xs transition"
                          >
                            ✨ カルテに一括反映する
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 進捗バー */}
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-slate-800 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (userProfile.currentCredits / 124) * 100)}%` }}
                    />
                  </div>

                  {/* 科目テーブル（スマホ横スクロール対応・文字崩れ防止） */}
                  <div className="border border-slate-200 rounded-lg overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse min-w-[340px]">
                      <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-2.5 min-w-[140px] whitespace-nowrap">科目名</th>
                          <th className="py-2 px-2.5 whitespace-nowrap">単位数</th>
                          <th className="py-2 px-2.5 whitespace-nowrap">評価</th>
                          <th className="py-2 px-2.5 text-center whitespace-nowrap">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {userProfile.completedCourses.map((c, i) => {
                          const g = normalizeGrade(c.grade || '修得');
                          const failed = isFailingGrade(g);
                          const earned = isEarnedGrade(g);
                          return (
                          <tr key={i} className={failed ? 'bg-rose-50/60 hover:bg-rose-50' : 'hover:bg-slate-50'}>
                            <td className={`py-2 px-2.5 font-medium min-w-[140px] ${earned ? 'text-slate-900' : 'text-slate-500'}`}>
                              {c.name}
                              {(c.takenYear || c.term) && (
                                <span className="ml-1.5 text-[10px] font-normal text-slate-400">{[c.takenYear ? `${c.takenYear}年度` : '', c.term || ''].filter(Boolean).join(' ')}</span>
                              )}
                            </td>
                            <td className={`py-2 px-2.5 whitespace-nowrap ${earned ? 'text-slate-600' : 'text-slate-400 line-through'}`}>{c.credits}単位</td>
                            <td className="py-2 px-2.5 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                g === 'S' ? 'bg-purple-100 text-purple-800' :
                                g === 'A' ? 'bg-emerald-100 text-emerald-800' :
                                g === 'B' ? 'bg-blue-100 text-blue-800' :
                                g === 'C' ? 'bg-amber-100 text-amber-800' :
                                failed ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                                'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}>
                                {g}
                              </span>
                              {failed && <span className="ml-1 text-[10px] font-semibold text-rose-600">未修得</span>}
                              {g === 'P' && <span className="ml-1 text-[10px] text-slate-500">履修中止</span>}
                            </td>
                            <td className="py-2 px-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = userProfile.completedCourses.filter((_, idx) => idx !== i);
                                  // 不合格・履修中止の記録は修得単位に入っていないので減らさない
                                  const newCredits = Math.max(0, userProfile.currentCredits - (isEarnedGrade(c.grade) ? c.credits : 0));
                                  saveProfile({ ...userProfile, completedCourses: updated, currentCredits: newCredits });
                                }}
                                className="text-rose-600 hover:text-rose-800 text-[11px]"
                              >
                                削除
                              </button>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: 必修・選択必修科目チェックリスト（完全区分・単位数明記） */}
              {profileTab === 'reqCourses' && (() => {
                const compulsoryList = liveDeptData.requiredCourses.map((c) => ({ ...c, isElective: false }));
                const electiveList = (liveDeptData.electiveRequiredCourses || []).map((c) => ({ ...c, isElective: true }));
                const combinedList = [...compulsoryList, ...electiveList];
                const displayedList = combinedList.filter((c) => {
                  if (reqCourseFilter === 'compulsory') return !c.isElective;
                  if (reqCourseFilter === 'elective') return c.isElective;
                  return true;
                });

                return (
                  <div className="space-y-3">
                    {/* 学科名と要件サマリー */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-1 gap-2 border-b border-slate-100">
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                          <span>🎓</span>
                          <span>【{liveDeptData.department}】必修・選択必修カリキュラム</span>
                          <span className="text-[10px] text-slate-400 font-normal">（要覧 p.{liveDeptData.page}）</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          必修科目（100%修得必須）と選択必修科目（規定群から選択修得）を明確に区分しています。
                        </p>
                      </div>
                      <div className="flex items-center space-x-1.5 text-[11px] shrink-0">
                        <span className="px-2 py-0.5 rounded font-bold bg-slate-900 text-white">
                          必修: {liveDeptData.majorReq}単位
                        </span>
                        <span className="px-2 py-0.5 rounded font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          選択必修: {liveDeptData.majorOpt}単位
                        </span>
                      </div>
                    </div>

                    {/* フィルター切り替えタブ */}
                    <div className="flex items-center justify-between">
                      <div className="flex space-x-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                        <button
                          type="button"
                          onClick={() => setReqCourseFilter('all')}
                          className={`px-2.5 py-1 rounded-md font-medium transition ${
                            reqCourseFilter === 'all'
                              ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          すべて ({combinedList.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setReqCourseFilter('compulsory')}
                          className={`px-2.5 py-1 rounded-md font-medium transition flex items-center space-x-1 ${
                            reqCourseFilter === 'compulsory'
                              ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <span>必修 ({compulsoryList.length})</span>
                          {liveDeficiency.missingMajorReqs.length > 0 && (
                            <span className="text-[10px] px-1 rounded-full bg-rose-600 text-white">
                              未修得{liveDeficiency.missingMajorReqs.length}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setReqCourseFilter('elective')}
                          className={`px-2.5 py-1 rounded-md font-medium transition ${
                            reqCourseFilter === 'elective'
                              ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          選択必修 ({electiveList.length})
                        </button>
                      </div>

                      <div className="text-[11px] text-slate-500 hidden sm:block">
                        未修得必修: <strong className="text-rose-600">{liveDeficiency.missingMajorReqs.length}科目</strong>
                      </div>
                    </div>

                    {/* 科目一覧リスト */}
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                      {displayedList.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">該当する科目がありません</div>
                      ) : (
                        displayedList.map((req) => {
                          const isCompleted = userProfile.completedCourses.some((c) => c.name === req.name);
                          return (
                            <label
                              key={req.name + req.group}
                              className={`flex items-start justify-between p-2.5 cursor-pointer transition ${
                                isCompleted ? 'bg-slate-50/70' : 'bg-white hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-start space-x-2.5">
                                <input
                                  type="checkbox"
                                  checked={isCompleted}
                                  onChange={() => toggleCourseCompleted(req.name, req.credits, req.year || 1)}
                                  className="mt-0.5 rounded text-slate-800 focus:ring-slate-500"
                                />
                                <div>
                                  <div className="flex items-center space-x-1.5">
                                    <span
                                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                        req.isElective
                                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                          : 'bg-slate-900 text-white'
                                      }`}
                                    >
                                      {req.isElective ? '選択必修' : '必修'}
                                    </span>
                                    <span
                                      className={`font-semibold text-xs ${
                                        isCompleted ? 'text-slate-400 line-through' : 'text-slate-900'
                                      }`}
                                    >
                                      {req.name}
                                    </span>
                                    <span className="text-[11px] font-bold text-slate-700 shrink-0">
                                      （{req.credits}単位）
                                    </span>
                                  </div>

                                  <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-1">
                                    {req.group && (
                                      <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">
                                        {req.group}
                                      </span>
                                    )}
                                    {req.year && (
                                      <span className="text-slate-400 text-[10px]">
                                        {req.year}年配当
                                      </span>
                                    )}
                                    {req.note && (
                                      <span className="text-amber-700 text-[10px]">
                                        ※{req.note}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <span
                                className={`text-[10px] font-medium px-2 py-0.5 rounded shrink-0 ml-2 ${
                                  isCompleted
                                    ? 'bg-slate-200 text-slate-700'
                                    : req.isElective
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200 font-semibold'
                                }`}
                              >
                                {isCompleted ? '修得済' : req.isElective ? '未選択' : '未修得'}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* TAB 4: 基本情報・GPA目標 */}
              {profileTab === 'basic' && (
                <div className="space-y-4">
                  {/* デザインテーマ */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="font-semibold text-slate-800 text-xs mb-1.5 flex items-center justify-between">
                      <span id="theme-picker-label">デザインテーマ:</span>
                      <span className="text-[10px] text-slate-500">この端末に保存されます</span>
                    </div>
                    <div role="radiogroup" aria-labelledby="theme-picker-label" className="grid grid-cols-3 gap-2">
                      {THEMES.map((option) => {
                        const selected = theme === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            data-theme-option={option.id}
                            onClick={() => changeTheme(option.id)}
                            className={`p-2 rounded-lg border text-left transition ${
                              selected
                                ? 'border-slate-800 ring-2 ring-slate-800/20 bg-white'
                                : 'border-slate-200 bg-white hover:bg-slate-100'
                            }`}
                          >
                            {/* 見本はテーマ変数の影響を受けないよう固定色で描く */}
                            <span className="flex h-6 overflow-hidden rounded-md border border-black/10" aria-hidden="true">
                              {option.swatch.map((color) => (
                                <span key={color} className="flex-1" style={{ backgroundColor: color }} />
                              ))}
                            </span>
                            <span className="mt-1.5 flex items-center gap-1 text-xs font-bold text-slate-900">
                              {selected && <span aria-hidden="true">✓</span>}
                              {option.label}
                            </span>
                            <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">{option.description}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* アカウント・メール連携 */}
                  {currentStudent && (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                      <div className="font-semibold text-slate-800 text-xs">アカウント・メール連携</div>
                      {isDemoAccountId(currentStudent.id) ? (
                        <p className="text-[11px] text-slate-500">デモアカウントではメール連携とパスワード変更は使えません。</p>
                      ) : !currentStudent.serverLinked ? (
                        <div className="space-y-2">
                          <p className="text-[11px] text-slate-600 leading-relaxed">
                            このアカウントは、この端末だけに保存されている古い形式です。一度ログインし直すとサーバーに登録され、メールでのパスワード再設定やID確認が使えるようになります。カルテはそのまま残ります。
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              const id = currentStudent.id;
                              setCurrentStudentId(null);
                              setCurrentStudent(null);
                              setUserProfile(DEFAULT_PROFILE);
                              setLoginId(id);
                              setLoginPassword('');
                              setAuthTab('login');
                              setAuthNotice('今までのパスワードでログインしてください。');
                              setShowProfileModal(false);
                              setShowAuthModal(true);
                            }}
                            className="px-3 py-1.5 bg-slate-900 text-white rounded-md text-xs font-medium"
                          >
                            ログインし直す
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="text-[11px] text-slate-700 space-y-0.5">
                            <div>ログインID：<span className="font-semibold">{currentStudent.id}</span></div>
                            <div>
                              メールアドレス：
                              {currentStudent.email
                                ? <span className="font-semibold">{currentStudent.email}（確認済み）</span>
                                : <span className="text-amber-800">未登録（パスワードを忘れると再設定できません）</span>}
                            </div>
                            {currentStudent.pendingEmail && (
                              <div className="text-amber-800">確認待ち：{currentStudent.pendingEmail}（届いたメールのリンクを開いてください）</div>
                            )}
                          </div>
                          {accountMessage && (
                            <div className={`p-2 rounded text-[11px] border ${accountMessage.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                              {accountMessage.text}
                            </div>
                          )}
                          <input
                            type="password"
                            value={accountCurrentPassword}
                            onChange={(e) => setAccountCurrentPassword(e.target.value)}
                            placeholder="現在のパスワード（変更の確認に使います）"
                            autoComplete="current-password"
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white"
                          />
                          <form onSubmit={handleSetAccountEmail} className="flex gap-2">
                            <input
                              type="email"
                              value={accountEmailInput}
                              onChange={(e) => setAccountEmailInput(e.target.value)}
                              placeholder={currentStudent.email ? '新しいメールアドレス' : 'メールアドレス'}
                              autoComplete="email"
                              className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-md text-xs bg-white"
                            />
                            <button type="submit" disabled={isAuthBusy} className="shrink-0 px-3 py-2 bg-slate-900 text-white rounded-md text-xs font-medium disabled:opacity-60">
                              確認メールを送る
                            </button>
                          </form>
                          <form onSubmit={handleChangeAccountPassword} className="flex gap-2">
                            <input
                              type="password"
                              value={accountNewPassword}
                              onChange={(e) => setAccountNewPassword(e.target.value)}
                              placeholder={`新しいパスワード（${PASSWORD_MIN_LENGTH}文字以上）`}
                              autoComplete="new-password"
                              className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-md text-xs bg-white"
                            />
                            <button type="submit" disabled={isAuthBusy} className="shrink-0 px-3 py-2 bg-white border border-slate-300 text-slate-800 rounded-md text-xs font-medium disabled:opacity-60">
                              パスワード変更
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  )}

                  {/* カリキュラム体系 */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <label className="block font-semibold text-slate-800 text-xs mb-1.5 flex items-center justify-between">
                      <span>入学年度 / カリキュラム体系:</span>
                      <span className="text-[10px] text-slate-500">時間割・履修要綱の判定基準</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => saveProfile({ ...userProfile, admissionYear: 'reiwa7_or_later' })}
                        className={`px-3 py-2 rounded text-xs font-semibold border text-center transition ${
                          (userProfile.admissionYear || 'reiwa7_or_later') === 'reiwa7_or_later'
                            ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        令和7年度以降入学者（新カリキュラム / 2025〜）
                      </button>
                      <button
                        type="button"
                        onClick={() => saveProfile({ ...userProfile, admissionYear: 'reiwa6_or_earlier' })}
                        className={`px-3 py-2 rounded text-xs font-semibold border text-center transition ${
                          userProfile.admissionYear === 'reiwa6_or_earlier'
                            ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        令和6年度以前入学者（旧カリキュラム / 〜2024）
                      </button>
                    </div>
                  </div>

                  {/* 学科・学年 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-800 text-xs mb-1">所属学科（全18学科）:</label>
                      <select
                        value={userProfile.department}
                        onChange={(e) => saveProfile({ ...userProfile, department: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs sm:text-sm font-medium"
                      >
                        {CHS_DEPARTMENTS.map((dept) => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-800 text-xs mb-1">学年:</label>
                      <select
                        value={userProfile.grade}
                        onChange={(e) => saveProfile({ ...userProfile, grade: parseInt(e.target.value, 10) })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs sm:text-sm font-medium"
                      >
                        {[1, 2, 3, 4].map((g) => (
                          <option key={g} value={g}>{g}年</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Google Gemini API設定 */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                        <span>🤖 Google Gemini API設定</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                          apiKey.trim() || hasServerKey ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                        }`}>
                          {apiKey.trim() || hasServerKey ? '連携中' : '未設定'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        無料のGemini APIキーを設定すると、回答速度向上と時間割・成績表の写真解析が使えます
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowApiModal(true)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold whitespace-nowrap shrink-0 self-start sm:self-center cursor-pointer shadow-2xs"
                    >
                      {apiKey.trim() || hasServerKey ? 'Gemini連携を確認' : 'Gemini連携を設定'}
                    </button>
                  </div>

                  {/* 単位・GPA */}
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div>
                      <label className="block font-semibold text-slate-800 text-xs mb-1">現在の総修得単位数:</label>
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          min={0}
                          max={160}
                          value={userProfile.currentCredits}
                          onChange={(e) => saveProfile({ ...userProfile, currentCredits: parseInt(e.target.value || '0', 10) })}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-xs sm:text-sm font-bold text-slate-900"
                        />
                        <span className="text-xs text-slate-500 whitespace-nowrap">/ 124</span>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-800 text-xs mb-1">今期履修中の単位数:</label>
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={userProfile.semesterCredits}
                          onChange={(e) => saveProfile({ ...userProfile, semesterCredits: parseInt(e.target.value || '0', 10) })}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-xs sm:text-sm"
                        />
                        <span className="text-xs text-slate-500 whitespace-nowrap">単位</span>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-800 text-xs mb-1">現在のGPA:</label>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        max={4.0}
                        value={userProfile.currentGpa}
                        onChange={(e) => saveProfile({ ...userProfile, currentGpa: parseFloat(e.target.value || '0') })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-xs sm:text-sm font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-800 text-xs mb-1">目標GPA:</label>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        max={4.0}
                        value={userProfile.targetGpa}
                        onChange={(e) => saveProfile({ ...userProfile, targetGpa: parseFloat(e.target.value || '0') })}
                        className="w-full px-3 py-1.5 border border-slate-400 bg-white text-slate-900 rounded text-xs sm:text-sm font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: 資格・専門コース選択＆必修チェック */}
              {profileTab === 'courses' && (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 leading-relaxed">
                    履修中のコースにチェックを入れると、<strong>必修科目・選択必修科目の修得状況と不足単位</strong>をリアルタイムに自動判定します。修得済み科目はチェックして進捗を確認できます。
                  </div>

                  <div className="space-y-3">
                    {GAKUBU_YORAN_COURSES.map((c) => {
                      const isChecked = userProfile.selectedCourses.includes(c.name);
                      const cDetail = VERIFIED_COURSES_CURRICULUM[c.name];
                      const analysis = liveDeficiency.coursesAnalysis.find((x) => x.name === c.name);

                      return (
                        <div
                          key={c.name}
                          className={`rounded-xl border transition overflow-hidden ${
                            isChecked
                              ? 'bg-slate-50/50 border-slate-400 shadow-2xs'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {/* コース概要バー */}
                          <div className="p-3 flex items-start justify-between">
                            <label className="flex items-start space-x-2.5 cursor-pointer flex-1">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const updated = e.target.checked
                                    ? [...userProfile.selectedCourses, c.name]
                                    : userProfile.selectedCourses.filter((x) => x !== c.name);
                                  saveProfile({ ...userProfile, selectedCourses: updated });
                                }}
                                className="mt-0.5 rounded text-slate-800 focus:ring-slate-500"
                              />
                              <div>
                                <div className="font-bold text-xs sm:text-sm text-slate-900 flex items-center space-x-1.5">
                                  <span>{c.name}</span>
                                  <span className="text-[10px] text-slate-400 font-normal">（{c.page}）</span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">{c.target} ｜ 窓口: {c.window}</div>
                              </div>
                            </label>

                            {/* 進捗バッジ */}
                            <div className="text-right shrink-0 ml-2">
                              {isChecked && analysis ? (
                                <div className="space-y-1">
                                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                    analysis.isFulfilled
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                                  }`}>
                                    {analysis.isFulfilled ? '修了要件達成' : `修得: ${analysis.earnedCredits} / ${analysis.reqCredits}単位`}
                                  </span>
                                  {analysis.missingCompulsory.length > 0 && (
                                    <div className="text-[10px] text-rose-600 font-medium">
                                      未修得必修: {analysis.missingCompulsory.length}科目
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400">必要: {c.requiredCredits}単位</span>
                              )}
                            </div>
                          </div>

                          {/* 選択中の場合、必修・選択必修チェックリストを展開 */}
                          {isChecked && cDetail && (
                            <div className="border-t border-slate-200 bg-white p-3 space-y-2">
                              <div className="text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                                <span>📋 コース科目チェックリスト（{cDetail.description}）</span>
                                <span className="text-slate-400 text-[10px]">クリックで修得済みに登録</span>
                              </div>
                              {analysis && <RequirementGroups groups={analysis.groups} />}

                              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg text-xs">
                                {/* 必修科目 */}
                                {cDetail.requiredCourses.map((req) => {
                                  const isComp = hasEarnedCourse(req.name, req.aliases);
                                  return (
                                    <label
                                      key={req.name}
                                      className={`p-2 flex items-center justify-between cursor-pointer transition ${
                                        isComp ? 'bg-slate-50/70' : 'hover:bg-slate-50'
                                      }`}
                                    >
                                      <div className="flex items-center space-x-2">
                                        <input
                                          type="checkbox"
                                          checked={isComp}
                                          onChange={() => toggleCourseCompleted(req.name, req.credits, 1)}
                                          className="rounded text-slate-800 focus:ring-slate-500"
                                        />
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-900 text-white">必修</span>
                                        <span className={`font-medium ${isComp ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                          {req.name}
                                        </span>
                                      </div>
                                      <span className="text-[11px] font-bold text-slate-600">{req.credits}単位</span>
                                    </label>
                                  );
                                })}

                                {/* 選択必修科目 */}
                                {cDetail.electiveRequiredCourses.map((ele) => {
                                  const isComp = hasEarnedCourse(ele.name, ele.aliases);
                                  return (
                                    <label
                                      key={ele.name + (ele.group || '')}
                                      className={`p-2 flex items-center justify-between cursor-pointer transition ${
                                        isComp ? 'bg-slate-50/70' : 'hover:bg-slate-50'
                                      }`}
                                    >
                                      <div className="flex items-center space-x-2">
                                        <input
                                          type="checkbox"
                                          checked={isComp}
                                          onChange={() => toggleCourseCompleted(ele.name, ele.credits, 1)}
                                          className="rounded text-slate-800 focus:ring-slate-500"
                                        />
                                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                          ele.category === '選択' ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-amber-100 text-amber-900 border-amber-300'
                                        }`}>
                                          {ele.group || '選択必修'}
                                        </span>
                                        <span className={`font-medium ${isComp ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                          {ele.name}
                                        </span>
                                      </div>
                                      <span className="text-[11px] font-bold text-slate-600">{ele.credits}単位</span>
                                    </label>
                                  );
                                })}
                              </div>
                              <RequirementNotes notes={cDetail.notes} />

                              {/* 教職コース：所属学科の教科に関する専門的事項（網掛けの必修・選択必修） */}
                              {analysis?.licenses && (
                                <div className="space-y-2 pt-1">
                                  <div className="text-[11px] font-semibold text-slate-700">
                                    🎓 {userProfile.department}の教科に関する専門的事項
                                  </div>
                                  {analysis.licenses.length === 0 && (
                                    <p className="text-[11px] text-slate-500">学部要覧（p.145-159）には{userProfile.department}の教科専門科目の表がありません。教職センターで確認してください。</p>
                                  )}
                                  {analysis.licenses.map((lic) => (
                                    <div key={lic.subject + lic.levels.join()} className="rounded-lg border border-slate-200 p-2 space-y-1.5">
                                      <div className="text-xs font-bold text-slate-900">
                                        {lic.subject}（{lic.levels.join('・')}）
                                        <span className="ml-1 text-[10px] font-normal text-slate-500">必要 {lic.requiredCreditsText} ／ {lic.page}</span>
                                      </div>
                                      {lic.missingRequired.length > 0 ? (
                                        <div className="text-[11px] text-rose-700">
                                          未修得の必修（{lic.missingRequired.length}科目）：{lic.missingRequired.map((c) => c.name).join('、')}
                                        </div>
                                      ) : (
                                        <div className="text-[11px] text-emerald-700">✓ 網掛けの必修科目はすべて修得済み</div>
                                      )}
                                      <RequirementGroups groups={lic.groups} />
                                      <div className="text-[10px] text-slate-500">教科教育法：{lic.methodCourses.join('、')}</div>
                                      <RequirementNotes notes={lic.notes} />
                                    </div>
                                  ))}
                                  <p className="text-[10px] text-slate-400">網掛けでない選択科目も必要単位数に数えられます。必要単位数に届いているかは成績表と教職センターの案内で確認してください。</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 6: 全24副専攻選択＆修了必修チェック */}
              {profileTab === 'minors' && (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 leading-relaxed">
                    全24種類の副専攻（学科副専攻19種・学際副専攻5種）から選択できます。<strong>所定の必修科目と指定群から計16単位</strong>を修得すると卒業時に副専攻修了証書が授与されます。※所属学科と同一の学科副専攻は修了認定不可。
                  </div>

                  <div className="space-y-3">
                    {GAKUBU_YORAN_ALL_24_MINORS.map((m) => {
                      const isChecked = userProfile.selectedMinors.includes(m.name);
                      const mDetail = VERIFIED_MINORS_CURRICULUM[m.name];
                      const analysis = liveDeficiency.minorsAnalysis.find((x) => x.name === m.name);

                      return (
                        <div
                          key={m.name}
                          className={`rounded-xl border transition overflow-hidden ${
                            isChecked
                              ? 'bg-slate-50/50 border-slate-400 shadow-2xs'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {/* 副専攻概要バー */}
                          <div className="p-3 flex items-start justify-between">
                            <label className="flex items-start space-x-2.5 cursor-pointer flex-1">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const updated = e.target.checked
                                    ? [...userProfile.selectedMinors, m.name]
                                    : userProfile.selectedMinors.filter((x) => x !== m.name);
                                  saveProfile({ ...userProfile, selectedMinors: updated });
                                }}
                                className="mt-0.5 rounded text-slate-800 focus:ring-slate-500"
                              />
                              <div>
                                <div className="font-bold text-xs sm:text-sm text-slate-900 flex items-center space-x-1.5">
                                  <span>{m.name}</span>
                                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                    m.type === 'department' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                                  }`}>
                                    {m.type === 'department' ? '学科副専攻' : '学際副専攻'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  幹事: {m.targetDept || '教務課'} ｜ {mDetail?.description || m.description}
                                </div>
                              </div>
                            </label>

                            {/* 進捗バッジ */}
                            <div className="text-right shrink-0 ml-2">
                              {isChecked && analysis ? (
                                <div className="space-y-1">
                                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                    analysis.isFulfilled
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                                  }`}>
                                    {analysis.isFulfilled ? '修了要件達成' : `修得: ${analysis.earnedCredits} / 16単位`}
                                  </span>
                                  {analysis.missingCompulsory.length > 0 && (
                                    <div className="text-[10px] text-rose-600 font-medium">
                                      未修得必修: {analysis.missingCompulsory.length}科目
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400">必要: 16単位</span>
                              )}
                            </div>
                          </div>

                          {/* 警告表示（同一学科・理系制限） */}
                          {isChecked && analysis && !analysis.isValid && (
                            <div className="mx-3 mb-2 p-2 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs">
                              {analysis.warning}
                            </div>
                          )}

                          {/* 選択中の場合、指定科目・必修チェックリストを展開 */}
                          {isChecked && mDetail && (
                            <div className="border-t border-slate-200 bg-white p-3 space-y-2">
                              <div className="text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                                <span>📋 修了要件科目（全 {mDetail.requiredCourses.length + mDetail.electiveRequiredCourses.length} 科目）: {mDetail.description}</span>
                                <span className="text-slate-400 text-[10px]">クリックで修得済みに登録</span>
                              </div>
                              {analysis && <RequirementGroups groups={analysis.groups} />}
                              <RequirementNotes notes={mDetail.notes} />

                              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg text-xs">
                                {/* 必修科目 */}
                                {mDetail.requiredCourses.map((req) => {
                                  const isComp = hasEarnedCourse(req.name, req.aliases);
                                  return (
                                    <label
                                      key={req.name}
                                      className={`p-2 flex items-center justify-between cursor-pointer transition ${
                                        isComp ? 'bg-slate-50/70' : 'hover:bg-slate-50'
                                      }`}
                                    >
                                      <div className="flex items-center space-x-2">
                                        <input
                                          type="checkbox"
                                          checked={isComp}
                                          onChange={() => toggleCourseCompleted(req.name, req.credits, 1)}
                                          className="rounded text-slate-800 focus:ring-slate-500"
                                        />
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-900 text-white">必修</span>
                                        <span className={`font-medium ${isComp ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                          {req.name}
                                        </span>
                                      </div>
                                      <span className="text-[11px] font-bold text-slate-600">{req.credits}単位</span>
                                    </label>
                                  );
                                })}

                                {/* 選択・群指定科目 */}
                                {mDetail.electiveRequiredCourses.map((ele) => {
                                  const isComp = hasEarnedCourse(ele.name, ele.aliases);
                                  return (
                                    <label
                                      key={ele.name + (ele.group || '')}
                                      className={`p-2 flex items-center justify-between cursor-pointer transition ${
                                        isComp ? 'bg-slate-50/70' : 'hover:bg-slate-50'
                                      }`}
                                    >
                                      <div className="flex items-center space-x-2">
                                        <input
                                          type="checkbox"
                                          checked={isComp}
                                          onChange={() => toggleCourseCompleted(ele.name, ele.credits, 1)}
                                          className="rounded text-slate-800 focus:ring-slate-500"
                                        />
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-900 border border-purple-200">
                                          {ele.group || '指定科目'}
                                        </span>
                                        <span className={`font-medium ${isComp ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                          {ele.name}
                                        </span>
                                      </div>
                                      <span className="text-[11px] font-bold text-slate-600">{ele.credits}単位</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* フッター */}
            <div className="shrink-0 px-3 py-2 sm:py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
              <span className="text-slate-500">変更内容は自動保存されます</span>
              <button
                onClick={() => setShowProfileModal(false)}
                className="px-4 py-2 bg-slate-800 text-white rounded-md font-medium hover:bg-slate-900 transition"
              >
                完了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          API設定モーダル（Google Gemini APIキー）
      ======================================================== */}
      {showApiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs">
          <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Google Gemini API設定</h3>
                <p className="text-xs text-slate-500">無料枠で利用可能・自然な回答と時間割/成績表のOCR解析を有効化</p>
              </div>
              <button onClick={() => setShowApiModal(false)} className="text-slate-400 hover:text-slate-700 text-lg">✕</button>
            </div>

            <div className="text-xs text-slate-600 space-y-2">
              <p>
                APIキーを設定すると、時間割表や成績表の写真解析、柔軟な言い回しでの質問受付が有効になります。
              </p>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center space-x-2 w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm font-bold shadow-xs transition active:scale-98"
              >
                <span>🌐 Google AI Studioで無料APIキーを取得する（約1分）</span>
                <span className="text-base">↗</span>
              </a>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] space-y-1">
                <div className="font-semibold text-slate-800">🔑 APIキーの取得手順（完全無料）:</div>
                <ol className="list-decimal list-inside space-y-1 text-slate-600">
                  <li>上の青いボタンをタップして「Google AI Studio」を開く</li>
                  <li>Googleアカウントでログインし「<strong>Create API key</strong>」をタップ</li>
                  <li>表示されたキー（AIzaSy...）をコピーして、下の枠に貼り付けて「<strong>保存</strong>」</li>
                </ol>
              </div>
            </div>

            {hasServerKey && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                ✓ サーバー環境変数に <code>GEMINI_API_KEY</code> が設定されています。ブラウザでの入力を行わなくても即時利用可能です。
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">Gemini APIキー:</label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono focus:outline-none focus:border-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-2 text-xs text-slate-400 hover:text-slate-600"
                >
                  {showApiKey ? '非表示' : '表示'}
                </button>
              </div>
            </div>

            {/* 接続テスト結果 */}
            {keyTestResult && (
              <div className={`p-2.5 rounded-md text-xs border ${
                keyTestResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                {keyTestResult.message}
              </div>
            )}

            {apiSaveStatus && (
              <div className="text-xs text-emerald-700 font-semibold text-center">
                ✓ {apiSaveStatus}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleTestApiKey}
                disabled={isTestingKey}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium transition disabled:opacity-50"
              >
                {isTestingKey ? 'テスト中...' : '接続テスト'}
              </button>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowApiModal(false)}
                  className="px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-600 hover:bg-slate-50"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleSaveApiKey}
                  className="px-4 py-2 bg-slate-800 text-white rounded-md text-xs font-medium hover:bg-slate-900 transition"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          要覧早見表ドロワーモーダル
      ======================================================== */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[85vh] flex flex-col border border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">日本大学文理学部『学部要覧』早見表</h3>
                <p className="text-xs text-slate-500">令和7年度公式カリキュラム・施設・設備データ</p>
              </div>
              <button onClick={() => setShowDrawer(false)} className="text-slate-400 hover:text-slate-700 text-lg">✕</button>
            </div>

            <div className="flex border-b border-slate-200 bg-slate-50 px-3 pt-2 space-x-1 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setDrawerTab('credits')}
                className={`px-3 py-1.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
                  drawerTab === 'credits' ? 'border-slate-800 text-slate-900 bg-white rounded-t' : 'border-transparent text-slate-500'
                }`}
              >
                単位・CAP制
              </button>
              <button
                onClick={() => setDrawerTab('courses')}
                className={`px-3 py-1.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
                  drawerTab === 'courses' ? 'border-slate-800 text-slate-900 bg-white rounded-t' : 'border-transparent text-slate-500'
                }`}
              >
                資格コース
              </button>
              <button
                onClick={() => setDrawerTab('minors')}
                className={`px-3 py-1.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
                  drawerTab === 'minors' ? 'border-slate-800 text-slate-900 bg-white rounded-t' : 'border-transparent text-slate-500'
                }`}
              >
                副専攻一覧
              </button>
              <button
                onClick={() => setDrawerTab('rooms')}
                className={`px-3 py-1.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
                  drawerTab === 'rooms' ? 'border-slate-800 text-slate-900 bg-white rounded-t' : 'border-transparent text-slate-500'
                }`}
              >
                校舎・教室配置
              </button>
              <button
                onClick={() => setDrawerTab('vending')}
                className={`px-3 py-1.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
                  drawerTab === 'vending' ? 'border-slate-800 text-slate-900 bg-white rounded-t' : 'border-transparent text-slate-500'
                }`}
              >
                自動販売機
              </button>
              <button
                onClick={() => setDrawerTab('hours')}
                className={`px-3 py-1.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
                  drawerTab === 'hours' ? 'border-slate-800 text-slate-900 bg-white rounded-t' : 'border-transparent text-slate-500'
                }`}
              >
                営業時間
              </button>
            </div>

            <div className="p-4 overflow-y-auto text-xs sm:text-sm text-slate-700 space-y-3">
              {drawerTab === 'credits' && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900">卒業に必要な124単位の区分内訳（要覧 p.31）</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    <li>全学共通教育科目：自主創造の基礎（2単位必修・1年次）</li>
                    <li>総合教育科目：12単位必修（人文2, 社会2, 理学2を含む）。40単位まで自由選択算入可。</li>
                    <li>外国語教育科目：中国語(18), 英文(16), 独文(16), 他15学科(8単位)</li>
                    <li>基礎教育科目：健康スポーツ(3単位) ＋ 情報リテラシー(2単位)＝計5単位</li>
                    <li>学科専門科目：各学科指定（60〜78単位）</li>
                    <li>自由選択区分：各区分超過単位、他学科科目、コース科目</li>
                  </ul>
                  <h4 className="font-bold text-slate-900 pt-2">CAP制（年間40単位上限・要覧 p.35-36）</h4>
                  <p className="text-slate-600 text-xs">
                    前年度GPA3.0以上で年間+8単位（48単位）、GPA2.5以上で+6単位（46単位）、GPA2.0以上で+4単位（44単位）の加算措置があります。
                  </p>
                </div>
              )}

              {drawerTab === 'rooms' && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900">校舎・教室配置ルール</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    <li><strong>3号館</strong>：下2桁が01〜05は男子トイレ側、06〜10は女子トイレ側。エレベーター混雑時はエスカレーター推奨。</li>
                    <li><strong>4号館</strong>：給水所（冷水機）は1階のみ利用可能。トイレ前にゴミ箱あり。</li>
                    <li><strong>1号館</strong>：4階・5階にはトイレがありません（2階または3階を利用）。</li>
                    <li><strong>2号館</strong>：自動販売機およびゴミ箱は館内に設置されていません。</li>
                  </ul>
                </div>
              )}

              {drawerTab === 'hours' && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900">主要施設・窓口の営業時間</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    <li><strong>文理学部図書館</strong>：月〜金 09:00〜20:00 ｜ 土曜 09:00〜19:00</li>
                    <li><strong>コンピュータセンター</strong>：月〜金 09:00〜18:00 ｜ 土曜 09:00〜13:00</li>
                    <li><strong>ラーニング・コモンズ</strong>：月〜金 08:00〜18:00 ｜ 土曜 08:00〜17:00</li>
                    <li><strong>教務課窓口</strong>：月〜金 09:00〜17:00 ｜ 土曜 09:00〜13:00</li>
                  </ul>
                </div>
              )}

              {drawerTab === 'vending' && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900">自動販売機・決済方法</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    <li><strong>3号館 1階（赤コカ・コーラ自販機）</strong>：Visa/Mastercard クレジットカードタッチ決済対応、PayPay、モバイルSuica、現金</li>
                    <li><strong>4号館 1階（サントリー自販機）</strong>：ジハンピアプリ、天然水80円、ZONe80円、レッドブル170円</li>
                  </ul>
                </div>
              )}

              {drawerTab === 'courses' && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900">資格コース窓口一覧</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    <li>教職コース・司書教諭コース ➔ 教職センター</li>
                    <li>司書・学芸員・社会教育主事・日本語教育コース ➔ 教務課</li>
                  </ul>
                </div>
              )}

              {drawerTab === 'minors' && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900">全24副専攻</h4>
                  <p className="text-slate-600 text-xs">
                    各副専攻の指定科目から16単位以上を修得することで修了認定証書が授与されます。
                  </p>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowDrawer(false)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded-md text-xs font-medium hover:bg-slate-900"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          学生個別アカウント・ログインモーダル
      ======================================================== */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs">
          <div className="bg-white rounded-xl shadow-lg max-w-xl w-full max-h-[90vh] flex flex-col border border-slate-200">
            {/* モーダルヘッダー */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <span>🎓</span>
                  <span>文理学部 学生ログイン / アカウント管理</span>
                </h3>
                <p className="text-xs text-slate-500">
                  学生ごとに時間割・修得単位・GPA・会話履歴を個別管理できます
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAuthModal(false);
                  setAuthError(null);
                }}
                className="text-slate-400 hover:text-slate-700 text-lg px-2"
              >
                ✕
              </button>
            </div>

            {/* ナビゲーションタブ */}
            <div className="flex border-b border-slate-200 bg-white px-3 pt-2 space-x-1">
              <button
                onClick={() => { setAuthTab('login'); setAuthError(null); }}
                className={`px-3 py-1.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
                  authTab === 'login'
                    ? 'border-slate-800 text-slate-900 bg-slate-50 rounded-t'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                🔑 ログイン
              </button>
              <button
                onClick={() => { setAuthTab('register'); setAuthError(null); }}
                className={`px-3 py-1.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
                  authTab === 'register'
                    ? 'border-slate-800 text-slate-900 bg-slate-50 rounded-t'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                📝 新規学生登録
              </button>
              {currentStudent && (
                <button
                  onClick={() => { setAuthTab('info'); setAuthError(null); }}
                  className={`px-3 py-1.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
                    authTab === 'info'
                      ? 'border-slate-800 text-slate-900 bg-slate-50 rounded-t'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  👤 学生カルテ
                </button>
              )}
              <button
                onClick={() => { setAuthTab('switch'); setAuthError(null); }}
                className={`px-3 py-1.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
                  authTab === 'switch'
                    ? 'border-slate-800 text-slate-900 bg-slate-50 rounded-t'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                🔄 アカウント切替
              </button>
            </div>

            {/* エラー表示 */}
            {authError && (
              <div className="mx-4 mt-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md">
                ⚠️ {authError}
              </div>
            )}
            {authNotice && (
              <div className="mx-4 mt-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-md">
                ✓ {authNotice}
              </div>
            )}

            {/* モーダルコンテンツ */}
            <div className="p-4 overflow-y-auto text-xs sm:text-sm text-slate-700 space-y-4">
              {/* TAB 1: ログイン */}
              {authTab === 'login' && (
                <div className="space-y-4">
                  {/* 初めてご利用の方（新規ログイン・新規登録）への案内バナー */}
                  <div className="p-3 bg-gradient-to-r from-indigo-50 via-blue-50 to-purple-50 border border-indigo-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <span>✨</span>
                        <span>初めてご利用の方（新規ログイン）</span>
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold border border-indigo-200">
                        無料・約1分
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      エネコマを初めて利用される方は、まず<strong>無料のGemini APIキー</strong>を取得して新規登録を行ってください。
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthTab('register');
                        setAuthError(null);
                        if (!regApiKey && apiKey) setRegApiKey(apiKey);
                      }}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center justify-center gap-1.5"
                    >
                      <span>🔑 APIキーを取得して新規登録する ➔</span>
                    </button>
                  </div>

                  <form onSubmit={handleStudentLogin} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        学籍番号 または ログインID
                      </label>
                      <input
                        type="text"
                        value={loginId}
                        onChange={(e) => setLoginId(e.target.value)}
                        placeholder="例: 5424001"
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-slate-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        パスワード
                      </label>
                      <input
                        type="password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••"
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-slate-800"
                      />
                    </div>
                    <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={keepLoggedIn}
                        onChange={(e) => setKeepLoggedIn(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        ログイン状態を保持する（{REMEMBER_LOGIN_DAYS}日間）
                        <span className="block text-[11px] text-slate-500">共用のパソコンではチェックしないでください</span>
                      </span>
                    </label>
                    <button
                      type="submit"
                      disabled={isAuthBusy}
                      className="w-full py-2 bg-slate-900 text-white rounded-md text-xs font-medium hover:bg-slate-800 transition disabled:opacity-60"
                    >
                      {isAuthBusy ? '確認中...' : 'ログインしてカルテを読み込む'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthTab('forgot'); setAuthError(null); setAuthNotice(null); setForgotIdentifier(loginId.trim()); }}
                      className="w-full text-center text-[11px] text-slate-600 underline underline-offset-2 hover:text-slate-900"
                    >
                      パスワード・ログインIDを忘れた方
                    </button>
                  </form>

                  {/* 端末内だけの古いアカウントは、短いパスワードのままサーバーに移さない */}
                  {migrationAccount && (
                    <form onSubmit={handleMigrationSubmit} className="p-3 rounded-lg border border-amber-300 bg-amber-50 space-y-2">
                      <p className="text-[11px] text-amber-900 leading-relaxed">
                        {migrationAccount.name}さんのアカウントは、この端末だけに保存されている古い形式です。パスワードを忘れたときにメールで再設定できるよう、新しいパスワード（{PASSWORD_MIN_LENGTH}文字以上）を設定してください。カルテはそのまま使えます。
                      </p>
                      <input
                        type="password"
                        value={migrationPassword}
                        onChange={(e) => setMigrationPassword(e.target.value)}
                        placeholder={`新しいパスワード（${PASSWORD_MIN_LENGTH}文字以上）`}
                        autoComplete="new-password"
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white"
                      />
                      <button type="submit" disabled={isAuthBusy} className="w-full py-2 bg-slate-900 text-white rounded-md text-xs font-medium disabled:opacity-60">
                        新しいパスワードを設定してログイン
                      </button>
                    </form>
                  )}

                  {/* 1クリック体験デモアカウント */}
                  <div className="pt-3 border-t border-slate-200">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      💡 ワンクリック体験（デモアカウントはパスワード不要）
                    </p>
                    <div className="space-y-2">
                      {Object.values(INITIAL_DEMO_ACCOUNTS).map((demo) => (
                        <button
                          key={demo.id}
                          type="button"
                          onClick={() => handleSwitchToStudent(demo)}
                          className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition flex items-center justify-between"
                        >
                          <div>
                            <div className="font-semibold text-slate-900 text-xs">
                              {demo.name}（学籍番号: {demo.id}）
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {demo.department} {demo.grade}年 ｜ {demo.admissionYear === 'reiwa7_or_later' ? '令和7年度新カリ' : '令和6年度以前旧カリ'}
                            </div>
                          </div>
                          <span className="text-[11px] px-2 py-1 bg-slate-100 text-slate-700 rounded font-medium">
                            切り替え ➔
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: 新規学生登録 */}
              {authTab === 'register' && (
                <form onSubmit={handleStudentRegister} className="space-y-4">
                  {/* ステップ 1: Gemini APIキー連携（必須・完全無料） */}
                  <div className="p-3.5 bg-gradient-to-br from-indigo-50/90 via-blue-50/70 to-purple-50/50 border border-indigo-200 rounded-xl space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <span>🔑</span>
                        <span>ステップ 1: Gemini APIキーの取得・設定</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold border border-amber-200">
                          必須
                        </span>
                      </span>
                      {(apiKey || regApiKey.trim()) ? (
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                          ✓ 連携準備完了
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          ⚠️ 未設定
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      エネコマのAI履修相談・時間割OCR解析には、Google公式の<strong>Gemini APIキー</strong>が必要です。<br />
                      Googleアカウント（大学のGmailや個人のGoogle等）があれば<strong>クレジットカード不要・完全無料（約1分）</strong>で即時発行できます。
                    </p>

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition shrink-0"
                      >
                        <span>🌐 Google AI Studioで無料APIキーを取得する (約1分) ↗</span>
                      </a>
                      <button
                        type="button"
                        onClick={handleTestRegApiKey}
                        disabled={isTestingKey || (!regApiKey.trim() && !apiKey.trim())}
                        className="inline-flex items-center justify-center px-3 py-2 bg-white hover:bg-slate-100 border border-indigo-200 text-slate-700 rounded-lg text-xs font-medium transition disabled:opacity-50 shrink-0"
                      >
                        {isTestingKey ? 'テスト中...' : '接続テスト'}
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        取得したGemini APIキーを貼り付け <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={regApiKey}
                          onChange={(e) => {
                            setRegApiKey(e.target.value);
                            if (authError) setAuthError(null);
                          }}
                          placeholder="AIzaSy...（コピーしたキーを貼り付け）"
                          className="w-full px-3 py-2 pr-16 border border-indigo-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-500 hover:text-slate-800 px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200"
                        >
                          {showApiKey ? '非表示' : '表示'}
                        </button>
                      </div>
                    </div>

                    {regKeyTestResult && (
                      <div className={`p-2 rounded-md text-xs border ${
                        regKeyTestResult.success
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}>
                        {regKeyTestResult.message}
                      </div>
                    )}

                    <p className="text-[10px] text-slate-500">
                      🔒 入力されたAPIキーはお使いの端末（ブラウザのlocalStorage）内にのみ安全に保存され、日大外部のサーバーに送信されることはありません。
                    </p>
                  </div>

                  {/* ステップ 2: 学生基本情報 */}
                  <div className="pt-2 border-t border-slate-200">
                    <label className="block text-xs font-bold text-slate-800 mb-2">
                      👤 ステップ 2: 学生基本情報
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        学籍番号 または ユーザーID <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={regId}
                        onChange={(e) => setRegId(e.target.value)}
                        placeholder="例: 5425123"
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-slate-800"
                        required
                        disabled={isRegistering}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        氏名 / ニックネーム <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="例: 日大 太郎"
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-slate-800"
                        required
                        disabled={isRegistering}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        所属学科
                      </label>
                      <select
                        value={regDept}
                        onChange={(e) => setRegDept(e.target.value)}
                        className="w-full px-2.5 py-2 border border-slate-300 rounded-md text-xs bg-white"
                        disabled={isRegistering}
                      >
                        {CHS_DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        学年
                      </label>
                      <select
                        value={regGrade}
                        onChange={(e) => setRegGrade(Number(e.target.value))}
                        className="w-full px-2.5 py-2 border border-slate-300 rounded-md text-xs bg-white"
                        disabled={isRegistering}
                      >
                        <option value={1}>1年</option>
                        <option value={2}>2年</option>
                        <option value={3}>3年</option>
                        <option value={4}>4年</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        カリキュラム体系
                      </label>
                      <select
                        value={regAdmissionYear}
                        onChange={(e) => setRegAdmissionYear(e.target.value as any)}
                        className="w-full px-2.5 py-2 border border-slate-300 rounded-md text-xs bg-white"
                        disabled={isRegistering}
                      >
                        <option value="reiwa7_or_later">令和7年度以降（新カリキュラム）</option>
                        <option value="reiwa6_or_earlier">令和6年度以前（旧カリキュラム）</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        パスワード（{PASSWORD_MIN_LENGTH}文字以上・必須）
                      </label>
                      <input
                        type="password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        autoComplete="new-password"
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                        disabled={isRegistering}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        メールアドレス（任意）
                      </label>
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="example@example.com"
                        autoComplete="email"
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                        disabled={isRegistering}
                      />
                      <p className="mt-1 text-[10px] text-slate-500">パスワードやログインIDを忘れたときに使います。確認メールのリンクを開くと登録が完了します。</p>
                    </div>
                  </div>

                  {/* 1. コース（複数選択可） */}
                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-800">
                        🎯 ステップ 3: 取得希望コース・資格課程（任意）
                      </label>
                      <span className="text-[11px] text-slate-500">任意</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">
                      教職・学芸員・司書等のコースを選択すると、カルテ上で進捗や自由選択単位を自動算定します。
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {GAKUBU_YORAN_COURSES.map((c) => {
                        const isSelected = regCourses.includes(c.name);
                        return (
                          <button
                            key={c.name}
                            type="button"
                            onClick={() => {
                              setRegCourses((prev) =>
                                isSelected ? prev.filter((x) => x !== c.name) : [...prev, c.name]
                              );
                            }}
                            className={`px-2.5 py-2 rounded-lg text-xs font-medium text-left border transition flex items-center justify-between ${
                              isSelected
                                ? 'bg-slate-900 border-slate-900 text-white shadow-2xs'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                            }`}
                          >
                            <span className="truncate">{c.name.replace('コース', '')}</span>
                            <span className="text-[11px] ml-1">{isSelected ? '✓' : '+'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. 副専攻（複数選択可） */}
                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-800">
                        🏅 修了を目指す副専攻（複数選択可）
                      </label>
                      <span className="text-[11px] text-slate-500">任意</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">
                      学際副専攻（SDGs・データサイエンス等）や他学科の副専攻を選択できます（16単位で修了）。
                    </p>

                    {/* 学際副専攻 クイックトグル */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {['SDGs副専攻', 'グローバル副専攻', 'データサイエンス副専攻', 'STEAM副専攻', '日本語教育副専攻'].map((mName) => {
                        const isSelected = regMinors.includes(mName);
                        return (
                          <button
                            key={mName}
                            type="button"
                            onClick={() => {
                              setRegMinors((prev) =>
                                isSelected ? prev.filter((x) => x !== mName) : [...prev, mName]
                              );
                            }}
                            className={`px-2.5 py-1.5 rounded-full text-xs font-medium border transition ${
                              isSelected
                                ? 'bg-emerald-800 border-emerald-800 text-white shadow-2xs'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                            }`}
                          >
                            {isSelected ? `✓ ${mName}` : `+ ${mName}`}
                          </button>
                        );
                      })}
                    </div>

                    {/* その他の学科副専攻 ドロップダウン選択 */}
                    <div className="flex items-center space-x-2">
                      <select
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val && !regMinors.includes(val)) {
                            setRegMinors((prev) => [...prev, val]);
                          }
                          e.target.value = '';
                        }}
                        defaultValue=""
                        className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-md text-xs bg-white text-slate-700"
                      >
                        <option value="" disabled>＋ 学科副専攻を一覧から追加...</option>
                        {GAKUBU_YORAN_ALL_24_MINORS.filter(
                          (m) => !['SDGs副専攻', 'グローバル副専攻', 'データサイエンス副専攻', 'STEAM副専攻', '日本語教育副専攻'].includes(m.name)
                        ).map((m) => (
                          <option key={m.name} value={m.name} disabled={regMinors.includes(m.name)}>
                            {m.name} {regMinors.includes(m.name) ? '（追加済み）' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 選択中の副専攻バッジ一覧 */}
                    {regMinors.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 p-2 bg-slate-50 border border-slate-200 rounded-md">
                        <span className="text-[11px] text-slate-500 font-medium self-center mr-1">選択中:</span>
                        {regMinors.map((m) => (
                          <span
                            key={m}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-white border border-slate-300 text-slate-800 font-medium"
                          >
                            <span>{m}</span>
                            <button
                              type="button"
                              onClick={() => setRegMinors((prev) => prev.filter((x) => x !== m))}
                              className="ml-1.5 text-slate-400 hover:text-rose-600 font-bold"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3. 任意：時間割・成績表の添付（AIが履修プロフィールを自動作成） */}
                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-800">
                        📎 任意添付：時間割 ＆ 成績通知書（AI自動解析）
                      </label>
                      <span className="text-[11px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded">
                        ファイル添付でカルテ即時作成
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2.5">
                      今の時間割や成績通知書（画像・PDF・CSV等）を添付すると、AIが「履修中科目」や「修得単位・GPA」を読み込んで学生カルテを自動構築します（空欄でも登録可能）。
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* 今期の時間割 */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="text-xs font-semibold text-slate-800 mb-1 flex items-center space-x-1">
                          <span>📅</span>
                          <span>今期の時間割表（任意）</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mb-2">
                          履修中科目・曜日・時限・教室・今期単位を自動反映
                        </p>
                        {regTimetableFile ? (
                          <div className="p-2 bg-white border border-slate-300 rounded text-xs flex items-center justify-between">
                            <div className="truncate mr-2">
                              <div className="font-semibold text-slate-800 truncate text-[11px]">
                                {regTimetableFile.name}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {(regTimetableFile.size / 1024).toFixed(1)} KB
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setRegTimetableFile(null)}
                              className="text-[11px] text-rose-600 hover:text-rose-800 font-medium whitespace-nowrap px-1.5 py-0.5"
                            >
                              ✕ 解除
                            </button>
                          </div>
                        ) : (
                          <label className="flex items-center justify-center space-x-1.5 p-2 bg-white border border-dashed border-slate-300 rounded text-xs text-slate-600 hover:border-slate-500 hover:text-slate-900 cursor-pointer transition">
                            <span>📎</span>
                            <span className="font-medium">時間割ファイルを選択</span>
                            <input
                              type="file"
                              accept="*/*"
                              onChange={(e) => handleRegFileSelect(e, 'timetable')}
                              className="hidden"
                              disabled={isRegistering}
                            />
                          </label>
                        )}
                      </div>

                      {/* 成績通知書 */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="text-xs font-semibold text-slate-800 mb-1 flex items-center space-x-1">
                          <span>📊</span>
                          <span>成績通知書（任意）</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mb-2">
                          修得済み単位・現在GPA・過去の修得科目を自動反映
                        </p>
                        {regTranscriptFile ? (
                          <div className="p-2 bg-white border border-slate-300 rounded text-xs flex items-center justify-between">
                            <div className="truncate mr-2">
                              <div className="font-semibold text-slate-800 truncate text-[11px]">
                                {regTranscriptFile.name}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {(regTranscriptFile.size / 1024).toFixed(1)} KB
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setRegTranscriptFile(null)}
                              className="text-[11px] text-rose-600 hover:text-rose-800 font-medium whitespace-nowrap px-1.5 py-0.5"
                            >
                              ✕ 解除
                            </button>
                          </div>
                        ) : (
                          <label className="flex items-center justify-center space-x-1.5 p-2 bg-white border border-dashed border-slate-300 rounded text-xs text-slate-600 hover:border-slate-500 hover:text-slate-900 cursor-pointer transition">
                            <span>📎</span>
                            <span className="font-medium">成績通知書を選択</span>
                            <input
                              type="file"
                              accept="*/*"
                              onChange={(e) => handleRegFileSelect(e, 'transcript')}
                              className="hidden"
                              disabled={isRegistering}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 登録ボタン & AI解析インジケーター */}
                  <div className="pt-2">
                    {isRegistering && regStatusText && (
                      <div className="mb-2 p-2.5 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-md flex items-center space-x-2">
                        <svg className="animate-spin h-4 w-4 text-blue-600 flex-shrink-0" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span className="font-medium">{regStatusText}</span>
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={isRegistering}
                      className={`w-full py-2.5 rounded-lg text-xs font-semibold transition flex items-center justify-center space-x-2 ${
                        isRegistering
                          ? 'bg-slate-400 text-white cursor-not-allowed'
                          : 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm'
                      }`}
                    >
                      {isRegistering ? (
                        <>
                          <span>AIがファイルを解析中...</span>
                        </>
                      ) : (
                        <>
                          <span>✨ アカウントを作成して開始</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 3: 学生カルテ (Info) */}
              {authTab === 'info' && currentStudent && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{currentStudent.name}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-mono">
                        学籍番号: {currentStudent.id}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600">
                      {currentStudent.department} {currentStudent.grade}年 ｜ {currentStudent.admissionYear === 'reiwa7_or_later' ? '令和7年度新カリ' : '令和6年度以前旧カリ'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="p-2.5 bg-white border border-slate-200 rounded-md">
                      <div className="text-slate-400 text-[11px]">今期履修中</div>
                      <div className="text-base font-bold text-slate-900">{userProfile.semesterCredits}単位</div>
                      <div className="text-[10px] text-slate-500">{userProfile.enrolledCourses.length}科目</div>
                    </div>
                    <div className="p-2.5 bg-white border border-slate-200 rounded-md">
                      <div className="text-slate-400 text-[11px]">修得済み単位</div>
                      <div className="text-base font-bold text-slate-900">{userProfile.currentCredits} / 124</div>
                      <div className="text-[10px] text-slate-500">GPA: {userProfile.currentGpa.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAuthModal(false);
                        setShowProfileModal(true);
                      }}
                      className="w-full py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                    >
                      ⚙️ 履修科目・時間割を編集する
                    </button>
                    <button
                      type="button"
                      onClick={handleStudentLogout}
                      className="w-full py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-md text-xs font-medium hover:bg-rose-100 transition"
                    >
                      🚪 ログアウト（ゲストモードへ戻る）
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: 保存済み全アカウント一覧切替 */}
              {authTab === 'forgot' && (
                <div className="space-y-4">
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    メールアドレスを登録して確認が済んでいるアカウントが対象です。メールが届かない場合は、迷惑メールフォルダも確認してください。
                  </p>
                  <form onSubmit={(e) => { e.preventDefault(); handleForgotRequest('request_password_reset'); }} className="p-3 rounded-lg border border-slate-200 space-y-2">
                    <div className="text-xs font-bold text-slate-900">パスワードを再設定する</div>
                    <input
                      type="text"
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      placeholder="ログインID または メールアドレス"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                    />
                    <button type="submit" disabled={isAuthBusy} className="w-full py-2 bg-slate-900 text-white rounded-md text-xs font-medium disabled:opacity-60">
                      再設定のメールを送る
                    </button>
                  </form>
                  <form onSubmit={(e) => { e.preventDefault(); handleForgotRequest('request_login_id'); }} className="p-3 rounded-lg border border-slate-200 space-y-2">
                    <div className="text-xs font-bold text-slate-900">ログインID（学籍番号）を確認する</div>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="登録したメールアドレス"
                      autoComplete="email"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                    />
                    <button type="submit" disabled={isAuthBusy} className="w-full py-2 bg-slate-900 text-white rounded-md text-xs font-medium disabled:opacity-60">
                      ログインIDをメールで受け取る
                    </button>
                  </form>
                  <button type="button" onClick={() => { setAuthTab('login'); setAuthError(null); setAuthNotice(null); }} className="text-[11px] text-slate-600 underline underline-offset-2">
                    ログイン画面に戻る
                  </button>
                </div>
              )}

              {authTab === 'reset' && (
                <form onSubmit={handleResetPassword} className="space-y-3">
                  <p className="text-[11px] text-slate-600">新しいパスワード（{PASSWORD_MIN_LENGTH}文字以上）を設定してください。リンクは30分間、1回だけ使えます。</p>
                  <input
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="新しいパスワード"
                    autoComplete="new-password"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                  />
                  <input
                    type="password"
                    value={resetPasswordConfirm}
                    onChange={(e) => setResetPasswordConfirm(e.target.value)}
                    placeholder="確認のためもう一度"
                    autoComplete="new-password"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                  />
                  <button type="submit" disabled={isAuthBusy || !resetToken} className="w-full py-2 bg-slate-900 text-white rounded-md text-xs font-medium disabled:opacity-60">
                    パスワードを変更する
                  </button>
                </form>
              )}

              {authTab === 'switch' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">
                    このブラウザに保存されている学生カルテの一覧です。切り替えるにはパスワードの入力が必要です（デモアカウントは不要）。
                  </p>
                  <div className="space-y-2">
                    {Object.values(loadAllAccounts()).map((acc) => {
                      const isCurrent = currentStudent?.id === acc.id;
                      return (
                        <div
                          key={acc.id}
                          className={`p-3 rounded-lg border flex items-center justify-between transition ${
                            isCurrent
                              ? 'bg-slate-100 border-slate-400'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div>
                            <div className="font-semibold text-slate-900 text-xs flex items-center space-x-1.5">
                              <span>{acc.name}</span>
                              {isCurrent && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                                  現在ログイン中
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              学籍番号: {acc.id} ｜ {acc.department} {acc.grade}年
                            </div>
                          </div>
                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => {
                                if (isDemoAccountId(acc.id)) {
                                  handleSwitchToStudent(acc);
                                  return;
                                }
                                // 共用の端末で他の人のカルテを開けないよう、パスワードを確認してから切り替える
                                setLoginId(acc.id);
                                setLoginPassword('');
                                setAuthError(null);
                                setAuthNotice(`${acc.name}さんのパスワードを入力してください。`);
                                setAuthTab('login');
                              }}
                              className="px-2.5 py-1 text-xs bg-slate-800 text-white rounded font-medium hover:bg-slate-900 transition"
                            >
                              {isDemoAccountId(acc.id) ? '選択' : 'ログイン'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* モーダルフッター */}
            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end rounded-b-xl">
              <button
                type="button"
                onClick={() => {
                  setShowAuthModal(false);
                  setAuthError(null);
                }}
                className="px-4 py-1.5 bg-slate-800 text-white rounded-md text-xs font-medium hover:bg-slate-900"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 管理者用：メール送信ログ（直近50件・7日間） */}
      {isAdmin && showMailLogModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85dvh] flex flex-col border border-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-2 p-4 border-b border-slate-100">
              <div className="min-w-0 flex-1 basis-56">
                <h3 className="font-bold text-slate-900 text-sm">📧 メール送信ログ</h3>
                <p className="text-[11px] text-slate-500">直近50件を7日間保存。宛先は伏せ字で、本文・リンク・パスワードは保存していません。</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                <button type="button" onClick={() => void loadMailLog()} disabled={isLoadingMailLog} className="px-2.5 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-60">
                  {isLoadingMailLog ? '読み込み中…' : '再読み込み'}
                </button>
                <button type="button" onClick={() => setShowMailLogModal(false)} className="px-2.5 py-1 text-xs bg-slate-900 text-white rounded">
                  閉じる
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto space-y-2 text-xs">
              {mailLogError && <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-700">{mailLogError}</div>}
              {mailLogEntries && mailLogEntries.length === 0 && !mailLogError && (
                <p className="text-slate-500">記録はまだありません。メールを送る操作をしてから「再読み込み」を押してください。</p>
              )}
              {mailLogEntries?.map((e, i) => (
                <div
                  key={`${e.at}-${i}`}
                  className={`p-2.5 rounded-lg border ${
                    e.status === 'sent' ? 'border-emerald-200 bg-emerald-50' : e.status === 'failed' ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-semibold text-slate-900">
                    <span className={e.status === 'sent' ? 'text-emerald-700' : e.status === 'failed' ? 'text-rose-700' : 'text-amber-800'}>
                      {e.status === 'sent' ? '送信' : e.status === 'failed' ? '失敗' : '送信せず'}
                    </span>
                    <span className="font-normal text-slate-500">{e.at.replace('T', ' ').slice(0, 19)}</span>
                    <span>{e.to}</span>
                    {e.provider && <span className="font-normal text-slate-500">via {e.provider}</span>}
                  </div>
                  {e.subject && <div className="text-slate-700">{e.subject}</div>}
                  {e.reason && <div className="text-amber-900">理由：{e.reason}</div>}
                  {e.response && <div className="text-slate-600 break-all">応答：{e.response}</div>}
                  {e.detail && <div className="text-slate-500 break-all">{e.detail}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          管理者ログインモーダル
      ======================================================== */}
      {showAdminLoginModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                <span>👑</span>
                <span>管理者認証</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAdminLoginModal(false);
                  setAdminAuthError(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdminLogin} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  管理者コード
                </label>
                <input
                  type="password"
                  value={adminCodeInput}
                  onChange={(e) => setAdminCodeInput(e.target.value)}
                  placeholder="管理者コードを入力"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                  autoFocus
                />
              </div>

              {adminAuthError && (
                <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {adminAuthError}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminLoginModal(false);
                    setAdminAuthError(null);
                  }}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md transition"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-slate-900 text-white font-medium rounded-md hover:bg-slate-800 transition"
                >
                  認証
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          管理者コントロールパネル（メンテナンス日時・設定）
      ======================================================== */}
      {showAdminControlModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-5 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                <span>⚙️</span>
                <span>システムメンテナンス管理設定</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAdminControlModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs max-h-[80vh] overflow-y-auto pr-1">
              {maintenanceStorageWarning && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 font-medium">
                  ⚠️ {maintenanceStorageWarning}
                </div>
              )}

              {/* メンテナンストグルと状態表示 */}
              <div className={`p-4 rounded-xl border transition ${editMaintActive ? 'bg-rose-50 border-rose-300 text-rose-950' : 'bg-emerald-50 border-emerald-300 text-emerald-950'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{editMaintActive ? '🛠️' : '🟢'}</span>
                    <span className="font-bold text-sm">
                      {editMaintActive ? 'メンテナンスモード：有効（実施中）' : 'メンテナンスモード：無効（通常稼働中）'}
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editMaintActive}
                      onChange={(e) => setEditMaintActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-12 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                  </label>
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">
                  {editMaintActive
                    ? '⚠️ 現在、管理者以外がアクセスすると指定のメンテナンス画面が表示され、利用が制限されます。'
                    : '✓ 現在、すべての学生が通常通り空き教室検索、時間割管理、AIチャットを利用できます。'}
                </p>

                {/* ワンクリック設定プリセット */}
                <div className="flex flex-wrap gap-1.5 pt-3 mt-3 border-t border-slate-200/60">
                  <span className="text-[10px] text-slate-500 self-center mr-1">クイック設定:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditMaintActive(true);
                      setEditMaintStart('2026年10月27日(火) 01:00');
                      setEditMaintEnd('2026年10月27日(火) 06:00');
                      setEditMaintServices('全機能（空き教室検索、時間割管理、AIチャット、アカウント機能）');
                      setEditMaintMessage('現在、新機能の追加および学部要覧・時間割データの更新作業を行っております。');
                    }}
                    className="px-2 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-[10px] font-medium"
                  >
                    🌙 深夜定期メンテ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditMaintActive(true);
                      setEditMaintStart('ただいま実施中');
                      setEditMaintEnd('本日作業完了まで');
                      setEditMaintServices('全機能');
                      setEditMaintMessage('緊急のサーバーメンテナンスおよびデータ更新を行っております。');
                    }}
                    className="px-2 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-[10px] font-medium"
                  >
                    🚨 緊急メンテ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditMaintActive(false);
                    }}
                    className="px-2 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-[10px] font-medium"
                  >
                    🟢 通常稼働に戻す
                  </button>
                </div>
              </div>

              {/* 開始日時 */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  開始日時表示テキスト（例: 2026年10月27日(火) 01:00）
                </label>
                <input
                  type="text"
                  value={editMaintStart}
                  onChange={(e) => setEditMaintStart(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 text-xs"
                />
              </div>

              {/* 終了日時 */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  終了日時表示テキスト（例: 2026年10月27日(火) 06:00）
                </label>
                <input
                  type="text"
                  value={editMaintEnd}
                  onChange={(e) => setEditMaintEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 text-xs"
                />
              </div>

              {/* 対象サービス */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  対象サービス
                </label>
                <input
                  type="text"
                  value={editMaintServices}
                  onChange={(e) => setEditMaintServices(e.target.value)}
                  placeholder="例: 全機能（空き教室検索、時間割管理、AIチャット、アカウント機能）"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 text-xs"
                />
              </div>

              {/* 告知メッセージ */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  お知らせメッセージ
                </label>
                <textarea
                  value={editMaintMessage}
                  onChange={(e) => setEditMaintMessage(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 text-xs"
                />
              </div>

              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                💡 管理者権限で認証されているため、いつでも設定の切り替えやメンテナンスの解除が可能です。
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdminControlModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md transition"
                >
                  閉じる
                </button>
                <button
                  type="button"
                  onClick={handleSaveMaintenance}
                  disabled={isSavingMaintenance}
                  className="px-4 py-1.5 text-xs bg-slate-900 text-white font-semibold rounded-md hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {isSavingMaintenance ? '保存中...' : '設定を保存して即時反映'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
