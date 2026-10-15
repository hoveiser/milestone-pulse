# On-chain deployment evidence

This page summarizes the verified studionet deployment. Every row was produced
by `scripts/deploy_studionet.py` and confirmed by polling each transaction to
FINALIZED through the RPC, then read back through view methods and re-checked by
`tests/integration/test_milestone_pulse_integration.py` (6 passed).

Raw machine-readable proof: `evidence/studionet_deployment.json`.

## Deployment

| Field | Value |
| --- | --- |
| Network | studionet (chain id 61999) |
| RPC | https://studio.genlayer.com/api |
| Contract address | `0x8eB47337e7A5De713D3358555CD35521063C0aDD` |
| Explorer | https://genlayer-explorer.vercel.app/address/0x8eB47337e7A5De713D3358555CD35521063C0aDD |
| Deploy tx | `0x8ab167c1897cffef9aa21f3e47c0a095ad1887d17001cd12b4951d8ebeed8816` |
| Runner header | `# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }` |
| Primary signer | `0x3de43AA2f7162c80af98abe78222aE0Cdf83c506` |
| Burner signer | `0xab44C31d1C8073567215E2AD2d80d97B9802F76A` |

## 3-way sha256 source identity

All three are `6a948b25cd17904708a184af5f2e5bff5137321e3b5f681d34b7f2227607ab17`:

1. the local file `contracts/milestone_pulse.py` (LF normalized),
2. the exact source bytes submitted in the deploy transaction,
3. the git index blob of `contracts/milestone_pulse.py`.

`eth_getCode` returns empty for GenLayer contracts and the explorer code API was
unavailable during this run, so on-chain identity is proven by local file equal
to the bytes carried in the deploy transaction equal to the committed blob, plus
the deploy transaction hash above.

## Transaction log

| # | Step | Method | Execution | Lifecycle |
| --- | --- | --- | --- | --- |
| 1 | create market A | create_market | SUCCESS | FINALIZED |
| 2 | create market B | create_market | SUCCESS | FINALIZED |
| 3 | position PARTIAL_SHIP on A (primary) | take_forecast_position | SUCCESS | FINALIZED |
| 4 | position VAPORWARE on A (burner) | take_forecast_position | SUCCESS | FINALIZED |
| 5 | position FULL_SHIP on B (burner) | take_forecast_position | SUCCESS | FINALIZED |
| 6 | submit evidence on A (burner) | submit_evidence_dossier | SUCCESS | FINALIZED |
| 7 | upvote evidence on A (primary, distinct signer) | upvote_evidence | SUCCESS | FINALIZED |
| 8 | resolve A deterministically (creator) | resolve_market_deterministic | SUCCESS | FINALIZED |
| 9 | claim winner payout on A (primary) | claim_position_payout | SUCCESS | FINALIZED |
| 10 | rollback check, evidence on resolved A | submit_evidence_dossier | ERROR (expected revert) | FINALIZED |

Transaction hashes are in `evidence/studionet_deployment.json`.

## Resulting state and invariant

Market A: status RESOLVED, winning band PARTIAL_SHIP, verified completion 55,
pool PARTIAL_SHIP 200, pool VAPORWARE 120, total_staked 320, 2 positions, 1
evidence with 1 upvote.

Accounting invariant verified live: band pools sum (0 + 200 + 120) equals
total_staked (320).

Leaderboard verified live: creator 340 points (proportional share 200 x 320 /
200 = 320 plus calibration bonus 25 minus |60 - 55| = 20), burner 20 points
(15 evidence reward plus 5 received upvote). The on-chain numbers match the
payout formula in the contract exactly.
