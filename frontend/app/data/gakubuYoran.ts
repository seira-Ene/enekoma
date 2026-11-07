import { isEarnedGrade } from './courseGrades';
import {
  VERIFIED_COURSES_CURRICULUM,
  VERIFIED_MINORS_CURRICULUM,
  CourseOrMinorItem,
  CourseCurriculumDef,
  MinorCurriculumDef
} from './coursesAndMinorsCurriculum';
import {
  VERIFIED_12_DEPARTMENTS_CURRICULUM,
  DepartmentCurriculumCourse
} from './departmentCurriculum';
// 日本大学文理学部（CHS）公式ナレッジベース：『学部要覧（令和7年度 / 2025年度）』
// 本ファイルは公式『学部要覧』全ページ（履修要綱、共通カリキュラム、全18学科カリキュラム、6コース科目、全24副専攻、各種資格）の完全準拠データです。

export interface RequiredCourseItem {
  name: string;
  credits: number;
  year?: number; // 配当年次 (1〜4)
  semester?: '前期' | '後期' | '通年';
  category?: '必修' | '選択必修' | '共通必修' | '学科必修' | '選択';
  group?: string; // 例: '入門必修（14単位）', '基本科目（12単位選択必修）', 'A群（18単位以上選択必修）' など
  note?: string;
}

export interface ElectiveCategory {
  group: string;
  requiredCredits: number;
  description: string;
}

export interface ProgressionMilestone {
  timing: string;
  condition: string;
  consequence: string;
  page: number;
}

export interface DepartmentGraduationReq {
  department: string;
  zengakuReq: number; // 全学共通（自主創造の基礎）
  sogoReq: number;    // 総合教育（人文2, 社会2, 理学2を含む）
  gaikokugoReq: number; // 外国語教育
  gaikokugoDetail: string;
  kishoReq: number;   // 基礎教育（健康スポーツ3, 情報リテラシー2）
  majorReq: number;   // 学科専門 必修
  majorOpt: number;   // 学科専門 選択
  majorTotal: number; // 学科専門 計
  freeOpt: number;    // 自由選択区分
  total: number;      // 卒業要件総単位数（全学科 124単位）
  page: number;       // 学部要覧 該当ページ
  prerequisitesNotice: string; // 3年次・4年次進級・卒論/ゼミ着手要件
  requiredCourses: RequiredCourseItem[]; // 学科ごとの必修科目リスト
  electiveRequiredCourses?: RequiredCourseItem[]; // 学科ごとの選択必修科目リスト
  electiveCategories?: ElectiveCategory[];
  milestones?: ProgressionMilestone[];
}

