import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BANDS, STANCES } from "../lib/config";
import { readView } from "../lib/genlayer";
import { bandForPct, bandMatchesPct, bandLabel, bandColor, shortAddr, fmt } from "../lib/format";

// Static Tailwind class maps (dynamic class names are purged by Tailwind at build).
const BAR_CLASS = { FULL_SHIP: "bg-ship", PARTIAL_SHIP: "bg-partial", VAPORWARE: "bg-vapor" };
const BAND_ACTIVE_CLASS = {
  FULL_SHIP: "border-ship bg-ship/10 text-ship",
  PARTIAL_SHIP: "border-partial bg-partial/10 text-partial",
  VAPORWARE: "border-vapor bg-vapor/10 text-vapor",
};

export default function MarketDetail({ market, signerKey, signerAddress, runWrite, onChanged }) {
  const [positions, setPositions] = useState([]);
  const [evidences, setEvidences] = useState([]);
  const [tab, setTab] = useState("forecast");

  const load = useCallback(async () => {
    try {
      const [p, e] = await Promise.all([
        readView("get_market_positions", [market.market_id]),
        readView("get_market_evidences", [market.market_id]),
      ]);
      setPositions(Array.isArray(p) ? p : []);
      setEvidences(Array.isArray(e) ? e : []);
    } catch {
      /* keep last good state */
    }
  }, [market.market_id]);

  useEffect(() => {
    load();
  }, [load]);

  const isOpen = market.status === "OPEN";

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{market.project_name}</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-300">{market.milestone_commitment}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="rounded border border-edge px-2 py-0.5">
              deliverable token: <span className="text-pulse">{market.mandatory_deliverable_token}</span>
            </span>
            <a
              className="rounded border border-edge px-2 py-0.5 text-pulse hover:border-pulse/60"
              href={market.official_proof_url}
              target="_blank"
              rel="noreferrer"
            >
              official proof
            </a>
            <span>creator {shortAddr(market.creator)}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-widest text-slate-400">status</div>
          <div className={`text-lg font-semibold ${bandColor(market.winning_band)}`}>
            {isOpen ? "OPEN" : `${bandLabel(market.winning_band)} · ${market.verified_completion_pct}%`}
          </div>
        </div>
      </div>

      {market.resolution_summary && (
        <div className="mt-3 rounded-lg border border-edge bg-ink/60 p-3 text-sm text-slate-300">
          <span className="text-xs uppercase tracking-widest text-slate-400">Resolution summary</span>
          <p className="mt-1">{market.resolution_summary}</p>
        </div>
      )}

      <PoolVisualizer market={market} positions={positions} />

      {isOpen && (
        <div className="mt-5 flex gap-2 border-b border-edge">
          {[
            ["forecast", "Forecast Ticket"],
            ["evidence", `Evidence Duel (${evidences.length})`],
            ["positions", `Positions (${positions.length})`],
            ["settle", "Resolve"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-3 py-2 text-sm ${
                tab === id ? "border-b-2 border-pulse text-pulse" : "text-slate-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4">
        {tab === "forecast" && isOpen && (
          <ForecastTicket
            market={market}
            signerAddress={signerAddress}
            onPreview={(args) => runWrite("Take forecast position", "take_forecast_position", args)}
          />
        )}
        {tab === "evidence" && isOpen && (
          <EvidenceWall
            market={market}
            evidences={evidences}
            signerAddress={signerAddress}
            onPreview={(args) => runWrite("Submit evidence dossier", "submit_evidence_dossier", args)}
            onUpvote={(id) => runWrite("Upvote evidence", "upvote_evidence", [id])}
            onChanged={onChanged}
          />
        )}
        {tab === "positions" && <PositionTable positions={positions} market={market} onClaim={(id) => runWrite("Claim payout", "claim_position_payout", [id])} />}
        {tab === "settle" && isOpen && (
          <ResolvePanel
            market={market}
            canResolve={signerAddress && (signerAddress.toLowerCase() === market.creator.toLowerCase())}
            onLive={() => runWrite("Resolve via live GenLayer consensus", "resolve_market_live", [market.market_id])}
            onDeterministic={(pct, summary) =>
              runWrite("Resolve deterministically", "resolve_market_deterministic", [market.market_id, pct, summary])
            }
          />
        )}
        {!isOpen && (
          <PositionTable
            positions={positions}
            market={market}
            onClaim={(id) => runWrite("Claim payout", "claim_position_payout", [id])}
          />
        )}
      </div>
    </div>
  );
}

function PoolVisualizer({ market, positions }) {
  const pools = [
    { band: "FULL_SHIP", value: Number(market.pool_full_ship) },
    { band: "PARTIAL_SHIP", value: Number(market.pool_partial_ship) },
    { band: "VAPORWARE", value: Number(market.pool_vaporware) },
  ];
  const total = pools.reduce((a, b) => a + b.value, 0);
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
        <span className="uppercase tracking-widest">Implied odds by band</span>
        <span className="tabnum">total staked {fmt(total)} pts</span>
      </div>
      <div className="space-y-2">
        {pools.map((p) => {
          const meta = BANDS.find((b) => b.id === p.band);
          const share = total ? (p.value / total) * 100 : 0;
          return (
            <div key={p.band} className="flex items-center gap-3">
              <div className="w-40 shrink-0 text-sm">
                <span className={bandColor(p.band)}>{meta.label}</span>{" "}
                <span className="text-xs text-slate-500">{meta.range}</span>
              </div>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-ink">
                <div className={`h-full ${BAR_CLASS[p.band]}`} style={{ width: `${share}%` }} />
              </div>
              <div className="w-24 shrink-0 text-right text-sm tabnum">
                {share.toFixed(1)}% · {fmt(p.value)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ForecastTicket({ market, onPreview }) {
  const [handle, setHandle] = useState("");
  const [band, setBand] = useState("PARTIAL_SHIP");
  const [pct, setPct] = useState(55);
  const [stake, setStake] = useState(100);
  const [thesis, setThesis] = useState("");

  const bandOk = bandMatchesPct(band, pct);
  const stakeOk = stake >= 10 && stake <= 100000;
  const thesisOk = thesis.trim().length >= 1 && thesis.length <= 280;
  const valid = bandOk && stakeOk && thesisOk;

  const submit = () => {
    if (!valid) return;
    onPreview([market.market_id, handle.trim() || "anon", band, Number(pct), Number(stake), thesis.trim()]);
  };

  const quickFill = () => {
    setHandle("steward");
    setBand("PARTIAL_SHIP");
    setPct(62);
    setStake(150);
    setThesis("Pipeline ships on time but the audited zk-proofs artifact lands late.");
  };

  return (
    <div className="rounded-xl border border-edge bg-ink/50 p-4">
      <div className="mb-3 grid grid-cols-3 gap-2">
        {BANDS.map((b) => (
          <button
            key={b.id}
            onClick={() => {
              setBand(b.id);
              setPct(b.id === "FULL_SHIP" ? 90 : b.id === "PARTIAL_SHIP" ? 55 : 15);
            }}
            className={`rounded-lg border px-2 py-2 text-sm ${
              band === b.id ? BAND_ACTIVE_CLASS[b.id] : "border-edge text-slate-300"
            }`}
          >
            {b.label}
            <div className="text-[10px] text-slate-500">{b.range}</div>
          </button>
        ))}
      </div>

      <label className="mb-1 block text-xs text-slate-400">
        Exact completion prediction: <span className="text-pulse tabnum">{pct}%</span>
        {!bandOk && <span className="ml-2 text-vapor">outside the selected band</span>}
      </label>
      <input
        type="range"
        min="0"
        max="100"
        value={pct}
        onChange={(e) => setPct(Number(e.target.value))}
        className="mb-3 w-full accent-pulse"
      />

      <div className="mb-3 grid grid-cols-2 gap-3">
        <input
          placeholder="handle (optional)"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          className="rounded-lg border border-edge bg-ink px-3 py-2 text-sm outline-none focus:border-pulse/60"
        />
        <input
          type="number"
          placeholder="stake points (10..100000)"
          value={stake}
          onChange={(e) => setStake(Number(e.target.value))}
          className={`rounded-lg border bg-ink px-3 py-2 text-sm outline-none ${
            stakeOk ? "border-edge focus:border-pulse/60" : "border-vapor"
          }`}
        />
      </div>

      <textarea
        rows={2}
        placeholder="public thesis (max 280 chars)"
        value={thesis}
        onChange={(e) => setThesis(e.target.value)}
        className={`mb-3 w-full rounded-lg border bg-ink px-3 py-2 text-sm outline-none ${
          thesisOk || thesis === "" ? "border-edge focus:border-pulse/60" : "border-vapor"
        }`}
      />

      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={!valid}
          className="rounded-lg bg-pulse px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40"
        >
          Submit Forecast
        </button>
        <button
          onClick={quickFill}
          className="rounded-lg border border-pulse/50 px-3 py-2 text-sm text-pulse hover:bg-pulse/10"
        >
          Quick Fill Demo Forecast
        </button>
        <span className="ml-auto text-xs text-slate-500">band {bandLabel(band)}</span>
      </div>
    </div>
  );
}

function EvidenceWall({ market, evidences, signerAddress, onPreview, onUpvote }) {
  const [url, setUrl] = useState("");
  const [stance, setStance] = useState("PROVES_DELAYED");
  const [note, setNote] = useState("");
  const [handle, setHandle] = useState("");

  const urlOk = /^https?:\/\//i.test(url) && url.length >= 8 && url.length <= 512;
  const noteOk = note.trim().length >= 1 && note.length <= 300;
  const valid = urlOk && noteOk;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-edge bg-ink/50 p-4">
        <div className="mb-2 text-sm font-semibold text-slate-200">Whistleblower Wall: submit live evidence</div>
        <input
          placeholder="evidence URL (http/https)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className={`mb-2 w-full rounded-lg border bg-ink px-3 py-2 text-sm outline-none ${
            urlOk || url === "" ? "border-edge focus:border-pulse/60" : "border-vapor"
          }`}
        />
        <div className="mb-2 flex flex-wrap gap-2">
          {STANCES.map((s) => (
            <button
              key={s}
              onClick={() => setStance(s)}
              className={`rounded-full border px-2.5 py-1 text-[11px] ${
                stance === s ? "border-pulse text-pulse" : "border-edge text-slate-400"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="mb-2 grid grid-cols-3 gap-2">
          <input
            placeholder="handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            className="col-span-1 rounded-lg border border-edge bg-ink px-3 py-2 text-sm outline-none focus:border-pulse/60"
          />
          <input
            placeholder="note (max 300)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={`col-span-2 rounded-lg border bg-ink px-3 py-2 text-sm outline-none ${
              noteOk || note === "" ? "border-edge focus:border-pulse/60" : "border-vapor"
            }`}
          />
        </div>
        <button
          onClick={() => valid && onPreview([market.market_id, handle.trim() || "anon", url.trim(), stance, note.trim()])}
          disabled={!valid}
          className="rounded-lg bg-pulse px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40"
        >
          Submit Evidence Dossier
        </button>
      </div>

      <div className="space-y-2">
        {evidences.length === 0 && (
          <div className="text-sm text-slate-500">No community evidence yet. Be the first whistleblower.</div>
        )}
        {evidences
          .slice()
          .sort((a, b) => Number(b.upvotes) - Number(a.upvotes))
          .map((e) => (
            <div key={e.evidence_id} className="rounded-xl border border-edge bg-panel/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded border border-edge px-1.5 py-0.5 text-[10px] text-partial">
                    {e.claim_stance}
                  </span>
                  <a
                    className="text-sm text-pulse hover:underline"
                    href={e.evidence_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {e.evidence_url}
                  </a>
                </div>
                <button
                  onClick={() => onUpvote(e.evidence_id)}
                  disabled={signerAddress && signerAddress.toLowerCase() === e.submitter.toLowerCase()}
                  className="rounded-lg border border-edge px-3 py-1 text-xs text-slate-200 hover:border-pulse/60 disabled:opacity-40"
                >
                  Upvote ({fmt(e.upvotes)})
                </button>
              </div>
              <p className="mt-1 text-sm text-slate-300">{e.note}</p>
              <div className="mt-1 text-[11px] text-slate-500">by {e.submitter_handle} · {shortAddr(e.submitter)}</div>
            </div>
          ))}
      </div>
    </div>
  );
}

function PositionTable({ positions, market, onClaim }) {
  return (
    <div className="overflow-hidden rounded-xl border border-edge">
      <table className="w-full text-sm">
        <thead className="bg-ink/70 text-xs uppercase text-slate-400">
          <tr>
            <th className="p-2 text-left">#</th>
            <th className="p-2 text-left">Forecaster</th>
            <th className="p-2 text-left">Band</th>
            <th className="p-2 text-right">Exact</th>
            <th className="p-2 text-right">Stake</th>
            <th className="p-2 text-right">Payout</th>
          </tr>
        </thead>
        <tbody>
          {positions.length === 0 && (
            <tr>
              <td colSpan={6} className="p-3 text-center text-slate-500">
                No positions yet.
              </td>
            </tr>
          )}
          {positions.map((p) => (
            <tr key={p.position_id} className="border-t border-edge">
              <td className="p-2 tabnum">{p.position_id}</td>
              <td className="p-2">
                {p.handle} <span className="text-slate-500">{shortAddr(p.forecaster)}</span>
              </td>
              <td className={`p-2 ${bandColor(p.predicted_band)}`}>{bandLabel(p.predicted_band)}</td>
              <td className="p-2 text-right tabnum">{p.predicted_exact_pct}%</td>
              <td className="p-2 text-right tabnum">{fmt(p.stake_points)}</td>
              <td className="p-2 text-right tabnum">
                {p.claimed ? (
                  <span className="text-ship">{fmt(p.payout_earned)} claimed</span>
                ) : market.status === "RESOLVED" ? (
                  <button
                    onClick={() => onClaim(p.position_id)}
                    className="rounded border border-ship/50 px-2 py-0.5 text-xs text-ship hover:bg-ship/10"
                  >
                    Claim
                  </button>
                ) : (
                  <span className="text-slate-500">pending</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResolvePanel({ market, canResolve, onLive, onDeterministic }) {
  const [pct, setPct] = useState(55);
  const [summary, setSummary] = useState("Delivered core, key artifact outstanding.");
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-pulse/40 bg-pulse/5 p-4">
        <div className="text-sm font-semibold text-pulse">Resolve via live GenLayer consensus</div>
        <p className="mt-1 text-xs text-slate-400">
          Validators independently fetch the official proof and the top-upvoted evidence, run a
          comparative auditor prompt, and agree on the completion band. The mandatory deliverable
          token gates any Full Ship outcome.
        </p>
        <button
          onClick={onLive}
          disabled={market.position_count === 0}
          className="mt-3 rounded-lg bg-pulse px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40"
        >
          Resolve via Live GenLayer Consensus
        </button>
        {market.position_count === 0 && (
          <div className="mt-2 text-xs text-vapor">Needs at least one forecast position to resolve.</div>
        )}
      </div>

      <div className="rounded-xl border border-edge bg-ink/50 p-4">
        <div className="text-sm font-semibold text-slate-200">Deterministic steward resolution</div>
        <p className="mt-1 text-xs text-slate-400">Creator/owner only. Maps a verified completion to the same three bands.</p>
        {!canResolve && (
          <div className="mt-2 text-xs text-partial">Sign with the market creator address (or the owner) to use this.</div>
        )}
        <div className="mt-3 flex items-center gap-3">
          <input
            type="number"
            min="0"
            max="100"
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
            className="w-28 rounded-lg border border-edge bg-ink px-3 py-2 text-sm"
          />
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="flex-1 rounded-lg border border-edge bg-ink px-3 py-2 text-sm"
          />
          <button
            onClick={() => canResolve && pct >= 0 && pct <= 100 && onDeterministic(Number(pct), summary.slice(0, 400))}
            disabled={!canResolve || pct < 0 || pct > 100}
            className="rounded-lg border border-edge px-3 py-2 text-sm text-slate-200 hover:border-pulse/60 disabled:opacity-40"
          >
            Settle ({bandLabel(bandForPct(pct))})
          </button>
        </div>
      </div>
    </div>
  );
}
