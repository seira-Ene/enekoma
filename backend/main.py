from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

app = FastAPI(title="EneKoma Campus Navigator API")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://enekoma.vercel.app",
    ],
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TimetableItem(BaseModel):
    subject: str
    room_number: str


def parse_room_detail(room: str) -> str:
    """教室番号から正確な校舎・階・位置関係・トイレ位置を解析"""
    room_clean = room.strip().upper()
    if not room_clean:
        return "教室未入力"

    # 1号館 (3桁 1〇〇 または 1〇〇A/B)
    if room_clean.startswith("1") and len(room_clean) in [3, 4]:
        floor = room_clean[1]
        if floor == "1":
            return "1号館1階 (正面左手前:女子, 左奥:男子, 右手前奥:男子)"
        elif floor == "2":
            if room_clean in ["122", "123", "124"]:
                return "1号館2階・階段登って左側 (左奥に女子トイレ)"
            elif room_clean in ["125", "126", "127A", "127B"]:
                return "1号館2階・階段登って右側 (右手前に男子, 右奥に女子トイレ)"
            return "1号館2階"
        elif floor == "3":
            if room_clean == "130":
                return "1号館3階・階段登って正面"
            elif room_clean in ["131", "132", "133", "134", "138"]:
                return "1号館3階・階段登って左側 (左奥に男子トイレ)"
            elif room_clean in ["135", "136", "137A", "137B", "139"]:
                return "1号館3階・階段登って右側 (右奥に女子トイレ)"
            return "1号館3階"
        elif floor == "4":
            return "1号館4階・階段登って141 (※トイレなし)"
        elif floor == "5":
            return "1号館5階・階段登って151 (※トイレなし)"

    # 2号館 (4桁 2〇〇〇)
    if room_clean.startswith("2") and len(room_clean) == 4 and room_clean.isdigit():
        floor = room_clean[1]
        return f"2号館{floor}階"

    # 3号館 (4桁 3〇〇〇)
    if room_clean.startswith("3") and len(room_clean) == 4 and room_clean.isdigit():
        floor = room_clean[1]
        last_two = int(room_clean[2:])
        if 1 <= last_two <= 5:
            return f"3号館{floor}階・エスカレーター右 / エレベーター左 (男子トイレ側)"
        elif 6 <= last_two <= 10:
            return f"3号館{floor}階・エスカレーター左 / エレベーター右 (女子トイレ側)"
        return f"3号館{floor}階"

    # 4号館 (3桁 4〇〇)
    if room_clean.startswith("4") and len(room_clean) == 3 and room_clean.isdigit():
        floor = room_clean[1]
        num = room_clean
        if num == "411":
            return "4号館1階・正面入って左側 (男子トイレ側)"
        elif num == "412":
            return "4号館1階・正面入って右側 (女子トイレ側)"
        elif num == "421":
            return "4号館2階・階段登って左側 (男子トイレ側)"
        elif num == "422":
            return "4号館2階・階段登って右側 (女子トイレ側)"
        elif num == "431":
            return "4号館3階・階段登って右側 (男子トイレ側)"
        elif num == "432":
            return "4号館3階・階段登って左側 (女子トイレ側)"
        elif num == "441":
            return "4号館4階・階段登って右側奥 (男子トイレ側)"
        elif num == "442":
            return "4号館4階・階段登って右側手前 (男子トイレ側)"
        elif num == "443":
            return "4号館4階・階段登って左側手前 (女子トイレ側)"
        elif num == "444":
            return "4号館4階・階段登って左側奥 (女子トイレ側)"
        return f"4号館{floor}階"

    return "詳細場所未登録"


