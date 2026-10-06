# Step 4 — Test-Case Generation Reference

> Loaded on demand by SKILL.md Step 4. Read this in full **before** generating or enriching test cases.

## Step 4 — Generate Test Cases (Details)

**4a. Check existence first (MUST use terminal, NOT `list_dir`):**

```bash
python3 -c "import os; print(os.path.exists('test-cases/ui/{feature}-test-cases.yaml'))"
```

> ⚠️ Do NOT use `list_dir` — VS Code's virtual filesystem reports unsaved editor buffers as existing, causing false positives.

- If `True` → skip generation, read the existing file, proceed to Step 4.5.
- If `False` → run generator:

```bash
python3 generate_test_cases.py \
  --spec-yaml {spec_yaml} --element-map element-map.json \
  --out test-cases/ui/{feature}-test-cases.yaml --page-url $PAGE_URL
```

`spec_format: descriptive` → element-map-driven builder; `spec_format: structured` → form/rule builder.

**4a-duplicate/special-chars. Two data families the form builder emits (structured format).**

Both were blind spots until 2026-09-10: a corpus audit of 2,217 generated TCs found **5**
duplicate-data TCs (all accidental — a backend 409 the error pass happened to pick up) and
**1** special-character TC (a layout-stress probe that asks whether the layout breaks, never
whether the value survives). Neither family had a builder.

* **Duplicate** — fires only on a spec-stated distinctness rule, from either source:
  * `validations[].constraint: unique` — already a documented value in
    `templates/spec-template.yaml` that had no builder behind it, so every spec declaring
    one produced zero TCs;
  * `validations[].description` stating it in prose ("distinct values when supplied") — a
    VIF §Validation row rarely reaches for the keyword;
  * `enforcement_guards[].kind` in `{no-duplicates, unique, distinct}` — the ES 0.4
    `## Invariants` DSL, whose `error_code` becomes the oracle. A guard marked
    `reachable: false` is skipped: the rule exists, but not through this screen.

  The oracle is the declared error message/code, asserted verbatim. When the spec declares
  the rule but publishes no code, the TC asserts the **consequence** instead (route did not
  leave the form ⇒ nothing was saved) and the expectation text says the code is missing —
  that gap is a finding to report, not a reason to drop the TC.

  A field the spec's `boundary_constraints` does not carry is not typeable (multi-select,
  checkbox list, repeater). The TC is then emitted **skipped** with `UNTESTABLE:` naming the
  widget, so the gap stays visible in the report. Guessing a widget interaction there is how
  inert tests are born.

* **Special characters** — one TC per free-text field (`_derive_free_text_fields`, capped at
  3: the bug class is per input component, not per field). The value carries quotes, angle
  brackets, an ampersand, an apostrophe, CJK and an emoji.

  The oracle is that the control holds what was typed, **verbatim**, via the `value:` assert
  form. Two spec signals override that and are honoured:
  * a `constraint: format` rule on the field → the field is **skipped**; a declared character
    class means not every character is legal, and guessing which is an invented oracle;
  * `field_normalization[<field>]` (ES 0.4 §Properties `Normalization`) → `lowercase` /
    `uppercase` assert the transformed value; any other declared value keeps the verbatim
    oracle and names the transform in `expected` rather than guessing it.

  Deliberately **out of scope**: leading/trailing whitespace (a form-level trim is a widget
  concern, while the ES `Normalization` column governs the entity — asserting either way
  would be ungrounded), and the wire payload. This pass proves the control does not mangle
  the value; proving the *request body* carries it verbatim needs a route capture, which the
  `assert:` vocabulary cannot express — hand-author that in the suite when it matters.

  A field the element-map cannot resolve to a control emits **no TC**. `of: title` would
  compile to `page.locator('title')`, matching the document's `<title>` — a test that fails
  for a reason unrelated to the field. A missing TC is honest; a mis-bound one is not.

Both families emit **nothing** when the spec states no such rule, and that silence is the
correct outcome — asserting "a duplicate must be rejected" where no spec says so invents an
oracle and files a dev bug against a screen that never promised it.

**4a-exception. Unhappy-path TCs are auto-generated + executable (BOTH formats).**
`build_exception_test_cases()` emits one EXECUTABLE TC per error-catalogue entry and per
screen exception state, each carrying a `mock_routes` block that `generate_scripts.py` turns
into a real `page.route()` interception. It is **endpoint-aware**: `derive_api_patterns()`
splits `api_contracts` into a COLLECTION (list/load) endpoint and an ITEM (detail / drill-in)
endpoint, and error states are emitted against BOTH:
- **Collection** (page-load): `not-found/empty` (404), `forbidden` (403), `server-error` (5xx,
  +Retry if `recovery_action`), `loading` (delayed), and **`session_expired` (in-session 401)**
  — a 401 returned *while authenticated* (token expired mid-flight), asserting no stale rows +
  redirect/re-auth. This is SEPARATE from the unauthenticated→sign-in redirect TC.
