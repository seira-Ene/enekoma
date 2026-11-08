// 日本大学文理学部 12学科公式カリキュラム（必修科目・選択必修科目・単位数 完全データ）
// 省略記号・省略語を排除し、すべての科目名・配当単位・群分類を網羅

export interface DepartmentCurriculumCourse {
  name: string;
  credits: number;
  category: '必修' | '選択必修';
  group?: string;
  year?: number;
  note?: string;
}

// 学生がどれか1つを選ぶ選択必修の区分（情報科学科のカテゴリ4〜6、社会福祉学科のコース、体育学科のF群・G群）
export interface DepartmentTrack {
  id: string;
  label: string;
  // この区分に属する選択必修科目の group
  groups: string[];
  rule: string;
  // この区分を選んだときに必要な選択必修の単位数（学科全体の majorElectiveCredits と違うとき）
  electiveCredits?: number;
}

export interface DepartmentCurriculumInfo {
  department: string;
  majorReqCredits: number;
  majorElectiveCredits: number;
  requiredSummary: string;
  electiveSummary: string;
  requiredCourses: DepartmentCurriculumCourse[];
  electiveRequiredCourses: DepartmentCurriculumCourse[];
  // 選ぶ区分の呼び方（「カテゴリ」「コース」など）と選択肢
  trackLabel?: string;
  tracks?: DepartmentTrack[];
}

