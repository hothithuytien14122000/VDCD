---
name: uc-ui-testcase-generator
description: Generate QA test cases (as a styled .xlsx, same format as testcases-xlsx/*.xlsx in this repo) from a Vietnamese UC (use case) markdown spec, cross-checked against the real UI of a live webpage so field names, labels and error messages come from what is actually on screen, not from imagination. Use whenever the user asks to write/generate/export test cases (viet testcase, sinh test case, tao testcase, xuat test case ra excel) for a UC file, a screen, or a feature in this repo — trigger even on a short request like "viet test case cho UC1.1" or "tao testcase cho man hinh dang nhap" that names no categories. Chooses which test-case categories (positive, negative, boundary value, equivalence, required-field, data validation, business logic, decision table, permission, UI/UX, state transition, integration, persistence, error handling, security, regression, compatibility, performance) actually apply to each function instead of forcing all of them onto every function. Also handles turning the generated .md test cases into a runnable Playwright script and executing it (gen script tu TC md, chay test) — use that path when asked to automate/chay/run the test cases, not just write them. No HTML report file and no Azure DevOps posting; for that heavier, spec-driven pipeline use ui-flow-test-generator instead.
compatibility: Requires python3 + openpyxl for the .xlsx output. Needs Playwright (playwright + a chromium binary) only when the target page is a live http(s) URL; a file:// page needs no browser.
---

# UC + UI Test Case Generator

## Core rule

Expected values come from the UC only (BR-x, flow step, Field Spec row) — if the UC
doesn't say it, mark the TC `[CAN XAC NHAN]` instead of guessing. Field
names/selectors/error text come from the live element map (Step 2) only — if
`PAGE_URL` wasn't given, say so in Step 7 instead of reusing UC wording as fact. Any
UC-vs-UI mismatch is reported, never silently resolved either way.

## Workflow

### Step 0 — Resolve inputs

Ask only for what's missing (one batched question), never ask for a password in chat:

| Input | Required | Notes |
|---|---|---|
| `UC_FILE` | Yes | `UC<n>.<m>_*.md` in `docs/` |
| `PAGE_URL` | No | Omit → UC-only generation, weaker grounding, say so in Step 7 |
| `BASE_URL` | If `PAGE_URL` is http(s) | Site origin |
| `UI_AUTH_USERNAME`/`UI_AUTH_PASSWORD`/`LOGIN_URL` | If login needed | From `.env`, see `reference/scripts-and-env.md` |
| `OUT_XLSX` | No | Default `testcases-xlsx/{feature-slug}-test-cases.xlsx` (`UC1.1_Dang-nhap-he-thong.md` → `uc1-1-dang-nhap-he-thong`). `.md` twin always `Testcase/{feature-slug}-test-cases.md` |

### Step 1 — Parse the UC

Pull out: Business rules (`BR-x`), Pre/Post-condition, Actor, Trigger, Basic/Alt/Exception
Flow steps, the "Màn hình" table, and the Field Specification table (main source for
Required/Validation/BVA/EP). Anything the UC already flags `[Cần xác nhận]` stays
unconfirmed in your output too.

### Step 2 — Capture the real UI

Skip if no `PAGE_URL`.

```bash
# Only if login is required:
python3 .claude/skills/uc-ui-testcase-generator/scripts/login_and_capture.py --url $FULL_URL --out authed-page.html
python3 .claude/skills/uc-ui-testcase-generator/scripts/analyze_page.py --url authed-page.html --out element-map.json
# No login needed (public page or file://):
python3 .claude/skills/uc-ui-testcase-generator/scripts/analyze_page.py --url "$PAGE_URL" --out element-map.json
```

`element-map.json` lists every input/select/textarea/button on the page. Flags/.env:
[reference/scripts-and-env.md](reference/scripts-and-env.md).

**Prefer text over screenshots — a screenshot costs far more tokens than text.** Use
`element-map.json`, `page.$(...)`/`innerText()`/button-exists checks for anything a
string or boolean answers (does this field exist, what's its placeholder, did the row
count change). Only take an actual screenshot when the fact is inherently visual and
no text check can get it — a badge's color, an icon's presence, confirming an unknown
screen's overall layout — or to read a captcha. When exploring an unfamiliar screen,
reach for text/HTML first; screenshot only the specific thing text couldn't answer.

### Step 3 — Reconcile UC vs captured UI

Field in both → grounded, proceed. Field in UC only → keep it but mark `[CAN XAC NHAN]`
+ say what couldn't be located. Element live but not in UC → note it, only make a TC if
its purpose is obvious, otherwise leave out rather than invent its meaning.

### Step 4 — Decide categories per function

A function only gets categories that actually apply — forcing all of them onto a
static screen buries the TCs that would catch a real bug. Walk this table per function
(a row in the UC's "Truy vết chức năng" table, or a Basic Flow); keep only rows where
"Apply when" holds:

| Category | Apply when | Skip when |
|---|---|---|
| Positive | Always | Never |
| UI/UX | Always (labels, states, success/error display) | Never |
| Negative | Any input/action can be misused | Pure static display |
| Required Field | A Field Spec row has `Required = Yes` | None do |
| Data Validation | A field has a declared rule (format/length/char/dup) | No rule stated |
| Boundary Value Analysis | A field has a numeric/length/date min-max | No bounded field |
| Equivalence Partitioning | Multiple valid input classes, different behaviour | One free-text field, one behaviour |
| Business Logic | A testable `BR-x` exists | BR is purely descriptive |
| Decision Table | ≥2 independent conditions, combined outcomes | One linear flow |
| Permission/Authorization | UC names different roles for this function | Same for every actor |
| State Transition | Explicit status field, multiple states | No status field |
| Integration | Hands off to another UC/module/external system | Self-contained |
| Data Persistence | Creates/updates/deletes data that should survive reload | View/filter only |
| Error Handling | Backend call, failure simulable safely (mark if needs a mock) | No backend dep, or unsafe to trigger |
| Security | Auth, sensitive data, or direct-URL/role-bypass | No access-control angle |
| Regression | Only on explicit "something changed, re-baseline" request | Default: never |
| Compatibility/Responsive | UC states a multi-device/browser requirement | Not stated — `[CAN XAC NHAN]`, don't guess |
| Performance | UC states a response-time/load requirement | Not stated — same |

Note which categories you skipped per function and why — goes in Step 7, not the sheet.

### ⛔ Mandatory — exhaustive coverage of every small enumerable field

Applies anywhere, not just filters: status dropdowns, role/group pickers, radio
groups, a related set of checkboxes (e.g. BR-4's two defaults). A sampled value is
exactly the one that turns out broken, and a skipped value is invisible in the
output — tested-and-passing looks identical to never-tested. So, for every such
field in the UC/UI:

1. Find it — not just ones literally labelled "filter": every form dropdown, filter
   bar, radio group, checkbox set, status field.
2. Write its full value set, grounded the same way as everything else (UC enum/BR, or
   `element-map.json`/live dropdown read). Unconfirmed value → `[CAN XAC NHAN]`, never
   silently dropped.
3. "Small" = exhausting it is reasonable (~8–10 values) and each value differentiates
   observable behaviour — *not* a large reference dataset (provinces, org pickers);
   say so explicitly when you choose to sample instead.
4. Only write one-per-value when values actually differ in outcome (a filter changes
   rows, a status flips a badge/unlocks actions). If every value behaves the same
   (e.g. a form dropdown that just stores the pick), one representative TC is enough —
   say so rather than padding.
5. For a qualifying set: one TC per value, **plus** one TC for clearing it back to
   default — clearing is a separate assertion from setting any one value.
6. A related group of binary controls (≥2 checkboxes whose combination matters) is a
   Decision Table: every combination with a distinct outcome, not just all-on/all-off.
7. Report per-field coverage in Step 7 (`N/N gia tri da co TC`).

### Step 5 — Write the test case items

```python
dict(
    id="TC_<UC-id>_<NNN>",       # e.g. TC_UC1.1_001 — zero-padded 3-digit, sequential per UC
    title="<short Vietnamese-without-diacritics title>",
    pre="<preconditions>",
    steps="1. ...\n2. ...",
    expected="<expected result, grounded in the UC/BR and the real UI wording>",
    priority="Cao" | "Trung binh" | "Thap",
)
```

Group under function into `BLOCKS` (matches `workspace/ui-tests-self-assessment/testcases_data_*.py`):

```python
BLOCKS = [{"function": "<function name> (UC-id)", "items": [ ...dicts above... ]}, ...]
```

ASCII only, no diacritics — matches every existing `testcases-xlsx/` file. Full column
meaning/styling: [reference/testcase-format.md](reference/testcase-format.md). Save
`BLOCKS` + `group_title`/`group_subtitle` as JSON (shape in the same reference file).

### Step 5.5 — ⛔ Self-review before rendering

Do this before Step 6, not after the user asks "did you cover everything":

1. Every `BR-x` → at least one TC references it. List any with zero hits.
2. Every `EF-x` → at least one TC.
3. Every `AF-x` → at least one TC, including a cancel/"Huỷ" TC per modal/popup it
   applies to, not one overall.
4. Every row in the UC's "Truy vết chức năng" table → a function block in `BLOCKS`.
5. Every enumerable field from the Mandatory section → actually has one TC per value
   written, not just noted.
6. Every `[CAN XAC NHAN]` item → would a cheap, safe, non-mutating live check (open a
   dropdown, read its options, open a read-only detail view) resolve it right now with
   the session already open? Only stay `[CAN XAC NHAN]` when resolving needs something
   unsafe (mutating shared data), unavailable (second account, a mock), or genuinely
   ambiguous (two valid designs).

Fix every gap immediately (add the TC, or write the specific exclusion reason) and
re-run the list once — don't stop at the first pass.

### Step 6 — Render the .xlsx and the .md

Always generate both from the same JSON, never hand-write either:

```bash
python3 .claude/skills/uc-ui-testcase-generator/scripts/render_xlsx.py \
  --in /path/to/blocks.json --out "$OUT_XLSX" --group-title "<GROUP TITLE>" --sheet-name "<SheetName>"
python3 .claude/skills/uc-ui-testcase-generator/scripts/render_md.py \
  --in /path/to/blocks.json --out "Testcase/{feature-slug}-test-cases.md"
```

`.xlsx` = QA execution tracker, reuses the existing `testcases-xlsx/*.xlsx` styling
(banners, STATUS dropdown, Index sheet) — don't hand-roll a different look. `.md` =
plain-text git-diffable twin, same grouping, no STATUS column.

### Step 7 — Summary

In chat only (not the sheet/.md): total TC count, category breakdown, skipped
categories per function + reason, every `[CAN XAC NHAN]` item, per-enumerable-field
coverage (`N/N gia tri da co TC`), **the Step 5.5 audit result** as a line (e.g. "Da
soat: 6/6 BR, 3/3 EF, 6/6 AF, 9/9 chuc nang — khong con khoang trong"), and both output
paths. If Step 2 was skipped, say field names/selectors are UC-only, unverified live.

### Step 8 — Generate a Playwright script (only when asked)

Write the `.spec.ts` by hand (same grounding rules as Step 5, no mechanical parser).
Save to **`Test Script/{feature-slug}.spec.ts`** at the repo root (sibling to
`Testcase/`, `testcases-xlsx/`). Follow the pattern in
`workspace/survey-api-tests/tests/users-management.spec.ts`: `test.describe` →
`test.skip(!fs.existsSync(AUTH_STATE_PATH), …)` → `test.use({ storageState: AUTH_STATE_PATH })`
→ `beforeEach` calling `applySessionStorage(context)` before `page.goto`, importing
both from `./helpers/ui` (that path only resolves once copied into `tests/` — see
Step 9, never written relative to `Test Script/`).

- One `test()` per TC with a concrete expected result, named with its `id`.
  `[CAN XAC NHAN]` → `test.skip(true, 'CAN XAC NHAN: <why>')`, never a guessed assert.
- Selectors from `element-map.json`/live capture only, never guessed.
- Mutating TCs use a disposable record (own unique marker), never an existing row.

### Step 9 — Run it

`Test Script/` has no `node_modules`, so a file there can't resolve `@playwright/test`
(Node resolves imports by the file's own location, not a config's `testDir`). It's the
saved copy of record; running always goes through a temporary copy inside the project:

1. **Copy in**: `cp "Test Script/{feature-slug}.spec.ts" "workspace/survey-api-tests/tests/{feature-slug}.spec.ts"`
2. **Refresh session if stale** (redirects to `/login`):
   ```bash
   NODE_PATH="$(pwd)/workspace/survey-api-tests/node_modules" \
     node .claude/skills/uc-ui-testcase-generator/scripts/refresh_session_headless.js \
     --out-dir workspace/survey-api-tests/.auth --env-file workspace/ui-tests-self-assessment/.env
   ```
   Run in background; read the captcha screenshot it prints, write the answer to the
   file it's waiting on (same handshake as live-UI exploration).
3. **Run**, from `workspace/survey-api-tests`: `npx playwright test tests/{feature-slug}.spec.ts --reporter=list`
   (`--reporter=list` overrides the config's default HTML report — no report file).
4. **Delete the copy**, always: `rm "workspace/survey-api-tests/tests/{feature-slug}.spec.ts"`.
   `Test Script/` stays the only persistent copy — fix the original there, re-copy,
   re-run; never edit the `tests/` copy directly.
5. **Summarize in chat only**: pass/fail/skip counts + TC id and reason per failure. No
   report artifact, no xlsx STATUS write-back.

## Reference files

- [reference/testcase-format.md](reference/testcase-format.md) — BLOCKS/JSON shape,
  xlsx columns, styling. Read before Step 5/6.
- [reference/scripts-and-env.md](reference/scripts-and-env.md) — `.env` keys, script
  flags, login/capture troubleshooting. Read before Step 2.
