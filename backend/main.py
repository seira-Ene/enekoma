import datetime
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import re

try:
    from chs_courses import CHS_LECTURE_DATABASE
except ImportError:
    CHS_LECTURE_DATABASE = []

app = FastAPI(
    title="EneKoma Campus Navigator API",
    version="2.1.0",
    description="日本大学文理学部向け時間割・履修卒業判定・コース科目・施設案内・スケジュール・フレンド共有・空き教室案内API"
)

# CORS許可設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 1. 授業時間設定 (時限データモデル)
# ==========================================
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

# ==========================================
# 2. 日本大学文理学部 (CHS) 学部要覧基準データ
# ==========================================
# 全学科卒業必要単位数: 124単位
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

# 全学科共通6つのコース科目 ＆ 副専攻データ
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
    """全学科共通の6つのコース科目および副専攻の詳細情報（提出窓口、単位認定ルール等）"""
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
    
    # 副専攻 / コース判定
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
        
    # 情報科学科の専門必修・卒業研究要件判定
    if req.department == "情報科学科":
        cs_required = [
            "基礎微分積分1", "基礎微分積分2", "線形代数1", "線形代数2",
            "基礎プログラミング1", "基礎プログラミング2", "情報科学実習1", "情報科学実習2",
            "データ構造", "アルゴリズム", "情報理論1", "情報科学研究1", "情報科学研究2"
        ]
        missing_cs = [c for c in cs_required if not any(c in t for t in req.taken_courses)]
        if missing_cs and rem_major_req > 0:
            missing_items.append(f"情報科学科 必修指定残存: {', '.join(missing_cs[:3])}{' など' if len(missing_cs) > 3 else ''}")
        if req.grade >= 3:
            advice.append("🔬 【情報科学科・卒研着手要件】4年次の「情報科学研究1・2（卒業研究）」着手には、3年次終了時までに所定の専門必修単位修得が必須です。データ構造・アルゴリズム・情報科学実習等の未修得科目がないか確認してください。")

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

# ==========================================
# 3. 講義データベース & 空き教室判定 API
# ==========================================
try:
    from chs_courses import CHS_LECTURE_DATABASE
except ImportError:
    try:
        from backend.chs_courses import CHS_LECTURE_DATABASE
    except ImportError:
        CHS_LECTURE_DATABASE = []

# キャンパスの主要教室一覧
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
    day: Optional[str] = Query(None, description="曜日 (月, 火, 水, 木, 金, 土, 集中)"),
    period: Optional[int] = Query(None, description="時限 (1〜5, 集中は0)"),
    q: Optional[str] = Query("", description="講義名・教員名・学科キーワード")
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
    day: Optional[str] = Query(None, description="曜日 (月〜土)"),
    period: Optional[int] = Query(None, description="時限 (1〜5)")
):
    """現在の時刻または指定された曜日・時限における空き教室を判定・案内"""
    now = datetime.datetime.now()
    weekday_map = {0: "月", 1: "火", 2: "水", 3: "木", 4: "金", 5: "土", 6: "日"}
    
    current_day = day or weekday_map.get(now.weekday(), "月")
    if current_day == "日":
        current_day = "月" # 休日は月曜をデフォルト参考
        
    current_period = period
    if current_period is None:
        # 現在時刻から判定
        now_time = now.strftime("%H:%M")
        if now_time < "10:35":
            current_period = 1
        elif now_time < "12:15":
            current_period = 2
        elif now_time < "13:00":
            current_period = 2 # 昼休み
        elif now_time < "14:35":
            current_period = 3
        elif now_time < "16:15":
            current_period = 4
        else:
            current_period = 5

    # 該当コマで使用されている教室
    occupied_rooms = [
        c["room"] for c in CHS_LECTURE_DATABASE 
        if c["day"] == current_day and c["period"] == current_period
    ]
    
    free_rooms = [r for r in ALL_CAMPUS_ROOMS if r not in occupied_rooms]
    
    # 建物ごとに分類
    building_1 = [r for r in free_rooms if r.startswith("1")]
    building_3 = [r for r in free_rooms if r.startswith("3")]
    building_4 = [r for r in free_rooms if r.startswith("4")]
    
    bubble_message = (
        f"ただいま（{current_day}曜 {current_period}限）の空き教室は、"
        f"{', '.join(free_rooms[:5])} など全{len(free_rooms)}室が利用可能です。"
    )
    
    return {
        "day": current_day,
        "period": current_period,
        "occupied_count": len(occupied_rooms),
        "occupied_rooms": occupied_rooms,
        "free_count": len(free_rooms),
        "free_rooms": free_rooms,
        "by_building": {
            "1号館": building_1,
            "3号館": building_3,
            "4号館": building_4
        },
        "bubble_message": bubble_message
    }