- **Item / detail** (drill-in): `not-found` (404), `forbidden` (403), `server-error` (500). Each
  prepends the canonical drill-in step *"Open the first record's detail (click the first data
  row)"* (translated to a first-data-row click) so the detail fetch actually fires, then asserts
  `testing_scope.detail_content_anchor` is HIDDEN (no successful-content leak). **Without a
  `detail_content_anchor` the item TC is emitted as a visible `spec_only` stub** (a reviewable
  gap, not a false-passing page-load test) — fill the anchor to make it executable.

`build_business_rule_mutation_test_cases()` emits a TC per `alternate_values[]` that mutates the
API response so enum/threshold variants render. These run in any backend mode (self-injecting),
default `data_dependency: any`, and are designed to **fail when the app mishandles the state**.

**4a-enforcement. Domain-guard negative TCs are auto-generated (BOTH formats).**
`build_enforcement_test_cases()` emits one NEGATIVE TC per `enforcement_guards[]` entry (see 2c-enforcement) — `category: enforcement`, `type: Negative`, carrying an `enforcement:` sub-dict (`target`/`rule`/`kind`/`error_code`/`wire_code`/`violate`/`source`) that `generate_scripts.py` reads to scaffold the seed-violating-state + assert-rejected body. This is the **rejection** counterpart the state-machine pass never produces. The quality gate (Step 4.5, dimension 2) BLOCKS when a declared `ENF-xxx` guard has no TC.
> ⚠️ After generation, confirm there is one `category: enforcement` TC per `## Invariants` **row** and per `throw` in every `## Behaviors` `Steps:` block (0.3 alias: per `## Domain Methods` `Pre:` clause). Count them — `grep -c "throw \`" <ES file>` plus the invariant row count is the floor. Missing guard → fill `enforcement_guards` and regenerate.

> ⚠️ After generation, confirm the YAML contains exception TCs (`category: exception`) for each
> state the spec declares, **against each endpoint class**. A master-detail page must have
> collection-scoped 403/500/401 AND item-scoped 404/403/500. If any are missing, the spec is
> under-specified — the catalogue only produces a detail-scoped TC when an `error_messages` entry's
> `trigger` references the item path (`/{id}` / `/*` / "clicked"/"detail"). Fill `error_messages`
> (one row per status PER endpoint) / `screens[].states` / `api_contracts.endpoint` (see 2c-exception)
> and regenerate. The quality gate (Step 4.5, dimension 2) BLOCKS when exception coverage is incomplete.
> ❌ Do not hand-mark exception TCs `spec_only` — that turns them into `test.skip()` and they stop
> catching bugs. They must execute (item TCs become executable once `detail_content_anchor` is set).

`mock_routes` grammar (per route entry, all keyed by `pattern`):
- `{pattern, response: {status, body}}` → fulfill with a fixed status/body (404/403/500…)
- `{pattern, delay: <ms>, passthrough: true}` → delay then `route.continue()` (loading skeleton)
- `{pattern, mutate: {"<json.path>": <value>}}` → fetch real response, patch field(s), fulfill (enum/threshold variants)
- `{pattern, abort: 'failed'}` → simulate a network failure

**4a-sections. VIF-section TCs are auto-generated from the blocks 2c-sections merged.**

Eight builders, one per section block, all driven off the yaml — nothing re-reads the VIF.
They run after every other builder because the last of them fills the gap the others left.

