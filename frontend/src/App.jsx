import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CONTRACT_ADDRESS, CHAIN_ID, explorerAddressUrl } from "./lib/config";
import { readView, submitWrite } from "./lib/genlayer";
import { loadBurner, rotateBurner, connectInjected } from "./lib/wallet";
import Header from "./components/Header.jsx";
import SummaryBar from "./components/SummaryBar.jsx";
import MarketList from "./components/MarketList.jsx";
import MarketDetail from "./components/MarketDetail.jsx";
import CreateMarketModal from "./components/CreateMarketModal.jsx";
import TxStepper, { useTxLifecycle } from "./components/TxStepper.jsx";

export default function App() {
  const [burner, setBurner] = useState(() => loadBurner());
  const [walletMode, setWalletMode] = useState("burner"); // burner | injected
  const [injected, setInjected] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const tx = useTxLifecycle();

  const signerKey = walletMode === "burner" ? burner.privateKey : null;

  const refresh = useCallback(async () => {
    try {
      setError("");
      const [m, s, l] = await Promise.all([
        readView("get_all_markets"),
        readView("get_pulse_summary"),
        readView("get_forecaster_leaderboard"),
      ]);
      setMarkets(Array.isArray(m) ? m : []);
      setSummary(s || null);
      setLeaderboard(Array.isArray(l) ? l : []);
      if (m && m.length && selectedId == null) setSelectedId(m[0].market_id);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, [refresh]);

  const selectedMarket = useMemo(
    () => markets.find((m) => m.market_id === selectedId) || null,
    [markets, selectedId]
  );

  // Runs a contract write through the lifecycle stepper, then refreshes state.
  const runWrite = useCallback(
    async (label, functionName, args) => {
      if (!signerKey) {
        tx.fail(label, "Switch to the 1-Click Burner wallet to sign this action on studionet.");
        return;
      }
      tx.begin(label);
      try {
        const hash = await submitWrite(signerKey, functionName, args);
        tx.broadcast(hash);
        tx.finalizing();
        await refresh();
        tx.done(hash);
      } catch (e) {
        tx.fail(label, String(e?.message || e));
      }
    },
    [signerKey, tx, refresh]
  );

  return (
    <div className="min-h-screen">
      <Header
        walletMode={walletMode}
        setWalletMode={setWalletMode}
        burner={burner}
        injected={injected}
        onRotateBurner={() => setBurner(rotateBurner())}
        onConnectInjected={async () => {
          try {
            const acc = await connectInjected();
            setInjected(acc);
            setWalletMode("injected");
          } catch (e) {
            tx.fail("Connect wallet", String(e?.message || e));
          }
        }}
      />

      <main className="mx-auto max-w-7xl px-4 pb-24">
        <SummaryBar summary={summary} address={CONTRACT_ADDRESS} chainId={CHAIN_ID} />

        {error && (
          <div className="mb-4 rounded-lg border border-vapor/40 bg-vapor/10 p-3 text-sm text-vapor">
            Read failed: {error}. The terminal still renders cached state.
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-6">
            <MarketList
              markets={markets}
              selectedId={selectedId}
              onSelect={setSelectedId}
              loading={loading}
              onCreate={() => setShowCreate(true)}
            />
          </div>
          <div className="lg:col-span-2">
            {selectedMarket ? (
              <MarketDetail
                market={selectedMarket}
                signerKey={signerKey}
                signerAddress={walletMode === "burner" ? burner.address : injected?.address}
                runWrite={runWrite}
                onChanged={refresh}
              />
            ) : (
              <div className="glass rounded-2xl p-10 text-center text-slate-400">
                Select a milestone market to open the forecasting terminal.
              </div>
            )}
          </div>
        </div>
      </main>

      {showCreate && (
        <CreateMarketModal
          onClose={() => setShowCreate(false)}
          onSubmit={(args) => {
            setShowCreate(false);
            runWrite("Create market", "create_market", args);
          }}
        />
      )}

      <TxStepper state={tx.state} />
    </div>
  );
}
