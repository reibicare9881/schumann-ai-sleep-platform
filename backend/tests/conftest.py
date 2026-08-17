"""Suite-wide test wiring.

Two things happen here before any test module is imported:

1. Every Supabase and secret environment variable is pinned to an obviously
   fake value.  ``backend/.env`` points at the shared production project, and
   pydantic-settings lets real environment variables win over the dotenv file,
   so this is what keeps a stray test from writing to it.
2. ``supabase.create_client`` is replaced with an in-memory double.  The REIBI
   routers capture their client in a closure at import time, so the swap has to
   land before ``import main``.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
TESTS_ROOT = BACKEND_ROOT / "tests"
for path in (BACKEND_ROOT, TESTS_ROOT):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

# --- 1. Pin the environment before config.Settings is instantiated ----------
os.environ.update(
    {
        "GEMINI_API_KEY": "test-gemini-key-not-real",
        "JWT_SECRET_KEY": "test-jwt-signing-key-with-enough-length-0123456789",
        "SUPABASE_URL": "http://supabase.invalid",
        "SUPABASE_SERVICE_ROLE_KEY": "test-service-role-key-not-real",
        "FRONTEND_URL": "http://localhost:3000",
        "DEBUG": "true",
        "LINE_CHANNEL_ACCESS_TOKEN": "",
    }
)

import pytest  # noqa: E402
import supabase as supabase_module  # noqa: E402

from support.fake_supabase import FakeSupabaseClient  # noqa: E402
from support.identities import TokenFactory, TrustedSessionRegistry  # noqa: E402

# --- 2. Every create_client call in the process returns the same double -----
SHARED_FAKE_CLIENT = FakeSupabaseClient()


def _fake_create_client(*_args, **_kwargs) -> FakeSupabaseClient:
    return SHARED_FAKE_CLIENT


supabase_module.create_client = _fake_create_client

import auth  # noqa: E402
import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

SHARED_SESSION_REGISTRY = TrustedSessionRegistry()
# main.py installs the real validator at import; replace it for the whole suite.
auth.configure_trusted_session_validator(SHARED_SESSION_REGISTRY.validate)


@pytest.fixture(autouse=True)
def _isolate_state():
    """Guarantee each test starts with an empty database and no leftover auth."""
    SHARED_FAKE_CLIENT.reset()
    SHARED_SESSION_REGISTRY.clear()
    main.app.dependency_overrides.clear()
    auth.configure_trusted_session_validator(SHARED_SESSION_REGISTRY.validate)
    yield
    main.app.dependency_overrides.clear()
    SHARED_FAKE_CLIENT.reset()
    SHARED_SESSION_REGISTRY.clear()


@pytest.fixture
def fake_supabase() -> FakeSupabaseClient:
    return SHARED_FAKE_CLIENT


@pytest.fixture
def sessions() -> TrustedSessionRegistry:
    return SHARED_SESSION_REGISTRY


@pytest.fixture
def tokens() -> TokenFactory:
    return TokenFactory(SHARED_SESSION_REGISTRY)


@pytest.fixture
def client() -> TestClient:
    with TestClient(main.app) as test_client:
        yield test_client