// =========================================================================
// 1. 全18学科公式カリキュラム完全データ（学部要覧 p.31, p.68〜139準拠）
// =========================================================================
export const GAKUBU_YORAN_DEPARTMENTS: Record<string, DepartmentGraduationReq> = {
  '哲学科': {
    department: '哲学科',
    zengakuReq: 2,
    sogoReq: 12,
    gaikokugoReq: 8,
    gaikokugoDetail: '一言語8単位 または 二言語(各4単位)計8単位 (p.44)',
    kishoReq: 5,
    majorReq: 28,
    majorOpt: 40,
    majorTotal: 68,
    freeOpt: 29,
    total: 124,
    page: 68,
    prerequisitesNotice: '【3年次終了時】卒業に必要な単位を80単位以上修得していないと、4年次の必修科目「卒業論文」（8単位）を履修できず、4年間で卒業できません（要覧 p.69）。',
    requiredCourses: [
      { name: '自主創造の基礎', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '全学共通教育科目' },
      { name: '健康・スポーツ教育論', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '健康・スポーツ教育実習1', credits: 1, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '情報リテラシー', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '学問の扉', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: 'クリティカル・シンキング1', credits: 1, year: 1, semester: '前期', category: '学科必修' },
      { name: 'クリティカル・シンキング2', credits: 1, year: 1, semester: '後期', category: '学科必修' },
      { name: '哲学概論', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '倫理学概論', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '美学概論', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '宗教学概論', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '哲学講究', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: '倫理学講究', credits: 2, year: 2, semester: '後期', category: '学科必修' },
      { name: '美学講究', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: '宗教学講究', credits: 2, year: 2, semester: '後期', category: '学科必修' },
      { name: '卒業論文', credits: 8, year: 4, semester: '通年', category: '学科必修', note: '3年次終了時80単位以上修得が履修条件' }
    ],
    milestones: [
      { timing: '3年次終了時', condition: '総修得単位数が80単位以上であること', consequence: '満たない場合、4年次必修科目「卒業論文」（8単位）を履修不可（卒業延期）', page: 69 }
    ]
  },
  '史学科': {
    department: '史学科',
    zengakuReq: 2,
    sogoReq: 12,
    gaikokugoReq: 8,
    gaikokugoDetail: '一言語8単位 または 二言語(各4単位)計8単位 (p.44)',
    kishoReq: 5,
    majorReq: 12,
    majorOpt: 54,
    majorTotal: 66,
    freeOpt: 31,
    total: 124,
    page: 72,
    prerequisitesNotice: '【2年次終了時】卒業必要単位50単位以上修得、「自主創造の基礎」修得、基礎実習（D群）1単位以上修得の3要件をすべて満たさないと3年次配当科目（ゼミナール）を履修できません（要覧 p.73）。ゼミは同一分野・同一教員で1〜4を修得。',
    requiredCourses: [
      { name: '自主創造の基礎', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '全学共通教育科目' },
      { name: '健康・スポーツ教育論', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '健康・スポーツ教育実習1', credits: 1, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '情報リテラシー', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '学問の扉', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '史学概論', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '卒業論文', credits: 8, year: 4, semester: '通年', category: '学科必修' }
    ],
    electiveCategories: [
      { group: 'A群（歴史学入門）', requiredCredits: 4, description: '日本史・東洋史・西洋史・考古学の基礎' },
      { group: 'B群（歴史学講究）', requiredCredits: 8, description: '講究科目' },
      { group: 'C群（時代史・特講）', requiredCredits: 16, description: '専門時代史' },
      { group: 'D群（基礎実習）', requiredCredits: 2, description: '史学科基礎実習（2年次1単位以上修得必須）' },
      { group: 'E群（史料講読等）', requiredCredits: 4, description: '古文書・史料講読' },
      { group: 'F群（ゼミナール）', requiredCredits: 8, description: 'ゼミナール1〜4（各2単位・同一教員）' }
    ],
    milestones: [
      { timing: '2年次終了時', condition: '修得単位50単位以上 ＋ 自主創造の基礎修得 ＋ 基礎実習(D群)1単位以上修得', consequence: '満たさない場合、3年次配当科目（ゼミナール等）を履修不可', page: 73 }
    ]
  },
  '国文学科': {
    department: '国文学科',
    zengakuReq: 2,
    sogoReq: 12,
    gaikokugoReq: 8,
    gaikokugoDetail: '一言語8単位 または 二言語(各4単位)計8単位 (p.44)',
    kishoReq: 5,
    majorReq: 30,
    majorOpt: 30,
    majorTotal: 60,
    freeOpt: 37,
    total: 124,
    page: 76,
    prerequisitesNotice: '【2年次終了時】修得単位数が50単位未満の場合、3年次必修科目「特殊研究ゼミナール」を履修できず、4年間で卒業できなくなります（要覧 p.77）。選択必修A群12単位、B群8単位含む。',
    requiredCourses: [
      { name: '自主創造の基礎', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '全学共通教育科目' },
      { name: '健康・スポーツ教育論', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '健康・スポーツ教育実習1', credits: 1, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '情報リテラシー', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '学問の扉', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '日本語学入門1', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '日本語学入門2', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '日本文学入門1', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '日本文学入門2', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '国文学基礎演習1', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '国文学基礎演習2', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '日本語文法論', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: '日本文学史1', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: '日本文学史2', credits: 2, year: 2, semester: '後期', category: '学科必修' },
      { name: '漢文学1', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: '漢文学2', credits: 2, year: 2, semester: '後期', category: '学科必修' },
      { name: '卒業論文', credits: 4, year: 4, semester: '通年', category: '学科必修' }
    ],
    milestones: [
      { timing: '2年次終了時', condition: '修得単位数が50単位以上であること', consequence: '50単位未満の場合、3年次必修「特殊研究ゼミナール」を履修不可', page: 77 }
    ]
  },
  '中国語中国文化学科': {
    department: '中国語中国文化学科',
    zengakuReq: 2,
    sogoReq: 12,
    gaikokugoReq: 18,
    gaikokugoDetail: '必修中国語1〜14（14単位）＋ 必修以外の同一言語4単位以上 (p.31, p.44)',
    kishoReq: 5,
    majorReq: 10,
    majorOpt: 48,
    majorTotal: 58,
    freeOpt: 29,
    total: 124,
    page: 80,
    prerequisitesNotice: '「中国語1〜8」を6単位以上修得しないと「中国語9〜14」を履修不可。研究ゼミは「自主創造の基礎」「学問の扉」「中国語1〜14」「中国学入門1〜4」修得が条件（要覧 p.81）。',
    requiredCourses: [
      { name: '自主創造の基礎', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '全学共通教育科目' },
      { name: '中国語1〜14', credits: 14, year: 1, semester: '通年', category: '共通必修', note: '外国語必修（中国語1〜8は1年、9〜14は2年配当）' },
      { name: '健康・スポーツ教育論', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '健康・スポーツ教育実習1', credits: 1, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '情報リテラシー', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '学問の扉', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '中国学入門1', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '中国学入門2', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '中国学入門3', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: '中国学入門4', credits: 2, year: 2, semester: '後期', category: '学科必修' }
    ],
    milestones: [
      { timing: '2年次履修時', condition: '「中国語1〜8」のうち6単位以上修得済み', consequence: '満たない場合、「中国語9〜14」を履修不可', page: 81 },
      { timing: '3年次ゼミ着手時', condition: '自主創造の基礎、学問の扉、中国語1〜14、中国学入門1〜4を修得済み', consequence: '研究ゼミナール1〜4を履修不可', page: 81 }
    ]
  },
  '英文学科': {
    department: '英文学科',
    zengakuReq: 2,
    sogoReq: 12,
    gaikokugoReq: 16,
    gaikokugoDetail: '必修英語1〜12（12単位）＋ 英語以外の同一言語4単位以上 (p.31, p.44)',
    kishoReq: 5,
    majorReq: 48,
    majorOpt: 14,
    majorTotal: 62,
    freeOpt: 27,
    total: 124,
    page: 84,
    prerequisitesNotice: '【3年次終了時】修得単位数が80単位以上でないと、4年次必修「卒業論文1及び2」（各4単位）を履修できません（要覧 p.85）。選択必修A群4単位、B群6単位、C群4単位。',
    requiredCourses: [
      { name: '自主創造の基礎', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '全学共通教育科目' },
      { name: '英語1〜12', credits: 12, year: 1, semester: '通年', category: '共通必修', note: '外国語必修（1〜8は1年、9〜12は2年配当）' },
      { name: '健康・スポーツ教育論', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '健康・スポーツ教育実習1', credits: 1, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '情報リテラシー', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '学問の扉', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: 'Academic English 1', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: 'Academic English 2', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '英語学概説1', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '英語学概説2', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '英語文学概説1', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '英語文学概説2', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '英文法1', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '英文法2', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: 'Academic English 3', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: 'Academic English 4', credits: 2, year: 2, semester: '後期', category: '学科必修' },
      { name: '英語文学史1', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: '英語文学史2', credits: 2, year: 2, semester: '後期', category: '学科必修' },
      { name: '英文学演習1', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: '英文学演習2', credits: 2, year: 2, semester: '後期', category: '学科必修' },
      { name: 'Academic English 5', credits: 2, year: 3, semester: '前期', category: '学科必修' },
      { name: 'Academic English 6', credits: 2, year: 3, semester: '後期', category: '学科必修' },
      { name: '専門演習1', credits: 2, year: 3, semester: '前期', category: '学科必修' },
      { name: '専門演習2', credits: 2, year: 3, semester: '後期', category: '学科必修' },
      { name: '卒業論文1', credits: 4, year: 4, semester: '前期', category: '学科必修', note: '3年終了時80単位以上必要' },
      { name: '卒業論文2', credits: 4, year: 4, semester: '後期', category: '学科必修' }
    ],
    milestones: [
      { timing: '3年次終了時', condition: '修得単位数が80単位以上であること', consequence: '満たない場合、4年次必修科目「卒業論文1・2」（計8単位）を履修不可', page: 85 }
    ]
  },
  'ドイツ文学科': {
    department: 'ドイツ文学科',
    zengakuReq: 2,
    sogoReq: 12,
    gaikokugoReq: 16,
    gaikokugoDetail: '必修ドイツ語1〜12（12単位）＋ ドイツ語以外の同一言語4単位以上 (p.31, p.44)',
    kishoReq: 5,
    majorReq: 20,
    majorOpt: 40,
    majorTotal: 60,
    freeOpt: 29,
    total: 124,
    page: 88,
    prerequisitesNotice: '【3年次演習・卒業予備研究履修条件】ドイツ語1〜8全修得＋2年次指定科目3単位以上。【4年次卒論・卒研履修条件】修得単位78単位以上＋専門24単位以上＋指定科目充足（要覧 p.89）。',
    requiredCourses: [
      { name: '自主創造の基礎', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '全学共通教育科目' },
      { name: 'ドイツ語1〜12', credits: 12, year: 1, semester: '通年', category: '共通必修', note: '外国語必修（1〜8は1年、9〜12は2年配当）' },
      { name: '健康・スポーツ教育論', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '健康・スポーツ教育実習1', credits: 1, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '情報リテラシー', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '学問の扉', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: 'ドイツ文学入門1', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: 'ドイツ文学入門2', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: 'ドイツ語学入門1', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: 'ドイツ語学入門2', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: 'ドイツ文学史1', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: 'ドイツ文学史2', credits: 2, year: 2, semester: '後期', category: '学科必修' },
      { name: 'ドイツ文化論1', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: 'ドイツ文化論2', credits: 2, year: 2, semester: '後期', category: '学科必修' },
      { name: 'ドイツ語基礎演習', credits: 2, year: 2, semester: '通年', category: '学科必修' }
    ],
    milestones: [
      { timing: '3年次終了時', condition: '修得単位78単位以上 ＋ 学科専門24単位以上', consequence: '4年次卒業論文・卒業演習を履修不可', page: 89 }
    ]
  },
  '社会学科': {
    department: '社会学科',
    zengakuReq: 2,
    sogoReq: 12,
    gaikokugoReq: 8,
    gaikokugoDetail: '一言語8単位 または 二言語(各4単位)計8単位 (p.44)',
    kishoReq: 5,
    majorReq: 18,
    majorOpt: 52,
    majorTotal: 70,
    freeOpt: 27,
    total: 124,
    page: 92,
    prerequisitesNotice: '【2年次終了時】修得単位数が50単位未満の場合、3年次前学期において社会学科の3年次配当科目を履修できません（要覧 p.93）。専門70単位内訳：必修18（入門14、基本4）、選択必修52（基本12、応用28、完成12）。',
    requiredCourses: [
      { name: '自主創造の基礎', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '全学共通教育科目' },
      { name: '健康・スポーツ教育論', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '健康・スポーツ教育実習1', credits: 1, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '情報リテラシー', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '学問の扉', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '社会学概論', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '社会学各論', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '社会学入門1', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '社会学入門2', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '社会調査入門', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: 'データ収集・分析法入門', credits: 2, year: 1, semester: '後期', category: '学科必修' }
    ],
    electiveCategories: [
      { group: '基本選択必修', requiredCredits: 12, description: '社会学史、社会思想の基礎、マス・コミュニケーション論等' },
      { group: '応用選択必修', requiredCredits: 28, description: '社会調査実習1・2、データ分析演習、現代社会学理論等' },
      { group: '完成選択必修', requiredCredits: 12, description: 'ゼミナール1〜4（各1単位）、卒業論文、特殊研究等' }
    ],
    milestones: [
      { timing: '2年次終了時', condition: '修得単位数が50単位以上であること', consequence: '50単位未満の場合、3年次前学期において3年次配当科目を履修不可', page: 93 }
    ]
  },
  '社会福祉学科': {
    department: '社会福祉学科',
    zengakuReq: 2,
    sogoReq: 12,
    gaikokugoReq: 8,
    gaikokugoDetail: '一言語8単位 または 二言語(各4単位)計8単位 (p.44)',
    kishoReq: 5,
    majorReq: 32,
    majorOpt: 31,
    majorTotal: 63,
    freeOpt: 34,
    total: 124,
    page: 96,
    prerequisitesNotice: '※社会福祉士国家試験受験資格を取得する場合は、専門必修32＋専門選択58＝計90単位（自由選択7単位）が必要となります（要覧 p.31, p.96-97）。ソーシャルワーク実習系は再履修不可。',
    requiredCourses: [
      { name: '自主創造の基礎', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '全学共通教育科目' },
      { name: '健康・スポーツ教育論', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '健康・スポーツ教育実習1', credits: 1, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '情報リテラシー', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '学問の扉', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: 'ソーシャルワークの基盤と専門', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '社会福祉概論1', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '社会福祉概論2', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '福祉社会キャリアデザイン論1', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '福祉社会キャリアデザイン論2', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: 'ソーシャルワークの基盤と専門(専門)', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: '福祉マネジメント論', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: '社会保障論1', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: '社会保障論2', credits: 2, year: 2, semester: '後期', category: '学科必修' },
      { name: 'ゼミナール1', credits: 1, year: 3, semester: '前期', category: '学科必修' },
      { name: 'ゼミナール2', credits: 1, year: 3, semester: '後期', category: '学科必修' },
      { name: 'ゼミナール3', credits: 1, year: 4, semester: '前期', category: '学科必修' },
      { name: 'ゼミナール4', credits: 1, year: 4, semester: '後期', category: '学科必修' },
      { name: '卒業論文', credits: 8, year: 4, semester: '通年', category: '学科必修' }
    ],
    milestones: [
      { timing: '3年次終了時', condition: '実習要件および所定単位修得', consequence: '「ソーシャルワーク実習2」の受講可否に直結（実習系科目は再履修不可）', page: 96 }
    ]
  },
  '教育学科': {
    department: '教育学科',
    zengakuReq: 2,
    sogoReq: 12,
    gaikokugoReq: 8,
    gaikokugoDetail: '一言語8単位 または 二言語(各4単位)計8単位 (p.44)',
    kishoReq: 5,
    majorReq: 20,
    majorOpt: 36,
    majorTotal: 56,
    freeOpt: 41,
    total: 124,
    page: 100,
    prerequisitesNotice: '【3年次終了時】総単位数90単位以上修得していないと、4年次で「卒業論文」（または卒業研究）の履修が許可されず、4年間で卒業できません（要覧 p.101）。総合教育で「教育学」を除く。',
    requiredCourses: [
      { name: '自主創造の基礎', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '全学共通教育科目' },
      { name: '健康・スポーツ教育論', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '健康・スポーツ教育実習1', credits: 1, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '情報リテラシー', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '学問の扉', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '教育の理念と歴史', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '日本教育史', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '教育学ゼミナール1', credits: 1, year: 1, semester: '前期', category: '学科必修' },
      { name: '教育学ゼミナール2', credits: 1, year: 1, semester: '後期', category: '学科必修' },
      { name: '教育学ゼミナール3', credits: 1, year: 2, semester: '前期', category: '学科必修' },
      { name: '教育学ゼミナール4', credits: 1, year: 2, semester: '後期', category: '学科必修' },
      { name: '教育学ゼミナール5', credits: 1, year: 3, semester: '前期', category: '学科必修' },
      { name: '教育学ゼミナール6', credits: 1, year: 3, semester: '後期', category: '学科必修' },
      { name: '卒業論文', credits: 8, year: 4, semester: '通年', category: '学科必修', note: '卒業研究(4単位)を選択時は必修26/選択30' }
    ],
    milestones: [
      { timing: '3年次終了時', condition: '修得単位数が90単位以上であること', consequence: '満たない場合、4年次必修「卒業論文」（または卒業研究）を履修不可', page: 101 }
    ]
  },
  '体育学科': {
    department: '体育学科',
    zengakuReq: 2,
    sogoReq: 12,
    gaikokugoReq: 8,
    gaikokugoDetail: '一言語8単位 または 二言語(各4単位)計8単位 (p.44)',
    kishoReq: 5,
    majorReq: 12,
    majorOpt: 52,
    majorTotal: 64,
    freeOpt: 33,
    total: 124,
    page: 104,
    prerequisitesNotice: '【3年次終了時】F群（卒業研究）は74単位以上、G群（卒業論文）は90単位以上の修得が必要です（要覧 p.105）。A群1単位、B群1単位、C群2単位、D群1単位、E群4単位必須。',
    requiredCourses: [
      { name: '自主創造の基礎', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '全学共通教育科目' },
      { name: '健康・スポーツ教育論', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '健康・スポーツ教育実習1', credits: 1, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '情報リテラシー', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '学問の扉', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '体育学概論', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '体育原理', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '運動生理学', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '体育測定評価', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: 'バイオメカニクス', credits: 2, year: 2, semester: '後期', category: '学科必修' }
    ],
    electiveCategories: [
      { group: 'A群（水泳・器械・陸上）', requiredCredits: 1, description: '実技必修' },
      { group: 'B群（武道・ダンス）', requiredCredits: 1, description: '実技必修' },
      { group: 'C群（球技系）', requiredCredits: 2, description: '実技必修' },
      { group: 'D群（野外実習）', requiredCredits: 1, description: 'スキー・キャンプ実習等' },
      { group: 'E群（応用・方法論）', requiredCredits: 4, description: '指導法演習' },
      { group: 'F群またはG群', requiredCredits: 4, description: 'F群: 卒業研究(4単位) / G群: 卒業論文(8単位)' }
    ],
    milestones: [
      { timing: '3年次終了時', condition: '卒業研究選択者は74単位以上、卒業論文選択者は90単位以上修得', consequence: '満たない場合、4年次卒業研究/論文を履修不可', page: 105 }
    ]
  },
  '心理学科': {
    department: '心理学科',
    zengakuReq: 2,
    sogoReq: 12,
    gaikokugoReq: 8,
    gaikokugoDetail: '一言語8単位 または 二言語(各4単位)計8単位 (p.44)',
    kishoReq: 5,
    majorReq: 32,
    majorOpt: 34,
    majorTotal: 66,
    freeOpt: 31,
    total: 124,
    page: 108,
    prerequisitesNotice: '【2年次終了時】修得単位数が50単位未満の場合、3年次以降の科目を履修不可。【3年次終了時】90単位未満または1・2年次専門必修20単位未満の場合、4年次科目を履修できません（要覧 p.109）。公認心理師コース科目は原則卒業単位外（心理演習B除く）。',
    requiredCourses: [
      { name: '自主創造の基礎', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '全学共通教育科目' },
      { name: '健康・スポーツ教育論', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '健康・スポーツ教育実習1', credits: 1, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '情報リテラシー', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '学問の扉', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '心理学概論1', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '心理学概論2', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '行動心理学概論', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '臨床心理学概論', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '心理学ゼミ1', credits: 1, year: 1, semester: '前期', category: '学科必修' },
      { name: '心理学ゼミ2', credits: 1, year: 1, semester: '後期', category: '学科必修' },
      { name: '心理学統計法1', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: '心理学統計法2', credits: 2, year: 2, semester: '後期', category: '学科必修' },
      { name: '心理調査', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: '心理学研究法', credits: 2, year: 2, semester: '後期', category: '学科必修' },
      { name: '心理学実験A', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: '心理学実験B', credits: 2, year: 2, semester: '後期', category: '学科必修' },
      { name: '心理情報処理実習1', credits: 2, year: 2, semester: '通年', category: '学科必修' },
      { name: '心理学ゼミ3', credits: 1, year: 2, semester: '前期', category: '学科必修' },
      { name: '心理学ゼミ4', credits: 1, year: 2, semester: '後期', category: '学科必修' },
      { name: '心理的アセスメント', credits: 2, year: 3, semester: '前期', category: '学科必修' },
      { name: '心理学研究', credits: 2, year: 3, semester: '後期', category: '学科必修' }
    ],
    milestones: [
      { timing: '2年次終了時', condition: '修得単位数が50単位以上であること', consequence: '50単位未満の場合、3年次以降の科目を履修不可', page: 109 },
      { timing: '3年次終了時', condition: '総単位数90単位以上 かつ 1・2年次専門必修20単位以上修得', consequence: '満たない場合、4年次科目を履修不可（卒業延期）', page: 109 }
    ]
  },
  '地理学科': {
    department: '地理学科',
    zengakuReq: 2,
    sogoReq: 12,
    gaikokugoReq: 8,
    gaikokugoDetail: '一言語8単位 または 二言語(各4単位)計8単位 (p.44)',
    kishoReq: 5,
    majorReq: 40,
    majorOpt: 34,
    majorTotal: 74,
    freeOpt: 23,
    total: 124,
    page: 112,
    prerequisitesNotice: '【2年次終了時】50単位未満は3年次配当科目を履修不可。課題研究1・2は1年次指定科目修得が先修条件。卒業研究1・2は課題研究1・2修得が先修条件（要覧 p.113）。',
    requiredCourses: [
      { name: '自主創造の基礎', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '全学共通教育科目' },
      { name: '健康・スポーツ教育論', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '健康・スポーツ教育実習1', credits: 1, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '情報リテラシー', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '学問の扉', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '自然地理学基礎1', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '自然地理学基礎2', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '人文地理学基礎1', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '人文地理学基礎2', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '地理学基礎演習', credits: 2, year: 1, semester: '通年', category: '学科必修' },
      { name: '地図学', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: '地理情報システム(GIS)', credits: 2, year: 2, semester: '後期', category: '学科必修' },
      { name: '地理学野外調査法1', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: '地理学野外調査法2', credits: 2, year: 2, semester: '後期', category: '学科必修' },
      { name: '地理学課題研究1', credits: 2, year: 3, semester: '前期', category: '学科必修', note: '1年次必修6科目修得が先修条件' },
      { name: '地理学課題研究2', credits: 2, year: 3, semester: '後期', category: '学科必修' },
      { name: '地理学野外実習1', credits: 2, year: 3, semester: '前期', category: '学科必修' },
      { name: '地理学野外実習2', credits: 2, year: 3, semester: '後期', category: '学科必修' },
      { name: '地理学卒業研究1', credits: 4, year: 4, semester: '前期', category: '学科必修', note: '課題研究1・2修得が先修条件' },
      { name: '地理学卒業研究2', credits: 4, year: 4, semester: '後期', category: '学科必修' }
    ],
    milestones: [
      { timing: '2年次終了時', condition: '修得単位数が50単位以上であること', consequence: '50単位未満の場合、3年次配当科目を履修不可', page: 113 },
      { timing: '3年次課題研究着手時', condition: '自然地理基礎1・2、人文地理基礎1・2、自主創造の基礎、地理学基礎演習を修得済み', consequence: '地理学課題研究1・2を履修不可', page: 113 }
    ]
  },
  '地球科学科': {
    department: '地球科学科',
    zengakuReq: 2,
    sogoReq: 12,
    gaikokugoReq: 8,
    gaikokugoDetail: '一言語8単位 または 二言語(各4単位)計8単位 (p.44)',
    kishoReq: 5,
    majorReq: 20,
    majorOpt: 53,
    majorTotal: 73,
    freeOpt: 24,
    total: 124,
    page: 116,
    prerequisitesNotice: '【2年次終了時】50単位未満は3年次配当科目を履修不可。卒業テーマ研究1・2は総修得90単位以上、1年次必修4科目以上、3年次実験1単位以上、調査研究法1・2修得が条件（要覧 p.117）。総合プログラム（計73単位）とJABEE準拠プログラム（計77単位）あり。総合教育で「地球科学」履修不可。',
    requiredCourses: [
      { name: '自主創造の基礎', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '全学共通教育科目' },
      { name: '健康・スポーツ教育論', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '健康・スポーツ教育実習1', credits: 1, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '情報リテラシー', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '学問の扉', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '地球科学概論1', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '地球科学概論2', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '地球科学基礎実験1', credits: 1, year: 1, semester: '前期', category: '学科必修' },
      { name: '地球科学基礎実験2', credits: 1, year: 1, semester: '後期', category: '学科必修' },
      { name: '地球科学調査研究法1', credits: 2, year: 2, semester: '前期', category: '学科必修', note: '基礎理数2科目修得が先修条件' },
      { name: '地球科学調査研究法2', credits: 2, year: 2, semester: '後期', category: '学科必修' },
      { name: '卒業テーマ研究1', credits: 2, year: 4, semester: '前期', category: '学科必修', note: '90単位以上、実験1単位、調査研究法1・2修得必須' },
      { name: '卒業テーマ研究2', credits: 2, year: 4, semester: '後期', category: '学科必修' }
    ],
    milestones: [
      { timing: '2年次終了時', condition: '修得単位数が50単位以上であること', consequence: '50単位未満の場合、3年次配当科目を履修不可', page: 117 },
      { timing: '4年次卒研着手時', condition: '総修得90単位以上 ＋ 1年必修4科目 ＋ 3年実験1単位以上 ＋ 調査研究法1・2修得', consequence: '卒業テーマ研究1・2を履修不可', page: 117 }
    ]
  },
  '数学科': {
    department: '数学科',
    zengakuReq: 2,
    sogoReq: 12,
    gaikokugoReq: 8,
    gaikokugoDetail: '一言語8単位 または 二言語(各4単位)計8単位 (p.44)',
    kishoReq: 5,
    majorReq: 30,
    majorOpt: 35,
    majorTotal: 65,
    freeOpt: 32,
    total: 124,
    page: 120,
    prerequisitesNotice: '【3年次数学講究1履修条件】前年度までに1年次線形代数1・2/微積1・2より9単位以上修得、かつ2年次指定科目から9単位以上修得（要覧 p.121）。数学研究1・2は講究修得が先修条件。',
    requiredCourses: [
      { name: '自主創造の基礎', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '全学共通教育科目' },
      { name: '健康・スポーツ教育論', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '健康・スポーツ教育実習1', credits: 1, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '情報リテラシー', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '学問の扉', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '線形代数1', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '線形代数2', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '線形代数演習1', credits: 1, year: 1, semester: '前期', category: '学科必修' },
      { name: '線形代数演習2', credits: 1, year: 1, semester: '後期', category: '学科必修' },
      { name: '微分積分1', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '微分積分2', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '微分積分演習1', credits: 1, year: 1, semester: '前期', category: '学科必修' },
      { name: '微分積分演習2', credits: 1, year: 1, semester: '後期', category: '学科必修' },
      { name: '線形代数3', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: '線形代数4', credits: 2, year: 2, semester: '後期', category: '学科必修' },
      { name: '微分積分3', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: '微分積分4', credits: 2, year: 2, semester: '後期', category: '学科必修' },
      { name: '数学講究1', credits: 2, year: 3, semester: '前期', category: '学科必修', note: '1年指定9単位＋2年指定9単位以上修得必須' },
      { name: '数学講究2', credits: 2, year: 3, semester: '後期', category: '学科必修' },
      { name: '数学研究1', credits: 2, year: 4, semester: '前期', category: '学科必修', note: '数学講究2修得が先修条件' },
      { name: '数学研究2', credits: 2, year: 4, semester: '後期', category: '学科必修' }
    ],
    milestones: [
      { timing: '3年次数学講究着手時', condition: '1年次指定線形/微積より9単位以上 ＋ 2年次指定科目より9単位以上修得', consequence: '数学講究1を履修不可', page: 121 }
    ]
  },
  '情報科学科': {
    department: '情報科学科',
    zengakuReq: 2,
    sogoReq: 12,
    gaikokugoReq: 8,
    gaikokugoDetail: '一言語8単位 または 二言語(各4単位)計8単位 (p.44)',
    kishoReq: 5,
    majorReq: 38,
    majorOpt: 22,
    majorTotal: 60,
    freeOpt: 37,
    total: 124,
    page: 124,
    prerequisitesNotice: '【情報科学講究1履修条件】全学共通2単位＋1・2年次学科必修28単位中22単位以上修得、かつ卒業必要単位中62単位以上修得。【情報科学研究1履修条件】講究1・2（4単位）修得かつ卒業必要単位90単位以上修得（要覧 p.125）。※カテゴリ4選択時は専門60/自由37、カテゴリ5選択時は専門50/自由47、カテゴリ6選択時は専門44/自由53。',
    requiredCourses: [
      { name: '自主創造の基礎', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '全学共通教育科目' },
      { name: '健康・スポーツ教育論', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '健康・スポーツ教育実習1', credits: 1, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '情報リテラシー', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '学問の扉', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '基礎プログラミング', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '基礎プログラミング演習', credits: 1, year: 1, semester: '前期', category: '学科必修' },
      { name: '実践プログラミング', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '実践プログラミング演習', credits: 1, year: 1, semester: '後期', category: '学科必修' },
      { name: 'コンピューティング1', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '離散数学', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '基礎微分積分1', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '基礎微分積分2', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '線形代数1', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '線形代数2', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: 'コンピューティング2', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: 'データ構造', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: 'アルゴリズム', credits: 2, year: 2, semester: '後期', category: '学科必修' },
      { name: '確率統計', credits: 2, year: 2, semester: '後期', category: '学科必修' },
      { name: '情報科学講究1', credits: 2, year: 3, semester: '前期', category: '学科必修', note: '1・2年必修28中22単位以上 ＋ 総単位62単位以上' },
      { name: '情報科学講究2', credits: 2, year: 3, semester: '後期', category: '学科必修' },
      { name: '情報科学研究1', credits: 4, year: 4, semester: '前期', category: '学科必修', note: '講究1・2修得 ＋ 総単位90単位以上' },
      { name: '情報科学研究2', credits: 4, year: 4, semester: '後期', category: '学科必修' }
    ],
    milestones: [
      { timing: '3年次講究着手時', condition: '全学共通2単位 ＋ 1・2年必修28単位中22単位以上 ＋ 総修得単位62単位以上', consequence: '情報科学講究1を履修不可', page: 125 },
      { timing: '4年次研究着手時', condition: '情報科学講究1・2（4単位）修得 ＋ 卒業必要単位中90単位以上修得', consequence: '情報科学研究1を履修不可', page: 125 }
    ]
  },
  '物理学科': {
    department: '物理学科',
    zengakuReq: 2,
    sogoReq: 12,
    gaikokugoReq: 8,
    gaikokugoDetail: '一言語8単位 または 二言語(各4単位)計8単位 (p.44)',
    kishoReq: 5,
    majorReq: 66,
    majorOpt: 12,
    majorTotal: 78,
    freeOpt: 19,
    total: 124,
    page: 128,
    prerequisitesNotice: '【2年次終了時】50単位未満は3年次配当科目を履修不可。【特別研究A履修条件】物理実験A・B及び発展物理実験A・Bを全修得、自主創造の基礎修得、上記を含め100単位以上修得（要覧 p.129）。総合教育で「物理学」履修不可。',
    requiredCourses: [
      { name: '自主創造の基礎', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '全学共通教育科目' },
      { name: '健康・スポーツ教育論', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '健康・スポーツ教育実習1', credits: 1, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '情報リテラシー', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '学問の扉', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '力学1', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '力学2', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '物理数学1', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '物理数学2', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '基礎物理実験A', credits: 1, year: 1, semester: '前期', category: '学科必修' },
      { name: '基礎物理実験B', credits: 1, year: 1, semester: '後期', category: '学科必修' },
      { name: '電磁気学1', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: '電磁気学2', credits: 2, year: 2, semester: '後期', category: '学科必修' },
      { name: '熱力学', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: '統計力学', credits: 2, year: 2, semester: '後期', category: '学科必修' },
      { name: '量子力学1', credits: 2, year: 2, semester: '後期', category: '学科必修' },
      { name: '物理実験A', credits: 1, year: 2, semester: '前期', category: '学科必修' },
      { name: '物理実験B', credits: 1, year: 2, semester: '後期', category: '学科必修' },
      { name: '量子力学2', credits: 2, year: 3, semester: '前期', category: '学科必修' },
      { name: '発展物理実験A', credits: 2, year: 3, semester: '前期', category: '学科必修' },
      { name: '発展物理実験B', credits: 2, year: 3, semester: '後期', category: '学科必修' },
      { name: '特別研究A', credits: 8, year: 4, semester: '通年', category: '学科必修', note: '実験全修得＋自主創造修得＋100単位以上' }
    ],
    milestones: [
      { timing: '2年次終了時', condition: '修得単位数が50単位以上であること', consequence: '50単位未満の場合、3年次配当科目を履修不可', page: 129 },
      { timing: '4年次卒研着手時', condition: '基礎・専門実験全修得 ＋ 自主創造の基礎修得 ＋ 総修得100単位以上', consequence: '特別研究Aを履修不可', page: 129 }
    ]
  },
  '生命科学科': {
    department: '生命科学科',
    zengakuReq: 2,
    sogoReq: 12,
    gaikokugoReq: 8,
    gaikokugoDetail: '一言語8単位 または 二言語(各4単位)計8単位 (p.44)',
    kishoReq: 5,
    majorReq: 55,
    majorOpt: 22,
    majorTotal: 77,
    freeOpt: 20,
    total: 124,
    page: 132,
    prerequisitesNotice: '【2年次終了時】50単位未満は3年次配当科目を履修不可。【特別研究1・2履修条件】生命科学実験1〜3中2科目修得、1〜3年次必修47単位中45単位以上修得、上記を含め104単位以上修得（要覧 p.133）。',
    requiredCourses: [
      { name: '自主創造の基礎', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '全学共通教育科目' },
      { name: '健康・スポーツ教育論', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '健康・スポーツ教育実習1', credits: 1, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '情報リテラシー', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '学問の扉', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '生命科学概論1', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '生命科学概論2', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '細胞生物学', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '生化学', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '基礎科学実験1', credits: 1, year: 1, semester: '前期', category: '学科必修' },
      { name: '基礎科学実験2', credits: 1, year: 1, semester: '後期', category: '学科必修' },
      { name: '分子生物学', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: '遺伝学', credits: 2, year: 2, semester: '後期', category: '学科必修' },
      { name: '代謝生理学', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: '生命科学基礎実験1', credits: 1, year: 2, semester: '前期', category: '学科必修' },
      { name: '生命科学基礎実験2', credits: 1, year: 2, semester: '後期', category: '学科必修' },
      { name: '特別研究1', credits: 4, year: 4, semester: '前期', category: '学科必修', note: '実験2科目＋必修47中45単位＋104単位以上' },
      { name: '特別研究2', credits: 4, year: 4, semester: '後期', category: '学科必修' }
    ],
    milestones: [
      { timing: '2年次終了時', condition: '修得単位数が50単位以上であること', consequence: '50単位未満の場合、3年次配当科目を履修不可', page: 133 },
      { timing: '4年次卒研着手時', condition: '生命科学実験2科目修得 ＋ 必修47単位中45単位以上 ＋ 総修得104単位以上', consequence: '特別研究1・2を履修不可', page: 133 }
    ]
  },
  '化学科': {
    department: '化学科',
    zengakuReq: 2,
    sogoReq: 12,
    gaikokugoReq: 8,
    gaikokugoDetail: '一言語8単位 または 二言語(各4単位)計8単位 (p.44)',
    kishoReq: 5,
    majorReq: 52,
    majorOpt: 24,
    majorTotal: 76,
    freeOpt: 21,
    total: 124,
    page: 136,
    prerequisitesNotice: '【2年次終了時】50単位未満は3年次配当科目を履修不可。【化学特別研究1・2履修条件】全学共通・総合・外国語・基礎全充足、1〜3年次化学科必修全充足、専門選択22単位以上、自由選択16単位以上修得（要覧 p.137）。',
    requiredCourses: [
      { name: '自主創造の基礎', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '全学共通教育科目' },
      { name: '健康・スポーツ教育論', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '健康・スポーツ教育実習1', credits: 1, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '情報リテラシー', credits: 2, year: 1, semester: '前期', category: '共通必修', note: '基礎教育科目' },
      { name: '学問の扉', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '基礎無機化学', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '基礎有機化学', credits: 2, year: 1, semester: '前期', category: '学科必修' },
      { name: '基礎物理化学', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '基礎分析化学', credits: 2, year: 1, semester: '後期', category: '学科必修' },
      { name: '化学実験1', credits: 1, year: 1, semester: '前期', category: '学科必修' },
      { name: '化学実験2', credits: 1, year: 1, semester: '後期', category: '学科必修' },
      { name: '無機化学1', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: '有機化学1', credits: 2, year: 2, semester: '前期', category: '学科必修' },
      { name: '物理化学1', credits: 2, year: 2, semester: '後期', category: '学科必修' },
      { name: '分析化学1', credits: 2, year: 2, semester: '後期', category: '学科必修' },
      { name: '化学実験3', credits: 1, year: 2, semester: '前期', category: '学科必修' },
      { name: '化学実験4', credits: 1, year: 2, semester: '後期', category: '学科必修' },
      { name: '化学特別研究1', credits: 4, year: 4, semester: '前期', category: '学科必修', note: '共通・外国語・基礎・1〜3年必修全充足＋専門選択22＋自由16' },
      { name: '化学特別研究2', credits: 4, year: 4, semester: '後期', category: '学科必修' }
    ],
    milestones: [
      { timing: '2年次終了時', condition: '修得単位数が50単位以上であること', consequence: '50単位未満の場合、3年次配当科目を履修不可', page: 137 },
      { timing: '4年次卒研着手時', condition: '全学・総合・外国語・基礎全充足 ＋ 1〜3年必修全充足 ＋ 専門選択22単位 ＋ 自由選択16単位修得', consequence: '化学特別研究1・2を履修不可', page: 137 }
    ]
  }
};

