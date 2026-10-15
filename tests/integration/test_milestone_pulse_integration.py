"""Live integration verification of the deployed MilestonePulse on studionet.

This exercises the contract through the real GenLayer VM and consensus path
(view calls are executed by the leader on studionet), asserting that the
seeded scenario the deploy script wrote to chain is actually present and that
the core invariants hold. It is intentionally read-mostly so it does not add
load to studionet's per-IP rate limits.

Run with:  gltest tests/integration -v -s --network studionet
"""

import json
from pathlib import Path

from gltest import get_contract_factory
from gltest.assertions import tx_execution_succeeded

EVIDENCE = Path(__file__).resolve().parents[2] / "evidence" / "studionet_deployment.json"
CONTRACT_FILE = "milestone_pulse.py"


def _load_evidence():
    return json.loads(EVIDENCE.read_text(encoding="utf-8"))


def _connected():
    evidence = _load_evidence()
    factory = get_contract_factory(contract_file_path=CONTRACT_FILE)
    return factory.build_contract(contract_address=evidence["contract_address"]), evidence


def test_deployed_contract_answers_view_calls():
    contract, _ = _connected()
    summary = contract.get_pulse_summary().call()
    assert isinstance(summary, dict)
    assert summary["total_markets"] >= 2
    assert summary["total_positions"] >= 3


def test_seeded_market_a_state_matches_evidence():
    contract, evidence = _connected()
    market = contract.get_market(args=[1]).call()
    expected = evidence["seeded_state"]["market_a"]
    assert market["status"] == "RESOLVED"
    assert market["winning_band"] == expected["winning_band"]
    assert market["verified_completion_pct"] == expected["verified_completion_pct"]


def test_live_accounting_invariant():
    contract, _ = _connected()
    market = contract.get_market(args=[1]).call()
    pools = market["pool_full_ship"] + market["pool_partial_ship"] + market["pool_vaporware"]
    assert pools == market["total_staked"], "band pools must sum to total_staked"


def test_live_evidence_and_upvote_present():
    contract, _ = _connected()
    evidences = contract.get_market_evidences(args=[1]).call()
    assert len(evidences) >= 1
    assert any(int(e["upvotes"]) >= 1 for e in evidences)


def test_leaderboard_reflects_economic_rewards():
    contract, evidence = _connected()
    board = contract.get_forecaster_leaderboard().call()
    assert len(board) >= 2
    # Creator won market A's PARTIAL_SHIP band and claimed; must top the board.
    winner = evidence["primary_signer"].lower()
    assert board[0]["forecaster"].lower() == winner
    assert int(board[0]["points"]) > 0


def test_resolution_guard_reverts_on_resolved_market():
    # A write against an already-resolved market must be rejected on chain.
    from gltest import get_default_account

    contract, _ = _connected()
    account = get_default_account()
    receipt = contract.submit_evidence_dossier(
        args=[1, "tester", "https://example.com/a", "TECHNICAL_AUDIT", "should revert"]
    ).transact()
    assert not tx_execution_succeeded(receipt)
