# Vercel Serverless Function for Frontend
import datetime
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import re

app = FastAPI(
    title="EneKoma Campus Navigator API",
    version="2.1.0",
    description="日本大学文理学部向け時間割・履修卒業判定・コース科目・施設案内・スケジュール・フレンド共有・空き教室案内API"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PERIODS = [
    {"period": 1, "name": "1限", "start": "09:00", "end": "10:30"},
    {"period": 2, "name": "2限", "start": "10:40", "end": "12:10"},
    {"period": "lunch", "name": "昼休み", "start": "12:10", "end": "13:00"},
    {"period": 3, "name": "3限", "start": "13:00", "end": "14:30"},
    {"period": 4, "name": "4限", "start": "14:40", "end": "16:10"},
    {"period": 5, "name": "5限", "start": "16:20", "end": "17:50"},
]

@app.get("/")
@app.get("/api")
def read_root():
    return {"message": "EneKoma Campus Navigator API v2.1 is running", "university": "Nihon University CHS"}

@app.get("/api/periods")
def get_periods():
    return {"periods": PERIODS}

CHS_GRADUATION_REQUIREMENTS = {
    "情報科学科": {"zengaku": 2, "sogo": 12, "gaikokugo": 8, "kisho": 5, "major_req": 38, "major_opt": 22, "free_opt": 37, "total": 124},
    "国文学科": {"zengaku": 2, "sogo": 12, "gaikokugo": 8, "kisho": 5, "major_req": 30, "major_opt": 30, "free_opt": 37, "total": 124},
    "英文学科": {"zengaku": 2, "sogo": 12, "gaikokugo": 16, "kisho": 5, "major_req": 48, "major_opt": 14, "free_opt": 27, "total": 124},
    "哲学科": {"zengaku": 2, "sogo": 12, "gaikokugo": 8, "kisho": 5, "major_req": 28, "major_opt": 40, "free_opt": 29, "total": 124},
    "史学科": {"zengaku": 2, "sogo": 12, "gaikokugo": 8, "kisho": 5, "major_req": 12, "major_opt": 54, "free_opt": 31, "total": 124},
    "中国語中国文化学科": {"zengaku": 2, "sogo": 12, "gaikokugo": 18, "kisho": 5, "major_req": 10, "major_opt": 48, "free_opt": 29, "total": 124},
    "ドイツ文学科": {"zengaku": 2, "sogo": 12, "gaikokugo": 16, "kisho": 5, "major_req": 20, "major_opt": 40, "free_opt": 29, "total": 124},
    "社会学科": {"zengaku": 2, "sogo": 12, "gaikokugo": 8, "kisho": 5, "major_req": 18, "major_opt": 52, "free_opt": 27, "total": 124},
    "社会福祉学科": {"zengaku": 2, "sogo": 12, "gaikokugo": 8, "kisho": 5, "major_req": 32, "major_opt": 31, "free_opt": 34, "total": 124},
    "教育学科": {"zengaku": 2, "sogo": 12, "gaikokugo": 8, "kisho": 5, "major_req": 20, "major_opt": 36, "free_opt": 41, "total": 124},
    "体育学科": {"zengaku": 2, "sogo": 12, "gaikokugo": 8, "kisho": 5, "major_req": 12, "major_opt": 52, "free_opt": 33, "total": 124},
    "心理学科": {"zengaku": 2, "sogo": 12, "gaikokugo": 8, "kisho": 5, "major_req": 32, "major_opt": 34, "free_opt": 31, "total": 124},
    "地理学科": {"zengaku": 2, "sogo": 12, "gaikokugo": 8, "kisho": 5, "major_req": 40, "major_opt": 34, "free_opt": 23, "total": 124},
    "地球科学科": {"zengaku": 2, "sogo": 12, "gaikokugo": 8, "kisho": 5, "major_req": 20, "major_opt": 53, "free_opt": 24, "total": 124},
    "数学科": {"zengaku": 2, "sogo": 12, "gaikokugo": 8, "kisho": 5, "major_req": 30, "major_opt": 35, "free_opt": 32, "total": 124},
    "物理学科": {"zengaku": 2, "sogo": 12, "gaikokugo": 8, "kisho": 5, "major_req": 66, "major_opt": 12, "free_opt": 19, "total": 124},
    "生命科学科": {"zengaku": 2, "sogo": 12, "gaikokugo": 8, "kisho": 5, "major_req": 55, "major_opt": 22, "free_opt": 20, "total": 124},
    "化学科": {"zengaku": 2, "sogo": 12, "gaikokugo": 8, "kisho": 5, "major_req": 52, "major_opt": 24, "free_opt": 21, "total": 124}
}

COURSE_AND_MINOR_INFO = {
    "教職コース（中高免許）": {
        "type": "コース科目",
        "target": "全学科共通（中学校・高等学校教諭一種免許状）、特別支援学校教諭免許状（教育学科のみ）",
        "window": "教職センター",
        "required_credits": 32,
        "key_courses": ["教育原理", "教育心理学", "教育課程論", "道徳教育の理論と方法", "各教科教育法Ⅰ・Ⅱ", "教育実習事前事後指導", "教職実践演習（中・高）"],
        "credit_rule": "修得単位は卒業に必要な「自由選択区分」に算入可能。ただし『各教科教育法Ⅰ〜Ⅳ』『教育実習事前・事後指導』『教育実習Ⅰ・Ⅱ』『教職実践演習（中・高）』等の実習・実践系科目は自由選択区分に算入不可。",
        "gpa_rule": "自由選択区分に算入可能なコース科目はすべてGPA算出対象に含まれます。"
    },
    "司書教諭コース": {
        "type": "コース科目",
        "target": "学校図書館司書教諭資格の取得",
        "window": "教職センター",
        "required_credits": 10,
        "key_courses": ["学校図書館メディアの構成", "読書課程論", "学習指導と学校図書館", "学校経営と学校図書館"],
        "credit_rule": "正規の手続きを経て修得した単位は卒業に必要な「自由選択区分」に算入可能。",
        "gpa_rule": "自由選択区分に算入可能なコース科目はすべてGPA算出対象に含まれます。"
    },
    "司書コース": {
        "type": "コース科目",
        "target": "公共図書館等で勤務する司書資格の取得",
        "window": "教務課",
        "required_credits": 20,
        "key_courses": ["図書館概論", "図書館情報技術論", "図書館サービス概論", "情報資源組織論", "情報資源組織演習"],
        "credit_rule": "修得単位は卒業に必要な「自由選択区分」に算入可能。",
        "gpa_rule": "自由選択区分に算入可能なコース科目はすべてGPA算出対象に含まれます。"
    },
    "学芸員コース": {
        "type": "コース科目",
        "target": "博物館・美術館等で勤務する学芸員資格の取得",
        "window": "教務課",
        "required_credits": 19,
        "key_courses": ["博物館概論", "博物館経営論", "博物館資料保存論", "博物館展示論", "博物館実習"],
        "credit_rule": "修得単位は卒業に必要な「自由選択区分」に算入可能。",
        "gpa_rule": "自由選択区分に算入可能なコース科目はすべてGPA算出対象に含まれます。"
    },
    "社会教育主事コース": {
        "type": "コース科目",
        "target": "地域社会教育の指導者（社会教育士等）に必要な資格取得",
        "window": "教務課",
        "required_credits": 24,
        "key_courses": ["社会教育経営論", "生涯学習論", "社会教育課題研究", "地域教育支援論"],
        "credit_rule": "修得単位は卒業に必要な「自由選択区分」に算入可能。",
        "gpa_rule": "自由選択区分に算入可能なコース科目はすべてGPA算出対象に含まれます。"
    },
    "日本語教育コース": {
        "type": "コース科目",
        "target": "国内外で日本語を教える日本語教員としての専門知識・技能習得",
        "window": "教務課",
        "required_credits": 26,
        "key_courses": ["日本語学概論", "日本語教授法", "対照言語学", "日本語教育実習", "第二言語習得論"],
        "credit_rule": "修得単位は卒業に必要な「自由選択区分」に算入可能。",
        "gpa_rule": "自由選択区分に算入可能なコース科目はすべてGPA算出対象に含まれます。"
    },
    "AI・データサイエンス副専攻": {
        "type": "副専攻",
        "target": "文理融合型データサイエンティスト育成",
        "window": "教務課",
        "required_credits": 16,
        "key_courses": ["データ処理基礎", "ビッグデータサイエンス", "人工知能概論", "データサイエンス演習"],
        "credit_rule": "副専攻指定科目の単位は要覧規定に基づき卒業単位（自由選択等）に算入。",
        "gpa_rule": "GPA算出対象に含まれます。"
    },
    "グローバル主専攻・副専攻": {
        "type": "副専攻",
        "target": "高度な国際教養・外国語コミュニケーション能力の習得",
        "window": "教務課",
        "required_credits": 16,
        "key_courses": ["国際教養A", "Cross-Cultural Communication", "異文化理解演習"],
        "credit_rule": "副専攻指定科目の単位は卒業要件区分に算入。",
        "gpa_rule": "GPA算出対象に含まれます。"
    },
    "環境・サステナビリティ副専攻": {
        "type": "副専攻",
        "target": "SDGs・地球環境科学と共生社会の理解",
        "window": "教務課",
        "required_credits": 16,
        "key_courses": ["環境科学概論", "地球環境学", "サステナビリティ論"],
        "credit_rule": "副専攻指定科目の単位は卒業要件区分に算入。",
        "gpa_rule": "GPA算出対象に含まれます。"
    },
    "心身ウェルネス副専攻": {
        "type": "副専攻",
        "target": "健康・スポーツ科学とメンタルヘルスマネジメント",
        "window": "教務課",
        "required_credits": 16,
        "key_courses": ["健康・スポーツ教育論", "ストレスマネジメント", "メンタルヘルス論"],
        "credit_rule": "副専攻指定科目の単位は卒業要件区分に算入。",
        "gpa_rule": "GPA算出対象に含まれます。"
    }
}

class CreditStatus(BaseModel):
    zengaku: int = 0
    sogo: int = 0
    gaikokugo: int = 0
    kisho: int = 0
    major_req: int = 0
    major_opt: int = 0
    free_opt: int = 0

class DegreeCheckRequest(BaseModel):
    department: str = "情報科学科"
    grade: int = 2
    earned_credits: CreditStatus
    selected_minor: Optional[str] = "AI・データサイエンス副専攻"
    taken_courses: List[str] = []

@app.get("/api/academic/courses")
def get_courses_info():
    return {"courses_and_minors": COURSE_AND_MINOR_INFO}

@app.post("/api/academic/degree-check")
def degree_check(req: DegreeCheckRequest):
    reqs = CHS_GRADUATION_REQUIREMENTS.get(req.department, CHS_GRADUATION_REQUIREMENTS["情報科学科"])
    earned = req.earned_credits
    
    rem_zengaku = max(0, reqs["zengaku"] - earned.zengaku)
    rem_sogo = max(0, reqs["sogo"] - earned.sogo)
    rem_gaikokugo = max(0, reqs["gaikokugo"] - earned.gaikokugo)
    rem_kisho = max(0, reqs["kisho"] - earned.kisho)
    rem_major_req = max(0, reqs["major_req"] - earned.major_req)
    rem_major_opt = max(0, reqs["major_opt"] - earned.major_opt)
    
    total_earned = (earned.zengaku + earned.sogo + earned.gaikokugo + 
                    earned.kisho + earned.major_req + earned.major_opt + earned.free_opt)
    rem_total = max(0, reqs["total"] - total_earned)
    
    minor_info = COURSE_AND_MINOR_INFO.get(req.selected_minor or "", {"required_credits": 16, "key_courses": [], "window": "教務課", "credit_rule": "", "gpa_rule": ""})
    minor_taken = [c for c in req.taken_courses if c in minor_info.get("key_courses", [])]
    minor_earned = len(minor_taken) * 2
    minor_rem = max(0, minor_info.get("required_credits", 16) - minor_earned)
    
    missing_items = []
    if rem_zengaku > 0:
        missing_items.append("全学共通: 「自主創造の基礎」(2単位・1年次必修)")
    if rem_sogo > 0:
        missing_items.append(f"総合教育科目: 残り{rem_sogo}単位 (人文系・社会系・理学系各2単位必修含む)")
    if rem_gaikokugo > 0:
        missing_items.append(f"外国語教育科目: 残り{rem_gaikokugo}単位")
    if rem_kisho > 0:
        missing_items.append("基礎教育科目: 「情報リテラシー」(2単位) ＆ 「健康・スポーツ教育」(3単位)")
    if rem_major_req > 0:
        missing_items.append(f"学科専門必修: 残り{rem_major_req}単位 (優先登録推奨)")
    if rem_major_opt > 0:
        missing_items.append(f"学科専門選択: 残り{rem_major_opt}単位")
        
    progress_rate = round((total_earned / reqs["total"]) * 100, 1)
    
    advice = []
    if progress_rate >= 80:
        advice.append(f"🎉 卒業条件の達成率は{progress_rate}%です！非常に順調です。卒業論文・ゼミナールと残りの専門必修科目を中心に履修をまとめましょう。")
    elif progress_rate >= 50:
        advice.append(f"👍 卒業条件の達成率は{progress_rate}%です。順調な進捗です。次学期は学科専門必修（残り{rem_major_req}単位）を優先して登録してください。")
    else:
        advice.append(f"⚠️ 卒業条件の達成率は{progress_rate}%です。{req.grade}年次としては取得ペースを上げる必要があります。履修登録上限数（CAP制）を活用しましょう。")
        
    if req.selected_minor and req.selected_minor in COURSE_AND_MINOR_INFO:
        recom_courses = [c for c in minor_info.get("key_courses", []) if c not in minor_taken]
        window_notice = f"（申請先窓口: {minor_info.get('window', '教務課')}）"
        advice.append(f"🎓 [{req.selected_minor}] {window_notice} 進捗: {minor_earned}/{minor_info.get('required_credits', 16)}単位。未履修おすすめ科目: {', '.join(recom_courses) or '要件充足中'}")
        if "教職" in req.selected_minor:
            advice.append("⚠️ 【教職コース注意事項】各教科教育法・実習・実践演習等の実習科目は『自由選択区分』に算入できません。履修計画の単位数計算にご注意ください。")

    return {
        "department": req.department,
        "total_earned": total_earned,
        "total_required": reqs["total"],
        "progress_rate": min(100.0, progress_rate),
        "remaining_credits": {
            "zengaku": rem_zengaku, "sogo": rem_sogo, "gaikokugo": rem_gaikokugo,
            "kisho": rem_kisho, "major_req": rem_major_req, "major_opt": rem_major_opt, "total": rem_total
        },
        "minor_status": {
            "name": req.selected_minor,
            "earned_credits": minor_earned,
            "required_credits": minor_info.get("required_credits", 16),
            "remaining_credits": minor_rem,
            "window": minor_info.get("window", "教務課"),
            "credit_rule": minor_info.get("credit_rule", ""),
            "gpa_rule": minor_info.get("gpa_rule", ""),
            "recommended_courses": [c for c in minor_info.get("key_courses", []) if c not in minor_taken]
        },
        "missing_requirements": missing_items,
        "ai_advice": "\n".join(advice)
    }

CHS_LECTURE_DATABASE = [
    # 月曜日
    {"day": "月", "period": 1, "name": "細胞生物学1", "teacher": "安原 徳子", "room": "3306", "department": "生命科学科"},
    {"day": "月", "period": 1, "name": "発達と学習", "teacher": "大森 馨子", "room": "411", "department": "教育学科/教職"},
    {"day": "月", "period": 1, "name": "日本文学入門", "teacher": "小林 茂美", "room": "122", "department": "国文学科"},
    {"day": "月", "period": 1, "name": "英語1（オーラル）", "teacher": "スミス J", "room": "3203", "department": "外国語教育科目"},
    {"day": "月", "period": 1, "name": "自然地理学の基礎", "teacher": "高橋 和博", "room": "3401", "department": "地理学科"},
    {"day": "月", "period": 2, "name": "力学2", "teacher": "玉岡 幸太郎", "room": "3403", "department": "物理学科"},
    {"day": "月", "period": 2, "name": "量子力学1", "teacher": "山本 大輔", "room": "3403", "department": "物理学科"},
    {"day": "月", "period": 2, "name": "心理学実験", "teacher": "佐藤 健一", "room": "421", "department": "心理学科"},
    {"day": "月", "period": 2, "name": "史学概論", "teacher": "鈴木 孝治", "room": "131", "department": "史学科"},
    {"day": "月", "period": 2, "name": "中国社会論", "teacher": "張 偉", "room": "3302", "department": "中国語中国文化学科"},
    {"day": "月", "period": 3, "name": "教育原論", "teacher": "原 圭寛", "room": "431", "department": "教育学科/教職"},
    {"day": "月", "period": 3, "name": "固体地球科学基礎実験", "teacher": "田中 秀樹", "room": "3506", "department": "地球科学科"},
    {"day": "月", "period": 3, "name": "英文法", "teacher": "ジョンソン M", "room": "124", "department": "英文学科"},
    {"day": "月", "period": 3, "name": "ドイツ語1", "teacher": "ミュラー K", "room": "3205", "department": "外国語教育科目"},
    {"day": "月", "period": 4, "name": "基礎物理実験A", "teacher": "上岡 隼人", "room": "125", "department": "物理学科"},
    {"day": "月", "period": 4, "name": "社会学史", "teacher": "中村 陽一", "room": "441", "department": "社会学科"},
    {"day": "月", "period": 4, "name": "運動生理学", "teacher": "渡辺 学", "room": "3206", "department": "体育学科"},
    {"day": "月", "period": 5, "name": "情報ネットワーク論", "teacher": "伊藤 賢治", "room": "3304", "department": "情報科学科"},

    # 火曜日
    {"day": "火", "period": 1, "name": "生徒指導・進路指導論", "teacher": "土屋 弥生", "room": "3500", "department": "教育学科/教職"},
    {"day": "火", "period": 1, "name": "古文書学", "teacher": "加藤 秀雄", "room": "132", "department": "史学科"},
    {"day": "火", "period": 1, "name": "地球科学概論", "teacher": "小林 誠", "room": "3402", "department": "地球科学科"},
    {"day": "火", "period": 2, "name": "特別支援教育概論", "teacher": "田部 絢子", "room": "3506", "department": "教育学科/教職"},
    {"day": "火", "period": 2, "name": "データ構造とアルゴリズム", "teacher": "森田 浩司", "room": "3305", "department": "情報科学科"},
    {"day": "火", "period": 2, "name": "哲学基礎講義", "teacher": "吉田 聡", "room": "412", "department": "哲学科"},
    {"day": "火", "period": 3, "name": "物理数学1", "teacher": "千葉 剛", "room": "3404", "department": "物理学科"},
    {"day": "火", "period": 3, "name": "教育課程論", "teacher": "野内 頼一", "room": "131", "department": "教育学科/教職"},
    {"day": "火", "period": 3, "name": "ソーシャルワーク演習", "teacher": "松本 恵子", "room": "422", "department": "社会福祉学科"},
    {"day": "火", "period": 4, "name": "現代家族論", "teacher": "斉藤 直子", "room": "3204", "department": "社会学科"},
    {"day": "火", "period": 4, "name": "スポーツバイオメカニクス", "teacher": "木村 剛", "room": "3303", "department": "体育学科"},
    {"day": "火", "period": 5, "name": "フランス語初級", "teacher": "デュポン P", "room": "135", "department": "外国語教育科目"},

    # 水曜日
    {"day": "水", "period": 1, "name": "基礎線形代数1", "teacher": "柳田 昌宏", "room": "3302", "department": "数学科"},
    {"day": "水", "period": 1, "name": "アカデミックICT基礎", "teacher": "清水 達也", "room": "3401", "department": "基礎教育科目"},
    {"day": "水", "period": 1, "name": "中国語1", "teacher": "李 芳", "room": "123", "department": "外国語教育科目"},
    {"day": "水", "period": 2, "name": "教育相談", "teacher": "西本 和月", "room": "3305", "department": "教育学科/教職"},
    {"day": "水", "period": 2, "name": "地形学", "teacher": "宮崎 慎一", "room": "3403", "department": "地理学科"},
    {"day": "水", "period": 2, "name": "障害者福祉施策", "teacher": "井上 敏", "room": "411", "department": "社会福祉学科"},
    {"day": "水", "period": 3, "name": "情報理論1", "teacher": "古市 茂", "room": "3308", "department": "情報科学科"},
    {"day": "水", "period": 3, "name": "アメリカ文学史", "teacher": "ベーカー R", "room": "126", "department": "英文学科"},
    {"day": "水", "period": 3, "name": "日本語学入門", "teacher": "橋本 健", "room": "130", "department": "国文学科"},
    {"day": "水", "period": 4, "name": "地震学", "teacher": "岡田 浩一", "room": "3500", "department": "地球科学科"},
    {"day": "水", "period": 4, "name": "認知心理学特講", "teacher": "西村 誠司", "room": "432", "department": "心理学科"},
    {"day": "水", "period": 5, "name": "スペイン語会話", "teacher": "ガルシア M", "room": "3203", "department": "外国語教育科目"},

    # 木曜日
    {"day": "木", "period": 1, "name": "道徳教育の理論と方法", "teacher": "河野 桃子", "room": "3305", "department": "教育学科/教職"},
    {"day": "木", "period": 1, "name": "有機化学基礎", "teacher": "竹内 亮", "room": "3402", "department": "化学科"},
    {"day": "木", "period": 2, "name": "データベース論", "teacher": "杉本 雅弘", "room": "3306", "department": "情報科学科"},
    {"day": "木", "period": 2, "name": "都市地理学", "teacher": "野村 貴行", "room": "3404", "department": "地理学科"},
    {"day": "木", "period": 2, "name": "東洋史特講", "teacher": "島田 英樹", "room": "131", "department": "史学科"},
    {"day": "木", "period": 3, "name": "教育原論", "teacher": "小野 雅章", "room": "3303", "department": "教育学科/教職"},
    {"day": "木", "period": 3, "name": "気圏科学実習", "teacher": "大野 健太", "room": "3506", "department": "地球科学科"},
    {"day": "木", "period": 3, "name": "韓国・朝鮮語1", "teacher": "金 秀賢", "room": "124", "department": "外国語教育科目"},
    {"day": "木", "period": 4, "name": "電磁気学3", "teacher": "鈴木 優樹", "room": "3401", "department": "物理学科"},
    {"day": "木", "period": 4, "name": "マス・コミュニケーション論", "teacher": "藤田 剛", "room": "442", "department": "社会学科"},
    {"day": "木", "period": 5, "name": "ロシア語初級", "teacher": "イワノフ D", "room": "127A", "department": "外国語教育科目"},

    # 金曜日
    {"day": "金", "period": 1, "name": "微分・積分1", "teacher": "石部 正", "room": "412", "department": "数学科"},
    {"day": "金", "period": 1, "name": "近代文学研究", "teacher": "安田 正人", "room": "122", "department": "国文学科"},
    {"day": "金", "period": 1, "name": "英語プレゼンテーション", "teacher": "クラーク S", "room": "3204", "department": "外国語教育科目"},
    {"day": "金", "period": 2, "name": "教育原論", "teacher": "佐野 良介", "room": "3204", "department": "教育学科/教職"},
    {"day": "金", "period": 2, "name": "健康・スポーツ教育実習", "teacher": "本田 孝文", "room": "体育館", "department": "基礎教育科目/体育"},
    {"day": "金", "period": 2, "name": "心理調査法実習", "teacher": "工藤 由美", "room": "421", "department": "心理学科"},
    {"day": "金", "period": 3, "name": "Webプログラミング", "teacher": "藤本 一平", "room": "3308", "department": "情報科学科"},
    {"day": "金", "period": 3, "name": "倫理学概論", "teacher": "中川 徹", "room": "132", "department": "哲学科"},
    {"day": "金", "period": 3, "name": "高齢者福祉論", "teacher": "西川 和恵", "room": "431", "department": "社会福祉学科"},
    {"day": "金", "period": 4, "name": "地理情報科学(GIS)", "teacher": "山崎 俊", "room": "3403", "department": "地理学科"},
    {"day": "金", "period": 4, "name": "同位体地球科学", "teacher": "池田 雅之", "room": "3500", "department": "地球科学科"},
    {"day": "金", "period": 5, "name": "中国語スピーキング", "teacher": "王 俊", "room": "125", "department": "中国語中国文化学科"},

    # 土曜日
    {"day": "土", "period": 1, "name": "教職総合演習", "teacher": "教職担当班", "room": "411", "department": "教職コース"},
    {"day": "土", "period": 2, "name": "学校図書館メディアの構成", "teacher": "図書館学担当", "room": "3203", "department": "司書教諭コース"},
    {"day": "土", "period": 3, "name": "博物館展示論", "teacher": "学芸員担当", "room": "3302", "department": "学芸員コース"},

    # 集中講義（不定期・実習・オンデマンド）
    {"day": "集中", "period": 0, "name": "データサイエンスの世界", "teacher": "オンデマンド", "room": "遠隔", "department": "情報科学科/副専攻"},
    {"day": "集中", "period": 0, "name": "ヨーロッパの教育思想", "teacher": "横田 みどり", "room": "3402", "department": "教育学科"},
    {"day": "集中", "period": 0, "name": "野外教育論(含実習)", "teacher": "西島 大祐", "room": "学外", "department": "体育学科"},
    {"day": "集中", "period": 0, "name": "恐竜学", "teacher": "藤原 慎一", "room": "3410", "department": "地球科学科"},
    {"day": "集中", "period": 0, "name": "キャリアデザイン特講", "teacher": "峯岸 久枝", "room": "学内3500", "department": "全学科共通"},
    {"day": "集中", "period": 0, "name": "教育実習事前・事後指導", "teacher": "教職指導委員会", "room": "131", "department": "教職コース"},
    {"day": "集中", "period": 0, "name": "博物館実習", "teacher": "資料館担当教授", "room": "8号館資料館", "department": "学芸員コース"},
    {"day": "集中", "period": 0, "name": "野外調査法（含実習）", "teacher": "地理学科スタッフ", "room": "学外巡検", "department": "地理学科"}
]

ALL_CAMPUS_ROOMS = [
    "122", "123", "124", "125", "126", "130", "131", "132", "135", "141", "151",
    "3203", "3204", "3205", "3206",
    "3302", "3303", "3304", "3305", "3306", "3308",
    "3401", "3402", "3403", "3404", "3410",
    "3500", "3506",
    "411", "412", "421", "422", "431", "432", "441", "442", "443", "444"
]

@app.get("/api/courses/search")
def search_courses(
    day: Optional[str] = Query(None),
    period: Optional[int] = Query(None),
    q: Optional[str] = Query("")
):
    query = (q or "").strip().lower()
    results = []
    for c in CHS_LECTURE_DATABASE:
        match_day = (day is None or c["day"] == day)
        match_period = (period is None or c["period"] == period)
        match_q = (
            not query or
            query in c["name"].lower() or
            query in c["teacher"].lower() or
            query in c["room"].lower() or
            query in c["department"].lower()
        )
        if match_day and match_period and match_q:
            results.append(c)
    return {"count": len(results), "courses": results}

@app.get("/api/rooms/free")
def get_free_rooms(
    day: Optional[str] = Query(None),
    period: Optional[int] = Query(None)
):
    now = datetime.datetime.now()
    weekday_map = {0: "月", 1: "火", 2: "水", 3: "木", 4: "金", 5: "土", 6: "日"}
    current_day = day or weekday_map.get(now.weekday(), "月")
    if current_day == "日":
        current_day = "月"
        
    current_period = period
    if current_period is None:
        now_time = now.strftime("%H:%M")
        if now_time < "10:35":
            current_period = 1
        elif now_time < "12:15":
            current_period = 2
        elif now_time < "13:00":
            current_period = 2
        elif now_time < "14:35":
            current_period = 3
        elif now_time < "16:15":
            current_period = 4
        else:
            current_period = 5

    occupied_rooms = [
        c["room"] for c in CHS_LECTURE_DATABASE 
        if c["day"] == current_day and c["period"] == current_period
    ]
    free_rooms = [r for r in ALL_CAMPUS_ROOMS if r not in occupied_rooms]
    
    return {
        "day": current_day,
        "period": current_period,
        "occupied_count": len(occupied_rooms),
        "occupied_rooms": occupied_rooms,
        "free_count": len(free_rooms),
        "free_rooms": free_rooms,
        "by_building": {
            "1号館": [r for r in free_rooms if r.startswith("1")],
            "3号館": [r for r in free_rooms if r.startswith("3")],
            "4号館": [r for r in free_rooms if r.startswith("4")]
        },
        "bubble_message": f"ただいま（{current_day}曜 {current_period}限）の空き教室は、{', '.join(free_rooms[:5])} など全{len(free_rooms)}室が利用可能です。"
    }

FACILITIES_DB = [
    {
        "id": "library",
        "name": "日本大学文理学部図書館",
        "category": "図書・資料",
        "weekday": "09:00 - 20:00",
        "saturday": "09:00 - 19:00",
        "sunday_holiday": "休館（授業なし日）",
        "note": "地下書庫・貸出手続きは閉館30分前まで",
        "location": "図書館棟"
    },
    {
        "id": "comp_center",
        "name": "コンピュータセンター（受付）",
        "category": "ICT・端末",
        "weekday": "09:00 - 18:00",
        "saturday": "09:00 - 13:00",
        "sunday_holiday": "休業",
        "note": "アカウント・学内Wi-Fi問い合わせ対応",
        "location": "3号館"
    },
    {
        "id": "museum",
        "name": "日本大学文理学部資料館",
        "category": "展示・文化",
        "weekday": "10:00 - 17:00",
        "saturday": "10:00 - 13:00",
        "sunday_holiday": "休館",
        "note": "入館無料 / 企画展示開催中",
        "location": "8号館"
    },
    {
        "id": "learning_commons",
        "name": "ラーニング・コモンズ",
        "category": "学習スペース",
        "weekday": "08:00 - 18:00 (サポートデスク 10:00 - 18:00)",
        "saturday": "08:00 - 17:00 (サポートデスク 09:00 - 13:00)",
        "sunday_holiday": "休館",
        "note": "グループ学習・PC貸出・アカデミックコモンズ併設",
        "location": "本館1階"
    },
    {
        "id": "academic_affairs",
        "name": "事務窓口・教務課等",
        "category": "各種手続き",
        "weekday": "09:00 - 17:00",
        "saturday": "09:00 - 13:00",
        "sunday_holiday": "休み",
        "note": "証明書自動発行機利用は閉口15分前まで / 教職コース届出は教職センターへ",
        "location": "本館1階事務室"
    }
]

class FacilityQueryRequest(BaseModel):
    query: Optional[str] = None

@app.get("/api/facilities/hours")
@app.post("/api/facilities/hours")
def facility_hours(req: Optional[FacilityQueryRequest] = None, q: Optional[str] = Query(None)):
    search_q = (req.query if req and req.query else q) or ""
    results = []
    for f in FACILITIES_DB:
        if not search_q or (search_q.lower() in f["name"].lower() or search_q.lower() in f["category"].lower() or search_q.lower() in f["location"].lower()):
            results.append(f)
            
    if not results:
        results = FACILITIES_DB
        
    ai_response = f"【文理学部 施設営業時間案内AI】\n検索条件: 「{search_q or '全施設'}」の回答結果です。\n\n"
    for r in results:
        ai_response += f"🏛 **{r['name']}** ({r['location']})\n"
        ai_response += f"  • 平日: {r['weekday']}\n"
        ai_response += f"  • 土曜: {r['saturday']}\n"
        ai_response += f"  • 日祝: {r['sunday_holiday']}\n"
        ai_response += f"  • 案内: {r['note']}\n\n"
        
    return {
        "query": search_q,
        "facilities": results,
        "ai_response": ai_response.strip()
    }

class ScheduleItem(BaseModel):
    id: str
    title: str
    date: str
    period: Optional[str] = None
    course_name: Optional[str] = None
    type: str = "task"
    push_notify: bool = True
    completed: bool = False

MOCK_SCHEDULES: List[Dict[str, Any]] = [
    {"id": "1", "title": "情報科学演習 レポート提出", "date": "2026-10-09", "period": "3限", "course_name": "情報科学演習", "type": "task", "push_notify": True, "completed": False},
    {"id": "2", "title": "データ構造 中間小テスト", "date": "2026-10-15", "period": "2限", "course_name": "データ構造", "type": "exam", "push_notify": True, "completed": False}
]

@app.get("/api/schedules")
def get_schedules():
    return {"schedules": MOCK_SCHEDULES}

@app.post("/api/schedules")
def add_schedule(item: ScheduleItem):
    MOCK_SCHEDULES.append(item.dict())
    return {"status": "success", "schedule": item}

@app.delete("/api/schedules/{schedule_id}")
def delete_schedule(schedule_id: str):
    global MOCK_SCHEDULES
    MOCK_SCHEDULES = [s for s in MOCK_SCHEDULES if s["id"] != schedule_id]
    return {"status": "deleted", "id": schedule_id}

class FriendCompareRequest(BaseModel):
    friend_code: str
    my_timetable: Dict[str, Any]

@app.post("/api/friends/compare")
def compare_friends(req: FriendCompareRequest):
    dummy_friend_db = {
        "ENE-1001": {
            "name": "サクラ (情報科学科 2年)",
            "timetable": {
                "mon_1": "情報科学概論", "mon_3": "英語3",
                "tue_2": "データ構造", "wed_1": "自修",
                "thu_1": "Webプログラミング", "thu_3": "線形代数",
                "fri_3": "健康・スポーツ実習"
            }
        },
        "ENE-2002": {
            "name": "ケンタ (国文学科 3年)",
            "timetable": {
                "mon_2": "日本文学史", "tue_1": "古文書学",
                "tue_3": "国語学演習", "thu_2": "漢文学特別講義",
                "fri_1": "近代文学研究"
            }
        }
    }
    
    friend_data = dummy_friend_db.get(
        req.friend_code.upper(),
        {
            "name": f"フレンド ({req.friend_code})",
            "timetable": {"mon_1": "総合教養", "tue_2": "専門演習", "thu_4": "外国語"}
        }
    )
    
    common_free_slots = []
    days = ["mon", "tue", "wed", "thu", "fri", "sat"]
    periods = [1, 2, 3, 4, 5]
    day_names = {"mon": "月曜", "tue": "火曜", "wed": "水曜", "thu": "木曜", "fri": "金曜", "sat": "土曜"}
    
    for d in days:
        for p in periods:
            slot_key = f"{d}_{p}"
            my_slot = req.my_timetable.get(slot_key, "")
            friend_slot = friend_data["timetable"].get(slot_key, "")
            
            if not my_slot and not friend_slot:
                common_free_slots.append({
                    "key": slot_key,
                    "day": day_names.get(d, d),
                    "period": f"{p}限"
                })
                
    return {
        "friend_name": friend_data["name"],
        "friend_code": req.friend_code,
        "friend_timetable": friend_data["timetable"],
        "common_free_slots": common_free_slots,
        "common_free_count": len(common_free_slots)
    }

class TimetableItem(BaseModel):
    subject: str
    room_number: str

def parse_room_detail(room: str) -> str:
    r = room.strip().upper()
    if not r:
        return "詳細場所未登録"

    if r in ["122", "123", "124"]:
        return "1号館2階・階段登って左側（左奥に女子トイレ）"
    if r in ["125", "126", "127A", "127B"]:
        return "1号館2階・階段登って右側（右手前に男子トイレ、右奥に女子トイレ）"
    if r == "130":
        return "1号館3階・階段登って正面（左奥: 男子トイレ、右奥: 女子トイレ）"
    if r in ["131", "132", "133", "134", "138"]:
        return "1号館3階・階段登って左側（左奥に男子トイレ）"
    if r in ["135", "136", "137A", "137B", "139"]:
        return "1号館3階・階段登って右側（右奥に女子トイレ）"
    if r == "141":
        return "1号館4階・階段登って正面（※4階・5階はトイレなし、2F/3Fを利用）"
    if r == "151":
        return "1号館5階・階段登って正面（※4階・5階はトイレなし、2F/3Fを利用）"

    if r == "411":
        return "4号館1階・正面から入って左側（男子トイレ側 / 給水所利用可能）"
    if r == "412":
        return "4号館1階・正面から入って右側（女子トイレ側 / 給水所利用可能）"
    if r == "421":
        return "4号館2階・階段登って左側（男子トイレ側 ※給水所使用不可）"
    if r == "422":
        return "4号館2階・階段登って右側（女子トイレ側 ※給水所使用不可）"
    if r == "431":
        return "4号館3階・階段登って右側（男子トイレ側 ※給水所使用不可）"
    if r == "432":
        return "4号館3階・階段登って左側（女子トイレ側 ※給水所使用不可）"
    if r == "441":
        return "4号館4階・階段登って右側奥（男子トイレ側・奥 ※給水所使用不可）"
    if r == "442":
        return "4号館4階・階段登って右側手前（男子トイレ側・手前 ※給水所使用不可）"
    if r == "443":
        return "4号館4階・階段登って左側手前（女子トイレ側・手前 ※給水所使用不可）"
    if r == "444":
        return "4号館4階・階段登って左側奥（女子トイレ側・奥 ※給水所使用不可）"

    m3 = re.match(r"^3([1-5])(\d{2})$", r)
    if m3:
        floor = m3.group(1)
        sub_num = int(m3.group(2))
        if 1 <= sub_num <= 5:
            return f"3号館{floor}階・エスカレーター出て右 / エレベーター出て左（男子トイレ側）"
        elif 6 <= sub_num <= 10:
            return f"3号館{floor}階・エスカレーター出て左 / エレベーター出て右（女子トイレ側）"
        return f"3号館{floor}階（下2桁01〜05: 男子トイレ側 / 06〜10: 女子トイレ側）"

    if r.startswith("1") and len(r) >= 3 and r[1].isdigit():
        return f"1号館{r[1]}階"
    if r.startswith("4") and len(r) >= 3 and r[1].isdigit():
        return f"4号館{r[1]}階"
    if r.startswith("2") and len(r) == 4 and r[1].isdigit():
        return f"2号館{r[1]}階"

    return f"{room}教室（キャンパス構内）"

VENDING_MACHINES = [
    {
        "id": "1f_drink",
        "building": "1号館",
        "floor": "1階",
        "type": "飲み物",
        "location": "正面入口を入って左手側",
        "payment": ["現金", "交通系IC", "iD", "QUICPay", "楽天Edy", "nanaco", "WAON", "PayPay", "LINE Pay", "メルペイ", "au PAY", "d払い", "WeChat Pay", "Alipay"],
        "items": [
            {"name": "コカ・コーラ 500ml", "price": 160},
            {"name": "綾鷹 525ml", "price": 140},
            {"name": "アクエリアス 500ml", "price": 150},
            {"name": "ジョージア ジャパンクラフトマン", "price": 130},
            {"name": "い・ろ・は・す 540ml", "price": 110},
            {"name": "爽健美茶 600ml", "price": 140},
            {"name": "リアルゴールド", "price": 120}
        ]
    },
    {
        "id": "3f_drink",
        "building": "3号館",
        "floor": "1階",
        "type": "飲み物",
        "location": "エレベーターホール横",
        "payment": ["現金", "交通系IC", "クレジットカード(タッチ決済)", "iD", "QUICPay", "PayPay", "d払い", "au PAY", "楽天ペイ"],
        "items": [
            {"name": "モンスターエナジー 355ml", "price": 210},
            {"name": "レッドブル 250ml", "price": 210},
            {"name": "サントリー天然水 550ml", "price": 100},
            {"name": "伊右衛門 600ml", "price": 130},
            {"name": "クラフトボス ラテ 500ml", "price": 140},
            {"name": "ポカリスエット 500ml", "price": 150},
            {"name": "オロナミンC", "price": 120}
        ]
    },
    {
        "id": "4f_drink",
        "building": "4号館",
        "floor": "1階",
        "type": "飲み物",
        "location": "エントランスホール（給水所横）",
        "payment": ["現金", "交通系IC", "PayPay", "LINE Pay", "d払い"],
        "items": [
            {"name": "お〜いお茶 525ml", "price": 130},
            {"name": "健康ミネラルむぎ茶 600ml", "price": 130},
            {"name": "タリーズ バリスタズブラック 390ml", "price": 140},
            {"name": "充実野菜 200ml", "price": 110},
            {"name": "エビアン 500ml", "price": 110},
            {"name": "カルピスウォーター 500ml", "price": 140}
        ]
    }
]

class NavigatorQuery(BaseModel):
    query: str

def answer_navigator_query(query: str) -> str:
    q = query.strip()
    q_lower = q.lower()

    room_match = re.search(r"\b([1-4]\d{2,3}[A-Ba-b]?)\b", q)
    if room_match:
        room_code = room_match.group(1).upper()
        detail = parse_room_detail(room_code)
        if detail != "詳細場所未登録":
            return f"📍 【教室案内: {room_code}】\n場所: {detail}\n※エネコマ時間割にもこのまま登録できます！"

    if any(k in q for k in ["水飲み場", "給水所", "給水", "水飲み", "冷水機"]):
        return (
            "🚰 【給水所（水飲み場）のご案内】\n"
            "・現在使用可能な場所: **4号館 1階** のみ\n"
            "※注意: 4号館 2階〜4階の給水所は現在使用不可となっています。"
        )

    if "ゴミ箱" in q or "ごみ箱" in q or "ゴミ" in q:
        return (
            "🗑️ 【ゴミ箱の設置場所】\n"
            "・1号館、2号館、3号館、4号館の **全館・各階** に設置されています。\n"
            "・4号館は **各階トイレ前** に設置されています。"
        )

    if "トイレ" in q or "お手洗い" in q or "便所" in q:
        if "1号館" in q or "1号" in q:
            return (
                "🚻 【1号館のトイレ情報】\n"
                "・1階: 正面左手前（女子）、左奥（男子）、右手前奥（男子）\n"
                "・2階: 左奥（女子）、右手前（男子）、右奥（女子）\n"
                "・3階: 左奥（男子）、右奥（女子）\n"
                "⚠️ 注意: 4階・5階にはトイレがありません。2階または3階をご利用ください。"
            )
        elif "3号館" in q or "3号" in q:
            return (
                "🚻 【3号館のトイレ情報（各階共通）】\n"
                "・男子トイレ: エスカレーター出て右 / エレベーター出て左（教室01〜05側）\n"
                "・女子トイレ: エスカレーター出て左 / エレベーター出て右（教室06〜10側）"
            )
        elif "4号館" in q or "4号" in q:
            return (
                "🚻 【4号館のトイレ情報】\n"
                "・1階: 左側（男子 / 411側）、右側（女子 / 412側）\n"
                "・2階: 左側（男子 / 421側）、右側（女子 / 422側）\n"
                "・3階: 右側（男子 / 431側）、左側（女子 / 432側）\n"
                "・4階: 右側（男子 / 441・442側）、左側（女子 / 443・444側）"
            )
        else:
            return (
                "🚻 【各館トイレのご案内】\n"
                "・3号館 (各階): 男子=エスカレーター右(01-05側) / 女子=エスカレーター左(06-10側)\n"
                "・4号館 (各階): 階ごとに左右配置（1F/2Fは左男子・右女子、3F/4Fは右男子・左女子）\n"
                "・1号館: 1F〜3Fに設置（※4階・5階にはトイレがありません）\n"
                "・2号館: 各階に設置"
            )

    if any(k in q for k in ["クレジット", "クレカ", "タッチ決済", "コンタクトレス"]):
        return (
            "💳 【クレジットカードタッチ決済が使える自販機】\n"
            "・設置場所: **3号館 1階 エレベーターホール横**\n"
            "・Visa / Mastercard コンタクトレス決済対応！"
        )

    if "100円" in q or "安い" in q:
        return (
            "🪙 【100円〜お得な商品】\n"
            "・サントリー天然水 550ml (3号館1F 100円)\n"
            "・い・ろ・は・す 540ml (1号館1F 110円)\n"
            "・エビアン 500ml (4号館1F 110円)"
        )

    return (
        "🎓 【キャンパス構内ナビゲーターAI】\n"
        "教室番号（例: 3402, 411）、自販機（レッドブル、クレカ決済、100円商品）、給水所、トイレ、ゴミ箱についてお答えできます！"
    )

@app.post("/api/timetable/parse")
def parse_timetable(item: TimetableItem):
    location_detail = parse_room_detail(item.room_number)
    return {
        "subject": item.subject,
        "room_number": item.room_number,
        "location_detail": location_detail,
        "full_display": f"{item.subject} （{item.room_number}：{location_detail}）"
    }

@app.post("/api/navigator/chat")
def navigator_chat(data: NavigatorQuery):
    reply = answer_navigator_query(data.query)
    return {"query": data.query, "reply": reply}