// =========================================================================

// =========================================================================
// 12学科公式カリキュラム（必修・選択必修・単位数完全同期）
// =========================================================================
Object.entries(VERIFIED_12_DEPARTMENTS_CURRICULUM).forEach(([deptName, info]) => {
  if (GAKUBU_YORAN_DEPARTMENTS[deptName]) {
    GAKUBU_YORAN_DEPARTMENTS[deptName] = {
      ...GAKUBU_YORAN_DEPARTMENTS[deptName],
      majorReq: info.majorReqCredits,
      majorOpt: info.majorElectiveCredits,
      majorTotal: info.majorReqCredits + info.majorElectiveCredits,
      requiredCourses: info.requiredCourses.map((c) => ({
        name: c.name,
        credits: c.credits,
        year: c.year || 1,
        category: '必修' as const,
        group: c.group,
        note: c.note
      })),
      electiveRequiredCourses: info.electiveRequiredCourses.map((c) => ({
        name: c.name,
        credits: c.credits,
        year: c.year || 2,
        category: '選択必修' as const,
        group: c.group,
        note: c.note
      }))
    };
  }
});

// 2. 学部要覧 p.35-36「履修科目登録単位数の上限（CAP制）」完全準拠データ
// =========================================================================
export const GAKUBU_YORAN_CAP_RULES = {
  standardAnnualLimit: 40,
  page: 'p.35-36',
  description: '文理学部においては，一人ひとりの学生の学習効果を向上させるために，年間で履修登録できる単位数の上限を年間40単位と定めています（※履修登録できる科目の合計単位数であり，修得単位数ではありません）。',
  exemptions: [
    '外国語教育科目の「中国語(逆)」再履修科目（中国語1・3・5・7・9・11・13(逆)）',
    '不定期に開講する授業（休暇中に行われる集中授業等）',
    '海外語学研修，海外文化交流',
    'コース科目（司書教諭，司書，学芸員，社会教育主事，教職科目）（※教職コース履修届を提出し許可を得た者）',
    '教職コース履修上の他学科開講専門科目・他学科聴講科目（所定の条件を満たす場合）',
    'その他所属学科が必要と認めた科目（学科専門科目一覧表でアンダーラインと＊が付いた科目）'
  ],
  specialRelief: [
    { condition: '1年次前学期に16単位以上修得し、GPAが2.5以上', bonus: '1年次後学期において4単位加算（年間44単位）' },
    { condition: '前年度に20単位以上修得し、前年度のGPAが3.0以上', bonus: '年間で8単位の加算（年間48単位）' },
    { condition: '前年度に20単位以上修得し、前年度のGPAが2.5以上', bonus: '年間で6単位の加算（年間46単位）' },
    { condition: '前年度に20単位以上修得し、前年度のGPAが2.0以上', bonus: '年間で4単位の加算（年間44単位）' },
    { condition: '前年度に履修し再履修となった科目', bonus: '年間で上限10単位まで加算' },
    { condition: '交換派遣留学生・認定留学生', bonus: '帰国後の直近年度に限り上限20単位（半期の場合は上限10単位）加算' },
    { condition: '編入学者・転部者・転科者・転籍者', bonus: '初年度において年間で上限10単位まで加算' }
  ]
};

