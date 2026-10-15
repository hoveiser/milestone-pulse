import React, { useCallback, useRef, useState } from "react";
import { explorerTxUrl } from "../lib/config";

const PHASES = [
  { id: "signing", label: "Signing" },
  { id: "broadcast", label: "Studionet Broadcast" },
  { id: "consensus", label: "Validator Consensus" },
  { id: "finalized", label: "Finalized" },
];

export function useTxLifecycle() {
  const [state, setState] = useState({ active: false, phase: "", label: "", hash: "", error: "" });
  const timer = useRef(null);

  const begin = useCallback((label) => {
    clearTimeout(timer.current);
    setState({ active: true, phase: "signing", label, hash: "", error: "" });
  }, []);
  const broadcast = useCallback((hash) => {
    setState((s) => ({ ...s, phase: "broadcast", hash }));
  }, []);
  const finalizing = useCallback(() => {
    setState((s) => ({ ...s, phase: "consensus" }));
    timer.current = setTimeout(() => setState((s) => (s.phase === "consensus" ? { ...s, phase: "finalized" } : s)), 6000);
  }, []);
  const done = useCallback((hash) => {
    clearTimeout(timer.current);
    setState((s) => ({ ...s, phase: "finalized", hash: hash || s.hash }));
    timer.current = setTimeout(() => setState((p) => ({ ...p, active: false })), 9000);
  }, []);
  const fail = useCallback((label, error) => {
    clearTimeout(timer.current);
    setState({ active: true, phase: "error", label, hash: "", error });
    timer.current = setTimeout(() => setState((p) => ({ ...p, active: false })), 9000);
  }, []);

  return { state, begin, broadcast, finalizing, done, fail };
}

export default function TxStepper({ state }) {
  if (!state.active) return null;
  const idx = PHASES.findIndex((p) => p.id === state.phase);
  return (
    <div className="fixed bottom-4 right-4 z-40 w-[360px] max-w-[92vw]">
      <div className="glass rounded-2xl p-4 shadow-glow">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-100">{state.label}</span>
          {state.hash ? (
            <a
              className="text-xs text-pulse hover:underline"
              href={explorerTxUrl(state.hash)}
              target="_blank"
              rel="noreferrer"
            >
              view tx
            </a>
          ) : null}
        </div>
        {state.phase === "error" ? (
          <div className="rounded-lg border border-vapor/40 bg-vapor/10 p-2 text-xs text-vapor">
            {state.error}
          </div>
        ) : (
          <ol className="space-y-1.5">
            {PHASES.map((p, i) => {
              const reached = i <= idx;
              const current = i === idx;
              return (
                <li key={p.id} className="flex items-center gap-2 text-xs">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      reached ? "bg-pulse" : "bg-slate-600"
                    } ${current ? "step-active" : ""}`}
                  />
                  <span className={reached ? "text-slate-100" : "text-slate-500"}>{p.label}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
