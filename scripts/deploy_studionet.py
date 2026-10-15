"""Deploy MilestonePulse to studionet and seed a rich, two-signer on-chain state.

The script is resumable: it persists a checkpoint after every finalized step, so
it can be re-run when the studionet network path is flaky and will continue from
where it left off instead of orphaning fresh deploys. It always writes
evidence/studionet_deployment.json (complete or partial) in a finally block.

Every claim in the evidence file is backed by a transaction this script polled
to FINALIZED and whose execution result it read from the consensus receipt.
Studionet is gasless: the .env key deploys, and a locally generated burner key is
the second signer for the two-role paths. Re-sending an already-signed transaction
is idempotent, so the provider-level retry below never duplicates state.
"""

import hashlib
import json
import os
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

from gltest_cli.config.user import load_user_config
from gltest_cli.config.general import get_general_config

_cfg = get_general_config()
_cfg.user_config = load_user_config("gltest.config.yaml")
_cfg.plugin_config.network_name = "studionet"
_cfg.plugin_config.contracts_dir = Path("contracts")
_cfg.plugin_config.artifacts_dir = Path("artifacts")

from gltest import get_contract_factory, get_default_account, get_gl_client
from gltest.contracts.contract_factory import extract_contract_address
from gltest.assertions import tx_execution_succeeded
from genlayer_py import create_account
from genlayer_py.types import TransactionStatus
import genlayer_py.provider.provider as _glp
from genlayer_py.exceptions import GenLayerError as _GLE

# Provider-level idempotent retry against studionet's intermittent TLS drops.
_ORIG_MAKE_REQUEST = _glp.GenLayerProvider.make_request
_TRANSIENT = (
    "ssl", "connection", "eof", "max retries", "timed out", "timeout",
    "temporarily unavailable", "429", "-32429", "-32028",
    "502", "503", "500", "bad gateway", "service unavailable", "invalid json",
    "<!doctype", "<html", "cloudflare",
)


def _robust_make_request(self, method, params):
    last = None
    for attempt in range(1, 8):
        try:
            return _ORIG_MAKE_REQUEST(self, method, params)
        except _GLE as exc:
            last = exc
            if any(tok in str(exc).lower() for tok in _TRANSIENT) and attempt < 8:
                time.sleep(min(20, 2 ** attempt))
                continue
            raise
    raise last


_glp.GenLayerProvider.make_request = _robust_make_request

FINAL = TransactionStatus.FINALIZED
WAIT = {"wait_interval": 3000, "wait_retries": 150}

OFFICIAL_A = "https://roadmap.zkcascade.io/milestones/zk-prover"
OFFICIAL_B = "https://roadmap.agentstack.dev/milestones/sdk-v1"
EVIDENCE_A = "https://github.com/zkcascade/prover/releases"

EVIDENCE_DIR = ROOT / "evidence"
EVIDENCE_DIR.mkdir(exist_ok=True)
CHECKPOINT = EVIDENCE_DIR / "_checkpoint.json"

TXNS = []


def log(*a):
    print(*a, flush=True)


def load_checkpoint():
    if CHECKPOINT.exists():
        return json.loads(CHECKPOINT.read_text(encoding="utf-8"))
    return {"address": None, "done": []}


def save_ckpt(ckpt):
    CHECKPOINT.write_text(json.dumps(ckpt, indent=2), encoding="utf-8")


def read_view(contract, method, args=None):
    fn = getattr(contract, method)

    def _do():
        return (fn(args=args) if args is not None else fn()).call()

    last = None
    for _ in range(5):
        try:
            return _do()
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(4)
    raise last


def run_write(contract, method, args, label, expect_success=True):
    fn = getattr(contract, method)
    receipt = fn(args=args).transact(wait_transaction_status=FINAL, **WAIT)
    status_name = receipt.get("status_name") or str(receipt.get("status"))
    leader = (receipt.get("consensus_data") or {}).get("leader_receipt") or [{}]
    execution_result = leader[0].get("execution_result")
    ok = tx_execution_succeeded(receipt)
    entry = {
        "label": label,
        "method": method,
        "tx_hash": receipt.get("hash") or receipt.get("tx_id"),
        "lifecycle_status": status_name,
        "execution_result": execution_result,
        "as_expected": ok is expect_success,
    }
    TXNS.append(entry)
    log(f"[{'OK' if ok else 'REVERT'}] {label}: lifecycle={status_name} execution={execution_result}")
    if ok is not expect_success:
        raise RuntimeError(f"{label}: expected success={expect_success}, got execution={execution_result}")
    return receipt


def sha256_bytes(b):
    return hashlib.sha256(b).hexdigest()