| Category | Source block | What it asserts, and why nothing else can |
|---|---|---|
| `boot-request` | `task_screen.screens[].query_params` | the **cold-load request** carries each declared default. The listener is attached BEFORE `goto` — a `waitForRequest` armed afterwards routinely misses the boot request, and a later request may already carry a value the app defaulted a control to post-mount. Every other TC in the suite sets a control first, so a changed default filter / page size / sort is invisible to all of them. A `sent_when: when-true` param is asserted **absent** on a cold load: a conformant app omits it until set |
| `negative-render` | `task_screen.screens[].fields_not_displayed` | the only **negative** render contract in the grammar. The oracle is the **VALUE**, read out of the response, not the field name — a UI that never labels its columns passes a name-only check while rendering the value anyway. When the payload does not carry the field the TC **fails** rather than skipping: the contract says it is received |
| `queue-column` | `…columns` | every declared column present **and its binding rendering a value**. Header presence alone is not the oracle: `role`, `aria-label` and the header row all render during the fetch, so a header-only assertion goes green on a table with no data. Settles on skeleton 0 first. A `conditional` column is asserted present on a qualifying row **and absent on one that does not qualify** |
| `support-panel` | `…support_panels` | one TC per panel whose `Required` is **yes**, asserting it renders *with content*. A mounted container with an errored body satisfies presence. A `no` panel is deliberately skipped — half the corpus's rows are `nba \| no \| not wired`, and asserting those present manufactures a false bug against a conformant screen |
| `state-default` | `state_defaults` where `observable: control` | the widget shows the spec's initial value with **no interaction**. `observable: request` rows are left to `boot-request` (the stronger oracle — the request is what the server received); `observable: none` emits nothing, by design |
| `responsive` | `responsive_rules` | one TC per breakpoint. Viewport is set **before** navigating: a resize after render can leave the desktop tree mounted, and the assertion then describes a layout nobody sees. Every locator carries `>> visible=true` — a Tailwind double-render mounts BOTH trees, so an unscoped `.first()` lands on a `display:none` node where `toBeHidden()` passes whatever the UI does |
| `error-precedence` | `error_precedence` | the **level**, which the exception pass structurally cannot ask about. Full-page means the primary content is *not rendered* — "covered by an overlay" is a different thing. `retry: false` asserts a Retry is **absent**: the spec forbidding one makes a helpful extra Retry a divergence. `disables` asserts **disabled, not hidden** — asserting absence would pass on the wrong UI |
| `empty-copy` | `component_tree` + `data_binding` | the quoted empty-state copy, verbatim. §Component Tree is the ONLY authority for it (CT `Message` covers errors, nothing covers this), and it used to be hand-carried into `api_contracts[].empty` so a skipped row had no oracle at all. Forces **200 + zero rows, never 404** — a 404 routed into the Error state is a different defect and the exception pass owns it. Distinct from that pass's empty-state TC, which asks Empty-vs-Error: this asks whether the string is the string the spec wrote, and a calm but **wrong** empty message passes the other one |
| `task-route` | `task_screen.task_journey.route` | the task route is a SECOND route the VIF declares (`/…/{id}/triage` beside the list). Every other TC arrives at the landing page, so a task route the build never implemented reports green — the same shape as a screen shipped with no nav entry. Takes a real id off the landing page rather than hard-coding one, so it fails on the defect and not on a reset database |
| `fixture-mutation` | `task_screen.fixtures` (Entity Snapshots) | an Entity Snapshot IS a `mutate:` payload with its own oracle: concrete single-entity JSON plus a `Verifies` cell stating how it must render. Measured on this corpus, **all 74 Entity Snapshots carry JSON** and 28 have quoted copy in `Verifies`. Cheapest access to a branch live data cannot produce — a resolved name that is null, an already-stale item, an event-set failure flag. Asserts BOTH a distinctive value from the injected payload (an oracle the test controls) and the quoted strings out of `Verifies`. **Entity Snapshots only**: the other ~320 fixtures (Task Activation 195, Checklist 72, Info Content 32, …) are scenario prose, and stubs for them would be unusable |
| `acceptance-criteria` | `vif_acceptance_criteria` | runs **LAST**, and emits only for ACs no other TC already cites. An AC is normally proven by a functional TC, so emitting one per AC would duplicate the suite; this fills what the others left. An AC with a stated `untestable` reason becomes a visible `spec_only` stub |

**Two derivations are mechanical, and both print what they derived — check them, do not trust them.**
The grammar mandates prose in these cells, so the machine-readable half has to be recovered:

- `responsive_rules` component expectations are recovered **per clause**, matched against the
  §Component Tree / queue-column name inventory. Clause-scoped, not window-scoped: a ±70-char
  window around a component name reaches into its neighbour's mandate, and the first version of
  this read "collapses" out of the *toolbar's* clause and concluded the **table** must be hidden
  — the opposite of what the row said. `full screen` is tested before `card` because a clause
  naming both belongs to the more specific one.