// =========================================================================
// 3. 学部要覧 p.38-39「成績評価基準とGPA算出方法」完全準拠データ
// =========================================================================
export const GAKUBU_YORAN_GPA_RULES = {
  page: 'p.38-39',
  grades: [
    { score: '100〜90点', grade: 'S', point: 4.0, desc: '特に優れた成績を示したもの', pass: true },
    { score: '89〜80点', grade: 'A', point: 3.0, desc: '優れた成績を示したもの', pass: true },
    { score: '79〜70点', grade: 'B', point: 2.0, desc: '妥当と認められたもの', pass: true },
    { score: '69〜60点', grade: 'C', point: 1.0, desc: '合格と認められるための成績を示したもの', pass: true },
    { score: '59点以下', grade: 'D', point: 0.0, desc: '合格と認められるに足る成績を示さなかったもの（不合格）', pass: false },
    { score: '成績不提示', grade: 'E', point: 0.0, desc: '履修登録したが成績を示さなかったもの（不合格）', pass: false },
    { score: '履修中止', grade: 'P', point: null, desc: '履修登録後、所定の中止手続きを取ったもの（GPA算定除外）', pass: false },
    { score: '認定', grade: 'N', point: null, desc: '修得単位として認定になったもの（GPA算定除外）', pass: true }
  ],
  formula: 'GPA = (4×S単位 + 3×A単位 + 2×B単位 + 1×C単位) / 総履修単位数(D, Eの単位数も含める)',
  rounding: '小数点以下第3位を四捨五入し、小数点以下第2位までを有効とする。',
  retakeRule: '授業科目を再履修した場合、累積GPA算出の際には最後の履修による成績及び単位数のみを算入し、以前の成績及び単位数は算入しない（要覧 p.39）。'
};

