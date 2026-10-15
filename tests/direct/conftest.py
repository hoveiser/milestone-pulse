"""Shared helpers for direct-mode tests of MilestonePulse."""

import json

import pytest

CONTRACT_PATH = "contracts/milestone_pulse.py"

OFFICIAL_URL = "https://roadmap.example.com/milestone/alpha"
COMMUNITY_URL = "https://github.example.com/alpha/releases/tag/v0.9"


@pytest.fixture
def pulse(direct_deploy):
    return direct_deploy(CONTRACT_PATH)


@pytest.fixture
def open_market(pulse, direct_vm, direct_owner):
    """A market created by owner, returns its id."""
    direct_vm.sender = direct_owner
    return pulse.create_market(
        "Alpha Layer",
        "Ship mainnet alpha with staking module and audits by Q3.",
        OFFICIAL_URL,
        "staking-module",
    )


def resolution_body(completion_pct: int, token_verified: bool, summary: str = "audited") -> str:
    return json.dumps(
        {
            "completion_pct": completion_pct,
            "token_verified": token_verified,
            "summary": summary,
        }
    )


@pytest.fixture
def mock_resolver(direct_vm):
    """Mocks proof web content and the auditor LLM for resolve_market_live."""

    def _mock(completion_pct: int, token_verified: bool):
        direct_vm.mock_web(
            r".*roadmap\.example\.com.*",
            {"status": 200, "body": "Release notes: alpha shipped with partial modules."},
        )
        direct_vm.mock_web(
            r".*github\.example\.com.*",
            {"status": 200, "body": "Community audit: some deliverables missing."},
        )
        direct_vm.mock_llm(
            r".*technical delivery auditor.*",
            resolution_body(completion_pct, token_verified),
        )

    return _mock