# ==========================================
# 4. 施設営業時間案内AI API
# ==========================================
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

# ==========================================
# 5. スケジュール ＆ 課題管理 API
# ==========================================
class ScheduleItem(BaseModel):
    id: str
    title: str
    date: str
    period: Optional[str] = None
    course_name: Optional[str] = None
    type: str = "task"  # "task", "exam", "event"
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

# ==========================================
# 6. マイページ ＆ フレンド時間割共有 API
# ==========================================
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

# ==========================================
# 7. 教室・キャンパスナビゲーター互換API（100%保持）
# ==========================================
class TimetableItem(BaseModel):
    subject: str
    room_number: str

def get_room_short_label(room: str) -> str:
    r = room.strip().upper()
    if not r:
        return "教室未指定"
    if r == "411": return "4号館411(男子側)"
    if r == "412": return "4号館412(女子側)"
    if r == "421": return "4号館421(男子側)"
    if r == "422": return "4号館422(女子側)"
    if r == "431": return "4号館431(男子側)"
    if r == "432": return "4号館432(女子側)"
    if r == "441": return "4号館441(男子側)"
    if r == "442": return "4号館442(男子側)"
    if r == "443": return "4号館443(女子側)"
    if r == "444": return "4号館444(女子側)"
    m3 = re.match(r"^3([1-5])(\d{2})$", r)
    if m3:
        fl = m3.group(1)
        sub = int(m3.group(2))
        side = "男子側" if 1 <= sub <= 5 else "女子側" if 6 <= sub <= 10 else "中央"
        return f"3号館{fl}{sub:02d}({side})"
    if r in ["122", "123", "124"]: return f"1号館{r}(左側)"
    if r in ["125", "126", "127A", "127B"]: return f"1号館{r}(右側)"
    if r == "130": return "1号館130(正面)"
    if r in ["131", "132", "133", "134", "138"]: return f"1号館{r}(左側)"
    if r in ["135", "136", "137A", "137B", "139"]: return f"1号館{r}(右側)"
    if r == "141": return "1号館141(4F)"
    if r == "151": return "1号館151(5F)"
    if r.startswith("1") and len(r) == 3: return f"1号館{r}"
    if r.startswith("2") and len(r) == 4: return f"2号館{r[1:]}"
    if "8B" in r or "88" in r:
        clean = r.replace("88", "8B")
        return f"8号館{clean.replace('8号館', '')[:4]}"
    return r[:12]

def parse_room_detail(room: str) -> str:
    r = room.strip().upper()
    if not r:
        return "詳細場所未登録"
    if r == "411":
        return "4号館1階・正面入って左側（男子トイレ側 / 給水所利用可能）"
    if r == "412":
        return "4号館1階・正面入って右側（女子トイレ側 / 給水所利用可能）"
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
        fl = m3.group(1)
        sub = int(m3.group(2))
        if 1 <= sub <= 5:
            return f"3号館{fl}階・エスカレーター出て右 / エレベーター出て左（男子トイレ側）"
        elif 6 <= sub <= 10:
            return f"3号館{fl}階・エスカレーター出て左 / エレベーター出て右（女子トイレ側）"
        return f"3号館{fl}階（フロア中央エリア）"
    if r in ["122", "123", "124"]:
        return "1号館2階・階段登って左側（奥に女子トイレ）"
    if r in ["125", "126", "127A", "127B"]:
        return "1号館2階・階段登って右側（手前に男子トイレ、奥に女子トイレ）"
    if r == "130":
        return "1号館3階・階段登って正面（左奥に男子トイレ、右奥に女子トイレ）"
    if r in ["131", "132", "133", "134", "138"]:
        return "1号館3階・階段登って左側（奥に男子トイレ）"
    if r in ["135", "136", "137A", "137B", "139"]:
        return "1号館3階・階段登って右側（奥に女子トイレ）"
    if r == "141":
        return "1号館4階・階段登って正面（※4階・5階はトイレなし、2F/3Fを利用）"
    if r == "151":
        return "1号館5階・階段登って正面（※4階・5階はトイレなし、2F/3Fを利用）"
    m2 = re.match(r"^2([1-5])(\d{2})$", r)
    if m2:
        fl = m2.group(1)
        return f"2号館{fl}階（※2号館は自動販売機・ゴミ箱未設置）"
    return f"{room}教室（キャンパス構内）"

