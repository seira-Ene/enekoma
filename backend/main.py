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
        elif sub_num == 0:
            return f"3号館{floor}階・大教室（フロア中央エリア）"
        else:
            return f"3号館{floor}階（3{floor}{sub_num:02d}教室）"

    m2 = re.match(r"^2([1-5])(\d{2})$", r)
    if m2:
        floor = m2.group(1)
        return f"2号館{floor}階（2号館は自動販売機・ゴミ箱未設置）"

    m1 = re.match(r"^1(\d)(\d)$", r)
    if m1:
        floor = m1.group(1)
        return f"1号館{floor}階"

    return f"{room}教室（キャンパス構内）"

@app.post("/api/timetable/parse")
def parse_timetable_room(item: TimetableItem):
    detail = parse_room_detail(item.room_number)
    return {
        "subject": item.subject,
        "room_number": item.room_number,
        "room_detail": detail
    }

# ==========================================
# 8. 自販機・構内ナビゲーターチャット（100%保持）
# ==========================================
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
        "id": "1f_bread",
        "building": "1号館",
        "floor": "1階",
        "type": "パン・軽食",
        "location": "飲み物自販機の並び",
        "payment": ["現金", "交通系IC"],
        "items": [
            {"name": "あんパン", "price": 130},
            {"name": "クリームパン", "price": 130},
            {"name": "メロンパン", "price": 140},
            {"name": "チョコデニッシュ", "price": 150},
            {"name": "カレーパン", "price": 150},
            {"name": "焼きそばパン", "price": 160}
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
        "id": "3f_ice",
        "building": "3号館",
        "floor": "1階",
        "type": "アイス",
        "location": "飲み物自販機横（セブンティーンアイス）",
        "payment": ["現金", "交通系IC"],
        "items": [
            {"name": "チョコチップ", "price": 160},
            {"name": "クッキー＆クリーム", "price": 170},
            {"name": "ワッフルコーンバニラ", "price": 170},
            {"name": "ソーダフロート", "price": 150},
            {"name": "濃厚いちご", "price": 160}
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

class ChatRequest(BaseModel):
    query: str
    history: Optional[List[Dict[str, str]]] = []

def answer_navigator_query(q: str) -> str:
    query = q.lower()
    
    # 1. 教室番号検索
    m_room = re.search(r"(\d{3,4}[a-zA-Z]?)", query)
    if m_room:
        room = m_room.group(1).upper()
        detail = parse_room_detail(room)
        ans = f"【教室案内: {room}教室】\n{detail}\n\n"
        if room.startswith("1"):
            ans += "• トイレ: 1F/2F/3Fにあります（4F・5Fにはトイレがありませんのでご注意ください）。\n• 自販機・ゴミ箱: 1階に設置されています。"
        elif room.startswith("3"):
            ans += "• トイレ: 奇数番号(01-05)は男子トイレ側、偶数番号(06-10)は女子トイレ側です。\n• 自販機: 1階エレベーターホール横（電子マネー・クレカタッチ対応、アイス自販機あり）。"
        elif room.startswith("4"):
            ans += "• 給水所: 1階のみ冷水機が利用可能です（2F〜4Fは使用不可）。\n• 自販機・ゴミ箱: 1階に設置されています。"
        elif room.startswith("2"):
            ans += "• 注意: 2号館内には自動販売機およびゴミ箱は設置されていません。"
        return ans

    # 2. 自動販売機・商品・価格・決済
    if any(k in query for k in ["自販機", "自動販売機", "ジュース", "アイス", "パン", "レッドブル", "モンスター", "水", "お茶", "いくら", "円", "決済", "クレカ", "suica", "paypay"]):
        found_items = []
        for vm in VENDING_MACHINES:
            for it in vm["items"]:
                if any(w in it["name"].lower() for w in ["コーラ", "レッドブル", "モンスター", "お茶", "水", "コーヒー", "アイス", "パン", "ラテ"]) and (w in query for w in ["コーラ", "レッドブル", "モンスター", "お茶", "水", "コーヒー", "アイス", "パン", "ラテ"]):
                    found_items.append((vm, it))
                elif query in it["name"].lower() or it["name"].lower() in query:
                    found_items.append((vm, it))
        
        if found_items:
            res = "【自動販売機 商品・価格案内】\n"
            for vm, it in found_items[:5]:
                res += f"• **{it['name']}**: {it['price']}円\n  場所: {vm['building']} {vm['floor']}（{vm['location']}）\n  決済方法: {', '.join(vm['payment'])}\n\n"
            return res.strip()

        # 決済方法で探す
        if any(pay in query for pay in ["クレカ", "クレジットカード", "タッチ決済", "カード"]):
            return (
                "【クレジットカード利用可能な自販機】\n"
                "• **3号館 1階 エレベーターホール横** の自動販売機がクレジットカードのタッチ決済に対応しています。\n"
                "（他: 交通系IC、iD、QUICPay、PayPay、d払い、au PAY、楽天ペイなども利用可能）"
            )

        if "100円" in query or "安い" in query or "最安" in query:
            return (
                "【100円〜お得な商品案内】\n"
                "• **3号館 1階**: サントリー天然水 550ml (100円)\n"
                "• **4号館 1階**: エビアン 500ml (110円)、充実野菜 (110円)\n"
                "• **1号館 1階**: い・ろ・は・す 540ml (110円)"
            )

        res = "【キャンパス内 自販機設置情報】\n"
        for vm in VENDING_MACHINES:
            res += f"■ **{vm['building']} {vm['floor']}** ({vm['type']})\n"
            res += f"  場所: {vm['location']}\n"
            res += f"  決済: {', '.join(vm['payment'][:5])}など\n"
            res += f"  主な商品: {', '.join([i['name'] for i in vm['items'][:3]])}\n\n"
        res += "※2号館には自販機・ゴミ箱がありませんのでご注意ください。"
        return res.strip()

    # 3. 給水所
    if any(k in query for k in ["給水", "水飲み", "冷水機", "ウォーターサーバー"]):
        return (
            "【構内 給水所（冷水機）のご案内】\n"
            "• **4号館 1階 エントランスホール**: 給水所（冷水機）が設置されており、マイボトルへの給水が可能です！\n"
            "⚠️ 注意: 4号館の2階・3階・4階の給水所は現在使用不可となっています。1階をご利用ください。"
        )

    # 4. トイレ
    if any(k in query for k in ["トイレ", "お手洗い", "化粧室", "便所"]):
        return (
            "【トイレ位置関係ガイド】\n"
            "• **1号館**:\n"
            "  - 1階: 左手前に女子、左奥に男子、右手前奥に男子\n"
            "  - 2階: 左奥に女子、右手前に男子、右奥に女子\n"
            "  - 3階: 左奥に男子、右奥に女子\n"
            "  - ⚠️ **4階・5階にはトイレがありません**（2F/3Fをご利用ください）\n"
            "• **3号館**: 各階共通\n"
            "  - 奇数教室側(01〜05): 男子トイレ側（エスカレーター出て右 / EV出て左）\n"
            "  - 偶数教室側(06〜10): 女子トイレ側（エスカレーター出て左 / EV出て右）\n"
            "• **4号館**: 1階〜4階\n"
            "  - 1階: 正面入って左側が男子、右側が女子\n"
            "  - 2階〜4階: 左右に男子・女子が分かれて配置されています。"
        )

    # 5. ゴミ箱
    if any(k in query for k in ["ゴミ箱", "ごみ箱", "ゴミ", "廃棄"]):
        return (
            "【ゴミ箱の設置場所】\n"
            "• **1号館 1階**: 自販機横に設置\n"
            "• **3号館 1階**: エレベーターホール自販機コーナー横に分別ゴミ箱設置\n"
            "• **4号館 1階**: エントランスホール自販機横に設置\n"
            "⚠️ **2号館にはゴミ箱が設置されていません**。他号館のゴミ箱をご利用ください。"
        )

    # デフォルト応答
    return (
        "【キャンパス構内ナビゲーターAI】\n"
        "教室番号（例: 3402, 411, 124）、トイレ・給水所の場所、自販機の商品・価格・決済方法（クレカ・電子マネー）、ゴミ箱の位置についてお答えできます。\n"
        "質問例:\n"
        "• 「3305教室はどこ？」\n"
        "• 「レッドブルが買える自販機は？」\n"
        "• 「クレジットカードが使える自販機はある？」\n"
        "• 「100円で買える水はどこ？」\n"
        "• 「給水所はどこ？」\n"
        "• 「1号館のトイレの注意点は？」"
    )

@app.post("/api/navigator/chat")
def navigator_chat(req: ChatRequest):
    reply = answer_navigator_query(req.query)
    return {"reply": reply}