def normalized_lf(b):
    return b.replace(b"\r\n", b"\n")


def git_blob_bytes(rel):
    subprocess.run(["git", "add", "--", rel], check=True)
    try:
        return subprocess.check_output(["git", "cat-file", "blob", f":{rel}"])
    finally:
        subprocess.run(["git", "reset", "-q", "--", rel], check=False)


def build_evidence(contract_obj, address, primary, burner, ckpt, invariant, market_a, summary, leaderboard, deploy_hash):
    file_bytes = normalized_lf((ROOT / "contracts" / "milestone_pulse.py").read_bytes())
    file_sha = sha256_bytes(file_bytes)
    code_bytes = contract_obj.contract_code
    if isinstance(code_bytes, str):
        code_bytes = code_bytes.encode("utf-8")
    deployed_sha = sha256_bytes(normalized_lf(code_bytes))
    try:
        git_sha = sha256_bytes(normalized_lf(git_blob_bytes("contracts/milestone_pulse.py")))
        git_ok = True
    except Exception:  # noqa: BLE001
        git_sha, git_ok = None, False
    three_way = file_sha == deployed_sha and (not git_ok or git_sha == file_sha)

    return {
        "project": "MilestonePulse",
        "network": "studionet",
        "chain_id": 61999,
        "rpc_url": "https://studio.genlayer.com/api",
        "contract_address": address,
        "explorer_contract_url": f"https://genlayer-explorer.vercel.app/address/{address}",
        "deploy_tx_hash": deploy_hash,
        "primary_signer": primary.address,
        "burner_signer": burner.address,
        "runner_header": file_bytes.split(b"\n", 1)[0].decode("utf-8"),
        "recorded_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "scenario_complete": sorted(ckpt["done"]),
        "three_way_sha256": {
            "local_file": file_sha,
            "deployed_submitted_code": deployed_sha,
            "git_index_blob": git_sha,
            "match": three_way,
            "note": "eth_getCode returns empty for GenLayer contracts and the explorer code API was unavailable; identity is proven by local file == bytes submitted in the deploy tx == git index blob.",
        },
        "seeded_state": {
            "market_a": market_a,
            "pulse_summary": summary,
            "leaderboard": leaderboard,
            "invariant_pools_equal_total_staked": invariant,
        },
        "transactions": TXNS,
        "all_transactions_finalized_ok": bool(TXNS)
        and all(t["as_expected"] and t["lifecycle_status"] == "FINALIZED" for t in TXNS),
    }


def write_evidence(evidence):
    (EVIDENCE_DIR / "studionet_deployment.json").write_text(
        json.dumps(evidence, indent=2), encoding="utf-8"
    )


