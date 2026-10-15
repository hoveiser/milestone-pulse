export function bandForPct(pct) {
  if (pct >= 80) return "FULL_SHIP";
  if (pct >= 30) return "PARTIAL_SHIP";
  return "VAPORWARE";
}

export function bandMatchesPct(band, pct) {
  if (band === "FULL_SHIP") return pct >= 80 && pct <= 100;
  if (band === "PARTIAL_SHIP") return pct >= 30 && pct <= 79;
  if (band === "VAPORWARE") return pct >= 0 && pct <= 29;
  return false;
}

export function bandLabel(band) {
  return (
    { FULL_SHIP: "Full Ship", PARTIAL_SHIP: "Partial Ship", VAPORWARE: "Vaporware" }[
      band
    ] || band || "Unresolved"
  );
}

export function bandColor(band) {
  return (
    {
      FULL_SHIP: "text-ship",
      PARTIAL_SHIP: "text-partial",
      VAPORWARE: "text-vapor",
    }[band] || "text-slate-300"
  );
}

export function shortAddr(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function fmt(n) {
  const v = Number(n || 0);
  return v.toLocaleString("en-US");
}
