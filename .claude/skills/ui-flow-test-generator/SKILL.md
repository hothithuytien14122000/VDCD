---
name: ui-flow-test-generator
description: Generate and execute UI E2E test cases from spec + page URL/HTML, then auto-report to Azure DevOps. Use when asked to create UI tests, validate user flows, or test from a page/prototype/HTML file. Reads spec file for business rules. Auto-completes full workflow - analyze, generate, evaluate, execute, report.
compatibility: Requires python3 + pyyaml, Node/Playwright with a chromium binary, and the azure-devops MCP server.
---

# UI Flow Test Generator

## ⛔ Spec-version contract — checked here first

Every generated artifact must name the **one VIF revision** its oracles came from.
A suite that cannot be tied to a revision cannot later be shown to be stale, so
"the tests pass" and "the spec is met" stop being the same claim.

| Hop | Field | Enforced by |
| --- | --- | --- |
| VIF frontmatter | `version:` + `grammar:` — **the only authority** | `resolve_specs.py` prints a paste-ready block at 2a |
| `spec/ui/{feature}-spec.yaml` | `vif_id` · `vif_version` · `vif_grammar` | `generate_test_cases.py` **exits 1** if absent |
| `test-cases/ui/{feature}-test-cases.yaml` | same three keys, at the top of the file | emitted automatically by that script |
| `script/ui/{feature}.spec.ts` | `// SPEC UNDER TEST: <id> v<ver> (grammar <g>)` banner, line 1 | `generate_scripts.py` **exits 1** if the yaml has no block |
| final report | **Spec Version** row in Section 1 Overview | `generate_report.py` — prints ⚠️ UNATTRIBUTED rather than omitting |

Rules:
- **Never re-type the version.** Not from memory, not from a `spec_ref` string, not from a
  git log. Copy the block `resolve_specs.py` prints.
- **VIF has no `version:`** → STOP and ask PnC to version it. An invented version is worse
  than none: it makes a stale suite look attributable.
- **grammar 0.3 VIF is allowed**, never silent: `grammar_fallback: true` lands in the yaml, a
  ⚠️ paragraph in the spec.ts banner, and a coverage caveat beside the report verdict — the
  0.4-only columns (ES `## Properties` constraints, CT `ValidationTier`/`Binding`, `Error
  Responses` `Applies To`) were unavailable, so guard coverage there is prose-derived.

## Env Variables

| Variable | Required | Default | Meaning |
| --- | --- | --- | --- |
| `SPEC_FILE` | Yes\* | — | **Path to the VIF, and nothing else.** Every other spec is resolved from its `depends_on` by `resolve_specs.py` at Step 2a. \*Either `SPEC_FILE` or `SPEC_FILES`. |
| `SPEC_FILES` | No | — | Legacy comma-separated list. Use only to add a file the VIF does **not** declare (a QC plan, a design doc). Never re-list the CT/ES/EN/UC/PM the VIF already depends on. |
| `SPEC_ROOTS` | No | `specs/platform,specs/foundry,.specs-0.3` | Spec roots in priority order — 0.4 first, 0.3 as a recorded fallback. Neither tree is a superset. |
| `SPEC_GRAMMAR` | No | `prefer-0.4` | `prefer-0.4` falls back to 0.3 and flags it; `0.4-strict` HALTS instead. |
| `FEATURE_SCOPE` | No | — | Suite name when `SPEC_FILES` spans several features. Unset → inferred from `PAGE_URL` or asked. |
| `PAGE_URL` | Yes | — | **Root-relative** path (`/strategy/initiatives`) or a `file://` path. Host comes from `UI_BASE_URL` — never hard-code it here. |
| `UI_BASE_URL` | Yes\* | — | Playwright `baseURL`. \*Not needed for `file://`. |
| `WORK_ITEM_ID` | Yes | — | Azure DevOps User Story ID. |
| `UI_AUTH_USERNAME` | No | — | Triggers the auto-login step. |
| `UI_AUTH_PASSWORD` | No | — | Never asked in chat — the user fills it in `.env` by hand. |
| `LOGIN_URL` | No | `UI_BASE_URL/auth/signin` | Override the login page URL when it is not `/auth/signin`. |
| `UI_AUTH_TENANT` | No | — | Sign-in tenant field. Missing → the session lands on `/unauthorized`. Usually `root`. |
| `TESTING_ROOT` | No | `apps/testing/automation-testing/fe-testing` | Working dir for all relative output paths. |
| `BACKEND_MODE` | No | `mock` | `mock` \| `real`. Auto-detected at Step 6b. |
| `AUTH_STORAGE_STATE` | No | `.auth/user.json` | Session cache path. |
| `HEADLESS` | No | `true` | |
| `ADO_REPORT` | No | `on` | `off` = local-only run (skips Step 0c + Step 11). |

Full key list with inline notes: `.env.example` (authoritative — read it at Step 0a, never guess from memory).

## URL Convention (#143582)

Generated artifacts (`{feature}-test-cases.yaml`, `{feature}.spec.ts`) MUST use **root-relative** paths so the same suite runs against dev/staging/local by changing `UI_BASE_URL` only.

| Where | URL form |
| --- | --- |
| **Step 3** — `analyze_page.py` / `login_and_capture.py` | **Full URL** = `UI_BASE_URL` + `PAGE_URL` (standalone browser, no `baseURL`) |
| **Steps 4 / 6** — `--page-url` | Pass relative `$PAGE_URL`; generators auto-relativize via `to_relative_url()` |

> ❌ Never hard-code the deployment host in any `*-test-cases.yaml` or `*.spec.ts`.

---

## Core Principle — Spec is the Oracle

The job is **conformance testing**: catch where the spec mandates X but the dev built Y.
Every assertion's *expected value* comes from the spec graph (UC / ES / VIF / DS) — never from the deployed app or the dev's source.

