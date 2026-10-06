"""Backend-mode configuration for generate_scripts.py.

Two configs differ only in runtime behavior; structural code is shared.
Add new mode-specific knobs as keys here — keep dicts small and obvious.
"""

MOCK_CONFIG = {
    # Even in mock mode the deployed shell keeps next-auth / websocket / telemetry
    # sockets open, so networkidle can hang to timeout — wasted wall-clock that hurts
    # most under the CI runner's 1-worker sequential shards. Gate on 'load' instead;
    # assertions auto-wait to T regardless, so settling early never passes a test early.
    'settle_wait_ts': "await page.waitForLoadState('load', { timeout: 5000 }).catch(() => {})",
    'assert_timeout_ms': 5000,
    # In mock mode the success toast is deterministic — assert it exactly.
    # Generator emits this as the regex literal for end-to-end submit TCs.
    'submit_success_regex': '/recorded successfully|created successfully|saved successfully/i',
    # In mock mode we never skip a TC for missing fixture — MSW provides it.
    'skip_fixture_tcs': False,
}

REAL_CONFIG = {
    # SPAs with next-auth / websockets / telemetry never reach networkidle.
    # 'load' + short timeout fires once DOMContentLoaded + initial resources are done.
    'settle_wait_ts': "await page.waitForLoadState('load', { timeout: 5000 }).catch(() => {})",
    'assert_timeout_ms': 15000,
    # Real backend may be down (502/503) — tolerant regex still validates UI rendered
    # *some* deterministic feedback. Frontend bugs (silent fail) still cause TC fail.
    'submit_success_regex': '/recorded|saved|created|failed to|error|status code/i',
    'skip_fixture_tcs': True,
}


def get_config(backend_mode: str) -> dict:
    """Return config dict for the given mode. Defaults to mock."""
    return REAL_CONFIG if backend_mode == 'real' else MOCK_CONFIG


# Per-step skip matrix keyed on (backend_mode, data_dependency).
# Value is the skip reason emitted into the generated spec, or None when
# the step is compatible with the active backend mode.
#
# Tag semantics:
#   any        - assertion holds under either backend (structural / format / role)
#   seed       - needs real data via seed API (real-only)
#   fixture    - needs MSW or page.route mock fixture (mock-only)
#   mock-only  - reserved for future "page.route stub only, no MSW" split;
#                currently behaves identically to fixture.
TAG_SKIP_RULES = {
    ('real',  'any'):       None,
    ('real',  'seed'):      None,
    ('real',  'fixture'):   'fixture-only TC: needs MSW/page.route mock fixture',
    ('real',  'mock-only'): 'mock-only TC: needs page.route stub (network error / timeout)',
    ('mock',  'any'):       None,
    ('mock',  'seed'):      'seed-data TC: needs real backend with API seeding',
    ('mock',  'fixture'):   None,
    ('mock',  'mock-only'): None,
}


def should_skip(backend_mode: str, data_dependency: str):
    """Return skip reason string, or None if TC should run.

    Unknown (mode, dep) pairs default to None (do not skip) — keep generator
    permissive so a typo in a spec never silently nukes a TC.
    """
    return TAG_SKIP_RULES.get((backend_mode, data_dependency))