@app.post("/api/timetable/parse")
def parse_timetable_room(item: TimetableItem):
    short_label = get_room_short_label(item.room_number)
    detail = parse_room_detail(item.room_number)
    return {
        "subject": item.subject,
        "room_number": item.room_number,
        "short_label": short_label,
        "room_detail": detail
    }

# ==========================================
# 8. 自販機・構内ナビゲーターチャット（校舎ナレッジ完全準拠）
# ==========================================
VENDING_MACHINES_DB = [
    {
        "id": "bldg4_1f_suntory",
        "building": "4号館",
        "floor": "1階",
        "brand": "サントリー",
        "app": "ジハンピ",
        "location": "4号館 1階 エントランスホール（給水所横）",
        "payment": "PayPay〇、交通系IC（モバイル）〇、※物理交通系IC直接タッチ×、現金〇",
        "items": [
            {"name": "サントリー天然水", "price": 80, "pos": "上段"},
            {"name": "ZONe スカッと透明", "price": 80, "pos": "中段"},
            {"name": "やさしい麦茶", "price": 90, "pos": "上段"},
            {"name": "マウンテンデュー", "price": 100, "pos": "中段"},
            {"name": "デカビタC GABA", "price": 100, "pos": "中段"},
            {"name": "伊右衛門 焙じ茶", "price": 100, "pos": "下段"},
            {"name": "伊右衛門 緑茶", "price": 110, "pos": "上段/下段"},
            {"name": "果汁飲料 赤パッケージ", "price": 110, "pos": "下段"},
            {"name": "リプトン 白の贅沢ミルクティー", "price": 110, "pos": "下段"},
            {"name": "プレミアムボス", "price": 130, "pos": "下段"},
            {"name": "amino VITAL", "price": 140, "pos": "上段"},
            {"name": "PREMIUM GREEN DA・KA・RA マスカット", "price": 150, "pos": "中段"},
            {"name": "レッドブル", "price": 170, "pos": "中段"},
        ]
    },
    {
        "id": "bldg3_1f_suntory_white_water",
        "building": "3号館",
        "floor": "1階",
        "brand": "サントリー（白・水メイン）",
        "app": "ジハンピ",
        "location": "3号館 1階（食堂側・サントリー白・水メイン）",
        "payment": "PayPay〇、交通系IC（モバイル）〇、※物理カード直タッチ×、現金〇",
        "items": [
            {"name": "サントリー天然水", "price": 80},
            {"name": "GREEN DA・KA・RA やさしい麦茶 600ml", "price": 90},
            {"name": "ぷるぷるプリン缶", "price": 100},
            {"name": "伊右衛門 特茶/焙じ茶", "price": 100, "price_max": 110, "price_display": "100〜110円"},
            {"name": "リプトン 白の贅沢ミルクティー", "price": 110},
            {"name": "BOSS各種（ブラック・アイスコーヒー・クラフトボス等）", "price": 90, "price_max": 140, "price_display": "90〜140円"},
        ]
    },
    {
        "id": "bldg3_1f_suntory_white_sports",
        "building": "3号館",
        "floor": "1階",
        "brand": "サントリー（白・スポーツ/エナジー系）",
        "app": "ジハンピ",
        "location": "3号館 1階（食堂側・サントリー白・スポーツ/エナジー系）",
        "payment": "PayPay〇、交通系IC（モバイル）〇、※物理カード直タッチ×、現金〇",
        "items": [
            {"name": "レモン強炭酸水", "price": 90},
            {"name": "やさしい麦茶", "price": 90},
            {"name": "レモンスカッシュ", "price": 100},
            {"name": "アイスティー", "price": 100},
            {"name": "プリン缶/MATCH", "price": 100},
            {"name": "デカビタC", "price": 100},
            {"name": "ダカラ (DAKARA)", "price": 110},
            {"name": "ポカリスエット/ポカリウォーター", "price": 110, "price_max": 130, "price_display": "110〜130円"},
            {"name": "MATCH", "price": 120},
            {"name": "ライムソルト", "price": 120},
            {"name": "T&S果汁系", "price": 130},
            {"name": "レッドブル", "price": 170},
            {"name": "モンスターエナジー各種", "price": 180, "price_max": 190, "price_display": "180〜190円"},
        ]
    },
    {
        "id": "bldg3_1f_suntory_blue",
        "building": "3号館",
        "floor": "1階",
        "brand": "サントリー（青）",
        "app": "ジハンピ",
        "location": "3号館 1階（食堂側・サントリー青）",
        "payment": "PayPay〇、交通系IC（モバイル）〇、※物理カード直タッチ×、現金〇",
        "items": [
            {"name": "ZONe NOPE", "price": 80},
            {"name": "BOSS いちごミルク/贅沢微糖", "price": 90, "price_max": 100, "price_display": "90〜100円"},
            {"name": "缶コーヒー微糖/プレミアムボス", "price": 100},
            {"name": "デカビタC GABA", "price": 100},
            {"name": "ペプシコーラ生", "price": 100},
            {"name": "マウンテンデュー", "price": 100},
            {"name": "塩分補給ドリンク", "price": 120},
            {"name": "京都レモネード", "price": 140},
            {"name": "果汁系ドリンク", "price": 140},
            {"name": "レッドブル", "price": 170},
        ]
    },
    {
        "id": "bldg3_1f_coca_cola_red",
        "building": "3号館",
        "floor": "1階",
        "brand": "コカ・コーラ（赤）",
        "app": "Coke ON（Coke ON Pay）",
        "location": "3号館 1階（食堂側・コカ・コーラ赤自販機）",
        "payment": "クレジットカードタッチ決済（Visa/Mastercard等）〇、PayPay〇、交通系IC（モバイル）〇、※物理カード直タッチ×、現金〇",
        "items": [
            {"name": "ジョージア各種", "price": 90, "price_max": 110, "price_display": "90〜110円"},
            {"name": "い・ろ・は・す", "price": 100, "price_max": 110, "price_display": "100〜110円"},
            {"name": "リアルゴールド", "price": 110, "price_max": 120, "price_display": "110〜120円"},
            {"name": "綾鷹", "price": 110},
            {"name": "やかんの麦茶", "price": 110},
            {"name": "アロエ＆白ぶどう", "price": 110},
            {"name": "紅茶花伝 ミルクティー", "price": 110},
            {"name": "ファンタ グレープ/ドクターペッパー", "price": 120},
            {"name": "アクエリアス", "price": 130},
            {"name": "コカ・コーラ", "price": 140},
        ]
    }
]