// =========================================================================
// 4. 学部要覧 p.140-177「6つの資格コース」完全準拠データ
// =========================================================================
export interface CourseProgramInfo {
  name: string;
  target: string;
  window: string;
  page: string;
  requiredCredits: number;
  creditsRule: string;
  practicalRequirements?: string;
  keyRequiredCourses: string[];
}

export const GAKUBU_YORAN_COURSES: CourseProgramInfo[] = [
  {
    name: '教職コース',
    target: '中学校・高等学校教諭一種免許状（全学科共通）、特別支援学校教諭免許状（教育学科のみ）',
    window: '教職センター（本館）',
    page: 'p.140-163',
    requiredCredits: 28, // 中一種は概ね28単位＋教職20単位、高一種は36単位＋教職14単位
    creditsRule: '修得単位は卒業要件の「自由選択区分」に算入可能。※ただし「各教科教育法Ⅰ〜Ⅳ」「教育実習事前・事後指導」「教育実習Ⅰ・Ⅱ」「教職実践演習（中・高）」等の実習・実践科目は自由選択に算入不可・GPA対象外（要覧 p.33, p.144）。',
    practicalRequirements: '教育実習条件：4年進級時「卒業見込」、教科教育法4単位含む24単位以上修得、教育の基礎的理解科目19単位以上修得、直前指導受講合格（要覧 p.142）。',
    keyRequiredCourses: [
      '教育原論（教育の理念と歴史）', '現代教職論', '発達と学習（教育心理学）', '特別支援教育概論',
      '教育課程論', '教育制度論', '教育の社会学', '道徳教育の理論と方法', '教育方法・ICT活用論',
      '特別活動・総合的な学習の時間の指導法', '生徒指導・進路指導論', '教育相談', '教職実践演習（中・高）'
    ]
  },
  {
    name: '司書教諭コース',
    target: '学校図書館司書教諭国家資格',
    window: '教職センター（本館）',
    page: 'p.164',
    requiredCredits: 10,
    creditsRule: '修得単位は「自由選択区分」に算入可能（要覧 p.33）。必修5科目10単位すべて修得。教員免許状の取得が前提。修得62単位以上で申請可能。',
    practicalRequirements: '基礎免許（中学校・高校）の取得が必須前提となります。',
    keyRequiredCourses: [
      '学校経営と学校図書館', '学校図書館メディアの構成', '学習指導と学校図書館', '読書と豊かな人間性', '情報メディアの活用'
    ]
  },
  {
    name: '司書コース',
    target: '公共図書館等の図書館司書国家資格',
    window: '教務課（本館1階）',
    page: 'p.165',
    requiredCredits: 26,
    creditsRule: '修得単位は「自由選択区分」に算入可能（要覧 p.33）。必修13科目22単位＋選択必修2科目4単位＝計26単位。国家試験はなく科目修得で資格取得。',
    keyRequiredCourses: [
      '図書館情報学概論', '図書館制度・経営論', '図書館情報技術論', '図書館サービス概論',
      '情報サービス論', '情報サービス演習1・2', '児童サービス論', '情報資源組織論', '情報資源組織演習1・2'
    ]
  },
  {
    name: '学芸員コース',
    target: '博物館・美術館・資料館等の学芸員国家資格',
    window: '教務課（本館1階）',
    page: 'p.166-167',
    requiredCredits: 38,
    creditsRule: '修得単位は「自由選択区分」に算入可能（要覧 p.33）。1・2年次「博物館概論」「博物館経営論」修得の上、2年次選考試験合格が必須。必修22単位＋選択16単位＝計38単位。実習費が必要。',
    practicalRequirements: '2年次選考試験合格および博物館実習1〜4の履修が必須。',
    keyRequiredCourses: [
      '博物館概論', '博物館経営論', '博物館資料論', '博物館資料保存論1・2', '博物館展示論',
      '博物館教育論', '博物館情報・メディア論', '博物館実習1〜4'
    ]
  },
  {
    name: '社会教育主事コース',
    target: '社会教育主事任用資格／社会教育士称号',
    window: '教務課（本館1階）',
    page: 'p.168-169',
    requiredCredits: 25,
    creditsRule: '修得単位は「自由選択区分」に算入可能（要覧 p.33）。大学に2年以上在学し62単位以上修得＋コース科目修得で任用資格・社会教育士。必修17単位＋選択必修8単位＝計25単位。',
    keyRequiredCourses: [
      '生涯学習論', '社会教育論', '社会教育経営論1・2', '地域教育論', '社会教育課題研究1・2', '社会教育演習1・2', '社会教育実習'
    ]
  },
  {
    name: '日本語教育コース',
    target: '登録日本語教員（国家資格）経過措置Cルート／日本語教員養成',
    window: '教務課（本館1階）',
    page: 'p.170-171',
    requiredCredits: 26,
    creditsRule: '修得単位は「自由選択区分」に算入可能（要覧 p.33）。必修11単位＋選択必修2単位を含む計26単位以上修得で修了証書。修了者は日本語教員試験の「基礎試験」と「実践研修」が免除（応用試験のみ）。実習履修には4科目8単位含む20単位修得が必要。',
    practicalRequirements: '日本語教育実習の履修には指定4科目8単位を含む計20単位修得が必要。',
    keyRequiredCourses: [
      '日本語教育学入門', '日本語教授法1・2', '第二言語習得論', '日本語教材研究', '日本語教育評価法', '日本語教育実習'
    ]
  }
];