- **Selector grounding** (where an element is, what it's labelled) MAY read the impl / element-map — that's "how to reach it".
- **Oracle grounding** (the value under test — number, label, color, state, mapping) is **spec-only**. Derive it and write it down (`spec_ref` + verbatim line) **before** opening any dev source.
- Can't observe the spec value on live data? **Mutate the API to a known input** (`mutate:` / `alternate_values`) and assert it — do NOT skip, do NOT read it back from source.
- A failing spec-grounded assertion is a **finding**: keep it red (`test.fail(true,'DEV-BUG: …')` citing the `spec_ref`).
- **A positive/read flow must assert its primary positive outcome**, never only an absence — an errored panel satisfies an absence-only oracle (Bug #145535).
- **A filter/search TC must prove the RESULT SET changed** — a non-matching value → zero rows + empty-state copy, then clear → baseline returns. Heading/column/no-error assertions are satisfied identically by a backend that ignores the parameter (Bug #148643). Full recipe: [references/test-case-generation.md](references/test-case-generation.md).
- **A DEV-BUG's evidence is the deployed DOM, never local source** — the deploy branch is often ahead of local. If they disagree, the deployed DOM wins.
- Spec coverage is **primary**; exploratory edge-cases (Step 4.3) are **secondary**.

### Spec Supremacy — non-negotiable

The dev's code, the deployed DOM, a `// Source: EN-xxx` comment, or "it works fine this way" **never** redefine the expected value.

**Every divergence is reported — no exceptions.** Including when the dev's behaviour is arguably better, when it is cosmetic (label, casing, colour, order, icon), when a bug is *fixed but fixed differently from the spec* (fixed ≠ conformant), when a fix removed a spec-mandated path to hide a symptom, and when the test still ends up green (that means the oracle was weak — say so).

**Never absorb a divergence.** Forbidden: rewriting the assertion to the rendered value; weakening the oracle (exact → `toContain` → `not.toBeNull()`); deleting/skipping the TC; editing the spec YAML or the source spec to match the impl; re-scoping the TC away from the diverging surface; declaring GO because "the feature works". If the spec itself looks wrong or two specs conflict, that is a **PnC/spec issue** — say so and stop; code never arbitrates which spec is canonical.

**Re-grounding a locator IS allowed — it is the only sanctioned repair.** A test has two halves: *where to look* (the locator) and *what must be true* (the oracle). A VIF states the second and almost never the first, so the locator has to be learned from the built app — opening the screen, reading the DOM or the element map, and swapping in a real `data-testid` / role / accessible name is correct work, not absorption. The oracle never moves. **The test that separates the two:** after your edit, would the assertion still fail if the app rendered the WRONG value? Yes → you re-grounded. No → you absorbed. Two smells that mean you crossed the line: the expected string now matches the app's copy instead of the spec's, and the assertion no longer names a value at all (`toBeVisible()` on a container that mounts either way). **Prefer fixing the CAPTURE over the test** — a thin element map (captured without opening the dialog/sheet) is why most locators were guessed in the first place; re-capture with the surface open and the locators come out grounded without touching a single expectation.

**Divergence Ledger (mandatory).** Collect every divergence and print the full list at Step 12 — including ones you chose not to file, with the reason. Each entry: `spec_ref` + verbatim spec line → observed behaviour → TC id → `DEV-BUG` / `SPEC-GAP` / `TEST-BUG` / `out-of-spec`. Zero divergences is legitimate; an **unreported** one is not. Spec silent → classify `out-of-spec` and still surface it.

---

## Workflow — Steps 0–12.5 are the run. Never stop early before Step 12.

> **Scripts root:** `.claude/skills/ui-flow-test-generator/scripts/`
> **All output paths are relative to `$TESTING_ROOT`.**
> **`{feature}`:** from `SPEC_FILE` filename — strip leading digits/underscores + extension, `_`→`-`, lowercase (`02_Billing_UI_InvoiceList.md` → `billing-ui-invoice-list`). Falls back to `PAGE_URL` segments only if `SPEC_FILE` is unset.
> **`{Title}`:** human-readable screen name from the spec matching `PAGE_URL`.
> **`{spec_yaml}`:** `spec/ui/{feature}-spec.yaml` — Step 2 output. One flat file per feature, re-run OVERWRITES it; history lives in `git log --follow` + the file's `provenance` block.

| Step | Action | Command / Details |
| --- | --- | --- |
| 0 | **Resolve config, then preflight** | 0a resolve config interactively → 0b `preflight.py --phase env --testing-root $TESTING_ROOT` → 0c the ADO MCP call. Halt on exit 1. See Step 0. |
| 2 | **Synthesize spec** | Read `$SPEC_FILE`, resolve its graph, merge `--emit-guards`, run `--append-to` for the section block, write `spec/ui/{feature}-spec.yaml`. See Step 2. |
| 3 | **Analyze page** | `python3 analyze_page.py --url $FULL_URL --out element-map.json`. See Step 3. |
| 4 | **Generate test cases** | `python3 generate_test_cases.py ...`. See Step 4. |
| 4.3 | **AI-Exploratory TCs** | Append under `# ── AI-EXPLORATORY` separator. See Step 4. |
| 4d | **Layout-Discovery TCs** | Always-on guards: `surface: auto` / `surface: clip` / `surface: viewport-collapse` (#148866) / `surface: hscroll` (#149093), plus opt-in `layout_stress`. See Step 4. |
| 4.5 | **Evaluate quality** | `python3 evaluate_quality.py --testcases test-cases/ui/{feature}-test-cases.yaml --spec {spec_yaml} --page-url $PAGE_URL --element-map element-map.json` — **always pass `--element-map`**. See Step 4.5. |
| 4.6 | **Auto-improve** | Overall < 4.0 → patch the gaps the scorer printed, re-generate, re-score (max 2 iterations). |
| 4.7 | **Assertion enrichment** | Resolve every `TODO(spec-oracle)` in the YAML with a spec-derived value. See Step 4. |
| 5 | **Setup auth** | `python3 setup_auth.py --testing-root $TESTING_ROOT`. See Step 5. |
| 5.5 | **API preflight** (real only) | `preflight.py --phase api --spec-yaml {spec_yaml} --base-url $UI_BASE_URL`. Halt on exit 1 — backend down / auth / CORS / **0 rows**. A reachable-but-empty list halts too: every data assertion would pass vacuously and report a false GO. Seed at 5.6, or pass `--allow-empty` when the empty state is genuinely under test. |
| 5.6 | **Gen seed fixture** (real only) | `python3 generate_seed_fixture.py --spec-yaml {spec_yaml}` — skip if no `seed_recipes:` block. See Step 5.6. |
| 6 | **Generate test scripts** | `python3 generate_scripts.py --testcases … --element-map … --page-url $PAGE_URL --feature {feature} --out-dir script/ui --domain-tag {domain}`. See Step 6. |
| 7 | **Setup Playwright** | Verify `playwright.config.ts` has `setup` + `UI Tests` projects; do NOT remove `API Tests`. |
| 8 | **Execute tests** | **8a version gate first — always** (see Step 8a). Then `python3 run_tests.py --date {YYYY-MM-DD} --feature {feature} --working-dir $TESTING_ROOT` (`--no-deps` if login is broken but `.auth/user.json` is valid). Exit **3** = the spec cannot be loaded (missing fixture / TS error / config) — fix the spec, do not retry the login. |
| 9 | **Format report** | `python3 generate_report.py --results report/ui/{date}/{feature}/results.json --testcases … --page-url $PAGE_URL --base-url $UI_BASE_URL --date {date} --feature {feature} --feature-title "{Title}" --work-item-id $WORK_ITEM_ID --script-path script/ui/{feature}.spec.ts --spec-file "$SPEC_FILE_FOR_REPORT" --out report/ui/{date}/{feature}/ui-report.md`. `$SPEC_FILE_FOR_REPORT` = `$SPEC_FILE`, else the first path in `$SPEC_FILES`. The tally is trustworthy by construction (`setup`/`seed` projects excluded; a `test.fail()`-pinned test buckets as `known_bug`, never a pass, and downgrades the verdict to Conditional) — **do not hand-patch the counts**. |
| 10 | **Convert to HTML** | `PYTHONIOENCODING=utf-8 python3 convert_md_to_html.py report/ui/{date}/{feature}/ui-report.md --output report/ui/{date}/{feature}/ui-report.html` |
| 11 | **Post to Azure DevOps** | See Step 11. |
| 12 | **Confirm** | Print: TC count, script count, pass/total, work item #, **the posting line** (`✅ posted to WI #xxx — <link>` or `⚠️ NOT POSTED — <reason>`; a run without this line is not finished), GO/NO-GO, **and the Divergence Ledger**. Then run the bug hand-off triage, print its prompt verbatim, **stop and wait**. Never auto-file a Bug. |
| 12.5 | **Clean run scratch** | **Run LAST**, only after Step 11 posted OK: `rm -f $TESTING_ROOT/element-map*.json $TESTING_ROOT/authed-*.html`. KEEP `.auth/` and every deliverable. **SKIP if the run aborted mid-way.** Always use the canonical scratch names at Step 3 so nothing orphans. |

---

## Step 0 — Preflight Gate (halt-on-fail)

Three parts, strict order — **0a first**. Auto-fix what is fixable; never ask for something you can run yourself, never halt for a value you could have asked for.

### 0a. Resolve config (interactive — BEFORE any validation)

`.env` is an **output** of this step, not a prerequisite. Never emit "fix `.env` and re-run" for a key you could have asked for.

1. **Read** `$TESTING_ROOT/.env` (may not exist — normal). A key already set there, or in the prompt, is resolved; the prompt wins.
2. **Read** `.claude/skills/ui-flow-test-generator/.env.example` — authoritative for *which* keys exist and their meaning. Keys and structure only; never copy its illustrative values. Do not modify it.
3. **Ask for every key still missing in ONE `AskUserQuestion`** — one batched round, never key-by-key:

| Key | Ask when missing | Note |
| --- | --- | --- |
| `SPEC_FILE` / `SPEC_FILES` | Neither in `.env` nor prompt | Do NOT auto-scan directories for specs |
| `PAGE_URL` | Always | Root-relative |
| `UI_BASE_URL` | Unless `PAGE_URL` is `file://` | |
| `WORK_ITEM_ID` | Unless `ADO_REPORT=off` | Offer `ADO_REPORT=off` for a local-only run |
| `UI_AUTH_USERNAME` | No valid `.auth/user.json` | Skip entirely for `file://` |
| `UI_AUTH_TENANT` | Same as above | Suggest `root` |
| `FEATURE_SCOPE` | Only if `SPEC_FILES` spans several features | Otherwise inferred at Step 2 |
| `TESTING_ROOT`, `BACKEND_MODE`, `HEADLESS`, `AUTH_STORAGE_STATE` | Never ask | Defaults above |
| `PLAYWRIGHT_EXTENDED_TIMEOUT` | Never ask — but **always WRITE it** (`90000`) | Never asked, never optional. `lib/timeouts.ts` **throws** without it, at module load, so the run does not get a red test — Playwright collects **0 tests** and prints `No tests found`, which reads as a bad `--grep`. A `.env` written without this line cannot run anything. |

4. **`UI_AUTH_PASSWORD` is never asked in chat** — it would land in the transcript and logs. Write the key **empty**.
5. **Write `$TESTING_ROOT/.env`** — preserve every existing key, append only what was resolved. Verify `.env` is gitignored; if not, say so before writing anything secret.
6. **Halt-once rule.** Password empty AND no valid `.auth/user.json` → stop here exactly once with the absolute path and line: _"✅ Config saved → `<abs path>/.env`. ⚠️ One value left: fill `UI_AUTH_PASSWORD=` (line N) — it is deliberately not asked in chat. Then re-run."_ Never proceed to 0b with no credential and no session — 0b would fail on the credential check and the reason would read as an environment defect.
7. Otherwise `✅ Config saved → <path>. Proceeding…`.

> Everything below assumes 0a resolved config, so a missing key is a bug in 0a — not a reason to halt.

### 0b. Environment

`preflight.py --phase env --testing-root $TESTING_ROOT` verifies, in order:

| Group | Check | On failure |
| --- | --- | --- |
| file/env | every `SPEC_FILE`/`SPEC_FILES` path exists; `PAGE_URL` root-relative; `UI_BASE_URL` set unless `file://`; `playwright.config.ts` present | Key missing → back to 0a and ask. Key present but wrong → exit 1, report the exact failing value |
| deps | `node_modules/`, `pyyaml`, and the **chromium binary really on disk** (`chromium.executablePath()` — `npx playwright --version` only proves the npm package resolves) | exit 1 with the install command — **report it, do not run it**. `npm install` / `npx playwright install` are safe; **pyyaml needs `sudo apt install python3-yaml`** (no pip, PEP 668) and an agent never runs `sudo` unattended |
| credential | `.auth/user.json` present → GET `/api/abp/application-configuration`, require non-empty `auth.grantedPolicies`. Absent → require `UI_AUTH_USERNAME` + `UI_AUTH_PASSWORD` + **`UI_AUTH_TENANT`** | exit 1 — delete the stale state, or fill the missing key |
| route | first-hop request to `UI_BASE_URL + PAGE_URL` **without following redirects**; a 3xx to anywhere but the auth gate means the route serves a different screen | exit 1 — confirm the real route; do NOT silently repoint `PAGE_URL` |

> **Credential.** An expired session, or an app-config call that failed and rendered as empty `grantedPolicies` (#147541), produces 401/403 screens that read exactly like product defects. A missing `UI_AUTH_TENANT` lands the run on `/unauthorized` — same false-defect shape.
> **Route.** Probe the FIRST hop only. A `next.config.ts` rewrite (308) fires *ahead of* the auth middleware's 307, so first-hop inspection catches a mis-pointed route even with no session (#148133; and the "VIF `**Route:**` was machine-guessed, ~8 of 20 wrong" class). When the first hop *is* the auth gate, route existence is reported **unproven**, not OK.

### 0c. Azure DevOps reachability

Unless `ADO_REPORT=off`, call `mcp__azure-devops__get_work_items(ids=[$WORK_ITEM_ID])` **now**, not at Step 11:

| Result | Action |
| --- | --- |
| Returns the WI, type = User Story | Pass |
| Returns the WI, different type | Ask once: use this ID, or another? |
| Tool unavailable / errors / WI not found | **HALT.** _"ADO MCP unusable — the report could not be posted. Configure the MCP server and re-run, or set `ADO_REPORT=off` for a local-only run."_ |

> One call proves four things: the MCP server works, the credential is live, the WI exists, and it is the right type. A PAT that expired mid-run otherwise surfaces two hours later at Step 11 — after all the work is done.

---

## Step 2 — Synthesize Spec → `spec/ui/{feature}-spec.yaml`

⛔ **Read [references/spec-synthesis.md](references/spec-synthesis.md) in full BEFORE writing the YAML.** It carries the resolver policy, the grammar-0.3/0.4 section aliases, and the exact shape of every block below. Writing the YAML from this summary alone drops coverage.

Sequence: **2a** start at the VIF → `resolve_specs.py` builds the draft from its `depends_on` (never hand-transcribe guards; never open PM/UC/PS/IS/VO/DS) → **2b** filter to feature scope (`FEATURE_SCOPE` → `PAGE_URL` → ask) → **2c** fill `templates/spec-template.yaml`, merging **both** drafts the resolver emits (`--emit-guards`, `--emit-vif-block`) → **2c-assert** fill `assert:` at all **seven** attachment points → **2d** write the flat file.

> ⛔ **`assert:` is not optional and it is not prose.** Every oracle you write in a
> `system_response` / `display` / `clause` / `reject_expected` cell must ALSO be written as an
> `assert:` block — that block is the **only** thing Step 6 turns into an `expect()`. A section
> with prose and no `assert:` renders a test with **no assertion at all** that reports PASS
> whatever the app does; 38% of the corpus was in that state before the contract existed.
> The vocabulary is closed (`text` / `element` / `rows` / `attr` / `url`), it is documented once
> at the top of `templates/spec-template.yaml` and in full at
> [references/spec-synthesis.md](references/spec-synthesis.md) §2c-assert, and Step 6 **raises**
> on anything it does not recognise rather than emitting nothing. The seven points:
> `user_flows[].steps[]` (in position) · `user_flows[]` (flow outcome) · `state_defaults[]` ·
> `a11y_requirements[]` · `enforcement_guards[]` · `vif_acceptance_criteria[]` ·
> `error_precedence[]`. **The Step 4.5 gate blocks the run** (dimension 7 → 2, exit 1) if any TC
> renders without one, so a spec that skips this does not reach Step 5.

> **Merge the section block with one command, not by hand:**
> `resolve_specs.py --vif "$SPEC_FILE" --repo-root <root> --append-to spec/ui/{feature}-spec.yaml`
> — it writes the block AND sets `vif_id`/`vif_version`/`vif_grammar` in place, with nothing
> crossing your context. Reading the ~42KB draft in only to type it back out costs ~24k tokens
> a run and is the transcription hop the draft exists to remove. It refuses (naming the keys)
> when the yaml already carries a block, because a second copy would shadow the first silently.
>
> **The VIF has 16 sections, not 11.** The grammar (`author-vif/references/section-rules.md`) fixes **11 core** for every VIF, **+5 task-screen** when the frontmatter declares `task_journey_id`, **+1** for a shell. Measured over both spec roots: 61 VIF files, all 61 with all 11 core sections, and **33 of them task-screens.** Ten of the sixteen fed nothing until 2026-09-08 — `--emit-vif-block` extracts all of them, and 2c-sections is the procedure.

Never invent a rule, an error message, or an outcome. Missing value → string `"[MISSING — <reason>]"`, list `[]`.

**Blocks that must be present in `2c` (each one is a coverage gate downstream):**

| Block | Required when | Drops if skipped |
| --- | --- | --- |
| `2c-version` | Always | `vif_id`/`vif_version`/`vif_grammar` — **Step 4 HALTS without them** (see the spec-version contract at the top) |
| `2c-grammar` | Always | Resolve BOTH 0.3 and 0.4 section names, never one |
| `2c-sections` | Always | **Every** VIF section, merged from `--emit-vif-block`. Without it the yaml carries 6 of the VIF's 16 sections and **dimension 8 BLOCKS** |
| `2c-visual` | Always | Every colour/variant/icon business rule |
| `2c-validation` | Any form input | The 4-dimension matrix + dimension 5 (message lifecycle) |
| `2c-exception` | Any data-backed page | Error catalogue + screen states |
| `2c-panel` | Any expander / tab / drawer | One `api_contracts[]` entry each |
| `2c-enforcement` | ES has `## Invariants` or `## Behaviors` | One negative TC per invariant row and per `throw` in the `Steps:` DSL |
| `2c-errormap` | Grammar 0.4 | Domain error → wire contract mapping — the richest source of out-of-VIF bugs |
| `2c-nav` | VIF declares `**Nav:**` | `nav_entry:` — without it an unreachable screen still reports 100% GO |
| `2c-a11y` | VIF has an §Accessibility section | Only what that section declares — no WCAG sweep. See [references/a11y-scoped.md](references/a11y-scoped.md) |
| `2c-seed` | `BACKEND_MODE=real` | `seed_recipes:` — data independence |
| `2c-layout` | A free-text field is rendered anywhere | Layout-stress block |

> A grammar fallback (`⚠️ 0.3 FALLBACK`) is recorded, never silent, and its coverage caveat goes in **Business Impact** beside the verdict — not in a footnote.
> `2a-audit` sweeps the whole corpus when you need the state of the spec graph rather than one feature.

---

## Step 3 — Analyze Page

`file://` → pass the path verbatim to the script.

Live fetch needs the **full URL** (`$UI_BASE_URL` joined with `$PAGE_URL`, single slash). Steps 4 & 6 still receive the relative `$PAGE_URL`.

**With auth (`UI_AUTH_USERNAME` set):**
1. `python3 login_and_capture.py --url $FULL_URL --out authed-page.html`
2. `python3 analyze_page.py --url authed-page.html --out element-map.json`

Session reuse: `login_and_capture.py` resolves `.auth/user.json` via CLI `--storage-state` → `AUTH_STORAGE_STATE` → auto-detect. Found → reuse; missing → fresh login + save. Force-fresh → delete the file; public page → `--skip-login`.

**Login-redirect detection:** `element-map.json` has `input[type=password]` AND < 5 total elements → halt, warn to set `UI_AUTH_USERNAME` (unless the spec *is* a login page).

---

## Step 4 — Generate Test Cases (4 / 4.3 / 4d / 4.7)

⛔ **Read [references/test-case-generation.md](references/test-case-generation.md) in full BEFORE generating.** It carries 4a–4c, the exploratory rules, the four layout-discovery surfaces, and the assertion-enrichment procedure.

Non-negotiables from that file:

- **4.0** the spec-yaml must carry `vif_id`/`vif_version`/`vif_grammar` — the script **exits 1**
  without them, and the version propagates from here into the spec.ts banner and the report.
- **4a** check existence via terminal (`python3 -c "import os; print(os.path.exists(...))"`), not `list_dir`.
- **4b** every TC step carries a `data_dependency` (`any`/`seed`/`fixture`/`mock-only`) — MANDATORY.
- **4c** every visual business rule gets a CSS-class assertion, not just text.
- **4.3** exploratory TCs come *after* spec coverage passes 4.5, appended under `# ── AI-EXPLORATORY`.
- **4d** always-on layout guards, no config: `surface: auto` (long-string overflow), `surface: clip` (clipped-unscrollable), `surface: viewport-collapse` (#148866), `surface: hscroll` (#149093).
- **4a-sections** eight always-on builders off the 2c-sections blocks: `boot-request`,
  `negative-render`, `queue-column`, `support-panel`, `state-default`, `responsive`,
  `error-precedence`, and `acceptance-criteria` (which runs LAST and emits only for ACs no
  other TC already cites). Four have dedicated script renderers because the mechanism is not a
  sequence of UI actions — capture before navigating, read a response then assert absence, set
  the viewport first, mock a status then assert the LEVEL.
- **4.7** resolve every `TODO(spec-oracle)` in `test-cases.yaml` with a **spec-derived** value — never one
  lifted from source or the DOM. (The `// TODO` in generated specs is Step 6b mock scaffolding, not this.)

> **Data-coverage families the form builder emits (Step 4).** Two families that produced
> almost nothing before 2026-09-10 — a 2,217-TC audit found 5 duplicate TCs (all accidental)
> and 1 special-character TC. Both are strictly spec-gated and emit **nothing** when the spec
> states no rule: **Duplicate** fires on `validations[].constraint: unique`, a prose
> distinctness rule, or an ES `enforcement_guards[].kind` of `no-duplicates`/`unique`/`distinct`
> (a guard marked `reachable: false` is skipped); **Special characters** fires per free-text
> field unless a `constraint: format` rule declares a character class. Full contract, oracles
> and the deliberate exclusions (whitespace, wire payload):
> [references/test-case-generation.md](references/test-case-generation.md) §4a-duplicate.

### Step 4.5 — Evaluate quality

`evaluate_quality.py` prints every finding to stdout; act on that output directly at Step 4.6. Passing `--element-map` is mandatory — it enables:

- dim 4 **widget-render gate** — every interactive Select/dropdown/popover needs ≥1 render-invariant TC (raw `"0"` label / detached popover — see [references/ui-render-invariants.md](references/ui-render-invariants.md)) — plus the invented-field check;
- dim 2 **validation-lifecycle gate** — every required field needs a TC proving the message DISAPPEARS once valid ([references/validation-lifecycle.md](references/validation-lifecycle.md));
- dim 7 **oracle-strength linter** — weak-oracle, tuned-to-dev, neg-only positive, and **vacuous filter oracle** (#148643).

**dim 8 VIF-section coverage** needs no `--element-map`; it reads the yaml structurally and asks a different question from the other seven: not how good the TCs are, but whether every section the VIF grammar declares reached the yaml at all. Two failure shapes:

- **`UNDER-DECLARED SECTION`** — the VIF declares N rows, the yaml models none. Not a "write more TCs" problem: nothing downstream can act until the section is merged in. Re-run `--emit-vif-block`.
- **`UNCOVERED SPEC ROW`** — the row is in the yaml and no TC in the matching category names it. Named per row (`AC4`, `EP-7`, `TenantId`, `tablet`), never as a count.

The comparison is against `vif_sections_declared:` — counts read off the VIF by the resolver — which is what turns an empty block from invisible into loud. Same mechanism as `UNDER-DECLARED ENFORCEMENT`. A yaml with no such block **cannot be checked**, and that is itself the finding: dim 8 scores 1 on grammar 0.4, 2 on a 0.3 fallback.

Exit codes: `0` pass · `1` a dimension scored < 3 (BLOCKED, auto-improve before Step 5) · `2` overall < 4.0 (improve, max 2 iterations).

---

## Step 5 — Setup Auth (one-time)

`python3 setup_auth.py --testing-root $TESTING_ROOT` — first feature only. Generates `auth.setup.ts`, patches `playwright.config.ts`, creates `.auth/`.

> ⛔ **One account = one identity. Role/permission TCs are emitted SKIPPED, on purpose.**
> `auth.setup.ts` writes exactly **one** `storageState`, for the privileged setup account
> (`UI_AUTH_TENANT=root`). There is no second session, so a TC whose precondition reads
> *"log in as `<role>`"* cannot do that — it runs as the same privileged user, asserts what
> that user sees, and goes **green without exercising the role it names**. In the report that
> vacuous pass reads as "permission covered", which is worse than a gap: a real authorization
> regression stays invisible behind it.
> Therefore `build_form_test_cases()` stamps every `AUTH-role` TC with
> `skip_reason='NEEDS_SECOND_ACCOUNT: …'`, and `generate_scripts.py` renders it as
> `test.skip(true, …)` — counted as **skipped**, never as passed, with the reason visible.
> **Do not "fix" these by deleting the skip_reason.** Un-skip only after a genuinely
> lower-privilege account exists AND the suite carries a `storageState` per role; then the TC
> must actually load that role's state, not merely be re-enabled.
> This does **not** apply to the other two authorization families, which need no second
> account and must keep running: the unauthenticated-redirect TC (real anonymous context,
> `storageState: { cookies: [] }`) and the 403 TCs (real `page.route()` interception).

> Skip if `setup/auth.setup.ts` exists and auth previously passed — re-running recreates it with a generic `#email` selector that breaks real login pages. Skip entirely when `UI_AUTH_USERNAME` is unset (public page).

### Step 5.6 — Seed fixture (real mode)

`generate_seed_fixture.py` **upserts** the feature's recipes into the single shared registry `setup/seed-recipes.generated.ts` (never a file per UI); the engine lives once in `setup/seed-runtime.ts`. The spec opts in with `import { seedTest, expect } from '../../setup/seed-recipes.generated'; const test = seedTest('{feature}');`. Step 6 wires this automatically — do not hand-edit the import. Bespoke seeding goes in the hand-written `setup/seed-helpers.ts` — the naming contract below binds it too.

> ⛔ **Seed values are business-meaningful.** `<real business text> [AUTO] ${suffix}` on the one field cleanup filters, pure business prose everywhere else, `${suffix}` always the last word. No `MinhVoTest_*`, no `TEST-AUTO-*` prefixes, no `"Seeded by automation skill"`. Full contract + why: [references/spec-synthesis.md](references/spec-synthesis.md) §2c-seed.

> ⛔ **NEVER** bind `test` conditionally to the plain export (`BACKEND_MODE === 'real' ? seedTest(f) : base`). `@playwright/test` has no `seedData` fixture, so this is not a mock fallback — Playwright fails while *loading* the file (`Test has unknown parameter "seedData"`), runs **0 tests in every project including `setup`**, never writes `.auth/user.json`, and gets misreported downstream as an auth failure (days of red CI, build 21483).

---

## Step 6 — Generate Test Scripts

### 6a. Run generator

```bash
python3 generate_scripts.py \
  --testcases test-cases/ui/{feature}-test-cases.yaml \
  --element-map element-map.json \
  --page-url $PAGE_URL \
  --feature {feature} --out-dir script/ui \
  --backend-mode $BACKEND_MODE \
  --domain-tag {domain}
```

- **Always pass `--domain-tag`** — the canonical CI `--grep` tag. The domain is NOT 1:1 with the URL (`/knowledge/sops`→`sop` but `/knowledge/rag-sync`→`operations`). Omitted → inferred from `--page-url` with a `VERIFY` notice.
- `--backend-mode real` skips `data_dependency: fixture` TCs, emits `const T = 15000`, and injects `await settled(page)` after every `page.goto`. Defaults to `mock`.
- `@readonly` / `@mutating` is emitted automatically per test and gates prod-monitoring runs; `lint:tests` rule **R7** fails the build if a test has neither tag or both. Never hand-pick a tag to pass it.
- `@shared-seed` is emitted alongside it on any seeded test whose body never writes (classifier signals == `{seed}` and nothing else). It lets those tests share ONE seeded entity per file per worker instead of POSTing a private one each — the backend exposes 4 DELETE routes across 219 paths, so every extra row is permanent. Measured −177 rows/run on the three seeded suites. Opt-IN: an untagged test keeps a private entity, so a classifier miss costs rows, never correctness.

Tag taxonomy, classification signals, and the selector/beacon caveats: [references/script-generation.md](references/script-generation.md).

### 6b. Wire API mocks → [references/mock-strategies.md](references/mock-strategies.md)

Read the reference, then: detect MSW mode and set `BACKEND_MODE`; run the post-gen mock-strategy scan (§3); replace every `test.skip` with `page.route()` / `overrideFetchWithMock` / `test.fail()` (§4); backport script-level mocks into the YAML `test_data` map and run the drift check (§5).

### 6c. Post-generation TypeScript check (MANDATORY)

```bash
cd $TESTING_ROOT && npx playwright test "script/ui/{feature}.spec.ts" --list
```

Use `--list`, NOT `tsc --noEmit` (needs a `tsconfig.json` in cwd, always fails here). `SyntaxError` / `error TS` → fix before Step 7. Common causes: malformed regex (`/pattern)/i`), prose inside `page.goto()`, missing `await`, wrong import path, stray `});`.

---

## ⛔ Pre-Submit Gate — MUST pass before Step 7

| # | Check | Pass condition |
|---|---|---|
| 1 | Visual BRs | Every colour/variant BR has a CSS-class assertion step, not just text |
| 2 | No `test.skip` | All replaced with `page.route()` / `overrideFetchWithMock` / `test.fail()` |
| 3 | MSW scan done | Post-gen grep confirmed the strategy matches the build mode |
| 4 | TypeScript clean | `playwright test --list` → no `SyntaxError` / `error TS` |
| 5 | Shell excluded | No TC targets sidebar / App Switcher / bell / avatar |
| 6 | Count assertions exact | `mock`: `toHaveCount(6)`. `real`: tag the step `fixture` + use `greaterThan(0)` |
| 7 | `data_dependency` tagged | Every step tagged. On `real`, ≥50% of steps are `any` |
| 8 | Validation matrix covered | Every input has a `validations[]` / `boundary_constraints` entry OR a `# NO_<dim>_<field>` comment, all 4 dimensions (2c-validation) |
| 8b | Validation lifecycle covered | Every required field has a `clear-on-valid` TC, plus one `pristine` TC per form (`reappear` per typed field, `reset` when a Clear control exists). Auto-generated — a missing one means the `required` entry is missing in 2c-validation. 4.5 hard-blocks (dim 2 ≤ 2) |
| 9 | Relative URLs only | No deployment host anywhere in `{feature}.spec.ts` / `{feature}-test-cases.yaml`. `file://` exempt |
| 10 | Hermetic data (real) | Every drill-in / edit / named-record assertion targets a `seedData.*` entity, not an ambient id/name. An ambient read is tagged `seed` (+ recipe) or carries `# AMBIENT: <reason>`. Mock-mode exempt |
| 10b | Spec must collect | `npx playwright test <spec> --project="UI Tests" --list` exits 0 **and** lists > 0 tests. Any TC reading `seedData` needs an unconditional `seedTest('{feature}')` binding. A collection error is silent-fatal — 0 tests run, `.auth/user.json` never written, CI blames auth |
| 10c | Seed data is business-meaningful | Every value in `seed_recipes:` (and any bespoke seed added to `setup/seed-helpers.ts`) reads like a real record of the screen under test. No placeholder tokens (`MinhVoTest_*`, `TEST-AUTO-*`, `"Seeded by automation skill"`, `test`/`abc`/`string`, lorem). Exactly one field carries `[AUTO]`, `${suffix}` is its last word, and `cleanup.list_filter` matches that field — a seed with no sweepable marker is permanent dev-DB litter and fails this gate. §2c-seed |
| 11 | Oracle fidelity | Every High-priority BR/VAL TC asserts a **spec-derived** value (literal / computed / mutate-forced), no vacuous "matches specification", no unresolved `TODO(spec-oracle)`. Every filter/search TC asserts an **exclusion** |
| 11b | Divergence disclosure | Nothing absorbed: no assertion rewritten to the rendered value, no oracle weakened, no TC deleted/skipped, no spec YAML edited to match the impl. Every divergence appears in the Step 12 Ledger with `spec_ref` + verbatim line |
| 11c | Re-grounding proved | Every TC whose **locator** you edited after a red run was re-run with `NEGATIVE_CONTROL=1` (or a wrong-value probe) and went **RED**. A test tuned to the app stays green there — this is the only mechanical check that separates re-grounding from absorption. Row 11b is a promise; this row is the proof, and 11b has been violated in practice while in force. Classify with `negative_control.py --baseline <results.json> --negative <results.json> --script script/ui/{feature}.spec.ts`; record each pair (TC id → red/green) in the Step 12 Ledger. A TC that will not go red is NOT a pass — report it as a weak oracle |
| 12 | Overflow coverage | Every length-limited displayed free-text field has a layout-overflow TC (normally the auto guard `surface: auto`, `spec_ref: auto-overflow`). Do NOT delete it or mark it `spec_only` |
| 13 | VIF sections merged | `vif_sections_declared:` present, and every non-zero count has a modelled block. A task-screen VIF has `task_screen.screens[]`. Dim 8 reports nothing UNDER-DECLARED |
| 14 | Section rows covered | Every declared row has a TC in its category, or is excused ON THE ROW with a reason (`untestable:` / `observable: none` / `required: no`). Excusing by deletion is forbidden — an AC removed to quiet the gate is the screen's definition of done, deleted |

Fix → re-verify the failed item → proceed.

---

## Known Selector Patterns → [references/selector-patterns.md](references/selector-patterns.md)

Apply to ALL generated Playwright code; re-check after every generation. Strict-mode violations on shadcn/base-ui/Tailwind are the #1 source of false negatives.

## Step 8a — Spec-coverage gate (before every execution)

```bash
cd $TESTING_ROOT && npm run lint:spec-drift
```

Run it **every time, unconditionally** — including straight after a full Step 0→7
run. ~1s for every suite on disk. Do not try to skip it "because we just
generated": knowing whether this session started at Step 0 needs a flag, and a
flag can be wrong. After a full run there is nothing to find, so it passes
silently and costs nothing.

It asks one question — *does the live VIF declare a requirement row this suite's
spec-yaml never received?* — by running the generator's own `resolve_specs.py`.
It does **not** compare version numbers; measured on this tree 2026-09-14, a
version compare flagged 4 suites of which 1 was real, and stayed silent on a VIF
that gained a whole new AC without a bump.

| Result | Do |
| --- | --- |
| **exit 0** | Execute. Print nothing about it. |
| **`SPEC-ROW-MISSING`** | **Do not execute.** A requirement never reached the yaml, so the quality gate cannot even report it uncovered. Follow the loop below. |
| **`STAMP-SPLIT`** | **Do not execute.** The four build stamps disagree with each other — a partial regeneration; fix the lagging file. |
| **`VIF-UNRESOLVED` / `RESOLVER-FAILED` / `YAML-UNPARSEABLE`** | **Do not execute.** The suite could not be checked at all; that is a finding, not a pass. |

### On `SPEC-ROW-MISSING` — extend the suite, never rebuild it

1. Emit the block, then **copy the named rows VERBATIM** into their section —
   the command is printed in the finding:

```bash
S=.claude/skills/ui-flow-test-generator/scripts
python3 $S/resolve_specs.py --vif <VIF.md> --emit-vif-block /tmp/vif-block.yaml
```

   `--append-to` is **first-merge-only**: on a yaml that already carries the block
   it refuses (`⛔ NOT APPENDED — already carries: ...`). Copy by hand instead, and
   never retype a row — a row you paraphrase is a row the gate can no longer match.

2. Re-score to find what now needs a TC — dim 8 names each gap individually
   (`UNCOVERED SPEC ROW — §vif_acceptance_criteria "AC37" — no TC names it`):

```bash
python3 $S/evaluate_quality.py --testcases test-cases/ui/{feature}-test-cases.yaml \
    --spec spec/ui/{feature}-spec.yaml --page-url $PAGE_URL --element-map element-map.json
```

3. **Report the delta to the QC and ask before writing anything.** Read the rows,
   say what they actually require and whether the suite already asserts it
   elsewhere, then let them choose: add the TCs / mark the row `untestable:` with
   a reason / execute anyway against a known gap. Reading the delta and
   recommending is your job; choosing is theirs.

4. Write ONLY the agreed TCs and their `spec.ts` tests. Re-run step 2 until clean.

**Never re-run the generator over an existing suite to catch it up.** It is not
idempotent — re-running `decision-recording` moved it from 2/160 to 184/251 TCs
off a one-line spec delta — and it destroys hand fixes, which is why every recent
suite needs a `postgen.py` to re-apply them.

> **Known hole:** the gate compares row IDENTITY, not row TEXT. A VIF that rewrites
> an existing row in place — same `AC13`, different error code — passes it silently.
> Worked example (investigated 2026-09-14): VIF-ANA-005 `AC13` names 422
> `Analytics:Objective:MetricDefinitionNotFound`; CT-ANA-001 v14.8.2, five days
> newer, struck the CODE while keeping the row at 422 with `— (framework default)`
> and the same Message. Neither side is a suite defect and no oracle broke — the
> TCs assert the user-visible Message, which both specs agree on. It was a
> **spec-vs-spec conflict**, recorded in that suite's Divergence Ledger as `D10`.
> Two lessons: the gate cannot see this class at all, and when it surfaces, the
> answer is usually "record the conflict", not "edit the yaml" — absorbing it
> erases the only evidence the two specs disagree. Until text comparison has a
> verbatim-field allowlist, a human reading the delta is the only detector.

---

## Step 8 — Error Recovery → [references/error-recovery.md](references/error-recovery.md)

Classify (test failure vs infra failure), apply the matching recipe (max 2 retries), stop if still infra-failing. Proceed to Step 9+ only when at least 1 test actually executed.

---

## Step 11 — Post to Azure DevOps

> Skip ONLY when `ADO_REPORT=off`. Any other reason means Step 0c failed and the run should never have reached here.

**11a.** Build the comment fragments **and post them** — one command, `--post` does both:

```bash
python3 .claude/skills/ui-flow-test-generator/scripts/build_azdo_chunks.py report/ui/{date}/{feature}/ui-report.html --out-dir report/ui/{date}/{feature}/azdo-chunks --post $WORK_ITEM_ID
```

The script posts each part in order over the ADO REST API. **Never read the parts back and re-post them by hand** — every byte would cross the context twice, which on a large suite costs more than the rest of the run. Drop `--post` only to inspect the fragments without posting; then post them in order via `mcp_azure-devops_add_work_item_comment(..., format="html")`.

Sections 1, 2, 4 and 5 are passed through whole. **Section 3 is reduced**: the tally is kept verbatim, but the summary table keeps only its non-PASS rows and only non-PASS detail cards survive — the full per-case detail is already in the `ui-report.html` artifact, and a reviewer on the work item is there for the verdict and the failures. Every fragment is bare HTML (no `<html>/<head>/<style>` wrapper), verified under the 4000-char ADO cap before it is written, and a card too long for one comment is split rather than dropped.

> **Two stops post nothing at all** (credentials, and a part count over `--warn-parts`; `--help` names the credential paths). Over the part gate the parts are still written, but `--post` prints `⛔ NOT POSTED` and exits without touching the work item — read `ui-report.html`, then re-run with `--force`. A **split** card is only advisory: its error text was too long for one comment, read it in the report.

**11b.** Confirm `✔ part-NN.html posted (N/N)` for every part — it prints only after the response parsed as a real comment object, so it is evidence, not an assumption. Anything else means nothing landed from that point on; the parts are on disk, so post the remainder in order via `mcp_azure-devops_add_work_item_comment(..., format="html")`. Never post raw Markdown.

### Bug hand-off (manual, user-gated)

Step 11 posts the *report*. It does NOT open a defect — a failing test is not automatically a Bug.

**1. Route by classification, not by red:**

| Verdict | Destination |
|---|---|
| `DEV-BUG` (spec clear, code doesn't do it) | `create-bug` → `UI Bug` / `API Bug` |
| `out-of-spec` (spec silent, self-evident UI/UX defect) | `create-bug` → `UI Bug`, BugType `UI/UX bug` |
| `SPEC-GAP` / two specs contradict | `create-bug` with the **`PnC`** prefix + BugType `Spec Bug`, assigned to the spec owner. Not a dev defect — code never arbitrates which spec is canonical |
| `TEST-BUG` (wrong oracle/selector/fixture/seed) | **Nothing is filed.** Fix the test and say so |

**2. Group by root cause, not by test case** — several failures from one fault = **one** Bug. Split only when the fixes are genuinely independent.

**3. Ask once per proposed Bug:**
`→ Confirmed bug: <one-line symptom> [<classification>] — covers <TC-ids>. Chạy skill create-bug để tạo Bug item không?`
Nothing confirmed → print `→ No bug to file.` (naming the test to fix if a `TEST-BUG` was the reason).

On yes, hand off to **`create-bug`**: it de-dupes first, files one Bug per root cause under the **same User Story that parents `$WORK_ITEM_ID`** (siblings) plus a `related` link back and a one-line back-reference comment naming the Bug id, and at its last step offers the `.mp4`+`.gif` evidence via **`bug-repro-clip`**. Do NOT call `bug-repro-clip` from here.

---

## Output Files

| Path | Content |
| --- | --- |
| `spec/ui/{feature}-spec.yaml` | AI-synthesized spec (Step 2 → input to Step 4). Flat, one per feature, overwritten each run |
| `test-cases/ui/{feature}-test-cases.yaml` | Test case docs |
| `script/ui/{feature}.spec.ts` | Playwright scripts (flat — no date subfolder) |
| `report/ui/{YYYY-MM-DD}/{feature}/ui-report.md` | Report (Markdown) |
| `report/ui/{YYYY-MM-DD}/{feature}/ui-report.html` | Report (HTML) |
| `report/ui/{YYYY-MM-DD}/{feature}/results.json` | Raw Playwright JSON (written by `playwright.config.ts` via the `FEATURE` env var) |
| `report/ui/{YYYY-MM-DD}/{feature}/azdo-chunks/` | Split chunks for Azure DevOps |
