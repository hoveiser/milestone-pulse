import React from "react";
import { bandColor, bandLabel, fmt } from "../lib/format";

function StatusPill({ status }) {
  const map = {
    OPEN: "bg-pulse/15 text-pulse border-pulse/40",
    RESOLVED: "bg-ship/15 text-ship border-ship/40",
    CANCELLED: "bg-slate-500/15 text-slate-300 border-slate-500/40",
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${map[status] || map.CANCELLED}`}>
      {status}
    </span>
  );
}

export default function MarketList({ markets, selectedId, onSelect, loading, onCreate }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-300">
          Milestone Markets
        </h2>
        <button
          onClick={onCreate}
          className="rounded-lg bg-pulse/20 px-3 py-1.5 text-xs font-medium text-pulse hover:bg-pulse/30"
        >
          + New Market
        </button>
      </div>
      {loading && !markets.length ? (
        <div className="py-10 text-center text-sm text-slate-500">Reading studionet state...</div>
      ) : !markets.length ? (
        <div className="py-10 text-center text-sm text-slate-500">
          No markets yet. Create one to begin forecasting.
        </div>
      ) : (
        <ul className="space-y-2">
          {markets.map((m) => (
            <li key={m.market_id}>
              <button
                onClick={() => onSelect(m.market_id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selectedId === m.market_id
                    ? "border-pulse/60 bg-pulse/5"
                    : "border-edge bg-panel/60 hover:border-pulse/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{m.project_name}</span>
                  <StatusPill status={m.status} />
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-400">{m.milestone_commitment}</p>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400 tabnum">
                  <span>{fmt(m.position_count)} positions</span>
                  <span>{fmt(m.evidence_count)} evidence</span>
                  <span>{fmt(m.total_staked)} pts</span>
                  {m.status === "RESOLVED" && (
                    <span className={`ml-auto font-semibold ${bandColor(m.winning_band)}`}>
                      {bandLabel(m.winning_band)}
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
