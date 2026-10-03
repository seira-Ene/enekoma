import datetime
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import re

app = FastAPI(
    title="EneKoma Campus Navigator API",
    version="2.0.0",
    description="日本大学文理学部向け時間割・履修卒業判定・施設案内・スケジュール・フレンド共有API"
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
    return {"message": "EneKoma Campus Navigator API v2.0 is running", "university": "Nihon University CHS"}

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

MINOR_COURSES = {
    "AI・データサイエンス副専攻": {"required_credits": 16, "key_courses": ["データ処理基礎", "ビッグデータサイエンス", "人工知能概論", "データサイエンス演習"]},
    "グローバル主専攻・副専攻": {"required_credits": 16, "key_courses": ["国際教養A", "Cross-Cultural Communication", "異文化理解演習"]},
    "環境・サステナビリティ副専攻": {"required_credits": 16, "key_courses": ["環境科学概論", "地球環境学", "サステナビリティ論"]},
    "心身ウェルネス副専攻": {"required_credits": 16, "key_courses": ["健康・スポーツ教育論", "ストレスマネジメント", "メンタルヘルス論"]},
    "教職コース（中高免許）": {"required_credits": 32, "key_courses": ["教育原理", "教育心理学", "各教科教育法Ⅰ・Ⅱ", "教育実習事前事後指導"]},
    "司書教諭コース": {"required_credits": 10, "key_courses": ["学校図書館メディアの構成", "読書課程論", "学習指導と学校図書館"]},
    "学芸員コース": {"required_credits": 19, "key_courses": ["博物館概論", "博物館経営論", "博物館資料保存論", "博物館実習"]},
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
    
    minor_info = MINOR_COURSES.get(req.selected_minor or "", {"required_credits": 16, "key_courses": []})
    minor_taken = [c for c in req.taken_courses if c in minor_info.get("key_courses", [])]
    minor_earned = len(minor_taken) * 2
    minor_rem = max(0, minor_info["required_credits"] - minor_earned)
    
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
        
    if req.selected_minor and req.selected_minor in MINOR_COURSES:
        recom_courses = [c for c in minor_info.get("key_courses", []) if c not in minor_taken]
        advice.append(f"🎓 [{req.selected_minor}] 進捗: {minor_earned}/{minor_info['required_credits']}単位完了。未履修のおすすめ科目: {', '.join(recom_courses) or '要件充足中'}")

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
            "required_credits": minor_info["required_credits"],
            "remaining_credits": minor_rem,
            "recommended_courses": [c for c in minor_info.get("key_courses", []) if c not in minor_taken]
        },
        "missing_requirements": missing_items,
        "ai_advice": "\n".join(advice)
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
        "note": "証明書自動発行機利用は閉口15分前まで",
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
    days = ["mon", "tue", "wed", "thu", "fri"]
    periods = [1, 2, 3, 4, 5]
    day_names = {"mon": "月曜", "tue": "火曜", "wed": "水曜", "thu": "木曜", "fri": "金曜"}
    
    for d in days:
        for p in periods:
            slot_key = f"{d}_{p}"
            my_slot = req.my_timetable.get(slot_key, "")
            friend_slot = friend_data["timetable"].get(slot_key, "")
            
            if not my_slot and not friend_slot:
                common_free_slots.append({
                    "key": slot_key,
                    "day": day_names[d],
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

    return "詳細場所未登録"

@app.post("/api/timetable/parse")
@app.post("/timetable/parse")
def parse_timetable(item: TimetableItem):
    location_detail = parse_room_detail(item.room_number)
    return {
        "subject": item.subject,
        "room_number": item.room_number,
        "location_detail": location_detail,
        "full_display": f"{item.subject} （{item.room_number}：{location_detail}）"
    }
