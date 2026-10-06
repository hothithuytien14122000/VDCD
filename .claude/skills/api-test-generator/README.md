# API Test Generator Skill

Generate and run API test suites (test-case docs + executable Playwright specs) from domain specs
(UC/ES/CT/PM/EN/VO) and a live Swagger/OpenAPI endpoint.

For the authoritative, step-by-step behavior, see **[SKILL.md](./SKILL.md)** — this file is an
orientation layer on top of it, not a separate workflow.

## Quick Start

### 1. Configure environment

Copy **[.env.example](./.env.example)** to `.env` in `apps/testing/automation-testing/be-testing/`
and fill in your own values. Full variable list + which are required: **SKILL.md → Configuration**.

### 2. Ask Claude

```
/api-test-generator UC-KNW-001
```

or describe the target directly:

```
Generate API tests for UC-GOV-025 (Route DRTP to Decision Queue).
```

Claude will re-glob `specs/**/*.md` and `.specs-0.3/**/*.md` for the driving spec, fetch the live
Swagger schema, write the test-case yaml, write the Playwright spec, and run it.

### 3. What happens

- Discover the driving UC/ES/CT/PM/EN spec(s) for the target (never a cached/assumed path); also
  flags any pre-existing test artifact for the same UC (even a stale `.ps1`/`.md`) instead of
  silently trusting or ignoring it
- Fetch the live Swagger JSON — ground truth for actual parameter names, arity, and shapes
- Write `test-cases/api/{folder}/{name}-test-cases.yaml` (documented coverage matrix below)
- Re-read the driving UC/CT prose sentence by sentence against that file — a coverage self-audit
  that catches clauses collapsed into one test, invariants tested only via their filter mechanism,
  and similar gaps a first AC-by-AC pass tends to miss
- Write `script/api/{folder}/{name}.spec.ts` (Playwright, raw-fetch guardrail, hard assertions)
- Run it (`npx playwright test`) and report pass/fail directly in chat

There is no automatic Azure DevOps posting step — if you want results on a work item, ask
explicitly and Claude will post via the `mgi-devops` MCP server (e.g.
`mcp__mgi-devops__add_work_item_comment`).

## What Gets Generated

```
apps/testing/automation-testing/be-testing/
├── test-cases/api/{folder}/{name}-test-cases.yaml   # test-case documentation
├── script/api/{folder}/{name}.spec.ts               # executable Playwright test
├── lib/http.ts            # apiCall() — raw fetch, redirect:'manual', explicit token
├── lib/assert.ts          # expectStatus/expectError/expectSuccessBody (hard assertions)
├── lib/retell-signature.ts
├── lib/poll.ts
├── report/junit-{timestamp}.xml   # JUnit results, one file per run — never overwritten
├── report/html-{timestamp}/       # Playwright HTML report, one folder per run
├── playwright.config.ts
└── .env
```

`{folder}`/`{name}` naming rule (kebab-case derivation from the ADO User Story title / driving
spec's own id+title): **SKILL.md → Configuration, "`{name}` derivation"**.

## Test Coverage

Happy path, negative, boundary, state transitions, authorization, Doc Conformance (mandatory on a
grammar-0.4 CT), combined filters, default values, and functional pagination — full matrix +
mechanical derivation rules for grammar-0.4 CTs: **SKILL.md → Step 4** and **→ Grammar 0.4 CT
Awareness**.

## Run Tests Manually

From `apps/testing/automation-testing/be-testing`:

```bash
npx playwright test "script/api/{folder}/{name}.spec.ts"   # one file
npx playwright test --grep @gov                            # by BC tag
./node_modules/.bin/playwright test --list "<file>"         # sanity-check before a live run
```

Tag taxonomy (BC / auth-scheme / case-type tags): **SKILL.md → Step 6, "Tags (CI selection)"**.

## Troubleshooting

**Swagger not reachable:**
```bash
curl "$SWAGGER_URL"
```

**Auth errors** — verify the token manually:
```bash
curl -H "Authorization: Bearer $API_AUTH_TOKEN" "$API_BASE_URL/knowledge/sops"
```

**Playwright not installed:**
```bash
cd apps/testing/automation-testing/be-testing
npm install -D @playwright/test
npx playwright install
```

## Customizing

Edit **[SKILL.md](./SKILL.md)** directly to change: test-case template shape, assertion patterns
(`lib/assert.ts`), file/folder naming, or tag taxonomy. Edit `playwright.config.ts` (in `be-testing/`)
for timeouts/retries/worker count.

## A Note on the `scripts/` Folder

`scripts/` used to also hold `generate_test_cases.py`, `fetch_swagger.py`, `run_workflow.py`,
`convert_md_to_html.py`, and `report.py` — a legacy CLI orchestrator predating the current
Playwright-direct workflow described in SKILL.md (the current flow has Claude read specs, fetch
Swagger, and write `test-cases/*.yaml` + `*.spec.ts` directly, no Python orchestration step or
Markdown→HTML conversion). Removed 2026-08-25: none were invoked by the current flow,
`run_workflow.py` imported `python-dotenv` (not installed in this repo, so it crashed immediately),
and its own `generate_test_scripts`/`format_report`/`post_to_azure_devops` steps were themselves
unfinished stubs. See git history for the old implementation if it's ever needed for reference.

**`scripts/execute_and_report.py` is the one script that remains** — an optional local helper Claude may run
after `npx playwright test` to produce a standard-format GO/NO-GO markdown summary
(`report/test-report.md` + `.json`) from that run's `report/test-results.json`. It does **not**
post to Azure DevOps itself: run it with `python3 scripts/execute_and_report.py [--work-item-id N]`
from the repo root, then Claude reads the generated `test-report.md` and posts it via the
`mgi-devops` MCP server (e.g. `mcp__mgi-devops__add_work_item_comment`) only when the user
explicitly asks — same "no automatic ADO posting" behavior as the rest of
this skill, just with a consistently-formatted summary instead of an ad hoc one.

## Documentation

- **[SKILL.md](./SKILL.md)** — complete, authoritative skill instructions
- **[EXAMPLES.md](./EXAMPLES.md)** — confirmed-live evidence backing SKILL.md's rules (read on
  demand, not on every invocation — SKILL.md points to the relevant section by name)
- **[REFERENCE.md](./REFERENCE.md)** — the drift-classification table, YAML test-case template,
  and Playwright spec skeleton (read on demand — SKILL.md points to the relevant section by name)
- **[USAGE.md](./USAGE.md)** — quick usage guide (Vietnamese)
- **[.env.example](./.env.example)** — configuration template

---

**Last Updated:** 2026-08-26
