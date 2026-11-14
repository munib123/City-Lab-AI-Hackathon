import pytest


@pytest.fixture(autouse=True)
def _tests_never_touch_a_real_database(monkeypatch):
    """Even if SUPABASE_* variables exist on the machine, tests must not write to the real project."""
    for name in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"):
        monkeypatch.delenv(name, raising=False)
