# MilestonePulse adversarial security review

This is the output of the `contract-adversarial-review` skill run against
`contracts/milestone_pulse.py`. Every party that can call the contract is assumed
adversarial, including the market creator, forecasters, evidence submitters,
upvoters, and anyone who can influence the web pages that validators fetch.

All checks below were verified in this session with `genvm-lint check` (0 errors)
and the direct-mode suite `tests/direct/test_milestone_pulse_direct.py` (60 tests
passing). Direct mode exercises only the leader path, so consensus/validator
agreement is additionally exercised on studionet by
`tests/integration/test_milestone_pulse_integration.py`.

## 1. State machine

Statuses: `OPEN`, `RESOLVED`, `CANCELLED`. Winning band is `UNRESOLVED` until set.

| Status | Method callable | Guard | Effect |
| --- | --- | --- | --- |
| (any) | `create_market` | input bounds only | new market is `OPEN` |
| OPEN | `take_forecast_position` | band/pct/stake/handle/thesis bounds | pool + total_staked + position_count increase |
| OPEN | `submit_evidence_dossier` | stance/url/note bounds | evidence stored, +15 rep |
| OPEN | `upvote_evidence` | not self, not dup, market still OPEN | +1 upvote, +5 rep to submitter |
| OPEN & count>0 | `resolve_market_live` | any caller, live consensus | sets band + `RESOLVED` |
| OPEN & count>0 | `resolve_market_deterministic` | creator or owner only | sets band + `RESOLVED` |
| RESOLVED | `claim_position_payout` | sender==forecaster, not claimed | pays or refunds |
| OPEN & count==0 | `cancel_market` | creator or owner only | `CANCELLED` |

Terminal states `RESOLVED` and `CANCELLED` are irreversible. There is no appeal or
re-resolution path by design; that is a product decision, not a trap.

## 2. Liveness (no stuck points)

`stake_points` and `forecaster_points` are internal accounting points, not native
value or ERC20. No real asset is ever escrowed, so there is no custodial risk of
unrecoverable tokens. Still, the point pot must never be trapped:

- Every `OPEN` market with at least one position can be resolved by ANY caller via
  `resolve_market_live`, and by the creator/owner via `resolve_market_deterministic`.
  So no market can freeze with positions and no recovery path.
- `cancel_market` is intentionally limited to `position_count == 0`, so cancelling
  can never strand staked points.
- On claim, if the winning band pool is zero (nobody bet on the true outcome), the
  branch refunds each forecaster their original `stake_points`. Proven by
  `test_claim_refunds_all_when_winning_pool_zero`.

## 3. Race conditions between competing transitions

- `resolve_market_live` and `resolve_market_deterministic` both require `OPEN` and
  atomically flip to `RESOLVED` inside one transaction, so only one wins.
- `take_forecast_position` and `submit_evidence_dossier` require `OPEN`; a resolved
  or cancelled market rejects them (`test_take_position_rejects_on_resolved_market`,
  `test_submit_evidence_rejects_when_closed`).
- `upvote_evidence` now also requires the evidence's market to be `OPEN` (FIX-2),
  making the resolve/upvote pair mutually exclusive by status and closing the
  post-resolution reputation farming window.
- `claim_position_payout` is idempotent-guarded by `claimed` (double claim reverts).

## 4. Accounting invariant

Invariant: `total_staked == pool_full_ship + pool_partial_ship + pool_vaporware`.
Every position adds `stake_points` to exactly one band pool and to `total_staked`,
and nothing else touches those fields, so it holds by construction.

Winner redistribution: `share_i = stake_i * total_staked / winning_pool`. Summed over
winners this equals `total_staked * (sum winning stakes) / winning_pool = total_staked`,
so the full losing pot is redistributed to the winning band (plus at most 25
calibration points per winner, which are minted reputation, not a bounded pool).
Losers receive zero. Integer-division dust may remain, which is acceptable because
the units are non-custodial points. `test_pulse_summary_counts` asserts the volume
and outcome tallies.