# --- 自販機データ ---
VENDING_MACHINES = [
    {
        "id": "vending-4f-1",
        "location": "4号館1階",
        "vendor": "サントリー (ジハンピ対応)",
        "payments": ["現金", "PayPay", "交通系IC"],
        "items": [
            {"name": "伊右衛門 緑茶", "price": 110},
            {"name": "やさしい麦茶", "price": 90},
            {"name": "amino VITAL", "price": 140},
            {"name": "サントリー天然水", "price": 80},
            {"name": "PREMIUM GREEN DA・KA・RA マスカット", "price": 150},
            {"name": "マウンテンデュー", "price": 100},
            {"name": "ZONe スカッと透明", "price": 80},
            {"name": "デカビタC GABA", "price": 100},
            {"name": "レッドブル", "price": 170},
            {"name": "果汁飲料（赤パッケージ）", "price": 110},
            {"name": "伊右衛門 焙じ茶", "price": 100},
            {"name": "リプトン 白の贅沢ミルクティー", "price": 110},
            {"name": "プレミアムボス", "price": 130},
        ]
    },
    {
        "id": "vending-3f-1",
        "location": "3号館1階 食堂側（白・水メイン）",
        "vendor": "サントリー (ジハンピ対応)",
        "payments": ["現金", "PayPay", "交通系IC"],
        "items": [
            {"name": "サントリー天然水", "price": 80},
            {"name": "GREEN DA・KA・RA やさしい麦茶 600ml", "price": 90},
            {"name": "ぷるぷるプリン缶", "price": 100},
            {"name": "リプトン 白の贅沢ミルクティー", "price": 110},
            {"name": "伊右衛門 特茶", "price": 110},
            {"name": "伊右衛門 焙じ茶", "price": 100},
            {"name": "BOSS（各種）", "price": 100},
        ]
    },
    {
        "id": "vending-3f-2",
        "location": "3号館1階 食堂側（白・スポーツ/エナジー系）",
        "vendor": "サントリー (ジハンピ対応)",
        "payments": ["現金", "PayPay", "交通系IC"],
        "items": [
            {"name": "レモンスカッシュ", "price": 100},
            {"name": "MATCH", "price": 120},
            {"name": "T&S果汁系", "price": 130},
            {"name": "ライムソルト", "price": 120},
            {"name": "レモン強炭酸水", "price": 90},
            {"name": "アイスティー", "price": 100},
            {"name": "やさしい麦茶", "price": 90},
            {"name": "ダカラ", "price": 110},
            {"name": "ポカリスエット", "price": 120},
            {"name": "デカビタC", "price": 100},
            {"name": "レッドブル", "price": 170},
            {"name": "モンスターエナジー各種", "price": 180},
        ]
    },
    {
        "id": "vending-3f-3",
        "location": "3号館1階 食堂側（青）",
        "vendor": "サントリー (ジハンピ対応)",
        "payments": ["現金", "PayPay", "交通系IC"],
        "items": [
            {"name": "京都レモネード", "price": 140},
            {"name": "果汁系ドリンク", "price": 140},
            {"name": "塩分補給ドリンク", "price": 120},
            {"name": "レッドブル", "price": 170},
            {"name": "缶コーヒー微糖 / プレミアムボス", "price": 100},
            {"name": "BOSS いちごミルク", "price": 100},
            {"name": "ZONe NOPE", "price": 80},
            {"name": "デカビタC GABA", "price": 100},
            {"name": "ペプシコーラ生", "price": 100},
            {"name": "マウンテンデュー", "price": 100},
        ]
    },
    {
        "id": "vending-3f-4",
        "location": "3号館1階 食堂側（赤）",
        "vendor": "コカ・コーラ (Coke ON対応)",
        "payments": ["現金", "PayPay", "交通系IC", "クレジットカード"],
        "items": [
            {"name": "コカ・コーラ", "price": 140},
            {"name": "ファンタ グレープ / ドクターペッパー", "price": 120},
            {"name": "アクエリアス", "price": 130},
            {"name": "リアルゴールド", "price": 110},
            {"name": "綾鷹", "price": 110},
            {"name": "やかんの麦茶", "price": 110},
            {"name": "い・ろ・は・す", "price": 100},
            {"name": "アロエ＆白ぶどう", "price": 110},
            {"name": "紅茶花伝 ミルクティー", "price": 110},
            {"name": "ジョージア各種", "price": 100},
        ]
    }
]


@app.get("/")
@app.get("/api")
def read_root():
    return {"message": "EneKoma Campus Navigator API is running"}


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


@app.get("/api/vending-machines/search")
def search_vending_machines(
    keyword: Optional[str] = None,
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    payment: Optional[str] = None
):
    """自販機の商品名、価格帯、決済方法による高度な検索"""
    results = []

    for vm in VENDING_MACHINES:
        # 決済方法フィルタ
        if payment and payment.strip():
            target_p = payment.strip().lower()
            match_payment = any(target_p in p.lower() for p in vm["payments"])
            if not match_payment:
                continue

        matched_items = []
        for item in vm["items"]:
            # キーワード検索
            if keyword and keyword.strip():
                if keyword.strip().lower() not in item["name"].lower():
                    continue

            # 価格帯検索
            if min_price is not None and item["price"] < min_price:
                continue
            if max_price is not None and item["price"] > max_price:
                continue

            matched_items.append(item)

        if matched_items:
            results.append({
                "location": vm["location"],
                "vendor": vm["vendor"],
                "payments": vm["payments"],
                "matched_items": matched_items
            })

    return {"results": results}


@app.get("/api/facilities")
def get_facilities(building: Optional[str] = None, floor: Optional[str] = None):
    """トイレ・ゴミ箱・給水所情報の案内"""
    info = {
        "trash_boxes": "全館・各階に設置（4号館は各階トイレ前に配置）",
        "water_fountains": "4号館1階のみ利用可能（※2-4階の給水所は使用不可）",
        "toilets": {
            "1号館": "1階（正面左手前:女子, 左奥:男子, 右手前奥:男子）、2階（左奥:女子, 右手前:男子, 右奥:女子）、3階（左奥:男子, 右奥:女子）、4・5階（設置なし）",
            "3号館": "各階（下2桁 01〜05側: 男子トイレ、06〜10側: 女子トイレ）",
            "4号館": "各階（奇数/偶数および左右配置に応じた男子・女子トイレあり）"
        }
    }
    return info