// =========================================================================
// 5. 学部要覧 p.180-192「副専攻（全24種）」完全準拠データ
// =========================================================================
export interface MinorProgramInfo {
  name: string;
  type: 'academic' | 'department';
  targetDept?: string;
  creditsReq: number;
  window: string;
  page: string;
  ruleNotice: string;
  description: string;
  recommendedCourses: string[];
}

export const GAKUBU_YORAN_ALL_24_MINORS: MinorProgramInfo[] = [
  // --- 5つの学際副専攻（全学科対象） ---
  {
    name: 'グローバル・コミュニケーション副専攻',
    type: 'academic',
    creditsReq: 16,
    window: '教務課・国際交流委員会',
    page: 'p.190',
    ruleNotice: '全学科の学生が履修可能です。',
    description: '英語などの実践的コミュニケーション能力と異文化理解を深める学際副専攻。',
    recommendedCourses: ['Academic English', 'Advanced Communication', '異文化間コミュニケーション論', '海外語学研修']
  },
  {
    name: 'ダイバーシティ副専攻',
    type: 'academic',
    creditsReq: 16,
    window: '教務課・ダイバーシティ推進委員会',
    page: 'p.191',
    ruleNotice: '全学科の学生が履修可能です。',
    description: '性別、SOGI、国籍、障害などの多様性を尊重し共生社会の課題解決を学ぶ学際副専攻。',
    recommendedCourses: ['ダイバーシティ＆インクルージョン', 'ジェンダー論', 'LGBTQを知る', '特別ニーズ教育総論']
  },
  {
    name: 'データサイエンス副専攻',
    type: 'academic',
    creditsReq: 16,
    window: '教務課・CC運営委員会',
    page: 'p.191',
    ruleNotice: '全学科の学生が履修可能です。',
    description: 'データ処理、ビッグデータ、統計解析、AI基礎スキルを体系的に習得する学際副専攻。',
    recommendedCourses: ['情報リテラシー', 'データ処理基礎', 'ビッグデータサイエンス', 'アルゴリズムとデータ構造', '基礎統計学']
  },
  {
    name: '科学リテラシー副専攻',
    type: 'academic',
    creditsReq: 16,
    window: '教務課・理系6学科',
    page: 'p.192',
    ruleNotice: '⚠️ 注意：理系6学科（地理・地球科学・数学・情報科学・物理・生命科学・化学）所属学生は修了認定を受けられません（文系11学科・体育学科対象）。',
    description: '文系学生が自然科学の基礎的思考法とリテラシーを修得するための学際副専攻。',
    recommendedCourses: ['数学の世界', '物理学の世界', '化学の世界', '生命科学の世界', '地球科学の世界']
  },
  {
    name: '地域デザイン副専攻',
    type: 'academic',
    creditsReq: 16,
    window: '教務課・地域連携推進委員会',
    page: 'p.192',
    ruleNotice: '全学科の学生が履修可能です。',
    description: '地域社会の活性化、まちづくり、地域防災、自治体連携について多角的に探究する学際副専攻。',
    recommendedCourses: ['都市と地域の社会学', '地域社会論', '地域教育論', '都市地理学', '野外調査法']
  },

  // --- 19の学科副専攻 ---
  {
    name: '哲学副専攻',
    type: 'department',
    targetDept: '哲学科',
    creditsReq: 16,
    window: '哲学科事務室 / 教務課',
    page: 'p.181',
    ruleNotice: '※哲学科の学生は修了認定を受けられません。',
    description: '哲学・倫理学・美学・宗教学の体系的理論と批判的思考を修得。',
    recommendedCourses: ['哲学概論', '倫理学概論', '美学概論', '宗教学概論']
  },
  {
    name: '史学副専攻',
    type: 'department',
    targetDept: '史学科',
    creditsReq: 16,
    window: '史学科事務室 / 教務課',
    page: 'p.181',
    ruleNotice: '※史学科の学生は修了認定を受けられません。',
    description: '日本史・東洋史・西洋史・考古学の史料読解と歴史的視野を修得。',
    recommendedCourses: ['史学概論', '日本史概説', '東洋史概説', '西洋史概説', '考古学概説']
  },
  {
    name: '日本語日本文学副専攻',
    type: 'department',
    targetDept: '国文学科',
    creditsReq: 16,
    window: '国文学科事務室 / 教務課',
    page: 'p.182',
    ruleNotice: '※国文学科の学生は修了認定を受けられません。',
    description: '日本語学および古代〜近現代の日本文学の精緻な読解・表現力を修得。',
    recommendedCourses: ['日本語学入門', '日本文学入門', '日本語文法論', '日本文学史']
  },
  {
    name: '現代文化副専攻',
    type: 'department',
    targetDept: '国文学科',
    creditsReq: 16,
    window: '国文学科事務室 / 教務課',
    page: 'p.182',
    ruleNotice: '※国文学科の学生は修了認定を受けられません。',
    description: '近代・現代のサブカルチャー、映画、マンガ、現代言語文化を分析。',
    recommendedCourses: ['現代文学講義', 'サブカルチャー論', '映像文化論', '現代日本語論']
  },
  {
    name: '中国言語文化副専攻',
    type: 'department',
    targetDept: '中国語中国文化学科',
    creditsReq: 16,
    window: '中国語中国文化学科事務室 / 教務課',
    page: 'p.183',
    ruleNotice: '※中国語中国文化学科の学生は修了認定を受けられません。',
    description: '中国語の運用能力と中国・東アジアの古典・近現代文化を理解。',
    recommendedCourses: ['中国語コミュニケーション', '中国学入門', '中国古典文学概説', '中国文化論']
  },
  {
    name: '英語英文学副専攻',
    type: 'department',
    targetDept: '英文学科',
    creditsReq: 16,
    window: '英文学科事務室 / 教務課',
    page: 'p.183',
    ruleNotice: '※英文学科の学生は修了認定を受けられません。',
    description: '英語学（言語学）およびイギリス・アメリカ文学・文化の専門知を修得。',
    recommendedCourses: ['Academic English', '英語学概説', '英語文学概説', 'イギリス文学史']
  },
  {
    name: 'ドイツ語ヨーロッパ文化副専攻',
    type: 'department',
    targetDept: 'ドイツ文学科',
    creditsReq: 16,
    window: 'ドイツ文学科事務室 / 教務課',
    page: 'p.184',
    ruleNotice: '※ドイツ文学科の学生は修了認定を受けられません。',
    description: 'ドイツ語の実践力と中欧・ヨーロッパの思想・文化・文学を理解。',
    recommendedCourses: ['ドイツ文学入門', 'ドイツ語学入門', 'ドイツ文化論', 'ドイツ文学史']
  },
  {
    name: '社会学副専攻',
    type: 'department',
    targetDept: '社会学科',
    creditsReq: 16,
    window: '社会学科事務室 / 教務課',
    page: 'p.184',
    ruleNotice: '※社会学科の学生は修了認定を受けられません。',
    description: '現代社会の構造、マスメディア、流行、都市、家族等の社会学的探究。',
    recommendedCourses: ['社会学概論', 'マス・メディア論', '社会調査入門', '現代家族論']
  },
  {
    name: '福祉社会システム副専攻',
    type: 'department',
    targetDept: '社会福祉学科',
    creditsReq: 16,
    window: '社会福祉学科事務室 / 教務課',
    page: 'p.185',
    ruleNotice: '※社会福祉学科の学生は修了認定を受けられません。',
    description: '福祉政策、地域共生社会、社会保障システムと相談援助マインドを修得。',
    recommendedCourses: ['社会福祉概論', '社会保障論', '児童福祉論', '高齢者福祉論']
  },
  {
    name: '特別ニーズ教育副専攻',
    type: 'department',
    targetDept: '教育学科',
    creditsReq: 16,
    window: '教育学科事務室 / 教務課',
    page: 'p.185',
    ruleNotice: '※教育学科の学生は修了認定を受けられません。',
    description: '障害児教育、インクルーシブ教育、発達障害支援の専門的知識を修得。',
    recommendedCourses: ['特別支援教育論', '特別ニーズ教育の原理と歴史', '発達障害教育論']
  },
  {
    name: '体育学副専攻',
    type: 'department',
    targetDept: '体育学科',
    creditsReq: 16,
    window: '体育学科事務室 / 教務課',
    page: 'p.186',
    ruleNotice: '※体育学科の学生は修了認定を受けられません。',
    description: 'スポーツ科学、健康管理、運動生理学、コーチングの基礎と実践を修得。',
    recommendedCourses: ['体育学概論', '体育原理', '運動生理学', 'バイオメカニクス']
  },
  {
    name: '心理学副専攻',
    type: 'department',
    targetDept: '心理学科',
    creditsReq: 16,
    window: '心理学科事務室 / 教務課',
    page: 'p.186',
    ruleNotice: '※心理学科の学生は修了認定を受けられません。',
    description: '認知、発達、社会、臨床等の心理学基礎理論とデータ分析手法を習得。',
    recommendedCourses: ['心理学概論1・2', '行動心理学概論', '臨床心理学概論', '発達心理学']
  },
  {
    name: '地理学副専攻',
    type: 'department',
    targetDept: '地理学科',
    creditsReq: 16,
    window: '地理学科事務室 / 教務課',
    page: 'p.187',
    ruleNotice: '※地理学科の学生は修了認定を受けられません。',
    description: '自然環境、人文社会環境、GIS（地理情報システム）、フィールドワーク手法。',
    recommendedCourses: ['自然地理学基礎', '人文地理学基礎', '地図学', 'GIS分析法']
  },
  {
    name: '地球科学副専攻',
    type: 'department',
    targetDept: '地球科学科',
    creditsReq: 16,
    window: '地球科学科事務室 / 教務課',
    page: 'p.187',
    ruleNotice: '※地球科学科の学生は修了認定を受けられません。',
    description: '気象、海洋、地震・火山、地球史、宇宙地球科学の基礎を学ぶ。',
    recommendedCourses: ['地球科学概論1・2', '気圏科学', '水圏科学', '地質学基礎']
  },
  {
    name: '数学副専攻',
    type: 'department',
    targetDept: '数学科',
    creditsReq: 16,
    window: '数学科事務室 / 教務課',
    page: 'p.188',
    ruleNotice: '※数学科の学生は修了認定を受けられません。',
    description: '線形代数、微分積分、代数学、幾何学等の抽象数学と数理的論理思考を修得。',
    recommendedCourses: ['線形代数1・2', '微分積分1・2', '集合と写像', '初等整数論']
  },
  {
    name: '情報科学副専攻',
    type: 'department',
    targetDept: '情報科学科',
    creditsReq: 16,
    window: '情報科学科事務室 / 教務課',
    page: 'p.188',
    ruleNotice: '※情報科学科の学生は修了認定を受けられません。',
    description: 'プログラミング、アルゴリズム、データ構造、システム設計の数理的基礎。',
    recommendedCourses: ['基礎プログラミング', '実践プログラミング', 'コンピューティング1', 'データ構造']
  },
  {
    name: '物理学副専攻',
    type: 'department',
    targetDept: '物理学科',
    creditsReq: 16,
    window: '物理学科事務室 / 教務課',
    page: 'p.189',
    ruleNotice: '※物理学科の学生は修了認定を受けられません。',
    description: '力学、電磁気学、量子力学、熱統計力学の基本原理と実験的手法を修得。',
    recommendedCourses: ['力学1・2', '電磁気学1・2', '物理数学1', '熱力学']
  },
  {
    name: '生命科学副専攻',
    type: 'department',
    targetDept: '生命科学科',
    creditsReq: 16,
    window: '生命科学科事務室 / 教務課',
    page: 'p.189',
    ruleNotice: '※生命科学科の学生は修了認定を受けられません。',
    description: '分子生物学、細胞生物学、生化学、遺伝学、生理学等のバイオサイエンス。',
    recommendedCourses: ['生命科学概論1・2', '細胞生物学', '生化学', '分子生物学']
  },
  {
    name: '化学副専攻',
    type: 'department',
    targetDept: '化学科',
    creditsReq: 16,
    window: '化学科事務室 / 教務課',
    page: 'p.190',
    ruleNotice: '※化学科の学生は修了認定を受けられません。',
    description: '有機化学、無機化学、物理化学、分析化学の4大分野を基礎から習得。',
    recommendedCourses: ['基礎無機化学', '基礎有機化学', '基礎物理化学', '基礎分析化学']
  }
];

