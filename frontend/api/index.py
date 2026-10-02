from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

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
    if len(room) == 4 and room.isdigit():
        building = room[0]
        floor = room[1]
        return f"{building}号館{floor}階・男子トイレ側"
    return "詳細場所未登録"

@app.get("/")
@app.get("/api")
def read_root():
    return {"message": "EneKoma FastAPI Backend is running"}

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

