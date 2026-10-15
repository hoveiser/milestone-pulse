import React from "react";
import { explorerAddressUrl } from "../lib/config";
import { shortAddr, fmt } from "../lib/format";

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-xl border border-edge bg-panel px-4 py-3">
      <div className="text-[11px] uppercase tracking-widest text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabnum ${accent || "text-slate-100"}`}>
        {value}
      </div>
    </div>
  );
}

export default function SummaryBar({ summary, address, chainId }) {
  const linked = address && !address.startsWith("0x0000");
  return (
    <section className="my-6">
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
        <span className="rounded-full border border-edge bg-panel px-3 py-1">
          studionet / chain {chainId}
        </span>
        <a
          href={explorerAddressUrl(address)}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-edge bg-panel px-3 py-1 text-pulse hover:border-pulse/60"
        >
          contract {shortAddr(address)} {linked ? "on explorer" : "(pending deploy)"}
        </a>
        <span className="text-slate-400">
          Live data read directly from the deployed MilestonePulse contract.
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Stat label="Markets" value={fmt(summary?.total_markets)} />
        <Stat label="Open" value={fmt(summary?.open_markets)} accent="text-pulse" />
        <Stat label="Resolved" value={fmt(summary?.resolved_markets)} accent="text-ship" />
        <Stat label="Positions" value={fmt(summary?.total_positions)} />
        <Stat label="Evidences" value={fmt(summary?.total_evidences)} />
        <Stat label="Volume (pts)" value={fmt(summary?.total_volume_staked)} accent="text-partial" />
      </div>
    </section>
  );
}