// =========================================================================
// 6. ユーザープロフィール型定義
// =========================================================================
export interface CourseRecord {
  name: string;
  credits: number;
  // S/A/B/C は合格、D/E/F は不合格（未修得）、P は履修中止、N は認定。'修得' と '-' は評価が分からない記録（過去の時間割から登録）
  grade?: 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'P' | 'N' | '合格' | '修得' | '-' | string;
  category?: string;
  // 履修した学年（1〜4）
  year?: number;
  // 履修した年度（西暦）と学期。再履修でどの記録が最後かを決めるのに使う
  takenYear?: number;
  term?: string;
}

export interface EnrolledCourseItem {
  name: string;
  day?: string; // '月', '火', '水', '木', '金', '土'
  period?: number; // 1, 2, 3, 4, 5
  room?: string;
  teacher?: string;
  credits: number;
}

export interface UserProfileData {
  department: string;
  grade: number; // 1, 2, 3, 4
  currentCredits: number;
  currentGpa: number;
  targetGpa: number;
  semesterCredits: number;
  selectedCourses: string[]; // 複数選択可
  selectedMinors: string[];  // 複数選択可
  admissionYear?: 'reiwa7_or_later' | 'reiwa6_or_earlier'; // 入学年度・カリキュラム体系
  completedCourses?: CourseRecord[];
  enrolledCourses?: EnrolledCourseItem[]; // 今期履修中科目
}

// =========================================================================
// 7. 段階的不足判定ロジック（優先度1：必修 ➔ 優先度2：コース・副専攻 ➔ 優先度3：卒業124単位）
// =========================================================================
export interface DeficiencyReport {
  department: string;
  deptPage: number;
  grade: number;
  earnedCredits: number;
  remainingCredits: number;
  // 優先度1: 必修・選択必修の区別
  missingMajorReqs: RequiredCourseItem[];
  completedMajorReqs: string[];
  missingElectiveReqs: RequiredCourseItem[];
  completedElectiveReqs: string[];
  majorReqCreditsTarget: number;
  majorElectiveCreditsTarget: number;
  milestonesStatus: { timing: string; condition: string; consequence: string; isWarning: boolean; page: number }[];
  // 優先度2
  coursesAnalysis: {
    name: string;
    window: string;
    page: string;
    reqCredits: number;
    earnedCredits: number;
    isFulfilled: boolean;
    missingCompulsory: CourseOrMinorItem[];
    completedCompulsory: CourseOrMinorItem[];
    note: string;
  }[];
  minorsAnalysis: {
    name: string;
    page: string;
    reqCredits: number;
    earnedCredits: number;
    isValid: boolean;
    isFulfilled: boolean;
    warning?: string;
    missingCompulsory: CourseOrMinorItem[];
    completedCompulsory: CourseOrMinorItem[];
    note: string;
  }[];
  // 優先度3
  zengakuDeficiency: number;
  sogoDeficiency: number;
  gaikokugoDeficiency: number;
  kishoDeficiency: number;
  generalFormatted: string;
}

