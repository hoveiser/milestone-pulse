# MilestonePulse

A GenLayer Intelligent Contract and live interactive terminal for forecasting
the real technical delivery completeness of Web3 and AI roadmap commitments.

Participants forecast across three outcome bands, post live counter-evidence
URLs on chain, upvote community evidence, and settle through multi-source
GenLayer consensus. Everything in the frontend reads and writes the deployed
contract on studionet directly.

## What is on chain

- Contract: `0x8eB47337e7A5De713D3358555CD35521063C0aDD` on studionet (chain id 61999).
- Explorer: https://genlayer-explorer.vercel.app/address/0x8eB47337e7A5De713D3358555CD35521063C0aDD
- Live frontend: https://hoveiser.github.io/milestone-pulse/
- Full transaction proof: [docs/evidence.md](docs/evidence.md) and `evidence/studionet_deployment.json`.
- Security review: [docs/adversarial-review.md](docs/adversarial-review.md).

## The three bands

| Band | Completion range |
| --- | --- |
| FULL_SHIP | 80 to 100 percent delivered |
| PARTIAL_SHIP | 30 to 79 percent delivered |
| VAPORWARE | 0 to 29 percent delivered |

A forecast's exact percentage must fall inside the band it selects, and `FULL_SHIP`
cannot be unlocked unless the mandatory deliverable token is verified in the proof
content.

## Contract methods

Writes: `create_market`, `take_forecast_position`, `submit_evidence_dossier`,
`upvote_evidence`, `resolve_market_live`, `resolve_market_deterministic`,
`claim_position_payout`, `cancel_market`.

Views: `get_market`, `get_all_markets`, `get_market_positions`,
`get_market_evidences`, `get_forecaster_leaderboard`, `get_pulse_summary`.

### Live consensus resolution

`resolve_market_live` snapshots the market into plain variables, then fetches the
official proof page and the top-upvoted community evidence page inside
`gl.eq_principle.prompt_comparative`, so every validator re-fetches and re-scores
independently and must agree on the completion band and the token gate before any
payout is unlocked. A malformed verdict reverts and leaves the market OPEN rather
than settling on garbage.

### Payout math

The losing bands' stakes are redistributed to the winning band proportionally
(`stake * total_staked / winning_pool`) plus a calibration bonus of up to 25 points
for accuracy, and if nobody bet on the true band every forecaster reclaims their
original stake so no value is trapped.

## Repository layout

- `contracts/milestone_pulse.py` the pinned GenLayer intelligent contract.
- `tests/direct/` 60 fast direct-mode tests.
- `tests/integration/` live studionet verification of the deployed contract.
- `scripts/deploy_studionet.py` resumable deploy plus rich on-chain seeding.
- `scripts/generate_logo.py` programmatic PNG logo renderer.
- `frontend/` Vite + React + Tailwind + genlayer-js terminal.
- `docs/` evidence and adversarial review.

## Reproduce locally

Requires Python 3.13 with `genlayer-py`, `genlayer-test`, `genvm-lint` and a
`.env` holding `GENLAYER_PRIVATE_KEY`, plus Node 18+.

```bash
genvm-lint check contracts/milestone_pulse.py
pytest tests/direct
gltest tests/integration -v -s --network studionet
python scripts/deploy_studionet.py     # deploys and seeds studionet (gasless)
cd frontend && npm install && npm run build
```

The burner wallet in the frontend is generated and stored only in your browser
`localStorage`; studionet is gasless so a fresh identity can sign immediately.