VENDING_MACHINES = VENDING_MACHINES_DB

class ChatRequest(BaseModel):
    query: str
    history: Optional[List[Dict[str, str]]] = []

def answer_navigator_query(q: str) -> str:
    query = q.strip()
    q_lower = query.lower()

    # 1. 価格帯検索判定（「80円」「100~110円」「100円以下」など）を最優先判定
    range_match = re.search(r"(\d{2,3})\s*[-~〜]\s*(\d{2,3})\s*円?", query)
    exact_match = re.search(r"(\d{2,3})\s*円", query)
    under_match = re.search(r"(\d{2,3})\s*円?\s*(以下|未満)", query)
    
    min_p, max_p = None, None
    if range_match:
        min_p = int(range_match.group(1))
        max_p = int(range_match.group(2))
    elif under_match:
        min_p = 0
        max_p = int(under_match.group(1))
    elif exact_match:
        val = int(exact_match.group(1))
        min_p, max_p = val, val
    elif any(k in query for k in ["安い", "最安", "格安"]):
        min_p, max_p = 0, 100
    elif query.isdigit() and int(query) in [80, 90, 100, 110, 120, 130, 140, 150, 170, 180, 190]:
        val = int(query)
        min_p, max_p = val, val

    if min_p is not None and max_p is not None:
        results_by_vm: Dict[str, List[Dict[str, Any]]] = {}
        for vm in VENDING_MACHINES_DB:
            for it in vm["items"]:
                it_min = it["price"]
                it_max = it.get("price_max", it_min)
                if not (it_max < min_p or it_min > max_p):
                    vm_title = f"{vm['building']} {vm['floor']}（{vm['brand']}）"
                    if vm_title not in results_by_vm:
                        results_by_vm[vm_title] = []
                    results_by_vm[vm_title].append(it)

        title = f"【{min_p}〜{max_p}円で買える商品】" if min_p != max_p else f"【{min_p}円で買える商品】"
        if not results_by_vm:
            return f"{title}\n該当する商品は見つかりませんでした。"

        lines = [title]
        for vm_title, items in results_by_vm.items():
            lines.append(f"\n■ {vm_title}:")
            for it in items:
                p_str = it.get("price_display", f"{it['price']}円")
                pos_info = f" ({it['pos']})" if "pos" in it else ""
                lines.append(f"・{it['name']} ({p_str}){pos_info}")
        return "\n".join(lines).strip()

    # 2. 給水所・ゴミ箱・トイレ・決済等の設備検索
    if any(k in q_lower for k in ["給水", "冷水機", "ウォーターサーバー"]):
        return (
            "【構内 給水所（冷水機）のご案内】\n"
            "・**4号館 1階 エントランスホールのみ使用可能**！マイボトルへの給水が可能です。\n"
            "⚠️ 注意: 4号館の2階・3階・4階の給水所は現在使用不可となっています。1階をご利用ください。"
        )

    if any(k in q_lower for k in ["ゴミ箱", "ごみ箱", "ゴミ", "ごみ"]):
        return (
            "【ゴミ箱の設置場所】\n"
            "・**1号館**：各階に設置\n"
            "・**3号館**：各階に設置\n"
            "・**4号館**：各階トイレ前に設置\n"
            "⚠️ 注意: **2号館内にはゴミ箱および自動販売機は設置されていません**。他号館をご利用ください。"
        )

    if any(k in q_lower for k in ["トイレ", "お手洗い", "化粧室", "便所"]):
        return (
            "【トイレ位置関係ガイド】\n"
            "■ **1号館**:\n"
            "・1階: 正面入って左手前＝女子トイレ、左奥＝男子トイレ、右手前奥＝男子トイレ\n"
            "・2階: 左奥＝女子トイレ、右手前＝男子トイレ、右奥＝女子トイレ\n"
            "・3階: 左奥＝男子トイレ、右奥＝女子トイレ\n"
            "⚠️ **4階・5階にはトイレがありません**（2階または3階をご利用ください）\n\n"
            "■ **3号館（全階共通）**:\n"
            "・下2桁 `01〜05`: **男子トイレ側**（エスカレーター出て右 / エレベーター出て左）\n"
            "・下2桁 `06〜10`: **女子トイレ側**（エスカレーター出て左 / エレベーター出て右）\n\n"
            "■ **4号館**:\n"
            "・1階: 左側＝男子トイレ、右側＝女子トイレ\n"
            "・2階: 左側＝男子トイレ、右側＝女子トイレ\n"
            "・3階: 右側＝男子トイレ、左側＝女子トイレ\n"
            "・4階: 右側（手前442/奥441）＝男子側、左側（手前443/奥444）＝女子側\n"
            "※4号館は各階トイレ前にゴミ箱が設置されています。"
        )

    if any(k in q_lower for k in ["クレカ", "クレジットカード", "タッチ決済", "コンタクトレス", "カード"]):
        return (
            "【クレジットカード（タッチ決済）が使える自販機】\n"
            "・**場所**: 3号館 1階（食堂側・コカ・コーラ赤自販機）\n"
            "・**決済アプリ**: Coke ON（Coke ON Pay）\n"
            "・**対応カード**: Visa、Mastercard 等のクレジットカードタッチ決済に対応しています！\n"
            "※サントリー自販機は物理カード直タッチ不可ですが、ジハンピ連携のPayPay等で決済可能です。"
        )

    if any(k in q_lower for k in ["paypay", "ペイペイ", "交通系ic", "suica", "pasmo", "ジハンピ", "coke on", "決済", "支払い"]):
        return (
            "【自動販売機の決済方法・対応アプリ一覧】\n"
            "■ **4号館 1階 サントリー自販機**:\n"
            "・アプリ: ジハンピ\n"
            "・決済: PayPay〇、交通系IC（モバイル）〇、※物理カード直タッチ×（現金〇）\n\n"
            "■ **3号館 1階 サントリー自販機（計3台: 白水メイン、白スポーツ/エナジー、青）**:\n"
            "・アプリ: ジハンピ\n"
            "・決済: PayPay〇、交通系IC（モバイル）〇、※物理カード直タッチ×（現金〇）\n\n"
            "■ **3号館 1階 コカ・コーラ赤自販機**:\n"
            "・アプリ: Coke ON（Coke ON Pay）\n"
            "・決済: クレジットカードタッチ決済（Visa/Mastercard）〇、PayPay〇、交通系IC（モバイル）〇、※物理交通系IC直タッチ×（現金〇）"
        )

    # 3. 教室番号直接入力判定（「421」「3505」「124」等の直打ち・質問）
    m_room = re.search(r"([1-4]\d{2,3}[a-zA-Z]?)", query)
    if m_room:
        r = m_room.group(1).upper()
        short_label = get_room_short_label(r)
        
        # 4号館
        if r == "411":
            detail = "4号館411教室は 4号館 1階 です。正面を入って左側（男子トイレ側）にあります。給水所（冷水機）が利用可能です。トイレ前にゴミ箱が設置されています。"
        elif r == "412":
            detail = "4号館412教室は 4号館 1階 です。正面を入って右側（女子トイレ側）にあります。給水所（冷水機）が利用可能です。トイレ前にゴミ箱が設置されています。"
        elif r == "421":
            detail = "4号館421教室は 4号館 2階 です。階段を登って左側（男子トイレ側）にあります。トイレ前にゴミ箱が設置されています。（※給水所は1階のみ使用可）"
        elif r == "422":
            detail = "4号館422教室は 4号館 2階 です。階段を登って右側（女子トイレ側）にあります。トイレ前にゴミ箱が設置されています。（※給水所は1階のみ使用可）"
        elif r == "431":
            detail = "4号館431教室は 4号館 3階 です。階段を登って右側（男子トイレ側）にあります。トイレ前にゴミ箱が設置されています。（※給水所は1階のみ使用可）"
        elif r == "432":
            detail = "4号館432教室は 4号館 3階 です。階段を登って左側（女子トイレ側）にあります。トイレ前にゴミ箱が設置されています。（※給水所は1階のみ使用可）"
        elif r == "441":
            detail = "4号館441教室は 4号館 4階 です。階段を登って右側奥（男子トイレ側・奥）にあります。手前が442教室です。トイレ前にゴミ箱が設置されています。（※給水所は1階のみ使用可）"
        elif r == "442":
            detail = "4号館442教室は 4号館 4階 です。階段を登って右側手前（男子トイレ側・手前）にあります。奥が441教室です。トイレ前にゴミ箱が設置されています。（※給水所は1階のみ使用可）"
        elif r == "443":
            detail = "4号館443教室は 4号館 4階 です。階段を登って左側手前（女子トイレ側・手前）にあります。奥が444教室です。トイレ前にゴミ箱が設置されています。（※給水所は1階のみ使用可）"
        elif r == "444":
            detail = "4号館444教室は 4号館 4階 です。階段を登って左側奥（女子トイレ側・奥）にあります。手前が443教室です。トイレ前にゴミ箱が設置されています。（※給水所は1階のみ使用可）"
        elif r.startswith("3") and len(r) == 4:
            fl = r[1]
            sub = int(r[2:])
            sub_str = r[1:]
            if 1 <= sub <= 5:
                detail = f"3号館{sub_str}教室は 3号館 {fl}階 です。エスカレーターを出て右側（エレベーターを出て左側）の 男子トイレ側 にあります。ゴミ箱は各階に設置されています。"
            elif 6 <= sub <= 10:
                detail = f"3号館{sub_str}教室は 3号館 {fl}階 です。エスカレーターを出て左側（エレベーターを出て右側）の 女子トイレ側 にあります。ゴミ箱は各階に設置されています。"
            else:
                detail = f"3号館{sub_str}教室は 3号館 {fl}階 です。ゴミ箱は各階に設置されています。"
        elif r in ["122", "123", "124"]:
            detail = f"1号館{r}教室は 1号館 2階 です。階段を登って左側（奥に女子トイレ）にあります。ゴミ箱は各階に設置されています。"
        elif r in ["125", "126", "127A", "127B"]:
            detail = f"1号館{r}教室は 1号館 2階 です。階段を登って右側（手前に男子トイレ、奥に女子トイレ）にあります。ゴミ箱は各階に設置されています。"
        elif r == "130":
            detail = "1号館130教室は 1号館 3階 です。階段を登って正面にあります（左奥に男子トイレ、右奥に女子トイレ）。ゴミ箱は各階に設置されています。"
        elif r in ["131", "132", "133", "134", "138"]:
            detail = f"1号館{r}教室は 1号館 3階 です。階段を登って左側（奥に男子トイレ）にあります。ゴミ箱は各階に設置されています。"
        elif r in ["135", "136", "137A", "137B", "139"]:
            detail = f"1号館{r}教室は 1号館 3階 です。階段を登って右側（奥に女子トイレ）にあります。ゴミ箱は各階に設置されています。"
        elif r == "141":
            detail = "1号館141教室は 1号館 4階 です。階段を登って正面にあります。※注意：1号館の4階・5階にはトイレがありませんので、2階または3階のトイレをご利用ください。ゴミ箱は各階に設置されています。"
        elif r == "151":
            detail = "1号館151教室は 1号館 5階 です。階段を登って正面にあります。※注意：1号館の4階・5階にはトイレがありませんので、2階または3階のトイレをご利用ください。ゴミ箱は各階に設置されています。"
        elif r.startswith("2") and len(r) == 4:
            detail = f"2号館{r}教室は 2号館 {r[1]}階 です。※注意：2号館内には自動販売機およびゴミ箱は設置されていませんので他号館をご利用ください。"
        else:
            detail = f"{r}教室はキャンパス構内にあります。詳細は各号館のフロア案内板をご確認ください。"

        return f"表示用：{short_label}\n詳細案内：{detail}"

    # 4. 商品名・ドリンク検索（「コーラ」「レッドブル」「天然水」など）
    if any(k in q_lower for k in ["コーラ", "ペプシ", "coca", "pepsi"]):
        return (
            "【コカ・コーラ（140円）】\n"
            "場所：3号館 1階（食堂側・コカ・コーラ赤自販機）\n"
            "決済：Coke ON（PayPay、交通系IC）、クレジットカードタッチ決済\n\n"
            "【ペプシコーラ生（100円）】\n"
            "場所：3号館 1階（食堂側・サントリー青自販機）\n"
            "決済：ジハンピ（PayPay、交通系IC）"
        )

    if any(k in q_lower for k in ["レッドブル", "red bull", "redbull"]):
        return (
            "【レッドブル（170円）】※学内格安！\n"
            "・4号館 1階（サントリー自販機 中段）/ アプリ：ジハンピ\n"
            "・3号館 1階（食堂側・白スポーツ/エナジー系自販機）/ アプリ：ジハンピ\n"
            "・3号館 1階（食堂側・青自販機）/ アプリ：ジハンピ\n"
            "決済：PayPay〇、交通系IC（モバイル）〇、※物理カード直タッチ×、現金〇"
        )

    if any(k in q_lower for k in ["天然水", "いろはす", "い・ろ・は・す", "ミネラルウォーター"]) or (q_lower == "水" or "お水" in q_lower):
        return (
            "【サントリー天然水（80円）】※学内最安値！\n"
            "場所：\n"
            "・4号館 1階（サントリー自販機 上段）\n"
            "・3号館 1階（食堂側・サントリー白・水メイン自販機）\n"
            "決済：アプリ「ジハンピ」連携（PayPay、モバイル交通系IC、現金）\n\n"
            "【い・ろ・は・す（100〜110円）】\n"
            "場所：3号館 1階（食堂側・コカ・コーラ赤自販機）\n"
            "決済：Coke ON（PayPay、モバイル交通系IC）、クレジットカードタッチ決済"
        )

    if any(k in q_lower for k in ["モンスター", "monster", "zone", "ゾーン", "エナジー"]):
        return (
            "【エナジードリンク一覧】\n"
            "■ ZONe スカッと透明 / NOPE（80円）：※激安エナジー！\n"
            "  ・4号館 1階（スカッと透明 / ジハンピ）\n"
            "  ・3号館 1階 青自販機（NOPE / ジハンピ）\n"
            "■ レッドブル（170円）：※コンビニよりお得！\n"
            "  ・4号館 1階、3号館 1階（白スポーツ、青自販機）\n"
            "■ モンスターエナジー各種（180〜190円）：\n"
            "  ・3号館 1階 食堂側（白・スポーツ/エナジー系自販機）"
        )

    if any(k in q_lower for k in ["麦茶", "緑茶", "お茶", "伊右衛門", "綾鷹", "ほうじ茶", "焙じ茶"]):
        return (
            "【お茶・麦茶ラインナップ】\n"
            "■ やさしい麦茶（90円）：4号館1階（上段）、3号館1階（白水・白スポーツ）\n"
            "■ サントリー緑茶 伊右衛門（100〜110円）：4号館1階、3号館1階（白水）\n"
            "■ 綾鷹 / やかんの麦茶（110円）：3号館1階（コカ・コーラ赤自販機・クレカ決済可）\n"
            "■ 伊右衛門 焙じ茶（100円）：4号館1階、3号館1階"
        )

    if any(k in q_lower for k in ["コーヒー", "珈琲", "ボス", "boss", "ジョージア", "カフェオレ"]):
        return (
            "【コーヒー・カフェ飲料】\n"
            "■ BOSS各種（90〜140円）：3号館1階（白水、青自販機）、4号館1階（プレミアムボス130円）\n"
            "■ ジョージア各種（90〜110円）：3号館1階（コカ・コーラ赤自販機）\n"
            "■ リプトン 白の贅沢ミルクティー（110円）：4号館1階、3号館1階（白水）\n"
            "■ 紅茶花伝 ミルクティー（110円）：3号館1階（赤自販機）"
        )

    if any(k in q_lower for k in ["プリン", "プリン缶"]):
        return (
            "【ぷるぷるプリン缶（100円）】\n"
            "場所：3号館 1階 食堂側（サントリー白・水メイン、白・スポーツ系）\n"
            "決済：アプリ「ジハンピ」連携（PayPay、モバイル交通系IC、現金）"
        )

    # 5. 講義検索（科目名・教員名）
    if CHS_LECTURE_DATABASE and len(query) >= 2:
        user_day = None
        user_period = None
        for d in ["月", "火", "水", "木", "金", "土"]:
            if f"{d}曜" in query or d in query:
                user_day = d
                break
        for p in range(1, 6):
            if f"{p}限" in query or f"{p}コマ" in query:
                user_period = p
                break

        clean_q = re.sub(r"(月|火|水|木|金|土)曜?(日)?", "", query)
        clean_q = re.sub(r"[1-5]限(目|コマ)?", "", clean_q)
        clean_q = re.sub(r"(教室|どこ|何限|いつ|教えて|誰|先生|講義|授業)", "", clean_q)
        clean_q = re.sub(r"^[の\s]+|[の\s]+$", "", clean_q).strip()

        if len(clean_q) >= 2:
            matches = [
                c for c in CHS_LECTURE_DATABASE
                if clean_q.lower() in c.get("name", "").lower() or clean_q.lower() in c.get("teacher", "").lower()
            ]

            if matches:
                suggestion = ""
                if user_day or user_period:
                    exact = [
                        c for c in matches
                        if (not user_day or c["day"] == user_day) and (not user_period or c["period"] == user_period)
                    ]
                    if not exact:
                        best = matches[0]
                        suggestion = f"⚠️ もしかして {best['day']}曜{best['period']}限 の『{best['name']}』（担当：{best['teacher']} 先生）ですか？\n\n"

                lines = []
                if suggestion:
                    lines.append(suggestion)
                lines.append(f"【講義検索結果: {clean_q}】")
                for c in matches[:6]:
                    room_lbl = get_room_short_label(c.get("room", ""))
                    lines.append(f"・{c['name']}（{c['teacher']}）| {c['day']}曜{c['period']}限 | {room_lbl}")
                return "\n".join(lines).strip()

    # 6. 定型案内
    return (
        "【キャンパス構内ナビゲーターAI】\n"
        "教室番号（3505、421、124等）、自販機商品（コーラ、レッドブル、天然水等）、価格帯（80円、100~110円等）、設備（給水所、ゴミ箱、トイレ、クレカ決済）について直接入力すると即座にご案内します。\n\n"
        "質問例:\n"
        "• 「3505」または「421」\n"
        "• 「コーラ」または「レッドブル」\n"
        "• 「80円」または「100~110円」\n"
        "• 「給水所」または「ゴミ箱」\n"
        "• 「クレカ」または「PayPay」"
    )

@app.post("/api/navigator/chat")
def navigator_chat(req: ChatRequest):
    reply = answer_navigator_query(req.query)
    return {"reply": reply}