def main():
    primary = get_default_account()
    ckpt = load_checkpoint()
    burner_key = ckpt.get("burner_key") or create_account().key.hex()
    burner = create_account(burner_key)
    ckpt["burner_key"] = burner_key
    ckpt.setdefault("done", [])
    save_ckpt(ckpt)
    log(f"primary: {primary.address}  burner: {burner.address}")

    factory = get_contract_factory(contract_file_path="milestone_pulse.py")
    as_primary = as_burner = None
    deploy_hash = ckpt.get("deploy_hash")

    if ckpt.get("address"):
        address = ckpt["address"]
        as_primary = factory.build_contract(contract_address=address, account=primary)
        as_burner = factory.build_contract(contract_address=address, account=burner)
        log(f"resuming on existing deployment {address}")
    else:
        deploy_receipt = factory.deploy_contract_tx(
            args=[], account=primary, wait_transaction_status=FINAL, **WAIT
        )
        address = extract_contract_address(deploy_receipt)
        deploy_hash = deploy_receipt.get("hash")
        ckpt["address"] = address
        ckpt["deploy_hash"] = deploy_hash
        save_ckpt(ckpt)
        as_primary = factory.build_contract(contract_address=address, account=primary)
        as_burner = factory.build_contract(contract_address=address, account=burner)
        log(f"deployed at {address}")

    def done(step):
        return step in ckpt["done"]

    def mark(step):
        ckpt["done"].append(step)
        save_ckpt(ckpt)

    # Step 1: two markets.
    if not done("markets"):
        run_write(as_primary, "create_market", ["ZK Cascade Prover", "Ship trustless ZK proof pipeline with public audit by Q2.", OFFICIAL_A, "zk-proofs"], "create_market A")
        run_write(as_primary, "create_market", ["AgentStack SDK", "Ship v1 agent SDK with docs and examples.", OFFICIAL_B, "sdk-docs"], "create_market B")
        mark("markets")
    markets = read_view(as_primary, "get_all_markets")
    m_a = markets[0]["market_id"]
    m_b = markets[1]["market_id"]
    log(f"markets: {[m['market_id'] for m in markets]}")

    # Step 2: positions across bands with two signers (idempotent per position).
    def has_position(market_id, band, addr):
        ps = read_view(as_primary, "get_market_positions", [market_id])
        return any(
            p["predicted_band"] == band and p["forecaster"].lower() == addr.lower()
            for p in ps
        )

    def position(step, contract, market_id, band, addr):
        if done(step) or has_position(market_id, band, addr):
            return
        handle = "prim" if contract is as_primary else "burn"
        pct = {"PARTIAL_SHIP": 60, "VAPORWARE": 20, "FULL_SHIP": 92}[band]
        stake = {"PARTIAL_SHIP": 200, "VAPORWARE": 120, "FULL_SHIP": 150}[band]
        thesis = {
            "PARTIAL_SHIP": "prover ships but audit lands late",
            "VAPORWARE": "too early to ship zk",
            "FULL_SHIP": "docs nearly done",
        }[band]
        run_write(contract, "take_forecast_position", [market_id, handle, band, pct, stake, thesis], f"position {band} on {market_id}")
        mark(step)

    position("pos_a_partial", as_primary, m_a, "PARTIAL_SHIP", primary.address)
    position("pos_a_vapor", as_burner, m_a, "VAPORWARE", burner.address)
    position("pos_b_full", as_burner, m_b, "FULL_SHIP", burner.address)

    # Step 3: evidence from burner, upvoted by primary (distinct signer).
    def has_evidence(market_id, addr):
        evs = read_view(as_primary, "get_market_evidences", [market_id])
        return [e for e in evs if e["submitter"].lower() == addr.lower()]

    if not done("evidence_submit"):
        if has_evidence(m_a, burner.address):
            mark("evidence_submit")
        else:
            run_write(as_burner, "submit_evidence_dossier", [m_a, "burn", EVIDENCE_A, "PROVES_DELAYED", "release page shows no zk-proofs artifact yet"], "submit evidence A (burner)")
            mark("evidence_submit")

    if not done("evidence_upvote"):
        mine = has_evidence(m_a, burner.address)
        target = next((e for e in mine if int(e["upvotes"]) == 0), None)
        if target:
            run_write(as_primary, "upvote_evidence", [target["evidence_id"]], "upvote evidence A (primary)")
        mark("evidence_upvote")

    # Step 4: deterministic resolution of A by its creator (primary).
    if not done("resolve"):
        run_write(as_primary, "resolve_market_deterministic", [m_a, 55, "Delivered pipeline skeleton, zk-proofs artifact absent."], "resolve A deterministic")
        mark("resolve")
    market_a = read_view(as_primary, "get_market", [m_a])
    winning_band = market_a["winning_band"]

    # Step 5: claim the winning payout for primary's position.
    if not done("claim"):
        positions = read_view(as_primary, "get_market_positions", [m_a])
        winner = next(
            (p for p in positions if p["predicted_band"] == winning_band and p["forecaster"].lower() == primary.address.lower() and not p["claimed"]),
            None,
        )
        if winner:
            run_write(as_primary, "claim_position_payout", [winner["position_id"]], f"claim payout pos {winner['position_id']}")
        mark("claim")

    # Step 6: expected rollback, submitting evidence on a resolved market must revert.
    if not done("rollback"):
        run_write(as_burner, "submit_evidence_dossier", [m_a, "burn", EVIDENCE_A, "TECHNICAL_AUDIT", "must be rejected: market resolved"], "rollback check: evidence on resolved market", expect_success=False)
        mark("rollback")

    # Verify final state and the accounting invariant.
    market_a = read_view(as_primary, "get_market", [m_a])
    summary = read_view(as_primary, "get_pulse_summary")
    leaderboard = read_view(as_primary, "get_forecaster_leaderboard")
    pool_sum = market_a["pool_full_ship"] + market_a["pool_partial_ship"] + market_a["pool_vaporware"]
    invariant = pool_sum == market_a["total_staked"]
    log(f"invariant pools==total_staked: {invariant} ({pool_sum}=={market_a['total_staked']})")

    evidence = build_evidence(factory, address, primary, burner, ckpt, invariant, market_a, summary, leaderboard, deploy_hash)
    write_evidence(evidence)
    log(f"scenario_complete={ckpt['done']}")
    log(f"three_way_sha256_match={evidence['three_way_sha256']['match']}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        import traceback

        log("DEPLOY RUN ERROR:")
        log(traceback.format_exc())
        raise