- `error_precedence` `level` / `status` / `endpoint` / `retry` / `disables` are recovered from the
  `Condition` + `Display` cells. The `disables` derivation carries a **negation guard**: a Display
  cell states the negative case too ("**no** action buttons **are disabled** by this condition
  alone"), and the bare `buttons.*disabled` match read that as a mandate to assert them disabled.
  A TC derived that way fails a conformant screen and would have been filed as a defect.

**Three mock-mechanics rules these renderers encode, each learned the hard way here:**

- **Register the most specific route LAST.** Playwright resolves handlers in reverse
  registration order, and a collection glob (`**/api/x*`) also matches the item path
  (`/api/x/{id}`) — so registration order silently decides whether an item read gets served
  the collection's body. `fixture-mutation` sorts by segment count so the item handler always
  wins, instead of relying on §Data Binding's row order.
- **Do not double-inject `settled()`.** The post-generation pass adds one after every
  `page.goto`; a renderer that emits its own used to end up with two. The settle is part of
  these renderers' mechanism (assert on data, never on a skeleton) so they cannot drop it —
  the pass now skips a goto that is already followed by one.
- **Drop a payload value that is a substring of another asserted value.** An enum that
  prefixes a free-text field ("Investigating" inside "Investigating a stale metric
  definition") adds no evidence and dresses a weak oracle up as a second assertion.

> ⚠️ A renderer whose required metadata is missing **declines** and the TC falls through to the
> prose translator. That is not politeness: interpolating an empty value into a regex literal
> emits `//i`, which JS reads as a comment, and the resulting parse error costs the **whole spec
> file** — every test in it, reported by `--list` as "No tests found" rather than as one broken TC.
> ⚠️ `section:` metadata rides on the TC in the yaml. `parse_test_cases` in both
> `generate_scripts.py` and `evaluate_quality.py` is a **whitelist, not a passthrough** — a new
> metadata key must be named there or it is silently dropped, which is exactly how the
> negative-render renderer once received an empty `field`.

**4b. Assign `data_dependency` to every TC step — MANDATORY.**
For each generated TC step, classify and tag it:

| Tag | When to use | Script behavior |
|-----|-------------|----------------|
| `data_dependency: any` | Structural assertion — does not depend on specific fixture values. E.g. "Verify ≥1 card is visible", "Verify SpecId matches `/[A-Z]+-\w+-\d+/`", "Verify error Alert visible", badge color, tab switch. | **Always runs** regardless of `BACKEND_MODE` |
| `data_dependency: seed` | Asserts against entities created via the spec's `seed_recipes:` block (business-meaningful text carrying the `[AUTO]` marker — see spec-synthesis.md §2c-seed). E.g. "Verify the seeded objective 'Cut customer onboarding cycle time to 5 days' appears in the list", "Click the seeded decision and verify the detail page". Assert on the **business text**, never on the `[AUTO]`/`${suffix}` tail — that tail is cleanup plumbing, not a spec oracle. | **Runs only on real**; `test.skip` on mock with reason `seed-data TC: needs real backend with API seeding` |
| `data_dependency: fixture` | Asserts a specific value that only exists in the MSW / fixed mock fixture. E.g. `"Verify {a spec id only the fixture contains} visible"`, `"Verify count badge shows '6'"`, `"Verify 'Long Doan' visible"`. | **Runs only on mock**; `test.skip` on real with reason `fixture-only TC: needs MSW/page.route mock fixture` |
| `data_dependency: mock-only` | Asserts behavior that requires a `page.route` stub (network error / timeout / 5xx injection) — no real backend can deterministically reproduce. | **Runs only on mock**; `test.skip` on real with reason `mock-only TC: needs page.route stub (network error / timeout)` |

Rule: **default to `any`**. Only tag non-`any` when the assertion truly requires that backend posture — see `_mode_config.TAG_SKIP_RULES` for the authoritative matrix. Error states caused by a real backend (e.g. 404 from a missing entity) are `any`; error states *injected* via `page.route` are `mock-only`. Color, empty, loading, auth tests → `any`.

> ⚠️ **`any` means "passes even on an EMPTY/wiped database".** The boundary that's easy to
> get wrong: a step is only `any` if its assertion holds with **zero rows** present —
> structural checks like "≥0 cards", "SpecId matches regex", "error Alert visible",
> "empty-state text shows". A step that **needs at least one entity to exist** — open the
> first row's detail, edit a record, assert a specific named/seeded row appears — is **NOT
> `any`**, even though the assertion itself looks structural. Tag it by mode posture:
> **real → `seed`** (and seed that entity via `seed_recipes:`, per 2c-seed), **mock →
> `fixture`** (MSW/`page.route` provides the row). Tagging such a step `any` is the bug
> that makes the suite secretly depend on ambient DB data.

> ⚠️ Do NOT tag all assertions in a TC as `fixture` if only one step is fixture-dependent. Tag per-step, not per-TC. A TC can have a mix of `any` + `fixture` steps.

**4c-skip. Shell element filtering.**
`analyze_page.py` returns ALL interactive DOM elements including app shell (sidebar nav, App Switcher, notification bell, user avatar, sidebar toggle). Cross-check each TC against `testing_scope.excluded_shell_elements` in `{spec_yaml}`. Remove any TC targeting a shell element. Common false positives: shell nav links → "filter tabs", user profile → "filter option", sidebar toggle → "feature control".

**4c. Visual BR assertion enforcement.** ✅ **Automated since 2026-05-29.**
`generate_test_cases.py::build_visual_assertion_test_cases()` emits one TC per BR with non-empty `visual_assertions[]` — runs for BOTH `spec_format: descriptive` and `structured`. Step format (parsed by `generate_scripts.py`):
- `Verify element at selector '<scope>' has CSS class '<value>'` → `toHaveClass(/value/)`
- `Verify element at selector '<scope>' has attribute matching '<value>'` → `toHaveAttribute('class', /value/)`
- `Verify element at selector '<scope>' has animation class '<value>'` → `toHaveClass(/value/)`

Emitted TC `category: visual`, `flow: visual`, `priority: Medium`, title `Visual — BR-xxx: <description>`.

> ⚠️ If a feature has badge/color BRs but no `Visual — BR-xxx: ...` TC in output → root cause: `visual_assertions[]` empty/missing in spec YAML (Step 2c-visual). Fix the spec, not the generator.
> ⚠️ `getByText('Production')` alone does NOT validate the color rule — missing the class = not testing the BR.

---

## Step 4.3 — AI-Exploratory Test Cases (SECONDARY — spec coverage first)

> Exploratory edge-cases are **secondary** to spec conformance (see **Core Principle**).
> Run this step ONLY after the spec-driven TCs pass the Step 4.5 gate (no missing
> UF/VAL/exception/enforcement coverage, no "vacuous oracle" flags). Never trade
> spec-fidelity effort for exploratory breadth — a thin exploratory section on a
> fully-spec-covered page beats a wide one that left BR/VAL oracles vacuous.

Compare spec-driven TCs + `element-map.json` + `{spec_yaml}`. Append exploratory TCs to same YAML under separator `# ── AI-EXPLORATORY TEST CASES`. Continue TC numbering.

**Gap categories:** uncovered elements (buttons/links not targeted) · negative/boundary (empty submit, max-length, special chars, whitespace) · concurrent/race (double-click, rapid switching, back/forward) · responsive (mobile viewport) · error recovery (offline, timeout, retry) · conflict state (stale data 409).

> 🚫 **Accessibility is deliberately NOT a gap category here.** a11y is covered — but only in scope — by §2c-a11y, driven by the VIF's own `## Accessibility` clauses. Exploratory a11y probing is what invented the focus-trap check that produced the false bug **#147402**; a probe family that manufactures findings is worse than no probe. Do not add keyboard-nav or focus-trap TCs here, and do not re-derive a11y from the element-map.

**MANDATORY UI-render invariants (one TC per Select/dropdown + per overlay/popover) → see [references/ui-render-invariants.md](ui-render-invariants.md).** On a violation, reconcile with spec first: cite the exact line if it mandates the rendering, else file as a self-evident UI/UX out-of-spec bug (never invent a spec mandate).

**MANDATORY validation-message lifecycle (auto-generated, one `clear-on-valid` TC per required field + `pristine` / `reappear` / `reset`) → see [references/validation-lifecycle.md](validation-lifecycle.md).** Do NOT hand-write these — they come out of the `required` entries in §2c-validation. Do verify each one targets the right widget (a combobox must be answered by picking an option, not by typing) and never relax the oracle to make a stale message pass.

**Rules:**
- Every exploratory TC MUST have `rationale:` (1-line gap explanation).
- No duplicates of spec-driven TCs.
- Keep it lean: **3–8 high-value TCs**; do not pad. These are clearly subordinate to the spec-driven set above the separator.
- Re-run: replace only the exploratory section, leave spec-driven TCs above untouched.

---

## Step 4d — Layout-Discovery Test Cases

**4d-auto. Always-on overflow guard — NO config, runs for every feature.**
`generate_test_cases.py::build_auto_overflow_test_cases()` **auto-derives** free-text fields from data the spec already has (`boundary_constraints.<field>.max` that is length-like ≥ 40 and non-numeric-named, e.g. `rawText` max 2000; plus any `layout_stress.stress_fields`) and emits **one executable TC per field** — `category: layout-discovery`, `layout_stress.surface: auto`, `spec_ref: auto-overflow`. Each TC mutates the field to a long **no-space** value on **every** API response via `injectFieldValue(page, '**/api/**', …)` (works in **mock AND real** mode — no fixtures, no selectors), then asserts the value renders **within the viewport and does not self-clip** on the list surface and again after opening the first record's detail. This is the reliability backstop: catching the "long unbroken string breaks layout" class must NOT depend on the author declaring `layout_stress` (that gap let the Capture Inbox triage-screen overflow, Bug #145274, ship uncaught). **You do not fill anything for this to run.** The Step 4.5 gate (dim 2) docks the score when a displayed free-text field has no overflow TC.

> ⚠️ The auto guard needs no fixture — it mutates whatever the backend/MSW returns. Do NOT convert it to `spec_only`/`test.skip`. If it fails, that is a real overflow bug (missing `overflow-wrap`/`break-words`/`min-w-0`); keep it red and file it.

**4d-collapse. Always-on SHORT-VIEWPORT collapse guard — NO config, runs for every feature with a scroll region.**
Emit **one** `layout_stress.surface: viewport-collapse` TC (`category: layout-discovery`, `spec_ref: auto-viewport-collapse`) per feature. It renders REAL data at deliberately short viewport **heights** (`1280×360 / ×300 / ×260`) and calls `assertNoCollapsedScrollRegion` — which flags any primary declared scroller (`overflow-y: auto|scroll`, width ≥ 30% of viewport) that squeezes below a usable height (< 40px) **while still holding hidden content**. This catches the **fixed-header/footer + `flex-1 min-h-0 overflow-y-auto` + `overflow-hidden` non-scrolling-page** pattern (a *vertical* twin of the horizontal-overflow class): at short heights the fixed chrome eats the box, the flex-1 list collapses to ~0px, and every row silently vanishes with no way to scroll to it — the whole list looks "stacked" under the filter bar. This is the exact class users report as "chồng layout" (stacking/overlap). `assertNoClippedScrollSurface` (the clip guard) **deliberately skips** this — it treats a 0px declared scroller as reachable and its `clientHeight < 8` early-continue drops the collapsed node — so this complementary guard is required. **No fixture, no selector, no config.** Caught Bug #148866 (Escalation Queue). Fix direction when it fails: give the list a `min-height` for ≥1 row and/or let the outer container scroll instead of `overflow-hidden` clipping the collapsed list.

> ⚠️ Keep it red on failure and file a `UI/UX bug` — do NOT `test.skip` it. If a feature genuinely has no scroll region (a single short form), the guard is a no-op (nothing matches) and passes.

**Opt-in refinement (below) is OPTIONAL** — use it only to add precise per-selector assertions on top of the auto guard.

### 4d-hscroll — HORIZONTAL overflow sweep (always on, no config)

Emit **one** `layout_stress.surface: hscroll` TC (`category: layout-discovery`, `spec_ref: auto-hscroll`) per feature. It renders REAL data at desktop **widths** (`1280×800` and `1920×800`) and calls `assertNoHorizontalOverflowInScrollBox` — which flags any declared horizontal scroller (`overflow-x: auto|scroll`, width ≥ 30% of viewport) holding content **wider than its box**, and names the columns that fell off-screen. shadcn's default `<Table>` wrapper is literally `relative w-full overflow-x-auto`, so **every table screen is a candidate**: one unbounded cell (a long display name, an unresolved GUID) widens its column and takes the trailing columns — plus any row-action button — with it. Swept at two widths because a wider viewport must not merely postpone the break. **No fixture, no selector, no config.**

> ⚠️ **This is the twin of 4d-auto, and it is NOT redundant with it.** On the screen that motivated it (Bug #149093, BC Sovereignty Assignment) **all three** existing checks passed green while 4 of 5 columns were off-screen:
> - `assertNoHorizontalPageScroll` passed **vacuously** — `documentElement.scrollWidth` 1280 == `clientWidth` 1280, because the `overflow-x-auto` wrapper *absorbs* the overflow so the **document never scrolls**. A page-level horizontal check is structurally blind to a table inside a scroll box.
> - `assertChildWithinParent(cell, row)` passed **vacuously** — the `<tr>` widened *along with* the table, so a cell is **always** "within" its row. Never compare a table cell to its own row; the meaningful parent is the scroll container.
> - `assertTextWithinViewport` *would* have caught it, but only fires on an **injected sentinel**, and the field must be listed in `layout_stress.stress_fields`. The column arrived in a spec delta and was never added there — so nothing ran.
>
> **Generalize both lessons:** (1) a page-level geometry assertion goes vacuous the moment an inner container declares `overflow` — assert against the container that bounds the content; (2) any invariant depending on an author-maintained field list silently stops covering a screen the first time a spec delta adds a column, so the primary net must be selector-free and fixture-free. See [references/ui-render-invariants.md](ui-render-invariants.md) invariant 8.

> ⚠️ **Desktop-only** (`minViewportWidth = 1024`): VIF §Responsive Rules routinely *mandates* a horizontal `ScrollArea` at the **tablet** breakpoint, so asserting there would be a false positive. Spec grounding for a failure is the VIF AC "responsive layout … with **no overflow**" clause plus the §Responsive Rules **desktop** row — cite the AC, never the CSS.

**Trigger (opt-in row/detail TCs):** `{spec_yaml}` has `layout_stress` filled (not `null`) AND `mock_strategy != none`. Otherwise SKIP (the 4d-auto guard still runs).

**Action:** `generate_test_cases.py` automatically emits TCs under a `# ── LAYOUT-DISCOVERY` separator — one TC per (`stress_field` × bad-string variant by `type`), **per surface**:
- **Row surface** (when `row_selector` set): injects the bad string into the LIST API on one row; asserts no horizontal scroll, child-within-parent, max row height ≤ 2× baseline, no `undefined` render (empty variant).
- **Detail surface** (when `detail_surface.container_selector` set): injects the bad string into the ITEM/detail API, opens the surface, then asserts no horizontal scroll + every `text_selectors[]` element stays within `container_selector` (the "without overflow" invariant). This is the path that catches Sheet/dialog title + full-text overflow on `longNoSpace` values.

Each TC has `category: layout-discovery`, `data_dependency: any`, ID `TC-LAYOUT-NNN`. On re-run, only that section is replaced — spec-driven TCs above it stay untouched.

> ⚠️ **Mock fixtures are the caller's job.** `generate_scripts.py` emits placeholders inside each layout TC's `page.route()`: row TCs get `/* MOCK_FIXTURES with one row.{field} = LAYOUT_BAD_STRINGS.{variant} */ {}`; detail TCs get `/* detail DTO with {field} = LAYOUT_BAD_STRINGS.{variant} */ {}` and a TODO'd open interaction. At Step 6 you MUST fill these with a real fixture (row: clone the baseline list, set ONE row's `{field}` to the bad string, respect `only_when`; detail: return one item DTO with `{field}` = the bad string, and mock/seed the list if needed to open the detail) — otherwise the test passes vacuously.

> ⚠️ Layout TCs use **hard `expect`** — pipeline goes red on failure, intentionally. Known-bug skipping is handled at orchestration level, not in the TC.

---

## Step 4.7 — Assertion Enrichment (Spec is the Oracle)

This step works on `test-cases.yaml`, before any `.spec.ts` exists. Its only marker is
`TODO(spec-oracle)`, emitted by `generate_test_cases.py`. The `// TODO` comments you will
later see in generated specs are a different thing entirely — Step 6b mock-fixture
scaffolding from `generate_scripts.py` — and are NOT resolved here.

Two kinds of grounding — keep them strictly separate (see **Core Principle**):

**Selector / affordance grounding — impl source is OK.** To *locate or name* an element
(button label, badge `data-slot`, placeholder, URL pattern) you MAY read the React
components (`source_path` in the YAML header, or map URL → `apps/frontend/apps/{module}/app/(platform)/`).
This tells the test where to look / what it's called, not what is correct. Phrase each
`steps:` entry in `generate_scripts.py` form (`"Click 'Submit' button"`,
`"Verify URL contains '/orders/detail'"`): a step the generator cannot map is emitted as a
bare `//` comment and asserts nothing, so after Step 6 confirm no step of yours rendered
that way.

> ⚠️ **`BACKEND_MODE=real`: the live DOM is the selector source of truth, not local source.**
> `element-map.json` (captured from the deployed URL in Step 3) — and, when a selector is
> uncertain, a quick `page.route` DOM probe — outranks the local React components, which can
> lag the deployed build. If a component in this branch shows an element as absent / renamed /
> differently-mapped but the deployed DOM shows otherwise, **trust the deployed DOM** and do
> NOT manufacture a `test.fail('DEV-BUG')` from the stale source (see **Core Principle**).

**Oracle grounding — SPEC ONLY (UC / ES / VIF / DS).** The *value under test* — the number,
label, color, state or mapping a BR/VAL mandates — MUST come from the spec. Never fill the
asserted value from the dev's source: that asserts the impl against itself and erases the
spec-vs-impl bug you were sent to find.
- Spec value not observable on live data? Do NOT skip and do NOT read it from source —
  **mutate the API response to a known input that forces the spec's mandated output**
  (`mutate:` mock route / `alternate_values`), then assert that output.
- A BR/VAL TC whose `expected` still reads "behavior matches spec" / "matches specification"
  with no spec-derived literal, or carries an unresolved `TODO(spec-oracle)`, is **NOT done** —
  resolve it from the spec, or (spec lacks the concrete outcome) fix the spec and file
  `COVERAGE-GAP`. The Step 4.5 quality gate (dim 7) docks these as "vacuous oracle".

> ⚠️ A test that fails after oracle grounding = a real spec-vs-impl bug. Do NOT "fix" it by
> changing the assertion to whatever the app renders — keep it red
> (`test.fail(true,'DEV-BUG: …')` citing the spec_ref) so it flips loud when dev conforms.

**Every enriched oracle carries its provenance.** Each High-priority BR/VAL TC records the
`spec_ref` **plus the verbatim spec line** it was derived from (in the TC `notes`). No verbatim
line ⇒ no mandate ⇒ do not assert it as one (classify `out-of-spec` instead, see Spec Supremacy).

**Re-verifying a previously-filed bug is a fresh conformance check, not a smoke test.** Re-derive
the oracle from the spec line, then compare: `still broken` → keep red; `fixed and matches the
spec verbatim` → green, close; `fixed but behaves differently from the spec` (different message,
different control, mandated affordance removed) → **new divergence**, add it to the Divergence
Ledger and report it — never close it as fixed.

---


---

## Oracle rules in full (moved from Core Principle)

- **Oracle grounding** (the value under test — number, label, color, state, mapping) is
  **spec-only**. Fill it from the implementation and the test just confirms the dev matches
  the dev — it can never catch a spec-vs-impl bug.
- Can't observe the spec value on live data? **Mutate the API to a known input that forces
  the spec's output** (`mutate:` / `alternate_values`), then assert it — do NOT skip, do NOT
  read it back from source.
- A failing spec-grounded assertion is a **finding**, not a flaky test. Keep it red
  (`test.fail(true,'DEV-BUG: …')` citing the spec_ref); never relax it to the rendered value.
- **A read/view flow must assert its PRIMARY positive outcome — never only an absence.** If the
  expected outcome says content is *listed / shown / displayed / loaded*, the test MUST assert that
  content is actually present. An assertion that only checks a **negative** ("no edit/delete control",
  "X is hidden") is a **vacuous oracle for a positive flow**: an *errored* panel satisfies it and the
  test passes green (this is why Bug #145535's Version History error slipped through as PASS). The
  Step 4.5 gate flags a positive/read TC whose steps assert only an absence (dim 7). Absence checks
  (read-only, no-mutation) are legitimate but must be *in addition to* the positive load assertion.
- **A filter / search TC must prove the RESULT SET changed.** Any control that narrows a list —
  free-text search box, domain/keyword filter, status Select, filter pill or tab — is tested by
  what it *excludes*, never by what survives the keystroke. Asserting the section heading, the
  column headers, "a row exists" or "the error banner is hidden" is satisfied **identically by a
  backend that accepts the parameter and ignores it**, which is exactly how a dashboard suite's filter TC
  reported GREEN through a full QC pass while `GetPortfolioLearningHistory` dropped `domainArea`
  outright (Bug #148643 — a nonsense value still returned all 14 rows). Required shape:
  1. record the **baseline** row count (settled) and fail loudly if it is zero — a zero-row
     baseline makes every narrowing assertion vacuous;
  2. apply a value that **cannot match anything** and assert **zero rows + the spec's empty-state
     copy** (this needs no seeded data — it is the cheapest real oracle available);
  3. **clear** the control and assert the baseline set returns, so the narrowing is provably the
     filter's doing and not the section unmounting or erroring;
  4. optionally assert the request carried the typed value — necessary for the VIF §Interactions
     "re-issue with the updated filter" claim, but **never sufficient**: a backend that ignores
     the parameter passes it.
  A row/total-count assertion, or a present-AND-absent pair of two *named records*, also
  qualifies. **Settle before every count read** — mid-refetch the table is replaced by skeletons,
  so an unsettled `rows.count() === 0` catches the loading window and passes no matter what came
  back: poll on skeleton-count 0 **and** the assertion together. The Step 4.5 gate flags a
  filter/search TC with no discriminating assertion as a **vacuous filter oracle** (dim 7).
