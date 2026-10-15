export const RPC_URL = "https://studio.genlayer.com/api";
export const CHAIN_ID = 61999;

// Baked in after the verified studionet deploy (see evidence/studionet_deployment.json).
export const CONTRACT_ADDRESS = "0x8eB47337e7A5De713D3358555CD35521063C0aDD";

export const EXPLORER_BASE = "https://genlayer-explorer.vercel.app";

export const explorerTxUrl = (hash) =>
  hash ? `${EXPLORER_BASE}/tx/${hash}` : EXPLORER_BASE;
export const explorerAddressUrl = (addr) =>
  `${EXPLORER_BASE}/address/${addr}`;

export const BANDS = [
  { id: "FULL_SHIP", label: "Full Ship", range: "80-100%", color: "ship" },
  { id: "PARTIAL_SHIP", label: "Partial Ship", range: "30-79%", color: "partial" },
  { id: "VAPORWARE", label: "Vaporware", range: "0-29%", color: "vapor" },
];

export const STANCES = ["PROVES_SHIPPED", "PROVES_DELAYED", "TECHNICAL_AUDIT"];

export const MARKET_TEMPLATES = [
  {
    project_name: "ZK Cascade Prover",
    milestone_commitment:
      "Ship a trustless ZK proof pipeline with a public third-party audit by end of Q2.",
    official_proof_url: "https://roadmap.zkcascade.io/milestones/zk-prover",
    mandatory_deliverable_token: "zk-proofs",
  },
  {
    project_name: "AgentStack SDK v1",
    milestone_commitment:
      "Release the v1 agent SDK with published docs, examples and a stable API by Q3.",
    official_proof_url: "https://roadmap.agentstack.dev/milestones/sdk-v1",
    mandatory_deliverable_token: "sdk-docs",
  },
  {
    project_name: "Rollup native withdrawals",
    milestone_commitment:
      "Enable canonical L1 to L2 native withdrawals with a security review by Q4.",
    official_proof_url: "https://roadmap.lattice.io/milestones/native-withdrawals",
    mandatory_deliverable_token: "withdrawals",
  },
];
