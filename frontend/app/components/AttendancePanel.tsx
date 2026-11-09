'use client';

// 出欠（位置情報による自動記録と、手での修正）。記録はこの端末の中だけに保存する
import { useState } from 'react';
import {
  ATTENDANCE_LABELS,
  attendanceCounts,
  campusDate,
  readAttendance,
  recordKey,
  saveAttendance,
  type AttendanceRecord,
  type AttendanceStatus
} from '@/app/data/attendance';

interface Props {
  accountId: string;
  courses: { day?: string; period?: number | string; name: string; room?: string }[];
  // 自動記録が増えたら数字が変わる（読み直しの合図）
  version: number;
  onChange: () => void;
}

const STATUS_ORDER: AttendanceStatus[] = ['present', 'late', 'absent', 'unconfirmed', 'cancelled'];
const STATUS_STYLE: Record<AttendanceStatus, string> = {
  present: 'text-emerald-700',
  late: 'text-amber-700',
  absent: 'text-rose-700',
  unconfirmed: 'text-slate-500',
  cancelled: 'text-slate-500'
};

export default function AttendancePanel({ accountId, courses, version, onChange }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [addDate, setAddDate] = useState(() => campusDate());
  // version が変わるたびに端末の記録を読み直す
  const records = Object.values(readAttendance(accountId)).sort((a, b) => (a.date === b.date ? a.period - b.period : a.date < b.date ? 1 : -1));
  void version;

  // 同じ科目（週2回など）は1つにまとめる
  const byName = new Map<string, { name: string; slots: { day: string; period: number; room?: string }[] }>();
  for (const c of courses) {
    const day = String(c.day || '').replace(/曜.*$/, '');
    const period = Number(c.period);
    if (!c.name || !day || !Number.isInteger(period)) continue;
    const item = byName.get(c.name) || { name: c.name, slots: [] };
    item.slots.push({ day, period, room: c.room });
    byName.set(c.name, item);
  }

  const update = (mutate: (all: Record<string, AttendanceRecord>) => void) => {
    const all = readAttendance(accountId);
    mutate(all);
    saveAttendance(accountId, all);
    onChange();
  };

  if (byName.size === 0) {
    return <p className="text-xs text-slate-600">今期の時間割が登録されていません。「今期履修中」に時間割を登録すると、授業ごとの出欠を記録できます。</p>;
  }

  return (
    <div className="space-y-2 text-xs" data-attendance-panel>
      {[...byName.values()].map((course) => {
        const counts = attendanceCounts(records, course.name);
        const list = records.filter((r) => r.course === course.name);
        const expanded = open === course.name;
        return (
          <div key={course.name} data-attendance-course={course.name} className="p-3 rounded-lg border border-slate-200 bg-white">
            <button type="button" onClick={() => setOpen(expanded ? null : course.name)} className="w-full text-left" aria-expanded={expanded}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900 text-sm truncate">{course.name}</span>
                <span className="text-[11px] text-slate-500 shrink-0">{course.slots.map((s) => `${s.day}${s.period}`).join('・')}</span>
              </div>
              <div data-attendance-counts className="mt-1 flex flex-wrap gap-x-3 text-[12px] font-semibold">
                <span className="text-emerald-700">出席: {counts.present}回</span>
                <span className="text-amber-700">遅刻: {counts.late}回</span>
                <span className="text-rose-700">欠席: {counts.absent}回</span>
                {counts.unconfirmed > 0 && <span className="text-slate-500">未確認: {counts.unconfirmed}回</span>}
              </div>
            </button>

            {expanded && (
              <div className="mt-2 pt-2 border-t border-slate-100 space-y-1.5">
                {list.length === 0 && <p className="text-slate-500">まだ記録がありません。</p>}
                {list.map((r) => (
                  <div key={recordKey(r)} data-attendance-record={`${r.date}|${r.period}`} className="flex items-center gap-2">
                    <span className="text-slate-700 tabular-nums">
                      {r.date.slice(5).replace('-', '/')}（{r.day}）{r.period}限
                    </span>
                    <select
                      value={r.status}
                      aria-label={`${r.date} ${r.period}限の出欠`}
                      onChange={(e) =>
                        update((all) => {
                          all[recordKey(r)] = { ...r, status: e.target.value as AttendanceStatus, source: 'manual', updatedAt: Date.now() };
                        })
                      }
                      className={`px-1.5 py-1 border border-slate-300 rounded text-base sm:text-xs font-semibold bg-white ${STATUS_STYLE[r.status]}`}
                    >
                      {STATUS_ORDER.map((s) => (
                        <option key={s} value={s}>
                          {ATTENDANCE_LABELS[s]}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-400">{r.source === 'auto' ? '自動' : '手動'}</span>
                    <button
                      type="button"
                      onClick={() => update((all) => delete all[recordKey(r)])}
                      className="ml-auto text-[11px] text-slate-400 hover:text-rose-700"
                      aria-label={`${r.date} ${r.period}限の記録を消す`}
                    >
                      消す
                    </button>
                  </div>
                ))}

                {/* 手で記録を足す（アプリを開いていなかった日など） */}
                <form
                  className="flex flex-wrap items-center gap-1.5 pt-1"
                  data-attendance-add
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    const slot = course.slots[Number(form.get('slot')) || 0];
                    const status = String(form.get('status')) as AttendanceStatus;
                    if (!addDate || !slot) return;
                    update((all) => {
                      const rec: AttendanceRecord = { date: addDate, day: slot.day, period: slot.period, course: course.name, status, source: 'manual', updatedAt: Date.now() };
                      all[recordKey(rec)] = rec;
                    });
                  }}
                >
                  <input
                    type="date"
                    value={addDate}
                    onChange={(e) => setAddDate(e.target.value)}
                    aria-label="日付"
                    className="px-1.5 py-1 border border-slate-300 rounded text-base sm:text-xs"
                  />
                  {course.slots.length > 1 && (
                    <select name="slot" aria-label="時限" className="px-1.5 py-1 border border-slate-300 rounded text-base sm:text-xs bg-white">
                      {course.slots.map((s, i) => (
                        <option key={i} value={i}>
                          {s.day}曜{s.period}限
                        </option>
                      ))}
                    </select>
                  )}
                  <select name="status" defaultValue="present" aria-label="出欠" className="px-1.5 py-1 border border-slate-300 rounded text-base sm:text-xs bg-white">
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {ATTENDANCE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="px-2.5 py-1 rounded bg-slate-900 text-white font-semibold">
                    記録を追加
                  </button>
                </form>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