export const VERIFIED_12_DEPARTMENTS_CURRICULUM: Record<string, DepartmentCurriculumInfo> = {
  "社会学科": {
    "department": "社会学科",
    "majorReqCredits": 46,
    "majorElectiveCredits": 24,
    "requiredSummary": "入門必修科目（14単位）＋ 必修基本科目（4単位）＋ 必修応用科目（28単位）＝ 計46単位",
    "electiveSummary": "基本科目（12単位選択必修）＋ 完成科目（12単位選択必修）＝ 計24単位",
    "requiredCourses": [
      {
        "name": "社会学概論",
        "credits": 2,
        "category": "必修",
        "group": "入門必修科目（14単位）",
        "year": 1
      },
      {
        "name": "社会学各論",
        "credits": 2,
        "category": "必修",
        "group": "入門必修科目（14単位）",
        "year": 1
      },
      {
        "name": "社会学入門1",
        "credits": 2,
        "category": "必修",
        "group": "入門必修科目（14単位）",
        "year": 1
      },
      {
        "name": "社会学入門2",
        "credits": 2,
        "category": "必修",
        "group": "入門必修科目（14単位）",
        "year": 1
      },
      {
        "name": "学問の扉",
        "credits": 2,
        "category": "必修",
        "group": "入門必修科目（14単位）",
        "year": 1
      },
      {
        "name": "社会調査入門",
        "credits": 2,
        "category": "必修",
        "group": "入門必修科目（14単位）",
        "year": 1
      },
      {
        "name": "データ収集・分析法入門",
        "credits": 2,
        "category": "必修",
        "group": "入門必修科目（14単位）",
        "year": 1
      },
      {
        "name": "社会学史1",
        "credits": 2,
        "category": "必修",
        "group": "必修基本科目（4単位）",
        "year": 2
      },
      {
        "name": "社会学史2",
        "credits": 2,
        "category": "必修",
        "group": "必修基本科目（4単位）",
        "year": 2
      },
      {
        "name": "社会調査実習1",
        "credits": 2,
        "category": "必修",
        "group": "必修応用科目（28単位）",
        "year": 3
      },
      {
        "name": "社会調査実習2",
        "credits": 2,
        "category": "必修",
        "group": "必修応用科目（28単位）",
        "year": 3
      },
      {
        "name": "データ分析演習",
        "credits": 2,
        "category": "必修",
        "group": "必修応用科目（28単位）",
        "year": 3
      },
      {
        "name": "ゼミナール1",
        "credits": 1,
        "category": "必修",
        "group": "必修応用科目（28単位）",
        "year": 3
      },
      {
        "name": "ゼミナール2",
        "credits": 1,
        "category": "必修",
        "group": "必修応用科目（28単位）",
        "year": 3
      },
      {
        "name": "ゼミナール3",
        "credits": 1,
        "category": "必修",
        "group": "必修応用科目（28単位）",
        "year": 4
      },
      {
        "name": "ゼミナール4",
        "credits": 1,
        "category": "必修",
        "group": "必修応用科目（28単位）",
        "year": 4
      },
      {
        "name": "卒業論文",
        "credits": 8,
        "category": "必修",
        "group": "必修応用科目（28単位）",
        "year": 4
      }
    ],
    "electiveRequiredCourses": [
      {
        "name": "社会思想の基礎",
        "credits": 2,
        "category": "選択必修",
        "group": "基本科目（12単位選択必修）",
        "year": 2
      },
      {
        "name": "社会変動論",
        "credits": 2,
        "category": "選択必修",
        "group": "基本科目（12単位選択必修）",
        "year": 2
      },
      {
        "name": "社会史",
        "credits": 2,
        "category": "選択必修",
        "group": "基本科目（12単位選択必修）",
        "year": 2
      },
      {
        "name": "マス・コミュニケーション論",
        "credits": 2,
        "category": "選択必修",
        "group": "基本科目（12単位選択必修）",
        "year": 2
      },
      {
        "name": "文化人類学",
        "credits": 2,
        "category": "選択必修",
        "group": "基本科目（12単位選択必修）",
        "year": 2
      },
      {
        "name": "現代社会と社会学",
        "credits": 2,
        "category": "選択必修",
        "group": "基本科目（12単位選択必修）",
        "year": 2
      },
      {
        "name": "マス・メディア論",
        "credits": 2,
        "category": "選択必修",
        "group": "基本科目（12単位選択必修）",
        "year": 2
      },
      {
        "name": "都市と地域の社会学",
        "credits": 2,
        "category": "選択必修",
        "group": "基本科目（12単位選択必修）",
        "year": 2
      },
      {
        "name": "企業と働き方の社会学",
        "credits": 2,
        "category": "選択必修",
        "group": "基本科目（12単位選択必修）",
        "year": 2
      },
      {
        "name": "現代家族論",
        "credits": 2,
        "category": "選択必修",
        "group": "基本科目（12単位選択必修）",
        "year": 2
      },
      {
        "name": "社会問題論",
        "credits": 2,
        "category": "選択必修",
        "group": "基本科目（12単位選択必修）",
        "year": 2
      },
      {
        "name": "スポーツの社会学",
        "credits": 2,
        "category": "選択必修",
        "group": "基本科目（12単位選択必修）",
        "year": 2
      },
      {
        "name": "基礎統計学",
        "credits": 2,
        "category": "選択必修",
        "group": "基本科目（12単位選択必修）",
        "year": 2
      },
      {
        "name": "初等多変量解析",
        "credits": 2,
        "category": "選択必修",
        "group": "基本科目（12単位選択必修）",
        "year": 2
      },
      {
        "name": "質的分析法",
        "credits": 2,
        "category": "選択必修",
        "group": "基本科目（12単位選択必修）",
        "year": 2
      },
      {
        "name": "社会学特殊研究Ⅰ",
        "credits": 2,
        "category": "選択必修",
        "group": "完成科目（12単位選択必修）",
        "year": 3
      },
      {
        "name": "社会学特殊研究Ⅱ",
        "credits": 2,
        "category": "選択必修",
        "group": "完成科目（12単位選択必修）",
        "year": 3
      },
      {
        "name": "社会学特殊研究Ⅲ",
        "credits": 2,
        "category": "選択必修",
        "group": "完成科目（12単位選択必修）",
        "year": 3
      },
      {
        "name": "社会学特殊研究Ⅳ",
        "credits": 2,
        "category": "選択必修",
        "group": "完成科目（12単位選択必修）",
        "year": 3
      },
      {
        "name": "社会学特殊研究Ⅴ",
        "credits": 2,
        "category": "選択必修",
        "group": "完成科目（12単位選択必修）",
        "year": 3
      },
      {
        "name": "社会学特殊研究Ⅵ",
        "credits": 2,
        "category": "選択必修",
        "group": "完成科目（12単位選択必修）",
        "year": 3
      },
      {
        "name": "理論・学説特殊研究Ⅰ",
        "credits": 2,
        "category": "選択必修",
        "group": "完成科目（12単位選択必修）",
        "year": 3
      },
      {
        "name": "理論・学説特殊研究Ⅱ",
        "credits": 2,
        "category": "選択必修",
        "group": "完成科目（12単位選択必修）",
        "year": 3
      },
      {
        "name": "政治とジャーナリズム研究",
        "credits": 2,
        "category": "選択必修",
        "group": "完成科目（12単位選択必修）",
        "year": 3
      },
      {
        "name": "情報メディア特殊研究",
        "credits": 2,
        "category": "選択必修",
        "group": "完成科目（12単位選択必修）",
        "year": 3
      },
      {
        "name": "実証・応用特殊研究Ⅰ",
        "credits": 2,
        "category": "選択必修",
        "group": "完成科目（12単位選択必修）",
        "year": 3
      },
      {
        "name": "実証・応用特殊研究Ⅱ",
        "credits": 2,
        "category": "選択必修",
        "group": "完成科目（12単位選択必修）",
        "year": 3
      }
    ]
  },
  "社会福祉学科": {
    "department": "社会福祉学科",
    "majorReqCredits": 32,
    "majorElectiveCredits": 12,
    "requiredSummary": "共通必修 32単位",
    "electiveSummary": "ソーシャルワークコース科目群 または 福祉社会創造コース科目群",
    "requiredCourses": [
      {
        "name": "ソーシャルワークの基盤と専門職",
        "credits": 2,
        "category": "必修",
        "group": "共通必修（32単位）",
        "year": 1
      },
      {
        "name": "ソーシャルワークの基盤と専門職(専門)",
        "credits": 2,
        "category": "必修",
        "group": "共通必修（32単位）",
        "year": 1
      },
      {
        "name": "社会福祉概論1",
        "credits": 2,
        "category": "必修",
        "group": "共通必修（32単位）",
        "year": 1
      },
      {
        "name": "社会福祉概論2",
        "credits": 2,
        "category": "必修",
        "group": "共通必修（32単位）",
        "year": 1
      },
      {
        "name": "学問の扉",
        "credits": 2,
        "category": "必修",
        "group": "共通必修（32単位）",
        "year": 1
      },
      {
        "name": "福祉社会キャリアデザイン論1",
        "credits": 2,
        "category": "必修",
        "group": "共通必修（32単位）",
        "year": 1
      },
      {
        "name": "福祉社会キャリアデザイン論2",
        "credits": 2,
        "category": "必修",
        "group": "共通必修（32単位）",
        "year": 1
      },
      {
        "name": "福祉マネジメント論",
        "credits": 2,
        "category": "必修",
        "group": "共通必修（32単位）",
        "year": 2
      },
      {
        "name": "社会保障論1",
        "credits": 2,
        "category": "必修",
        "group": "共通必修（32単位）",
        "year": 2
      },
      {
        "name": "社会保障論2",
        "credits": 2,
        "category": "必修",
        "group": "共通必修（32単位）",
        "year": 2
      },
      {
        "name": "ゼミナール1",
        "credits": 1,
        "category": "必修",
        "group": "共通必修（32単位）",
        "year": 3
      },
      {
        "name": "ゼミナール2",
        "credits": 1,
        "category": "必修",
        "group": "共通必修（32単位）",
        "year": 3
      },
      {
        "name": "ゼミナール3",
        "credits": 1,
        "category": "必修",
        "group": "共通必修（32単位）",
        "year": 4
      },
      {
        "name": "ゼミナール4",
        "credits": 1,
        "category": "必修",
        "group": "共通必修（32単位）",
        "year": 4
      },
      {
        "name": "卒業論文",
        "credits": 8,
        "category": "必修",
        "group": "共通必修（32単位）",
        "year": 4
      }
    ],
    "electiveRequiredCourses": [
      {
        "name": "ソーシャルワークの理論と方法1",
        "credits": 2,
        "category": "選択必修",
        "group": "ソーシャルワークコース科目群",
        "year": 2
      },
      {
        "name": "ソーシャルワークの理論と方法2",
        "credits": 2,
        "category": "選択必修",
        "group": "ソーシャルワークコース科目群",
        "year": 2
      },
      {
        "name": "ソーシャルワーク演習1",
        "credits": 2,
        "category": "選択必修",
        "group": "ソーシャルワークコース科目群",
        "year": 3
      },
      {
        "name": "ソーシャルワーク演習2",
        "credits": 2,
        "category": "選択必修",
        "group": "ソーシャルワークコース科目群",
        "year": 3
      },
      {
        "name": "ソーシャルワーク実習1",
        "credits": 2,
        "category": "選択必修",
        "group": "ソーシャルワークコース科目群",
        "year": 4
      },
      {
        "name": "ソーシャルワーク実習2",
        "credits": 2,
        "category": "選択必修",
        "group": "ソーシャルワークコース科目群",
        "year": 4
      },
      {
        "name": "福祉法学基礎",
        "credits": 2,
        "category": "選択必修",
        "group": "福祉社会創造コース科目群",
        "year": 2
      },
      {
        "name": "司法福祉論",
        "credits": 2,
        "category": "選択必修",
        "group": "福祉社会創造コース科目群",
        "year": 2
      },
      {
        "name": "社会福祉法制",
        "credits": 2,
        "category": "選択必修",
        "group": "福祉社会創造コース科目群",
        "year": 3
      },
      {
        "name": "福祉政策運営管理",
        "credits": 2,
        "category": "選択必修",
        "group": "福祉社会創造コース科目群",
        "year": 3
      }
    ],
    "trackLabel": "コース",
    "tracks": [
      {
        "id": "socialwork",
        "label": "ソーシャルワークコース",
        "groups": [
          "ソーシャルワークコース科目群"
        ],
        "rule": "ソーシャルワークコース科目群の科目を履修（2年次から）"
      },
      {
        "id": "welfare",
        "label": "福祉社会創造コース",
        "groups": [
          "福祉社会創造コース科目群"
        ],
        "rule": "福祉社会創造コース科目群の科目を履修（2年次から）"
      }
    ]
  },
  "教育学科": {
    "department": "教育学科",
    "majorReqCredits": 24,
    "majorElectiveCredits": 14,
    "requiredSummary": "必修科目（24単位 / 論文選択時）",
    "electiveSummary": "各専門分野の選択必修講義科目",
    "requiredCourses": [
      {
        "name": "自主創造の基礎",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（24単位）",
        "year": 1
      },
      {
        "name": "学問の扉",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（24単位）",
        "year": 1
      },
      {
        "name": "現代教職論",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（24単位）",
        "year": 1
      },
      {
        "name": "教授学習論",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（24単位）",
        "year": 1
      },
      {
        "name": "教育の理念と歴史",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（24単位）",
        "year": 1
      },
      {
        "name": "日本教育史",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（24単位）",
        "year": 2
      },
      {
        "name": "教育学ゼミナール1",
        "credits": 1,
        "category": "必修",
        "group": "必修科目（24単位）",
        "year": 2
      },
      {
        "name": "教育学ゼミナール2",
        "credits": 1,
        "category": "必修",
        "group": "必修科目（24単位）",
        "year": 2
      },
      {
        "name": "教育学ゼミナール3",
        "credits": 1,
        "category": "必修",
        "group": "必修科目（24単位）",
        "year": 3
      },
      {
        "name": "教育学ゼミナール4",
        "credits": 1,
        "category": "必修",
        "group": "必修科目（24単位）",
        "year": 3
      },
      {
        "name": "教育学ゼミナール5",
        "credits": 1,
        "category": "必修",
        "group": "必修科目（24単位）",
        "year": 4
      },
      {
        "name": "教育学ゼミナール6",
        "credits": 1,
        "category": "必修",
        "group": "必修科目（24単位）",
        "year": 4
      },
      {
        "name": "教育学研究法1",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（24単位）",
        "year": 3
      },
      {
        "name": "教育学研究法2",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（24単位）",
        "year": 3
      },
      {
        "name": "卒業論文",
        "credits": 8,
        "category": "必修",
        "group": "必修科目（24単位）",
        "note": "卒業論文(8単位)または卒業研究(4単位)",
        "year": 4
      }
    ],
    "electiveRequiredCourses": [
      {
        "name": "学校教育分野の講義科目",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目群",
        "year": 2
      },
      {
        "name": "発達と人間形成分野の講義科目",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目群",
        "year": 2
      },
      {
        "name": "教育と社会・メディア分野の講義科目",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目群",
        "year": 2
      },
      {
        "name": "教育と国際理解分野の講義科目",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目群",
        "year": 2
      },
      {
        "name": "社会教育及び生涯学習分野の講義科目",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目群",
        "year": 2
      },
      {
        "name": "特別支援教育分野の講義科目",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目群",
        "year": 2
      },
      {
        "name": "特殊課題分野の講義科目",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目群",
        "year": 3
      }
    ]
  },
  "体育学科": {
    "department": "体育学科",
    "majorReqCredits": 12,
    "majorElectiveCredits": 17,
    "requiredSummary": "必修科目（12単位）",
    "electiveSummary": "A群(1単位)＋B群(1単位)＋C群(2単位)＋D群(1単位)＋E群(4単位)＋F群/G群(4〜8単位)",
    "requiredCourses": [
      {
        "name": "体育学概論",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（12単位）",
        "year": 1
      },
      {
        "name": "解剖学",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（12単位）",
        "year": 1
      },
      {
        "name": "生理学",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（12単位）",
        "year": 1
      },
      {
        "name": "運動生理学(基礎)",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（12単位）",
        "year": 2
      },
      {
        "name": "体育学基礎演習",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（12単位）",
        "year": 1
      },
      {
        "name": "ゼミナール2",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（12単位）",
        "year": 3
      }
    ],
    "electiveRequiredCourses": [
      {
        "name": "スポーツ実習（水泳）",
        "credits": 1,
        "category": "選択必修",
        "group": "A群（1単位選択必修）",
        "year": 1
      },
      {
        "name": "スポーツ実習（器械運動）",
        "credits": 1,
        "category": "選択必修",
        "group": "A群（1単位選択必修）",
        "year": 1
      },
      {
        "name": "スポーツ実習（陸上競技）",
        "credits": 1,
        "category": "選択必修",
        "group": "A群（1単位選択必修）",
        "year": 1
      },
      {
        "name": "スポーツ実習（剣道）",
        "credits": 1,
        "category": "選択必修",
        "group": "B群（1単位選択必修）",
        "year": 1
      },
      {
        "name": "スポーツ実習（柔道）",
        "credits": 1,
        "category": "選択必修",
        "group": "B群（1単位選択必修）",
        "year": 1
      },
      {
        "name": "スポーツ実習（ダンス）",
        "credits": 1,
        "category": "選択必修",
        "group": "B群（1単位選択必修）",
        "year": 1
      },
      {
        "name": "スポーツ実習（創作ダンス）",
        "credits": 1,
        "category": "選択必修",
        "group": "B群（1単位選択必修）",
        "year": 1
      },
      {
        "name": "スポーツ実習（ラグビー）",
        "credits": 1,
        "category": "選択必修",
        "group": "C群（2単位選択必修）",
        "year": 2
      },
      {
        "name": "スポーツ実習（ハンドボール）",
        "credits": 1,
        "category": "選択必修",
        "group": "C群（2単位選択必修）",
        "year": 2
      },
      {
        "name": "スポーツ実習（卓球）",
        "credits": 1,
        "category": "選択必修",
        "group": "C群（2単位選択必修）",
        "year": 2
      },
      {
        "name": "スポーツ実習（バドミントン）",
        "credits": 1,
        "category": "選択必修",
        "group": "C群（2単位選択必修）",
        "year": 2
      },
      {
        "name": "スポーツ実習（バスケットボール）",
        "credits": 1,
        "category": "選択必修",
        "group": "C群（2単位選択必修）",
        "year": 2
      },
      {
        "name": "スポーツ実習（バレーボール）",
        "credits": 1,
        "category": "選択必修",
        "group": "C群（2単位選択必修）",
        "year": 2
      },
      {
        "name": "スポーツ実習（サッカー）",
        "credits": 1,
        "category": "選択必修",
        "group": "C群（2単位選択必修）",
        "year": 2
      },
      {
        "name": "スポーツ実習（テニス）",
        "credits": 1,
        "category": "選択必修",
        "group": "C群（2単位選択必修）",
        "year": 2
      },
      {
        "name": "野外実習（アイススポーツ）",
        "credits": 1,
        "category": "選択必修",
        "group": "D群（1単位選択必修）",
        "year": 2
      },
      {
        "name": "野外実習（スノースポーツ）",
        "credits": 1,
        "category": "選択必修",
        "group": "D群（1単位選択必修）",
        "year": 2
      },
      {
        "name": "野外実習（オーシャンスポーツ）",
        "credits": 1,
        "category": "選択必修",
        "group": "D群（1単位選択必修）",
        "year": 2
      },
      {
        "name": "野外実習（キャンプ）",
        "credits": 1,
        "category": "選択必修",
        "group": "D群（1単位選択必修）",
        "year": 2
      },
      {
        "name": "水泳方法論",
        "credits": 2,
        "category": "選択必修",
        "group": "E群（4単位選択必修）",
        "year": 2
      },
      {
        "name": "陸上競技方法論",
        "credits": 2,
        "category": "選択必修",
        "group": "E群（4単位選択必修）",
        "year": 2
      },
      {
        "name": "体操方法論",
        "credits": 2,
        "category": "選択必修",
        "group": "E群（4単位選択必修）",
        "year": 2
      },
      {
        "name": "球技方法論",
        "credits": 2,
        "category": "選択必修",
        "group": "E群（4単位選択必修）",
        "year": 2
      },
      {
        "name": "武道方法論",
        "credits": 2,
        "category": "選択必修",
        "group": "E群（4単位選択必修）",
        "year": 2
      },
      {
        "name": "ダンス方法論",
        "credits": 2,
        "category": "選択必修",
        "group": "E群（4単位選択必修）",
        "year": 2
      },
      {
        "name": "スポーツ方法論(水泳)",
        "credits": 2,
        "category": "選択必修",
        "group": "E群（4単位選択必修）",
        "year": 2
      },
      {
        "name": "卒業研究1",
        "credits": 2,
        "category": "選択必修",
        "group": "F群（合計4単位）",
        "year": 4
      },
      {
        "name": "卒業研究2",
        "credits": 2,
        "category": "選択必修",
        "group": "F群（合計4単位）",
        "year": 4
      },
      {
        "name": "卒業論文",
        "credits": 8,
        "category": "選択必修",
        "group": "G群（合計8単位）",
        "year": 4
      }
    ],
    "trackLabel": "卒業研究・卒業論文",
    "tracks": [
      {
        "id": "f",
        "label": "F群（卒業研究1・2）",
        "groups": [
          "F群（合計4単位）"
        ],
        "rule": "F群から4単位"
      },
      {
        "id": "g",
        "label": "G群（卒業論文）",
        "groups": [
          "G群（合計8単位）"
        ],
        "rule": "G群から8単位"
      }
    ]
  },
  "心理学科": {
    "department": "心理学科",
    "majorReqCredits": 32,
    "majorElectiveCredits": 34,
    "requiredSummary": "必修科目（32単位）",
    "electiveSummary": "A群(18単位以上)＋B群(14単位以上)＋C群(1単位以上)＋D群(1単位以上)",
    "requiredCourses": [
      {
        "name": "心理学概論1",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（32単位）",
        "year": 1
      },
      {
        "name": "心理学概論2",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（32単位）",
        "year": 1
      },
      {
        "name": "行動心理学概論",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（32単位）",
        "year": 1
      },
      {
        "name": "臨床心理学概論",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（32単位）",
        "year": 1
      },
      {
        "name": "学問の扉",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（32単位）",
        "year": 1
      },
      {
        "name": "心理情報処理実習1",
        "credits": 1,
        "category": "必修",
        "group": "必修科目（32単位）",
        "year": 1
      },
      {
        "name": "心理学統計法1",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（32単位）",
        "year": 1
      },
      {
        "name": "心理学統計法2",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（32単位）",
        "year": 2
      },
      {
        "name": "心理学研究法",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（32単位）",
        "year": 2
      },
      {
        "name": "心理学ゼミ1",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（32単位）",
        "year": 3
      },
      {
        "name": "心理学ゼミ2",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（32単位）",
        "year": 3
      },
      {
        "name": "心理学ゼミ3",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（32単位）",
        "year": 4
      },
      {
        "name": "心理学ゼミ4",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（32単位）",
        "year": 4
      },
      {
        "name": "心理調査",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（32単位）",
        "year": 2
      },
      {
        "name": "心理的アセスメント",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（32単位）",
        "year": 2
      },
      {
        "name": "心理学研究",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（32単位）",
        "year": 3
      },
      {
        "name": "心理学実験(A)",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（32単位）",
        "year": 2
      }
    ],
    "electiveRequiredCourses": [
      {
        "name": "発達心理学",
        "credits": 2,
        "category": "選択必修",
        "group": "A群（18単位以上選択必修）",
        "year": 2
      },
      {
        "name": "社会・集団・家族心理学A",
        "credits": 2,
        "category": "選択必修",
        "group": "A群（18単位以上選択必修）",
        "year": 2
      },
      {
        "name": "社会・集団・家族心理学B",
        "credits": 2,
        "category": "選択必修",
        "group": "A群（18単位以上選択必修）",
        "year": 2
      },
      {
        "name": "感情・人格心理学A",
        "credits": 2,
        "category": "選択必修",
        "group": "A群（18単位以上選択必修）",
        "year": 2
      },
      {
        "name": "感情・人格心理学B",
        "credits": 2,
        "category": "選択必修",
        "group": "A群（18単位以上選択必修）",
        "year": 2
      },
      {
        "name": "知覚・認知心理学",
        "credits": 2,
        "category": "選択必修",
        "group": "A群（18単位以上選択必修）",
        "year": 2
      },
      {
        "name": "学習・言語心理学",
        "credits": 2,
        "category": "選択必修",
        "group": "A群（18単位以上選択必修）",
        "year": 2
      },
      {
        "name": "神経・生理心理学",
        "credits": 2,
        "category": "選択必修",
        "group": "A群（18単位以上選択必修）",
        "year": 2
      },
      {
        "name": "司法・犯罪心理学",
        "credits": 2,
        "category": "選択必修",
        "group": "A群（18単位以上選択必修）",
        "year": 2
      },
      {
        "name": "産業・組織心理学",
        "credits": 2,
        "category": "選択必修",
        "group": "A群（18単位以上選択必修）",
        "year": 2
      },
      {
        "name": "教育・学校心理学",
        "credits": 2,
        "category": "選択必修",
        "group": "A群（18単位以上選択必修）",
        "year": 2
      },
      {
        "name": "精神疾患とその治療",
        "credits": 2,
        "category": "選択必修",
        "group": "A群（18単位以上選択必修）",
        "year": 2
      },
      {
        "name": "臨床心理学特講",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（14単位以上選択必修）",
        "year": 3
      },
      {
        "name": "カウンセリング特講",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（14単位以上選択必修）",
        "year": 3
      },
      {
        "name": "心理面接特講",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（14単位以上選択必修）",
        "year": 3
      },
      {
        "name": "心理検査法特講",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（14単位以上選択必修）",
        "year": 3
      },
      {
        "name": "認知心理学特講",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（14単位以上選択必修）",
        "year": 3
      },
      {
        "name": "社会心理学特講",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（14単位以上選択必修）",
        "year": 3
      },
      {
        "name": "生理心理学特講",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（14単位以上選択必修）",
        "year": 3
      },
      {
        "name": "環境心理学特講",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（14単位以上選択必修）",
        "year": 3
      },
      {
        "name": "健康心理学特講",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（14単位以上選択必修）",
        "year": 3
      },
      {
        "name": "臨床社会心理学特講",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（14単位以上選択必修）",
        "year": 3
      },
      {
        "name": "老年心理学特講",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（14単位以上選択必修）",
        "year": 3
      },
      {
        "name": "心理検査法実習",
        "credits": 1,
        "category": "選択必修",
        "group": "C群（1単位以上選択必修）",
        "year": 3
      },
      {
        "name": "認知心理学実験",
        "credits": 1,
        "category": "選択必修",
        "group": "C群（1単位以上選択必修）",
        "year": 3
      },
      {
        "name": "生理心理学実験",
        "credits": 1,
        "category": "選択必修",
        "group": "C群（1単位以上選択必修）",
        "year": 3
      },
      {
        "name": "社会心理学実験・実習",
        "credits": 1,
        "category": "選択必修",
        "group": "C群（1単位以上選択必修）",
        "year": 3
      },
      {
        "name": "環境心理学実験・実習",
        "credits": 1,
        "category": "選択必修",
        "group": "C群（1単位以上選択必修）",
        "year": 3
      },
      {
        "name": "行動心理学実験・実習",
        "credits": 1,
        "category": "選択必修",
        "group": "C群（1単位以上選択必修）",
        "year": 3
      },
      {
        "name": "臨床心理学実習",
        "credits": 1,
        "category": "選択必修",
        "group": "D群（1単位以上選択必修）",
        "year": 3
      },
      {
        "name": "心理調査法実習",
        "credits": 1,
        "category": "選択必修",
        "group": "D群（1単位以上選択必修）",
        "year": 3
      },
      {
        "name": "心理演習B",
        "credits": 1,
        "category": "選択必修",
        "group": "D群（1単位以上選択必修）",
        "year": 3
      }
    ]
  },
  "地理学科": {
    "department": "地理学科",
    "majorReqCredits": 40,
    "majorElectiveCredits": 6,
    "requiredSummary": "必修科目（40単位）",
    "electiveSummary": "A群（2単位選択必修）＋ B群（4単位選択必修）",
    "requiredCourses": [
      {
        "name": "地理学基礎演習",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（40単位）",
        "year": 1
      },
      {
        "name": "自然地理学の基礎1",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（40単位）",
        "year": 1
      },
      {
        "name": "自然地理学の基礎2",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（40単位）",
        "year": 1
      },
      {
        "name": "人文地理学の基礎1",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（40単位）",
        "year": 1
      },
      {
        "name": "人文地理学の基礎2",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（40単位）",
        "year": 1
      },
      {
        "name": "日本地誌",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（40単位）",
        "year": 2
      },
      {
        "name": "地図学",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（40単位）",
        "year": 2
      },
      {
        "name": "地理統計の基礎",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（40単位）",
        "year": 2
      },
      {
        "name": "地形学",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（40単位）",
        "year": 2
      },
      {
        "name": "気候学",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（40単位）",
        "year": 2
      },
      {
        "name": "経済地理学",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（40単位）",
        "year": 2
      },
      {
        "name": "社会地理学",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（40単位）",
        "year": 2
      },
      {
        "name": "文化地理学",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（40単位）",
        "year": 2
      },
      {
        "name": "地理情報システム(含実習)",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（40単位）",
        "year": 3
      },
      {
        "name": "地域分析法(含実習)",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（40単位）",
        "year": 3
      },
      {
        "name": "野外調査法(含実習)",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（40単位）",
        "year": 3
      },
      {
        "name": "地理学課題研究1",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（40単位）",
        "year": 3
      },
      {
        "name": "地理学課題研究2",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（40単位）",
        "year": 3
      },
      {
        "name": "地理学卒業研究1",
        "credits": 4,
        "category": "必修",
        "group": "必修科目（40単位）",
        "year": 4
      },
      {
        "name": "地理学卒業研究2",
        "credits": 4,
        "category": "必修",
        "group": "必修科目（40単位）",
        "year": 4
      }
    ],
    "electiveRequiredCourses": [
      {
        "name": "地形学演習(含実験)",
        "credits": 2,
        "category": "選択必修",
        "group": "A群（2単位選択必修）",
        "year": 3
      },
      {
        "name": "気候学演習(含実習)",
        "credits": 2,
        "category": "選択必修",
        "group": "A群（2単位選択必修）",
        "year": 3
      },
      {
        "name": "環境地理学演習(含実験)",
        "credits": 2,
        "category": "選択必修",
        "group": "A群（2単位選択必修）",
        "year": 3
      },
      {
        "name": "外国地誌研究1",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（4単位選択必修）",
        "year": 3
      },
      {
        "name": "外国地誌研究2",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（4単位選択必修）",
        "year": 3
      },
      {
        "name": "外国地誌研究3",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（4単位選択必修）",
        "year": 3
      }
    ]
  },
  "地球科学科": {
    "department": "地球科学科",
    "majorReqCredits": 28,
    "majorElectiveCredits": 49,
    "requiredSummary": "講義必修（20単位）＋ 実験群必修（2単位）＋ 卒業テーマ研究必修（8単位）",
    "electiveSummary": "講義演習群（46〜50単位選択必修）＋ 実験群（3単位選択必修）",
    "requiredCourses": [
      {
        "name": "地球科学概論1",
        "credits": 2,
        "category": "必修",
        "group": "必修科目",
        "year": 1
      },
      {
        "name": "地球科学概論2",
        "credits": 2,
        "category": "必修",
        "group": "必修科目",
        "year": 1
      },
      {
        "name": "地球科学概論3",
        "credits": 2,
        "category": "必修",
        "group": "必修科目",
        "year": 1
      },
      {
        "name": "学問の扉",
        "credits": 2,
        "category": "必修",
        "group": "必修科目",
        "year": 1
      },
      {
        "name": "基礎数学",
        "credits": 2,
        "category": "必修",
        "group": "必修科目",
        "year": 1
      },
      {
        "name": "基礎物理学",
        "credits": 2,
        "category": "必修",
        "group": "必修科目",
        "year": 1
      },
      {
        "name": "基礎化学",
        "credits": 2,
        "category": "必修",
        "group": "必修科目",
        "year": 1
      },
      {
        "name": "物理数学",
        "credits": 2,
        "category": "必修",
        "group": "必修科目",
        "year": 2
      },
      {
        "name": "卒業テーマ演習1",
        "credits": 1,
        "category": "必修",
        "group": "必修科目",
        "year": 3
      },
      {
        "name": "卒業テーマ演習2",
        "credits": 1,
        "category": "必修",
        "group": "必修科目",
        "year": 3
      },
      {
        "name": "流体地球科学基礎実験1",
        "credits": 1,
        "category": "必修",
        "group": "実験群必修",
        "year": 2
      },
      {
        "name": "固体地球科学基礎実験1",
        "credits": 1,
        "category": "必修",
        "group": "実験群必修",
        "year": 2
      },
      {
        "name": "卒業テーマ研究1",
        "credits": 4,
        "category": "必修",
        "group": "卒業テーマ研究必修",
        "year": 4
      },
      {
        "name": "卒業テーマ研究2",
        "credits": 4,
        "category": "必修",
        "group": "卒業テーマ研究必修",
        "year": 4
      }
    ],
    "electiveRequiredCourses": [
      {
        "name": "気圏科学",
        "credits": 2,
        "category": "選択必修",
        "group": "講義演習群（46〜50単位選択必修）",
        "year": 2
      },
      {
        "name": "水圏科学",
        "credits": 2,
        "category": "選択必修",
        "group": "講義演習群（46〜50単位選択必修）",
        "year": 2
      },
      {
        "name": "地圏科学",
        "credits": 2,
        "category": "選択必修",
        "group": "講義演習群（46〜50単位選択必修）",
        "year": 2
      },
      {
        "name": "物質移行科学",
        "credits": 2,
        "category": "選択必修",
        "group": "講義演習群（46〜50単位選択必修）",
        "year": 2
      },
      {
        "name": "環境化学",
        "credits": 2,
        "category": "選択必修",
        "group": "講義演習群（46〜50単位選択必修）",
        "year": 2
      },
      {
        "name": "同位体地球科学",
        "credits": 2,
        "category": "選択必修",
        "group": "講義演習群（46〜50単位選択必修）",
        "year": 2
      },
      {
        "name": "地球物理学1",
        "credits": 2,
        "category": "選択必修",
        "group": "講義演習群（46〜50単位選択必修）",
        "year": 2
      },
      {
        "name": "地球物理学2",
        "credits": 2,
        "category": "選択必修",
        "group": "講義演習群（46〜50単位選択必修）",
        "year": 2
      },
      {
        "name": "流体地球科学基礎実験2",
        "credits": 1,
        "category": "選択必修",
        "group": "実験群（3単位選択必修）",
        "year": 2
      },
      {
        "name": "固体地球科学基礎実験2",
        "credits": 1,
        "category": "選択必修",
        "group": "実験群（3単位選択必修）",
        "year": 2
      },
      {
        "name": "気圏科学実習1",
        "credits": 1,
        "category": "選択必修",
        "group": "実験群（3単位選択必修）",
        "year": 3
      },
      {
        "name": "気圏科学実習2",
        "credits": 1,
        "category": "選択必修",
        "group": "実験群（3単位選択必修）",
        "year": 3
      },
      {
        "name": "水圏科学実験",
        "credits": 1,
        "category": "選択必修",
        "group": "実験群（3単位選択必修）",
        "year": 3
      }
    ]
  },
  "数学科": {
    "department": "数学科",
    "majorReqCredits": 30,
    "majorElectiveCredits": 35,
    "requiredSummary": "必修科目（30単位）",
    "electiveSummary": "選択必修科目（35単位以上）",
    "requiredCourses": [
      {
        "name": "線形代数1(含演習)",
        "credits": 3,
        "category": "必修",
        "group": "必修科目（30単位）",
        "year": 1
      },
      {
        "name": "線形代数2(含演習)",
        "credits": 3,
        "category": "必修",
        "group": "必修科目（30単位）",
        "year": 1
      },
      {
        "name": "微分積分学1(含演習)",
        "credits": 3,
        "category": "必修",
        "group": "必修科目（30単位）",
        "year": 1
      },
      {
        "name": "微分積分学2(含演習)",
        "credits": 3,
        "category": "必修",
        "group": "必修科目（30単位）",
        "year": 1
      },
      {
        "name": "命題と論理",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（30単位）",
        "year": 1
      },
      {
        "name": "コンピュータ基礎",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（30単位）",
        "year": 1
      },
      {
        "name": "学問の扉",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（30単位）",
        "year": 1
      },
      {
        "name": "数学講究1",
        "credits": 3,
        "category": "必修",
        "group": "必修科目（30単位）",
        "year": 3
      },
      {
        "name": "数学講究2",
        "credits": 3,
        "category": "必修",
        "group": "必修科目（30単位）",
        "year": 3
      },
      {
        "name": "数学研究1",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（30単位）",
        "year": 4
      },
      {
        "name": "数学研究2",
        "credits": 4,
        "category": "必修",
        "group": "必修科目（30単位）",
        "year": 4
      }
    ],
    "electiveRequiredCourses": [
      {
        "name": "初等整数論",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目（35単位以上）",
        "year": 2
      },
      {
        "name": "線形空間論(含演習)",
        "credits": 3,
        "category": "選択必修",
        "group": "選択必修科目（35単位以上）",
        "year": 2
      },
      {
        "name": "微分積分学続論",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目（35単位以上）",
        "year": 2
      },
      {
        "name": "多変数微分積分学(含演習)",
        "credits": 3,
        "category": "選択必修",
        "group": "選択必修科目（35単位以上）",
        "year": 2
      },
      {
        "name": "集合と写像(含演習)",
        "credits": 3,
        "category": "選択必修",
        "group": "選択必修科目（35単位以上）",
        "year": 2
      },
      {
        "name": "距離と位相",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目（35単位以上）",
        "year": 2
      },
      {
        "name": "数理統計",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目（35単位以上）",
        "year": 2
      },
      {
        "name": "確率論(含演習)",
        "credits": 3,
        "category": "選択必修",
        "group": "選択必修科目（35単位以上）",
        "year": 2
      },
      {
        "name": "プログラミング入門",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目（35単位以上）",
        "year": 2
      },
      {
        "name": "曲線と曲面",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目（35単位以上）",
        "year": 2
      },
      {
        "name": "幾何構造",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目（35単位以上）",
        "year": 2
      },
      {
        "name": "群論入門",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目（35単位以上）",
        "year": 2
      },
      {
        "name": "環論",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目（35単位以上）",
        "year": 3
      },
      {
        "name": "ガロア理論",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目（35単位以上）",
        "year": 3
      },
      {
        "name": "ホモロジー論",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目（35単位以上）",
        "year": 3
      },
      {
        "name": "関数空間論",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目（35単位以上）",
        "year": 3
      },
      {
        "name": "多様体論",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目（35単位以上）",
        "year": 3
      },
      {
        "name": "ルベーグ積分論",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目（35単位以上）",
        "year": 3
      },
      {
        "name": "複素解析学",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目（35単位以上）",
        "year": 3
      },
      {
        "name": "常微分方程式入門",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目（35単位以上）",
        "year": 3
      },
      {
        "name": "力学系入門",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目（35単位以上）",
        "year": 3
      },
      {
        "name": "数学教育学概論",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目（35単位以上）",
        "year": 2
      },
      {
        "name": "数学教育実践論",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目（35単位以上）",
        "year": 3
      },
      {
        "name": "離散構造",
        "credits": 2,
        "category": "選択必修",
        "group": "選択必修科目（35単位以上）",
        "year": 2
      }
    ]
  },
  "情報科学科": {
    "department": "情報科学科",
    "majorReqCredits": 38,
    "majorElectiveCredits": 22,
    "requiredSummary": "カテゴリ1(16単位)＋カテゴリ2(8単位)＋カテゴリ3(4単位)＋カテゴリ7(10単位)＝計38単位",
    "electiveSummary": "次の(1)〜(3)のいずれか：(1)カテゴリ4から22単位以上 (2)カテゴリ5の12単位すべて (3)カテゴリ6の6単位すべて",
    "requiredCourses": [
      {
        "name": "情報処理入門1",
        "credits": 2,
        "category": "必修",
        "group": "カテゴリ1（16単位）",
        "year": 1
      },
      {
        "name": "情報処理入門2",
        "credits": 2,
        "category": "必修",
        "group": "カテゴリ1（16単位）",
        "year": 1
      },
      {
        "name": "情報科学実習1",
        "credits": 1,
        "category": "必修",
        "group": "カテゴリ1（16単位）",
        "year": 1
      },
      {
        "name": "情報科学実習2",
        "credits": 1,
        "category": "必修",
        "group": "カテゴリ1（16単位）",
        "year": 1
      },
      {
        "name": "情報科学実習3",
        "credits": 1,
        "category": "必修",
        "group": "カテゴリ1（16単位）",
        "year": 2
      },
      {
        "name": "情報科学実習4",
        "credits": 1,
        "category": "必修",
        "group": "カテゴリ1（16単位）",
        "year": 2
      },
      {
        "name": "基礎プログラミング1",
        "credits": 2,
        "category": "必修",
        "group": "カテゴリ1（16単位）",
        "year": 1
      },
      {
        "name": "基礎プログラミング2",
        "credits": 2,
        "category": "必修",
        "group": "カテゴリ1（16単位）",
        "year": 1
      },
      {
        "name": "実践プログラミング1",
        "credits": 2,
        "category": "必修",
        "group": "カテゴリ1（16単位）",
        "year": 2
      },
      {
        "name": "実践プログラミング2",
        "credits": 2,
        "category": "必修",
        "group": "カテゴリ1（16単位）",
        "year": 2
      },
      {
        "name": "基礎線形代数1",
        "credits": 2,
        "category": "必修",
        "group": "カテゴリ2（8単位）",
        "year": 1
      },
      {
        "name": "基礎線形代数2",
        "credits": 2,
        "category": "必修",
        "group": "カテゴリ2（8単位）",
        "year": 1
      },
      {
        "name": "基礎微分積分1",
        "credits": 2,
        "category": "必修",
        "group": "カテゴリ2（8単位）",
        "year": 1
      },
      {
        "name": "基礎微分積分2",
        "credits": 2,
        "category": "必修",
        "group": "カテゴリ2（8単位）",
        "year": 1
      },
      {
        "name": "学問の扉",
        "credits": 2,
        "category": "必修",
        "group": "カテゴリ3（4単位）",
        "year": 1
      },
      {
        "name": "アカデミックスキルズ",
        "credits": 2,
        "category": "必修",
        "group": "カテゴリ3（4単位）",
        "year": 1
      },
      {
        "name": "情報科学講究1",
        "credits": 2,
        "category": "必修",
        "group": "カテゴリ7（10単位）",
        "year": 3
      },
      {
        "name": "情報科学講究2",
        "credits": 2,
        "category": "必修",
        "group": "カテゴリ7（10単位）",
        "year": 3
      },
      {
        "name": "情報科学研究1",
        "credits": 2,
        "category": "必修",
        "group": "カテゴリ7（10単位）",
        "year": 4
      },
      {
        "name": "情報科学研究2",
        "credits": 4,
        "category": "必修",
        "group": "カテゴリ7（10単位）",
        "year": 4
      }
    ],
    "electiveRequiredCourses": [
      {
        "name": "線形代数1",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ4（22単位以上）",
        "year": 2
      },
      {
        "name": "線形代数2",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ4（22単位以上）",
        "year": 2
      },
      {
        "name": "解析学1",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ4（22単位以上）",
        "year": 2
      },
      {
        "name": "解析学2",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ4（22単位以上）",
        "year": 2
      },
      {
        "name": "代数学",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ4（22単位以上）",
        "year": 2
      },
      {
        "name": "離散数学",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ4（22単位以上）",
        "year": 2
      },
      {
        "name": "確率論",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ4（22単位以上）",
        "year": 2
      },
      {
        "name": "データ科学",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ4（22単位以上）",
        "year": 2
      },
      {
        "name": "マルチメディア表現",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ4（22単位以上）",
        "year": 2
      },
      {
        "name": "オートマトンと形式言語",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ4（22単位以上）",
        "year": 3
      },
      {
        "name": "論理と計算",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ4（22単位以上）",
        "year": 3
      },
      {
        "name": "情報理論",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ4（22単位以上）",
        "year": 3
      },
      {
        "name": "グラフ理論",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ4（22単位以上）",
        "year": 3
      },
      {
        "name": "数理計画",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ4（22単位以上）",
        "year": 3
      },
      {
        "name": "幾何学",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ4（22単位以上）",
        "year": 3
      },
      {
        "name": "情報セキュリティ",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ4（22単位以上）",
        "year": 3
      },
      {
        "name": "データベース",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ4（22単位以上）",
        "year": 3
      },
      {
        "name": "ヒューマンインタフェース",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ4（22単位以上）",
        "year": 3
      },
      {
        "name": "コンピューティング",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ4（22単位以上）",
        "year": 3
      },
      {
        "name": "アルゴリズム",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ4（22単位以上）",
        "year": 3
      },
      {
        "name": "画像情報処理と機械学習",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ4（22単位以上）",
        "year": 3
      },
      {
        "name": "ソフトウェアクリエイション1",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ5（12単位すべて）",
        "year": 2,
        "note": "1と2、3と4、5と6はそれぞれ同時に履修（要覧 p.125）"
      },
      {
        "name": "ソフトウェアクリエイション2",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ5（12単位すべて）",
        "year": 2
      },
      {
        "name": "ソフトウェアクリエイション3",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ5（12単位すべて）",
        "year": 3
      },
      {
        "name": "ソフトウェアクリエイション4",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ5（12単位すべて）",
        "year": 3
      },
      {
        "name": "ソフトウェアクリエイション5",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ5（12単位すべて）",
        "year": 3
      },
      {
        "name": "ソフトウェアクリエイション6",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ5（12単位すべて）",
        "year": 3
      },
      {
        "name": "次世代社会コミュニティ情報科学1",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ6（6単位すべて）",
        "year": 2
      },
      {
        "name": "次世代社会コミュニティ情報科学2",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ6（6単位すべて）",
        "year": 3
      },
      {
        "name": "次世代社会コミュニティ情報科学3",
        "credits": 2,
        "category": "選択必修",
        "group": "カテゴリ6（6単位すべて）",
        "year": 3,
        "note": "履修にはいずれかの副専攻の修了条件を満たすこと（要覧 p.125）"
      }
    ],
    "trackLabel": "カテゴリ",
    "tracks": [
      {
        "id": "cat4",
        "electiveCredits": 22,
        "label": "カテゴリ4（応用講義群）",
        "groups": [
          "カテゴリ4（22単位以上）"
        ],
        "rule": "カテゴリ4の中から22単位以上を修得"
      },
      {
        "id": "cat5",
        "electiveCredits": 12,
        "label": "カテゴリ5（ソフトウェアクリエイション）",
        "groups": [
          "カテゴリ5（12単位すべて）"
        ],
        "rule": "カテゴリ5の12単位をすべて修得"
      },
      {
        "id": "cat6",
        "electiveCredits": 6,
        "label": "カテゴリ6（次世代社会コミュニティ情報科学）",
        "groups": [
          "カテゴリ6（6単位すべて）"
        ],
        "rule": "カテゴリ6の6単位をすべて修得"
      }
    ]
  },
  "物理学科": {
    "department": "物理学科",
    "majorReqCredits": 66,
    "majorElectiveCredits": 12,
    "requiredSummary": "必修科目（計66単位）",
    "electiveSummary": "選択科目（12単位以上選択）",
    "requiredCourses": [
      {
        "name": "物理学概論1",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 1
      },
      {
        "name": "物理学概論2",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 1
      },
      {
        "name": "微分・積分1",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 1
      },
      {
        "name": "微分・積分2",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 1
      },
      {
        "name": "線形代数1",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 1
      },
      {
        "name": "線形代数2",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 1
      },
      {
        "name": "力学入門",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 1
      },
      {
        "name": "力学1",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 2
      },
      {
        "name": "力学2",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 2
      },
      {
        "name": "電磁気学入門",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 1
      },
      {
        "name": "電磁気学1",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 2
      },
      {
        "name": "電磁気学2",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 2
      },
      {
        "name": "電磁気学1演習",
        "credits": 1,
        "category": "必修",
        "group": "必修演習",
        "year": 2
      },
      {
        "name": "電磁気学2演習",
        "credits": 1,
        "category": "必修",
        "group": "必修演習",
        "year": 2
      },
      {
        "name": "熱力学",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 2
      },
      {
        "name": "振動と波動",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 2
      },
      {
        "name": "物性物理学入門",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 2
      },
      {
        "name": "物理数学1",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 2
      },
      {
        "name": "物理数学2",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 2
      },
      {
        "name": "量子力学入門",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 2
      },
      {
        "name": "量子力学1",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 3
      },
      {
        "name": "量子力学2",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 3
      },
      {
        "name": "量子力学1演習",
        "credits": 1,
        "category": "必修",
        "group": "必修演習",
        "year": 3
      },
      {
        "name": "量子力学2演習",
        "credits": 1,
        "category": "必修",
        "group": "必修演習",
        "year": 3
      },
      {
        "name": "統計力学1",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 3
      },
      {
        "name": "統計力学2",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 3
      },
      {
        "name": "統計力学1演習",
        "credits": 1,
        "category": "必修",
        "group": "必修演習",
        "year": 3
      },
      {
        "name": "統計力学2演習",
        "credits": 1,
        "category": "必修",
        "group": "必修演習",
        "year": 3
      },
      {
        "name": "物理学演習1",
        "credits": 2,
        "category": "必修",
        "group": "必修演習",
        "year": 3
      },
      {
        "name": "物理学演習2",
        "credits": 2,
        "category": "必修",
        "group": "必修演習",
        "year": 3
      },
      {
        "name": "基礎物理実験A",
        "credits": 1,
        "category": "必修",
        "group": "必修実験",
        "year": 1
      },
      {
        "name": "基礎物理実験B",
        "credits": 1,
        "category": "必修",
        "group": "必修実験",
        "year": 1
      },
      {
        "name": "物理実験A",
        "credits": 1,
        "category": "必修",
        "group": "必修実験",
        "year": 2
      },
      {
        "name": "物理実験B",
        "credits": 1,
        "category": "必修",
        "group": "必修実験",
        "year": 2
      },
      {
        "name": "発展物理実験A",
        "credits": 1,
        "category": "必修",
        "group": "必修実験",
        "year": 3
      },
      {
        "name": "発展物理実験B",
        "credits": 1,
        "category": "必修",
        "group": "必修実験",
        "year": 3
      },
      {
        "name": "特別研究A",
        "credits": 3,
        "category": "必修",
        "group": "必修特別研究",
        "year": 4
      },
      {
        "name": "特別研究B",
        "credits": 3,
        "category": "必修",
        "group": "必修特別研究",
        "year": 4
      }
    ],
    "electiveRequiredCourses": [
      {
        "name": "数値計算入門1",
        "credits": 2,
        "category": "選択必修",
        "group": "選択科目（12単位以上選択）",
        "year": 2
      },
      {
        "name": "数値計算入門2",
        "credits": 2,
        "category": "選択必修",
        "group": "選択科目（12単位以上選択）",
        "year": 2
      },
      {
        "name": "解析力学",
        "credits": 2,
        "category": "選択必修",
        "group": "選択科目（12単位以上選択）",
        "year": 2
      },
      {
        "name": "電磁気学3",
        "credits": 2,
        "category": "選択必修",
        "group": "選択科目（12単位以上選択）",
        "year": 3
      },
      {
        "name": "物性物理学1",
        "credits": 2,
        "category": "選択必修",
        "group": "選択科目（12単位以上選択）",
        "year": 3
      },
      {
        "name": "物性物理学2",
        "credits": 2,
        "category": "選択必修",
        "group": "選択科目（12単位以上選択）",
        "year": 3
      },
      {
        "name": "量子力学3",
        "credits": 2,
        "category": "選択必修",
        "group": "選択科目（12単位以上選択）",
        "year": 3
      },
      {
        "name": "原子核と素粒子",
        "credits": 2,
        "category": "選択必修",
        "group": "選択科目（12単位以上選択）",
        "year": 3
      },
      {
        "name": "宇宙物理学",
        "credits": 2,
        "category": "選択必修",
        "group": "選択科目（12単位以上選択）",
        "year": 3
      },
      {
        "name": "超伝導の科学",
        "credits": 2,
        "category": "選択必修",
        "group": "選択科目（12単位以上選択）",
        "year": 3
      },
      {
        "name": "生物物理学",
        "credits": 2,
        "category": "選択必修",
        "group": "選択科目（12単位以上選択）",
        "year": 3
      }
    ]
  },
  "生命科学科": {
    "department": "生命科学科",
    "majorReqCredits": 57,
    "majorElectiveCredits": 22,
    "requiredSummary": "必修科目（57単位）",
    "electiveSummary": "選択A群（20単位選択必修）＋ 選択B群（2単位選択必修）",
    "requiredCourses": [
      {
        "name": "学問の扉",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（57単位）",
        "year": 1
      },
      {
        "name": "生命科学概論1",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（57単位）",
        "year": 1
      },
      {
        "name": "生命科学概論2",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（57単位）",
        "year": 1
      },
      {
        "name": "基礎数学",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（57単位）",
        "year": 1
      },
      {
        "name": "基礎物理1",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（57単位）",
        "year": 1
      },
      {
        "name": "基礎物理2",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（57単位）",
        "year": 1
      },
      {
        "name": "基礎化学1",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（57単位）",
        "year": 1
      },
      {
        "name": "基礎化学2",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（57単位）",
        "year": 1
      },
      {
        "name": "進化系統学",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（57単位）",
        "year": 1
      },
      {
        "name": "生化学",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（57単位）",
        "year": 2
      },
      {
        "name": "生物統計学基礎",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（57単位）",
        "year": 2
      },
      {
        "name": "分子生物学1",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（57単位）",
        "year": 2
      },
      {
        "name": "分子生物学2",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（57単位）",
        "year": 2
      },
      {
        "name": "細胞生物学1",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（57単位）",
        "year": 2
      },
      {
        "name": "細胞生物学2",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（57単位）",
        "year": 2
      },
      {
        "name": "生命科学英語",
        "credits": 2,
        "category": "必修",
        "group": "必修科目（57単位）",
        "year": 2
      },
      {
        "name": "生命科学データ処理",
        "credits": 1,
        "category": "必修",
        "group": "必修科目（57単位）",
        "year": 2
      },
      {
        "name": "基礎科学実験1",
        "credits": 1,
        "category": "必修",
        "group": "必修科目（57単位）",
        "year": 1
      },
      {
        "name": "基礎科学実験2",
        "credits": 1,
        "category": "必修",
        "group": "必修科目（57単位）",
        "year": 1
      },
      {
        "name": "生命科学基礎実験1",
        "credits": 1,
        "category": "必修",
        "group": "必修科目（57単位）",
        "year": 2
      },
      {
        "name": "生命科学基礎実験2",
        "credits": 1,
        "category": "必修",
        "group": "必修科目（57単位）",
        "year": 2
      },
      {
        "name": "特別研究1",
        "credits": 4,
        "category": "必修",
        "group": "必修科目（57単位）",
        "year": 4
      },
      {
        "name": "特別研究2",
        "credits": 4,
        "category": "必修",
        "group": "必修科目（57単位）",
        "year": 4
      }
    ],
    "electiveRequiredCourses": [
      {
        "name": "生体エネルギー科学",
        "credits": 2,
        "category": "選択必修",
        "group": "選択A群（20単位選択必修）",
        "year": 2
      },
      {
        "name": "遺伝学",
        "credits": 2,
        "category": "選択必修",
        "group": "選択A群（20単位選択必修）",
        "year": 2
      },
      {
        "name": "微生物学",
        "credits": 2,
        "category": "選択必修",
        "group": "選択A群（20単位選択必修）",
        "year": 2
      },
      {
        "name": "生態学",
        "credits": 2,
        "category": "選択必修",
        "group": "選択A群（20単位選択必修）",
        "year": 2
      },
      {
        "name": "植物生態学",
        "credits": 2,
        "category": "選択必修",
        "group": "選択A群（20単位選択必修）",
        "year": 2
      },
      {
        "name": "ゲノム科学",
        "credits": 2,
        "category": "選択必修",
        "group": "選択A群（20単位選択必修）",
        "year": 3
      },
      {
        "name": "植物機能学",
        "credits": 2,
        "category": "選択必修",
        "group": "選択A群（20単位選択必修）",
        "year": 3
      },
      {
        "name": "代謝生理学",
        "credits": 2,
        "category": "選択必修",
        "group": "選択A群（20単位選択必修）",
        "year": 3
      },
      {
        "name": "生体計測学",
        "credits": 2,
        "category": "選択必修",
        "group": "選択A群（20単位選択必修）",
        "year": 3
      },
      {
        "name": "細胞内ダイナミクス",
        "credits": 2,
        "category": "選択必修",
        "group": "選択A群（20単位選択必修）",
        "year": 3
      },
      {
        "name": "生物統計学実践",
        "credits": 2,
        "category": "選択必修",
        "group": "選択A群（20単位選択必修）",
        "year": 3
      },
      {
        "name": "構造生物学",
        "credits": 2,
        "category": "選択必修",
        "group": "選択A群（20単位選択必修）",
        "year": 3
      },
      {
        "name": "バイオインフォマティクス1",
        "credits": 2,
        "category": "選択必修",
        "group": "選択A群（20単位選択必修）",
        "year": 3
      },
      {
        "name": "バイオインフォマティクス2",
        "credits": 2,
        "category": "選択必修",
        "group": "選択A群（20単位選択必修）",
        "year": 3
      },
      {
        "name": "発生生物学1",
        "credits": 2,
        "category": "選択必修",
        "group": "選択A群（20単位選択必修）",
        "year": 3
      },
      {
        "name": "発生生物学2",
        "credits": 2,
        "category": "選択必修",
        "group": "選択A群（20単位選択必修）",
        "year": 3
      },
      {
        "name": "植物生理学",
        "credits": 2,
        "category": "選択必修",
        "group": "選択A群（20単位選択必修）",
        "year": 3
      },
      {
        "name": "生物物理学",
        "credits": 2,
        "category": "選択必修",
        "group": "選択A群（20単位選択必修）",
        "year": 3
      },
      {
        "name": "脳神経科学",
        "credits": 2,
        "category": "選択必修",
        "group": "選択A群（20単位選択必修）",
        "year": 3
      },
      {
        "name": "生命医科学1",
        "credits": 2,
        "category": "選択必修",
        "group": "選択A群（20単位選択必修）",
        "year": 3
      },
      {
        "name": "生命医科学2",
        "credits": 2,
        "category": "選択必修",
        "group": "選択A群（20単位選択必修）",
        "year": 3
      },
      {
        "name": "免疫学",
        "credits": 2,
        "category": "選択必修",
        "group": "選択A群（20単位選択必修）",
        "year": 3
      },
      {
        "name": "環境保全生態学",
        "credits": 2,
        "category": "選択必修",
        "group": "選択A群（20単位選択必修）",
        "year": 3
      },
      {
        "name": "生命科学実験1",
        "credits": 1,
        "category": "選択必修",
        "group": "選択B群（2単位選択必修）",
        "year": 3
      },
      {
        "name": "生命科学実験2",
        "credits": 1,
        "category": "選択必修",
        "group": "選択B群（2単位選択必修）",
        "year": 3
      },
      {
        "name": "生命科学実験3",
        "credits": 1,
        "category": "選択必修",
        "group": "選択B群（2単位選択必修）",
        "year": 3
      }
    ]
  },
  "化学科": {
    "department": "化学科",
    "majorReqCredits": 52,
    "majorElectiveCredits": 24,
    "requiredSummary": "必修科目（52単位）",
    "electiveSummary": "A群（4単位以上）＋ B群（6単位以上）＋ C群（2単位以上）＝ 計24単位以上",
    "requiredCourses": [
      {
        "name": "基礎化学",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 1
      },
      {
        "name": "物理化学1",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 1
      },
      {
        "name": "物理化学2",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 2
      },
      {
        "name": "物理化学3",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 2
      },
      {
        "name": "分析化学1",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 1
      },
      {
        "name": "分析化学2",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 2
      },
      {
        "name": "分析化学3",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 2
      },
      {
        "name": "無機化学1",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 1
      },
      {
        "name": "無機化学2",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 2
      },
      {
        "name": "無機化学3",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 2
      },
      {
        "name": "有機化学1",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 1
      },
      {
        "name": "有機化学2",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 2
      },
      {
        "name": "有機化学3",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 2
      },
      {
        "name": "生物化学1",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 2
      },
      {
        "name": "生物化学2",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 3
      },
      {
        "name": "最前線の化学",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 1
      },
      {
        "name": "周期表の化学",
        "credits": 2,
        "category": "必修",
        "group": "必修講義",
        "year": 1
      },
      {
        "name": "基礎化学実験",
        "credits": 1,
        "category": "必修",
        "group": "必修実験",
        "year": 1
      },
      {
        "name": "化学実験",
        "credits": 1,
        "category": "必修",
        "group": "必修実験",
        "year": 1
      },
      {
        "name": "有機化学実験(含演習)",
        "credits": 2,
        "category": "必修",
        "group": "必修実験",
        "year": 2
      },
      {
        "name": "物理化学実験(含演習)",
        "credits": 2,
        "category": "必修",
        "group": "必修実験",
        "year": 2
      },
      {
        "name": "無機・分析化学実験(含演習)",
        "credits": 2,
        "category": "必修",
        "group": "必修実験",
        "year": 2
      },
      {
        "name": "複合生物化学実験(含演習)",
        "credits": 2,
        "category": "必修",
        "group": "必修実験",
        "year": 3
      },
      {
        "name": "発展化学実験(含演習)",
        "credits": 2,
        "category": "必修",
        "group": "必修実験",
        "year": 3
      },
      {
        "name": "化学特別研究1",
        "credits": 4,
        "category": "必修",
        "group": "必修特別研究",
        "year": 4
      },
      {
        "name": "化学特別研究2",
        "credits": 4,
        "category": "必修",
        "group": "必修特別研究",
        "year": 4
      }
    ],
    "electiveRequiredCourses": [
      {
        "name": "学問の扉",
        "credits": 2,
        "category": "選択必修",
        "group": "A群（4単位以上選択必修）",
        "year": 1
      },
      {
        "name": "化学の情報技術",
        "credits": 2,
        "category": "選択必修",
        "group": "A群（4単位以上選択必修）",
        "year": 1
      },
      {
        "name": "化学英語",
        "credits": 2,
        "category": "選択必修",
        "group": "A群（4単位以上選択必修）",
        "year": 2
      },
      {
        "name": "化学数学",
        "credits": 2,
        "category": "選択必修",
        "group": "A群（4単位以上選択必修）",
        "year": 1
      },
      {
        "name": "機器分析化学",
        "credits": 2,
        "category": "選択必修",
        "group": "A群（4単位以上選択必修）",
        "year": 2
      },
      {
        "name": "発展無機化学",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（6単位以上選択必修）",
        "year": 3
      },
      {
        "name": "有機反応化学",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（6単位以上選択必修）",
        "year": 3
      },
      {
        "name": "分光化学",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（6単位以上選択必修）",
        "year": 3
      },
      {
        "name": "量子化学",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（6単位以上選択必修）",
        "year": 3
      },
      {
        "name": "固体化学",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（6単位以上選択必修）",
        "year": 3
      },
      {
        "name": "資源化学",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（6単位以上選択必修）",
        "year": 3
      },
      {
        "name": "無機分析化学",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（6単位以上選択必修）",
        "year": 3
      },
      {
        "name": "環境化学",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（6単位以上選択必修）",
        "year": 3
      },
      {
        "name": "物質代謝学",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（6単位以上選択必修）",
        "year": 3
      },
      {
        "name": "エネルギー代謝学",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（6単位以上選択必修）",
        "year": 3
      },
      {
        "name": "元素の化学",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（6単位以上選択必修）",
        "year": 3
      },
      {
        "name": "応用無機化学",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（6単位以上選択必修）",
        "year": 3
      },
      {
        "name": "有機構造化学",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（6単位以上選択必修）",
        "year": 3
      },
      {
        "name": "有機合成化学",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（6単位以上選択必修）",
        "year": 3
      },
      {
        "name": "有機応用化学",
        "credits": 2,
        "category": "選択必修",
        "group": "B群（6単位以上選択必修）",
        "year": 3
      },
      {
        "name": "化学演習",
        "credits": 2,
        "category": "選択必修",
        "group": "C群（2単位以上選択必修）",
        "year": 3
      },
      {
        "name": "化学特論",
        "credits": 2,
        "category": "選択必修",
        "group": "C群（2単位以上選択必修）",
        "year": 3
      }
    ]
  }
};

export function getDepartmentCurriculum(department: string): DepartmentCurriculumInfo | undefined {
  return VERIFIED_12_DEPARTMENTS_CURRICULUM[department];
}
