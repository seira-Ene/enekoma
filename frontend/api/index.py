from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import re

app = FastAPI(title="EneKoma API & Campus Navigator")

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

class NavigatorQuery(BaseModel):
    query: str

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

    if any(k in q for k in ["クレジット", "クレカ", "タッチ決済", "コンタクトレス", "visa", "master"]):
        return (
            "💳 【クレジットカードタッチ決済が使える自販機】\n"
            "・設置場所: **3号館 1階 食堂側**\n"
            "・対象自販機: **コカ・コーラ（赤）**\n"
            "・対応ブランド: Visa / Mastercard コンタクトレス決済対応\n"
            "※他のサントリー自販機ではクレカ直接タッチは利用できません。"
        )

    if "paypay" in q_lower or "ペイペイ" in q:
        return (
            "📱 【PayPayが使える自販機】\n"
            "学内のすべての自販機でPayPayが利用可能です！\n\n"
            "1. **3号館 1階 食堂側 コカ・コーラ自販機（赤）**\n"
            "   → 『Coke ON Pay』アプリ連携でPayPay決済可能\n"
            "2. **3号館 1階 食堂側 サントリー自販機（計3台）＆ 4号館 1階 自販機**\n"
            "   → サントリー『ジハンピ』アプリ連携でPayPay決済可能"
        )

    if any(k in q for k in ["交通系", "suica", "pasmo", "icカード"]):
        return (
            "🚃 【交通系IC（Suica/PASMO等）が使える自販機】\n"
            "⚠️ 注意: 学内自販機は**物理カードの直接タッチには非対応**です。各社アプリ経由で決済できます。\n\n"
            "・**3号館 1階 コカ・コーラ（赤）**: 『Coke ON Pay』連携で利用可能\n"
            "・**3号館・4号館 サントリー各台**: 『ジハンピ』アプリ連携で利用可能"
        )

    if "100円以下" in q or "100円で買える" in q or "安い" in q:
        return (
            "🪙 【100円以下で購入できるお得な商品】\n\n"
            "【80円（最安値！）】\n"
            "・サントリー天然水 (4号館1F / 3号館1F水メイン)\n"
            "・ZONe スカッと透明 (4号館1F)\n"
            "・ZONe NOPE (3号館1F青)\n\n"
            "【90円】\n"
            "・やさしい麦茶 (4号館1F / 3号館1F各台)\n"
            "・レモン強炭酸水 (3号館1Fスポーツ系)\n\n"
            "【100円】\n"
            "・マウンテンデュー / デカビタC GABA / ペプシコーラ生\n"
            "・伊右衛門緑茶・焙じ茶 / プリン缶 / レモンスカッシュ / アイスティー\n"
            "・ジョージア缶コーヒー各種 / BOSS缶コーヒー各種"
        )

    drink_keywords = [
        {"kw": "レッドブル", "name": "レッドブル", "price": "170", "loc": "4号館1F, 3号館1F(スポーツ系/青)"},
        {"kw": "モンスター", "name": "モンスターエナジー各種", "price": "180〜190", "loc": "3号館1F 食堂側（スポーツ系）"},
        {"kw": "zone", "name": "ZONe(スカッと透明/NOPE)", "price": "80", "loc": "4号館1F(スカッと透明) / 3号館1F(青/NOPE)"},
        {"kw": "天然水", "name": "サントリー天然水", "price": "80", "loc": "4号館1F / 3号館1F(水メイン)"},
        {"kw": "いろはす", "name": "い・ろ・は・す", "price": "100〜110", "loc": "3号館1F 食堂側（コカ・コーラ赤）"},
        {"kw": "麦茶", "name": "やさしい麦茶 / やかんの麦茶", "price": "90〜110", "loc": "4号館1F(90円), 3号館1F各台"},
        {"kw": "緑茶", "name": "伊右衛門 / 綾鷹", "price": "100〜110", "loc": "4号館1F, 3号館1F各台"},
        {"kw": "コーラ", "name": "コカ・コーラ(140円) / ペプシ生(100円)", "price": "100〜140", "loc": "3号館1F 食堂側"},
        {"kw": "ミルクティー", "name": "リプトン白の贅沢 / 紅茶花伝", "price": 110, "loc": "4号館1F, 3号館1F各台"},
        {"kw": "コーヒー", "name": "BOSS各種 / ジョージア各種", "price": "90〜140", "loc": "4号館1F, 3号館1F各台"},
        {"kw": "プリン", "name": "ぷるぷるプリン缶", "price": 100, "loc": "3号館1F 食堂側（水メイン／スポーツ系）"},
    ]

    for item in drink_keywords:
        if item["kw"] in q_lower:
            return (
                f"🥤 【「{item['name']}」の自販機情報】\n"
                f"・価格目安: **{item['price']}円**\n"
                f"・購入できる場所: **{item['loc']}**\n"
                f"・決済方法: 現金、PayPay(ジハンピ/Coke ON連携)、交通系IC(アプリ連携)、3号館赤ならクレカタッチもOK！"
            )

    return (
        "🎓 【キャンパス構内ナビゲーターAI】\n"
        "校舎ナレッジベースに基づき、以下の内容をご案内できます：\n\n"
        "1. **教室案内**: 「3505はどこ？」「411教室」「124の場所」など\n"
        "2. **自販機案内**: 「レッドブルはどこ？」「100円以下の飲み物」「PayPay/クレカが使える自販機」\n"
        "3. **設備案内**: 「水飲み場・給水所」「ゴミ箱の場所」「3号館のトイレ」\n\n"
        "質問したい内容をお気軽に入力してください！"
    )

@app.get("/")
@app.get("/api")
def read_root():
    return {"message": "EneKoma FastAPI Backend & Navigator is running"}

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

@app.post("/api/navigator/chat")
@app.post("/navigator/chat")
def navigator_chat(data: NavigatorQuery):
    reply = answer_navigator_query(data.query)
    return {
        "query": data.query,
        "reply": reply
    }
