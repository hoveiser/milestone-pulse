import React from "react";
import { shortAddr } from "../lib/format";

export default function Header({
  walletMode,
  setWalletMode,
  burner,
  injected,
  onRotateBurner,
  onConnectInjected,
}) {
  const activeAddr = walletMode === "burner" ? burner.address : injected?.address;
  return (
    <header className="sticky top-0 z-20 border-b border-edge/60 bg-ink/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <img src="logo.png" alt="MilestonePulse logo" className="h-9 w-9 rounded-md" />
          <div className="leading-tight">
            <div className="text-lg font-semibold tracking-tight">MilestonePulse</div>
            <div className="text-[11px] uppercase tracking-widest text-slate-400">
              Ship-date accountability terminal
            </div>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-edge bg-panel p-0.5 text-xs">
            <button
              onClick={() => setWalletMode("burner")}
              className={`rounded-md px-3 py-1.5 ${
                walletMode === "burner" ? "bg-pulse/20 text-pulse" : "text-slate-300"
              }`}
            >
              Burner (1-click)
            </button>
            <button
              onClick={onConnectInjected}
              className={`rounded-md px-3 py-1.5 ${
                walletMode === "injected" ? "bg-pulse/20 text-pulse" : "text-slate-300"
              }`}
            >
              Connect Wallet
            </button>
          </div>

          {walletMode === "burner" && (
            <button
              onClick={onRotateBurner}
              title="Generate a fresh burner identity for testing multi-account flows"
              className="rounded-lg border border-edge bg-panel px-3 py-1.5 text-xs text-slate-200 hover:border-pulse/60"
            >
              Switch Burner Identity
            </button>
          )}

          <div className="rounded-lg border border-edge bg-panel px-3 py-1.5 text-xs tabnum">
            <span className="text-slate-400">signing as </span>
            <span className="text-pulse">{shortAddr(activeAddr) || "not connected"}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