export function analyzeAcademicDeficiency(profile: UserProfileData): DeficiencyReport {
  const dept = profile.department || '情報科学科';
  const deptData = GAKUBU_YORAN_DEPARTMENTS[dept] || GAKUBU_YORAN_DEPARTMENTS['情報科学科'];
  const earned = Number(profile.currentCredits) || 0;
  const grade = Number(profile.grade) || 2;
  const remainingTotal = Math.max(0, 124 - earned);

  const completedNames = new Set(
    (profile.completedCourses || [])
      .filter((c) => isEarnedGrade(c.grade))
      .map((c) => c.name.trim())
  );

  // 優先度1: 学科必修科目の未修得チェック（必修と選択必修の完全区別）
  const missingMajorReqs: RequiredCourseItem[] = [];
  const completedMajorReqs: string[] = [];
  const missingElectiveReqs: RequiredCourseItem[] = [];
  const completedElectiveReqs: string[] = [];

  // 1. 必修科目（100%修得が必須）
  deptData.requiredCourses.forEach((req) => {
    const isCompleted = Array.from(completedNames).some((name) =>
      name === req.name || name.includes(req.name) || req.name.includes(name)
    );

    if (isCompleted) {
      completedMajorReqs.push(req.name);
    } else {
      missingMajorReqs.push(req);
    }
  });

  // 2. 選択必修科目（指定群・コースから規定単位の修得が必要）
  (deptData.electiveRequiredCourses || []).forEach((req) => {
    const isCompleted = Array.from(completedNames).some((name) =>
      name === req.name || name.includes(req.name) || req.name.includes(name)
    );

    if (isCompleted) {
      completedElectiveReqs.push(req.name);
    } else {
      missingElectiveReqs.push(req);
    }
  });

  // 進級・着手要件マイルストーンチェック
  const milestonesStatus = (deptData.milestones || []).map((ms) => {
    let isWarning = false;
    if (ms.timing === '2年次終了時' && grade >= 2 && earned < 50) {
      isWarning = true;
    } else if (ms.timing === '3年次終了時' && grade >= 3 && earned < 80) {
      isWarning = true;
    }
    return {
      timing: ms.timing,
      condition: ms.condition,
      consequence: ms.consequence,
      isWarning,
      page: ms.page
    };
  });

  // 優先度2: 選択コース・副専攻チェック（必修科目・指定群単位数の完全照合）
  const coursesAnalysis = (profile.selectedCourses || []).map((cName) => {
    const cInfo = GAKUBU_YORAN_COURSES.find((x) => x.name === cName);
    const cDetail = VERIFIED_COURSES_CURRICULUM[cName];
    const missingCompulsory: CourseOrMinorItem[] = [];
    const completedCompulsory: CourseOrMinorItem[] = [];
    let earnedCourseCredits = 0;

    if (cDetail) {
      cDetail.requiredCourses.forEach((req) => {
        const isComp = Array.from(completedNames).some((n) => n === req.name || n.includes(req.name) || req.name.includes(n));
        if (isComp) {
          completedCompulsory.push(req);
          earnedCourseCredits += req.credits;
        } else {
          missingCompulsory.push(req);
        }
      });
      cDetail.electiveRequiredCourses.forEach((ele) => {
        const isComp = Array.from(completedNames).some((n) => n === ele.name || n.includes(ele.name) || ele.name.includes(n));
        if (isComp) {
          earnedCourseCredits += ele.credits;
        }
      });
    }

    const targetCredits = cDetail?.requiredCredits || cInfo?.requiredCredits || 26;
    const isFulfilled = missingCompulsory.length === 0 && earnedCourseCredits >= targetCredits;

    return {
      name: cName,
      window: cDetail?.window || cInfo?.window || '担当窓口',
      page: cDetail?.page || cInfo?.page || 'p.140',
      reqCredits: targetCredits,
      earnedCredits: earnedCourseCredits,
      isFulfilled,
      missingCompulsory,
      completedCompulsory,
      note: cDetail?.description || (cInfo ? `${cInfo.creditsRule} ${cInfo.practicalRequirements || ''}` : '所定のコース科目の履修が必要です。')
    };
  });

  const minorsAnalysis = (profile.selectedMinors || []).map((mName) => {
    const mInfo = GAKUBU_YORAN_ALL_24_MINORS.find((x) => x.name === mName);
    const mDetail = VERIFIED_MINORS_CURRICULUM[mName];
    let isValid = true;
    let warning: string | undefined = undefined;

    if (mInfo?.type === 'department' && mInfo.targetDept === dept) {
      isValid = false;
      warning = `⚠️ 所属学科（${dept}）と同一の学科副専攻は修了認定を受けることができません（要覧 p.180）。`;
    } else if (mName === '科学リテラシー副専攻' && ['地理学科', '地球科学科', '数学科', '情報科学科', '物理学科', '生命科学科', '化学科'].includes(dept)) {
      isValid = false;
      warning = `⚠️ 理系6学科所属学生は「科学リテラシー副専攻」の修了認定を受けることができません（要覧 p.192）。`;
    }

    const missingCompulsory: CourseOrMinorItem[] = [];
    const completedCompulsory: CourseOrMinorItem[] = [];
    let earnedMinorCredits = 0;

    if (mDetail) {
      mDetail.requiredCourses.forEach((req) => {
        const isComp = Array.from(completedNames).some((n) => n === req.name || n.includes(req.name) || req.name.includes(n));
        if (isComp) {
          completedCompulsory.push(req);
          earnedMinorCredits += req.credits;
        } else {
          missingCompulsory.push(req);
        }
      });
      mDetail.electiveRequiredCourses.forEach((ele) => {
        const isComp = Array.from(completedNames).some((n) => n === ele.name || n.includes(ele.name) || ele.name.includes(n));
        if (isComp) {
          earnedMinorCredits += ele.credits;
        }
      });
    }

    const isFulfilled = isValid && missingCompulsory.length === 0 && earnedMinorCredits >= 16;

    return {
      name: mName,
      page: mDetail?.page || mInfo?.page || 'p.180',
      reqCredits: 16,
      earnedCredits: earnedMinorCredits,
      isValid,
      isFulfilled,
      warning,
      missingCompulsory,
      completedCompulsory,
      note: mDetail?.description || (mInfo ? `${mInfo.description} 修了要件：指定科目16単位以上修得。` : '指定科目16単位以上修得で修了証書。')
    };
  });

  // 優先度3: 卒業124単位
  const zengakuDeficiency = Math.max(0, deptData.zengakuReq);
  const sogoDeficiency = Math.max(0, deptData.sogoReq);
  const gaikokugoDeficiency = Math.max(0, deptData.gaikokugoReq);
  const kishoDeficiency = Math.max(0, deptData.kishoReq);

  const generalFormatted = `卒業要件（全18学科共通124単位・要覧 p.31）まで、残り **${remainingTotal}単位** です。`;

  return {
    department: dept,
    deptPage: deptData.page,
    grade,
    earnedCredits: earned,
    remainingCredits: remainingTotal,
    missingMajorReqs,
    completedMajorReqs,
    missingElectiveReqs,
    completedElectiveReqs,
    majorReqCreditsTarget: deptData.majorReq,
    majorElectiveCreditsTarget: deptData.majorOpt,
    milestonesStatus,
    coursesAnalysis,
    minorsAnalysis,
    zengakuDeficiency,
    sogoDeficiency,
    gaikokugoDeficiency,
    kishoDeficiency,
    generalFormatted
  };
}

// =========================================================================
// 8. 目標GPAシミュレーション（S=4.0, A=3.0, B=2.0, C=1.0, D/E=0.0）
// =========================================================================
export interface GpaSimulationResult {
  currentGpa: number;
  targetGpa: number;
  earnedCredits: number;
  semesterCredits: number;
  courseCount: number;
  isAchievable: boolean;
  requiredSemesterAvgGp: number;
  patternA: { sCourses: number; aCourses: number; sCredits: number; aCredits: number };
  patternB: { avgPointText: string; difficulty: 'S評価中心' | 'S・A評価中心' | 'B以上' | '到達困難' };
  explanation: string;
}

export function simulateGpaEngine(
  currentCredits: number,
  currentGpa: number,
  targetGpa: number,
  semesterCredits: number
): GpaSimulationResult {
  const curCredits = Math.max(1, currentCredits);
  const semCredits = Math.max(2, semesterCredits);
  const totalNewCredits = curCredits + semCredits;
  const currentQualityPoints = curCredits * currentGpa;
  const targetQualityPoints = totalNewCredits * targetGpa;
  const neededSemesterPoints = targetQualityPoints - currentQualityPoints;
  const requiredSemesterAvgGp = neededSemesterPoints / semCredits;
  const courseCount = Math.round(semCredits / 2);

  if (requiredSemesterAvgGp > 4.0) {
    return {
      currentGpa,
      targetGpa,
      earnedCredits: curCredits,
      semesterCredits: semCredits,
      courseCount,
      isAchievable: false,
      requiredSemesterAvgGp,
      patternA: { sCourses: courseCount, aCourses: 0, sCredits: semCredits, aCredits: 0 },
      patternB: { avgPointText: '4.00超（今期全科目S評価でも不足）', difficulty: '到達困難' },
      explanation: `今期${semCredits}単位をすべてS評価（4.0）で修得した場合の最大獲得GPAは **${((currentQualityPoints + semCredits * 4.0) / totalNewCredits).toFixed(2)}** となり、目標の **${targetGpa.toFixed(2)}** には届きません。次学期以降も含めた長期計画での引き上げが必要です。`
    };
  }

  // 1科目2単位と仮定してSとAの組み合わせを探索
  let bestS = courseCount;
  let bestA = 0;
  for (let s = courseCount; s >= 0; s--) {
    const a = courseCount - s;
    const pts = s * 2 * 4.0 + a * 2 * 3.0;
    if (pts >= neededSemesterPoints) {
      bestS = s;
      bestA = a;
    }
  }

  const difficulty =
    requiredSemesterAvgGp >= 3.5
      ? 'S評価中心'
      : requiredSemesterAvgGp >= 2.5
      ? 'S・A評価中心'
      : 'B以上';

  return {
    currentGpa,
    targetGpa,
    earnedCredits: curCredits,
    semesterCredits: semCredits,
    courseCount,
    isAchievable: true,
    requiredSemesterAvgGp: Math.max(0, requiredSemesterAvgGp),
    patternA: { sCourses: bestS, aCourses: bestA, sCredits: bestS * 2, aCredits: bestA * 2 },
    patternB: {
      avgPointText: `平均 ${Math.max(1.0, requiredSemesterAvgGp).toFixed(2)} ポイント以上`,
      difficulty
    },
    explanation: `目標GPA（${targetGpa.toFixed(2)}）に到達するには、今期受講する${semCredits}単位（約${courseCount}科目）のうち、**S評価を ${bestS}科目（${bestS * 2}単位）**、**A評価を ${bestA}科目（${bestA * 2}単位）** 以上修得する必要があります（B評価以下は極力避けてください）。`
  };
}
