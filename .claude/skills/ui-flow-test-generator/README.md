# UI Flow Test Generator Skill

Generate and execute UI E2E test cases from a domain **spec** + a **page URL** (or local HTML) using Playwright, then post the report to Azure DevOps — end to end, automatically.

> **Core principle — Spec is the Oracle.** This is *conformance* testing: it catches where
> the spec mandates X but the dev built Y. Every assertion's *expected value* comes from the
> spec, never from the deployed app or the dev's source. A spec-grounded assertion that fails
> is a **finding (a bug)**, not a test to relax. See `SKILL.md` → "Core Principle".

---

## Quick Start

### 1. Configure

Copy [`.env.example`](.env.example) to `apps/testing/automation-testing/fe-testing/.env` and fill it in. Minimum:

```env
UI_BASE_URL=https://dev-cc-mgios.4mgi.com/     # Playwright baseURL
# SPEC_FILE is the VIF, and nothing else — Step 2a resolves the CT/ES/EN it needs from
# the VIF's own depends_on (0.4 first, 0.3 fallback flagged). Never re-list them here.
SPEC_FILE=specs/mgi-actors/VIF-ACT-002_Conversation_Lifecycle.md
# SPEC_FILES=a.md,b.md  — legacy; only for a file the VIF does NOT declare (QC plan, design doc)
PAGE_URL=actors/conversations                  # root-relative; host comes from UI_BASE_URL
WORK_ITEM_ID=145235                            # Azure DevOps User Story id
FEATURE_SCOPE=Conversation Lifecycle           # feature to scope to (multi-spec)
BACKEND_MODE=real                              # real = live API | mock = MSW fixtures
# UI_AUTH_USERNAME / UI_AUTH_PASSWORD          # only for pages behind login
```

`PAGE_URL` is **root-relative** — the same suite runs against dev / staging / local just by
changing `UI_BASE_URL`. Never hard-code the host in generated artifacts.

### 2. Run

```
/ui-flow-test-generator
```

or in Vietnamese: `Tạo UI test cho màn Conversation từ spec + page URL trong .env`.

### 3. What it does (Steps 1–12)

1. **Analyze page** (`analyze_page.py`) → `element-map.json` (fields, buttons, Select/popover triggers…)
2. **Synthesize spec** → `spec/ui/{feature}-spec.yaml` (business rules, oracles)
3. **Generate test cases** → `test-cases/ui/{feature}-test-cases.yaml`
4. **Evaluate quality** (`evaluate_quality.py`) — 7 dimensions + gates below; auto-improve if < 4.0
5. **Auth / preflight / seed** (real mode) → login session, backend reachability, seed fixtures
6. **Generate scripts** (`generate_scripts.py`) → `script/ui/{feature}.spec.ts`
7. **Execute** against `UI_BASE_URL` (Playwright)
8. **Report** → `report/ui/{date}/{feature}/ui-report.md` + `.html`
9. **Post to Azure DevOps** User Story, then confirm GO/NO-GO

> Full step-by-step (with every flag) lives in **`SKILL.md`** — this README is the overview.

---

## What Gets Generated

```
apps/testing/automation-testing/fe-testing/
├── spec/ui/{feature}-spec.yaml       ← synthesized spec (the oracle)
├── test-cases/ui/{feature}-test-cases.yaml        ← test case definitions
├── script/ui/{feature}.spec.ts                    ← Playwright script
└── report/ui/{YYYY-MM-DD}/{feature}/
    ├── ui-report.md                               ← consolidated report
    └── ui-report.html                             ← posted to Azure DevOps
```

---

## Quality Gate (Step 4.5)

`evaluate_quality.py` scores 7 dimensions and **blocks** (auto-improve loop) when a dimension < 3:

| # | Dimension |
|---|-----------|
| 1 | User Flow Coverage |
| 2 | Validation / Unhappy-path & Error Coverage |
| 3 | Navigation Coverage |
| 4 | State / Interaction Coverage — **incl. widget-render gate** |
| 5 | Test Data Realism |
| 6 | Authorization Coverage |
| 7 | Clarity & Traceability — **incl. oracle-strength linter** |

Two gates target defects that live *below* the spec (a purely spec-driven suite is blind to them),
so `--element-map element-map.json` is always passed:

- **Widget-render gate (dim 4):** every interactive Select / dropdown / popover / combobox on the
  page needs ≥1 *render-invariant* TC — e.g. the trigger shows a human-readable **label**, not the
  raw enum index `"0"`; an overlay opens **visible + non-empty + anchored**. See
  [`references/ui-render-invariants.md`](references/ui-render-invariants.md).
- **Oracle-strength linter (dim 7):** flags **vacuous** oracles ("matches spec", assert-only-an-absence
  on a read flow), **tuned-to-dev** oracles (a UI string asserted that is absent from the spec), and
  **invented fields** (a field in neither the spec nor the DOM). A green suite built on hollow oracles
  proves nothing — this keeps assertions spec-grounded.

---

## Test Case Coverage

| Category | What it tests |
|----------|---------------|
| Happy Path | Complete user flow end-to-end |
| Required / Format / Boundary | Empty required, invalid format, min-1/min/max/max+1 (form pages) |
| Navigation | Redirect, back/cancel, breadcrumbs |
| State / Interaction | Modals, dropdowns, conditional visibility, **widget-render invariants** |
| Authorization | Unauthenticated redirect, role-based visibility |
| Exception / Enforcement | 404/403/5xx states, domain-invariant guards (negative TCs) |
| Layout / Overflow | Long no-space values stay within bounds; clipped-scroll sweep |

---

## GO/NO-GO

Report Section 1 verdict, from `_go_decision`: **GO** = 0 failures · **CONDITIONAL** = ≥80% pass with
failures · **NO-GO** < 80%. (Skipped tests — `spec_only`, feature-disabled — are not counted as failures.)

---

## Manual Execution

```bash
cd apps/testing/automation-testing/fe-testing
npx playwright test script/ui/{feature}.spec.ts --project="UI Tests" --retries 1
```

HTML report conversion (own converter):

```bash
python3 .claude/skills/ui-flow-test-generator/scripts/convert_md_to_html.py \
  apps/testing/automation-testing/fe-testing/report/ui/{date}/{feature}/ui-report.md \
  --output apps/testing/automation-testing/fe-testing/report/ui/{date}/{feature}/ui-report.html
```

---

## Playwright Config (`UI Tests` project)

The skill ensures `playwright.config.ts` keeps a `setup` + `UI Tests` project (and does not remove
`API Tests`):

```typescript
{
  name: 'UI Tests',
  testDir: './script/ui',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.UI_BASE_URL || 'http://localhost:4200',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
}
```

---

## Supported Inputs

| Input | Example |
|-------|---------|
| Live page | `actors/conversations` (root-relative) → resolved against `UI_BASE_URL` |
| Local HTML | `file:///abs/path/to/prototype.html` |
| Spec | `SPEC_FILE=specs/mgi-actors/VIF-ACT-002_Conversation_Lifecycle.md` — the VIF only |
| Extra non-declared spec | `SPEC_FILES=<vif>,qc-plan.md` + `FEATURE_SCOPE` (legacy path) |
| Spec roots / grammar | `SPEC_ROOTS=specs/platform,specs/foundry,.specs-0.3` · `SPEC_GRAMMAR=prefer-0.4\|0.4-strict` |
