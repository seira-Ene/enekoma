'use client';

// 「位置情報で校内 / 校外を判定する」のスイッチと、今の判定・使えないときの案内
import { CAMPUS, describeLocationError, type LocationState } from '@/app/data/campusLocation';

interface Props {
  enabled: boolean;
  state: LocationState;
  onToggle: (enabled: boolean) => void;
}

export default function LocationCard({ enabled, state, onToggle }: Props) {
  const status =
    !enabled ? null : state.kind === 'on_campus' ? (
      <p data-location-status="on_campus" className="text-[11px] font-semibold text-emerald-700">🏫 今は校内（{CAMPUS.name}）です</p>
    ) : state.kind === 'off_campus' ? (
      <p data-location-status="off_campus" className="text-[11px] font-semibold text-slate-700">🚗 今は校外です</p>
    ) : state.kind === 'error' ? (
      <p data-location-error={state.reason} role="alert" className="p-2 rounded-md border border-rose-200 bg-rose-50 text-[11px] text-rose-800 leading-relaxed">
        ⚠️ {describeLocationError(state.reason)}
      </p>
    ) : (
      <p data-location-status="checking" className="text-[11px] text-slate-500">位置情報を確認しています…</p>
    );

  return (
    <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-2" data-location-card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-800 text-xs">📍 位置情報で校内 / 校外を判定する</div>
          <div className="text-[11px] text-slate-500 leading-relaxed">
            アプリを開いている間、{CAMPUS.name}のキャンパス（半径{CAMPUS.radiusM}m）にいるかを判定し、自動出欠とフレンドの「校内 / 校外」に使います。緯度・経度はこの端末の外に送りません。
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="位置情報で校内 / 校外を判定する"
          data-location-toggle
          onClick={() => onToggle(!enabled)}
          className={`shrink-0 relative w-12 h-7 rounded-full transition ${enabled ? 'bg-emerald-600' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${enabled ? 'left-6' : 'left-1'}`} />
        </button>
      </div>
      {status}
    </div>
  );
}