## 5. Input validation at entry points

Length, format, enum membership and positivity bounds are enforced on every write
argument (see the direct tests for `create_market`, `take_forecast_position`,
`submit_evidence_dossier`). URLs are checked for scheme and for whitespace/control
characters. `stake_points` is bounded `10..100000`. `verified_completion_pct` is
rejected when greater than 100 rather than clamped.

- FIX-1: `predicted_exact_pct` is now rejected when greater than 100 instead of being
  silently clamped, so a forecaster cannot submit an out-of-domain exact prediction.
  Proven by `test_take_position_rejects_pct_above_100`.

## 6. Consensus safety (GenLayer)

- `resolve_market_live` snapshots all market fields into plain Python locals before
  the non-deterministic block, and performs zero storage reads inside it.
- Evidence pages are re-fetched by the leader and independently re-run by each
  validator because the verdict is produced inside
  `gl.eq_principle.prompt_comparative`, whose principle pins agreement on the
  decision-relevant band bucket (`<30`, `30..79`, `>=80`) and on `token_verified`.
- The value that drives any payout is the derived `winning_band` label plus stored,
  deterministic amounts. The raw LLM number only selects the band and the small
  calibration bonus.
- Fail-closed: a malformed or missing LLM verdict raises a `[LLM_ERROR]` and reverts
  the whole transaction, leaving the market `OPEN` and unsettled. Proven by
  `test_resolve_live_fails_closed_on_bad_llm_output`.
- Prompt injection: fetched text is stripped of control characters and any `</untrusted`
  sequence is defused before it reaches the prompt, and the instruction explicitly
  tells the model to treat fenced content as data. Proven to be survivable on the
  leader path by `test_resolve_live_survives_prompt_injection_body`. This tests the
  leader path only; validator-side injection resistance is asserted in the comparative
  re-run, not proven by direct tests.
- Mandatory token gate: if `token_verified` is false, a `>=80` completion is capped to
  `75`, so `FULL_SHIP` cannot be unlocked without the artifact token. Proven by
  `test_resolve_live_token_cap_blocks_full_ship`.

## 7. Findings

### FIXED

1. FIX-1 silent clamp of `predicted_exact_pct`. Now rejected out of range.
   Test: `test_take_position_rejects_pct_above_100`.
2. FIX-2 post-resolution upvote farming. `upvote_evidence` now requires `OPEN`.
   Test: `test_upvote_rejected_after_market_resolved`.

### Verified safe (with tests)

- Zero-winner refund, no trapped pot: `test_claim_refunds_all_when_winning_pool_zero`.
- Double claim, wrong caller, premature claim guards.
- Self-upvote and duplicate-upvote rejection.
- Deterministic-resolution authorization and range guards.
- Cancel guards (with positions, non-creator, non-open).
- Fail-closed on bad LLM output.
- Prompt-injection-laden evidence page does not crash or alter the rule.

### OPEN / accepted (honest limitations)

1. `resolve_market_live` is permissionless, so a griefer can trigger live resolution
   as soon as one position exists, before the community finishes submitting evidence.
   This is a deliberate product choice from the spec (resolution is externally
   evidenced and should not be censored by the creator). It is not a fund-safety
   problem because outcomes only map to a non-custodial point pot. Mitigation is
   social: stewards can resolve deterministically. Left OPEN by design.
2. A submitter can farm `+15` reputation by spamming many low-effort dossiers while a
   market is `OPEN`. The spec defines the per-dossier reward with no cap. No funds are
   at risk. Accepted.
3. Direct-mode tests do NOT prove validator agreement or real web/LLM fetching. That
   part is only proven by the studionet integration run and the live seeded scenario.
   Until that transaction evidence is captured, consensus resistance is asserted by
   design, not empirically proven.
