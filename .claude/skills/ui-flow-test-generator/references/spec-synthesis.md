# Step 2 — Spec Synthesis Reference

> Loaded on demand by SKILL.md Step 2. Read this in full **before** writing `spec/ui/{feature}-spec.yaml` for the first time on a feature.

## Contents

Blocks run in this order. Each is a bold `**{id}.**` paragraph — `grep -n "{id}"` jumps straight to one when you are back for a single answer rather than the whole procedure.

| Block | Applies when | Covers |
| --- | --- | --- |
| `2a` | always | Start at the VIF; `resolve_specs.py` builds the draft from `depends_on`; the 3 open rules; what is never opened |
| `2a-audit` | you need the spec graph's state, not one feature | Corpus-wide sweep |
| `2b` | `SPEC_FILES` spans several features | Scope filter: `FEATURE_SCOPE` → `PAGE_URL` → ask |
| `2c` | always | Fill `templates/spec-template.yaml`; the never-invent rule |
| `2c-grammar` | always | Resolve BOTH 0.3 and 0.4 section names — reading one finds zero guards on the other |
| `2c-sections` | always | **Every** VIF section into the yaml via `--emit-vif-block`; the 11 core + 5 task-screen contract; what the draft leaves to you |
| `2c-visual` | always | Colour / variant / icon rules → `visual_assertions` |
| `2c-validation` | any form input | The 4-dimension matrix + dimension 5, the message lifecycle no spec declares |
| `2c-exception` | any data-backed page | Error catalogue, screen states, collection-vs-item scoping |
| `2c-panel` | any expander / tab / drawer | One `api_contracts[]` entry per openable surface |
| `2c-enforcement` | ES has `## Invariants` or `## Behaviors` | One negative TC per invariant row and per `throw`; the 18-value `Kind` vocabulary |
| `2c-errormap` | grammar 0.4 | Domain error → wire code mapping; unmapped codes; the three recurring shapes |
| `2c-nav` | VIF declares `**Nav:**` | `nav_entry:` — why `**Nav:**` and never `**Route:**` |
| `2c-a11y` | VIF has an §Accessibility section | Copy its clauses verbatim, nothing outside the section |
| `2c-seed` | `BACKEND_MODE=real` | `seed_recipes:` and the data-independence policy |
| `2c-layout` | a free-text field is rendered anywhere | `layout_stress`, `detail_surface`, the delta-re-test rule |
| `2c-assert` | always | `assert:` — the machine-readable oracle. Without it a TC renders with **no `expect()` at all** and passes unconditionally |
| `2d` | always | Write the flat file; the required provenance keys |


**2a. Start at the VIF. Resolve everything else; open almost none of it.**

```bash
python3 scripts/resolve_specs.py --vif "$SPEC_FILE" --repo-root . \
        --roots "${SPEC_ROOTS:-specs/platform,specs/foundry,.specs-0.3}" --grammar "${SPEC_GRAMMAR:-prefer-0.4}" \
        --json /tmp/spec-plan.json --emit-guards /tmp/guards-draft.yaml \
        --emit-vif-block /tmp/vif-block.yaml \
        --emit-ct-slice /tmp/ct-slices
```

It prints exactly which files to open, which it refused to open and why, and the
`source_specs` lines to paste. Read the VIF plus **only** the files under `OPEN` —
and read them at **exactly** the path `OPEN` printed.

`--emit-ct-slice` is why that last clause matters: a CT is opened for its endpoint,
request-DTO and error tables, but `## Response DTOs` and `## Change Log` alone are 38%
of the CT corpus and no step below names either. The flag rewrites each opened CT down
to `Endpoints` / `Request DTOs` / `Error Responses` / `Auth & Security` / `Rate Limiting`
/ `Pagination`, **kept byte-for-byte**, and repoints `OPEN` at the slice — measured over
every VIF in the corpus that opens a CT: −35% on the CT read, −2%…−54% depending on how
much of that screen's CT is response shape, with nothing that feeds a 2c block removed.
Each slice header names its
source file and the sections dropped; open the source on the rare occasion you need one.
Guards are still extracted from the **full** CT, so `--emit-guards` is unaffected.

**Why the VIF alone is the declared input.** Every `depends_on` / `use_cases_served` id in the
corpus resolves from a filename index over the spec roots, so the list is derivable and
hand-maintaining it only adds a second place to be wrong. The `SPEC_FILES` lists it replaces
were dominated by a BC's `PM` spec — routinely the largest file named, opened to read a handful
of permission keys the VIF's `## Data Binding` `Gated By` column already states.

`--emit-guards` writes a DRAFT `enforcement_guards:` block: every `## Invariants` row and
every `throw` in every `## Behaviors` `Steps:` block, each already joined to its CT wire code.
**Merge that draft — do not retype the guards.** Transcribing them by hand has one failure
mode and it is silent: a guard left out of the yaml is a guard the dim-2 gate never asks
about, because the gate can only check the guards it was handed. On grammar 0.4 the gate
recomputes the reachable count from the same specs and reports `UNDER-DECLARED ENFORCEMENT`
with the exact shortfall, so a dropped guard now costs 2 points instead of passing quietly.

Three things the draft asks you to do, and only these:

1. **Delete every `reachable: false` guard.** The tool marks a behavior reachable only when
   this VIF's §Interactions *trigger* or *API-call* column names it — the Outcome column is
   deliberately excluded, because a behavior the system performs on its own (a resurface job,
   a stale sweep) is not something a user can attempt through this screen.
2. **Fill `violate` and `action_ui`.** No spec states how *this* screen reaches a rule; that
   is the judgment the tool cannot make.
3. **Leave `wire_code: ""` alone where it is empty.** That emptiness IS the finding — the
   domain enforces a condition the boundary publishes no code for. Assert the observable
   consequence, and report the gap.

`--emit-vif-block` writes the other draft: every section the VIF grammar declares, rows
verbatim. Same merge-don't-retype contract, same reason. Full procedure at **2c-sections** —
read it before writing the yaml, because the blocks it produces are what the dimension-8 gate
checks and what eight of the TC builders consume.

Everything it prints under `CONTRACT FINDINGS` is a defect a VIF-only read cannot see: an
unmapped domain error, a wire code no domain rule raises any more (a retired rule whose CT
row went stale), or a loose code join worth confirming. Report them with the run.

**The 3 open rules** (this is the whole policy — there is nothing else to track):

1. **CT** — open when a verbatim user-facing error string is needed. Take `Message` +
   `Error Code`, filtered by `Applies To` against the operationIds this VIF binds.
2. **ES** — open when the VIF's own `## Validation Rules` states no boundary number, **or**
   when the VIF has a write interaction. ~93% of Validation Rules rows across the corpus
   already carry the number inline (`inline: required; maxLength: 2000`), so on a read-only
   screen this rule usually declines to open anything.
3. **EN** — open only when the VIF names an enum without listing its values. A row reading
   `must be one of Investigate / Formalize / Defer / Dismiss` needs no lookup.

**Never opened: PM, UC, PS, IS, VO, DS.** Not "usually not" — never. Permissions are in
`Gated By`; UC only cross-checks something ES/CT already state (its `## Extensions` are read
at 2c-enforcement, and only for operations the VIF reaches); the rest are not UI-observable.

**Reachability is the point, not just the file count.** An ES routinely declares guards for
behaviors the screen under test cannot reach — ones driven by an event handler, a scheduler,
or another screen. Deriving those produces skips and unseedable tests, so scoping ES reads to
the operations **this** VIF calls makes the suite *cleaner*, not thinner. Check the ratio on
your own feature: count `### ` behaviors in the ES against the operationIds the resolver
printed — on the feature this was first measured against it was 2 reachable out of 8.

**Grammar fallback is recorded, never silent.** A `⚠️ 0.3 FALLBACK` line means the 0.4 tree
has no version of that spec yet. Copy it into `source_specs` verbatim as
`"ES-{BC}-{NNN} (grammar 0.3 FALLBACK)"`, and report the fallback list at the end of the run —
it is the migration backlog, surfaced for free. Current rate for the types these rules open:
CT 4/42, ES 8/58, EN 1/98, so ~90% of runs are pure 0.4.

> ⚠️ A file under `UNRESOLVED` is a **stated gap**, never a silent skip. Say which spec id
> could not be found and which coverage class is therefore thin.
> ⚠️ Do not widen the OPEN set on a hunch. If a coverage class genuinely cannot be filled
> from the VIF + the opened files, say so in the run report and name the one cell you needed —
> that is a finding about the spec graph, not a reason to read 12 files.

**2a-audit. Sweep the whole corpus when you need the state of the spec graph, not one feature.**

```bash
python3 scripts/resolve_specs.py --audit-all --repo-root .
```

Reports two things, both of which move over time and so must be **measured, never remembered**:

- **DANGLING references** — a `depends_on` id with no file in any root. During an active
  grammar migration these appear and vanish, so one sighting is not a defect report. A
  reference that survives several days is worth raising with the spec owners.
- **0.3-FALLBACK BACKLOG** — which specs have no 0.4 version yet, **ranked by how many VIFs
  they hold back**, each with the concrete cost of reading the 0.3 version. This is the
  migration ask, generated rather than argued.

It doubles as the genericity check for the resolver: it must complete over every VIF in every
BC, at both grammars, including a `shell` subtype, without crashing. Run it after any change
to `resolve_specs.py` — a crash there is a script bug, a gap is a spec finding.

**What a fallback costs, and what to do about it.** A fallback is not a failure — the run
still happens — but it degrades a specific coverage class, and the verdict must say so:

| Fallback | What is lost | Consequence if unstated |
|---|---|---|
| 0.3 **CT** | no `Applies To` column | every §Error Responses row's endpoint is inferred from prose; mis-routing one is how a detail-scoped 403/500 gap ships while the collection variant reports green |
| 0.3 **ES** | §Invariants is prose, guards live in `## Domain Methods` not a `Steps:` DSL | every enforcement guard is hand-derived — the exact shape in which a `Pre:` clause once shipped untested |

`generate_report.py` picks the `FALLBACK` markers out of `source_specs` and renders them as
**coverage caveats inside Business Impact**, beside the verdict rather than in a footnote.
Nothing extra to author: copying the resolver's `source_specs` lines verbatim is what feeds it.

> ⚠️ Never report a plain GO on a run that fell back without naming the caveat. Silence there
> reads as "fully covered", which a fallback run is not.

**2b. Filter to feature scope — MANDATORY when spec files contain multiple features.** Determine scope from (in order): `FEATURE_SCOPE` → `PAGE_URL` path segments → ask user. Extract ONLY matching sections (Suite block, Page layout, UX States, relevant DTOs/endpoints + referenced enums).

> ⚠️ Mixing features in one spec YAML produces overlapping/incorrect TCs.

**2c.** Use `templates/spec-template.yaml` as schema. Fill REQUIRED keys from filtered source. Missing values: string → `"[MISSING — <reason>]"`, list → `[]`. Never invent rules / error messages / outcomes.

**2c-grammar. Section names differ by spec grammar — resolve BOTH, never one.**
The spec corpus is mixed: `specs/` is grammar **0.4**, `.specs-0.3/` (= the old
`artifacts/platform/` tree) is **0.3**, and only 3 of 33 VIFs have migrated. Every section
reference below means "the 0.4 name **or** its 0.3 alias" — resolve by trying both and taking
whichever the file actually has. A missing section is a finding to state, never a silent skip.

| Spec | 0.4 (`specs/`) | 0.3 (`.specs-0.3/`) | Consequence of reading only the 0.3 name |
|---|---|---|---|
| ES | `## Behaviors` (per-behavior `### {Name}` + `Steps:` DSL) | `## Domain Methods` (prose + `Pre:`) | **every** enforcement guard silently vanishes — the 2c-enforcement pass finds 0 entries and the dim-2 gate has nothing to block on |
| ES | `## Invariants` (7-column DSL table) | `## Invariants` (free prose) | boundary/violation inputs must be hand-guessed instead of read off `Kind`+`Arguments` |
| ES | `## ABP Capabilities` | *(absent)* | soft-delete / concurrency behaviour untested |
| ES | *(no `## Relationships`)* | `## Relationships` | — |
| UC | `## Authorization`, `## Execution Contract`, `## Dependencies`, `## Execution Steps` | `## Commands table`, `## Domain Events` | permission oracle + control-flow steps missed |
| CT | `## Error Responses` has **`Applies To`** | no `Applies To` | error→endpoint routing falls back to guessing from `trigger` prose |
| CT | `## Request DTOs` has `Condition`/`Binding`/`ValidationTier`/`Error Ref` | `Constraints` only | client-vs-server rejection layer unknown |
| CT | *(no `## Auth & Security` per-endpoint table, no `## Rate Limiting`)* | both present | — |
| VIF | unchanged from 0.3 — same sections, same columns (0.4 only drops `## Change Log`) | same | none |

> ⚠️ VIF is the one spec type where 0.3 → 0.4 changed **nothing** structural:
> `## Routing & Entry Points`, the `shell` subtype, `## Navigation Taxonomy`, all five
> task-screen sections and the `COVERAGE`/`ERROR-SURFACE`/`CT-GAP` annotations already exist
> in the 0.3 corpus. There is no VIF grammar delta to hunt for.
>
> 🚫 **That sameness is not a reason to read fewer sections, and this line used to say so.**
> The earlier wording ("same 11 core sections" + "do not spend a pass looking for VIF deltas")
> was read as *11 sections is the whole VIF*, and it is not. The grammar
> (`author-vif/references/section-rules.md`, VIF KB §5.2/§5.3/§5.4/§5.5) fixes **11 core
> sections for every VIF, 5 more when `task_journey_id` is present, 1 more for a shell**, plus a
> 3-section optional whitelist. Measured over both roots: **61 VIF files, all 61 carry all 11
> core sections, and 33 are task-screens** — so on half the corpus the five task-screen sections
> are mandatory, and they were fed into nothing until 2026-09-08. That is a long-standing blind
> spot in THIS skill, not a property of the grammar. §2c-sections below is the pass that closes it.
> ⚠️ 0.4 spec prose (Invariant `Description`, `Steps:` narration) is often **Vietnamese**. It is
> internal description, **never** expected UI copy. On-screen copy still comes only from VIF
> §Component Tree Empty State and CT §Error Responses `Message`.

**2c-sections. Every VIF section into the yaml — MANDATORY, and the one pass that is
mechanical from end to end.**

Run it right after 2a, before any of the judgement-heavy blocks below. **Use
`--append-to`, not `--emit-vif-block`:**

```bash
python3 scripts/resolve_specs.py --vif "$SPEC_FILE" --repo-root <repo-root> \
        --append-to spec/ui/{feature}-spec.yaml
```

That one command writes the whole block onto the yaml **and** sets `vif_id` /
`vif_version` / `vif_grammar` in place — the spec-version block, which Step 4 HALTS
without and which must never be hand-typed. Nothing crosses your context.

**Why the flag and not a merge you perform.** The block is ~42KB. Reading it in only to
type it back out costs ~24k tokens a run and reintroduces the exact transcription hop the
draft exists to remove. `--emit-vif-block` still exists for inspecting the draft; when you
use it, append with `cat`, never by retyping — measured on this corpus the block's 10-11 top-level
keys collide with nothing the template writes, so an append is lossless (verified: 32 existing
keys + 10 appended = 42, none lost or altered).

`--append-to` **refuses** when the target already carries one of the block keys, and names
them. That is not fussiness: appending a second copy leaves both, `yaml.safe_load` keeps
only the last silently, and a stale row from the previous run could outlive a re-test while
reading as current. Delete the old block (everything from the `# DRAFT — extracted by
resolve_specs.py` marker down) or write the yaml fresh per 2d.

**Why any of this is mandatory.** A section that does not reach the yaml is a section no
gate can ask about, because a gate can only check what it was handed. The proof is on the
record — a live suite's VIF declared six §Accessibility bullets, `a11y_requirements` was
simply absent from its yaml, the run emitted **0** a11y TCs, and nothing anywhere said so.
It scored 4.2/5.0.

What the emitted block carries, and what each one buys:

| Block | From | The oracle it supplies, that nothing else does |
|---|---|---|
| `vif_acceptance_criteria` | §Acceptance Criteria | the screen's own AC1..ACn. Densest oracles in the file (a nav target with its query param, a three-branch fallback, a badge on exactly one row) and restated nowhere else in the spec graph. NOT the same key as `acceptance_criteria`, which is this run's GO/NO-GO checklist |
| `state_defaults` | §State Management | `Initial Value` = the boot contract. **Every other TC sets the control first**, so a changed default filter / page size / sort is invisible to the entire rest of the suite |
| `responsive_rules` | §Responsive Rules | all 3 breakpoints are mandatory in the grammar; "the CreatedAt column is hidden at tablet" is a mandate, not styling |
| `error_precedence` | §Empty & Error Precedence | the **level** — full-page vs component vs inline, retry vs forbidden, which controls disable. `error_messages` only says the error exists; a 403 the spec puts full-page, rendered inline over a still-populated list, passes every copy assertion and is still a defect |
| `component_tree` | §Component Tree | the only authority for on-screen **empty** copy (CT `Message` is the authority for error copy). Previously hand-carried into `api_contracts[].empty`, so a skipped row had no oracle and nothing noticed |
| `entry_points` | §Routing & Entry Points | one boot state per **arrival**. A screen can be correct via nav and broken via an inbound task, and a suite that only ever `page.goto`s the route never exercises the second |
| `task_screen` | §5.3 (5 sections) | task journey · blueprint · queue columns · form fields + `Required` · action keys · **query params WITH defaults** · **fields the screen must NOT display** · support panels · data mapping · fixtures |
| `data_binding` | §Data Binding | Component → Source Endpoint. What makes §Component Tree assertable at all: forcing a component to its Empty state means mocking ITS endpoint, and this is the only place that mapping is written down |
| `vif_sections_declared` | counts read off the VIF | ⛔ do not edit. This is the anti-silent-drop mechanism: dimension 8 compares it against what the yaml models, so an empty block becomes **UNDER-DECLARED** instead of invisible |

Three things the draft leaves for you, and only these:

1. **Fill `observable:` on every `state_defaults` row** — `control` (the widget shows it on
   load) / `request` (the cold-load request carries it — the stronger oracle, and the
   `boot-request` TC covers it) / `none` + a `note` saying why. An unfilled slot is reported;
   a slot that is not there could not be.
2. **Fill `untestable:` only where an AC genuinely cannot be driven through the UI** (a
   preview-emitter AC is the standard case). A *reason* excuses the id from the gate; an empty
   string does not. Never delete an AC to quiet the gate.
3. **Fill `use_as:` on the fixtures you intend to use.** §Verification Fixtures were authored
   for the preview emitter but they are valid suite oracles: an Entity Snapshot is a `mutate:`
   payload whose `Verifies` cell already states the expected rendering, which is exactly what
   a branch live data cannot show needs (a null resolved name, a stale item, a failure flag).
   Prefer one of these over inventing a mutation payload.

**On-screen copy is the QUOTED text, wherever it sits in the cell.** The corpus's quoting
convention is inconsistent but its quoting is not: of 235 §Component Tree cells declaring a
real empty state, 90 carry 100 quoted strings between them and the other 145 are descriptions
("see MetricsKpiGrid Empty State", "Skeleton fields while fetching"). Only the quoted strings
are gated — about 3.6 real oracles per VIF. Two exclusions, both deliberate:

- a 6-character floor, so value literals like `"0"` and `"0.0%"` are not mistaken for messages;
- **loading copy is not empty copy.** A few VIFs put `"Loading item…"` in the Empty State
  column. Asserting that on a no-rows response would FAIL a conformant screen, so it is
  reported as a spec-column mistake (PnC) and never gated. The resolver prints the line.

Three cases the parser reports rather than swallows — read all three, none is noise:

- **`# ⚠️ UNCLASSIFIED block`** — a task-screen table whose header matched no known shape. It
  is emitted **with its header**, not dropped; derive its TCs by hand.
- **`non-canonical header ... read as form_fields`** — a VIF wrote a form-field table with a
  first column of `Field / Component` or `Field` instead of `Form Field`. It is still a
  form-field table by the grammar's own definition (`Entity Binding` appears in no other
  shape), so it is classified — and the deviation is a spec finding to report.
- **`§Data Mapping traces screen "x"`** — an id in §Data Mapping that matches neither
  §Screen Blueprints nor any task-screen block label. Either the task-screen pass skipped a
  screen (taking its columns, query params, not-displayed fields and panels with it) or the
  VIF invented an id §Screen Blueprints never declared. Different owners — check which.

> ⚠️ A **required section absent** from the VIF (`🚨 GRAMMAR CONTRACT`) is a PnC finding, not a
> hole for this run to fill. Say which section and which coverage class is therefore thin.
> ⚠️ A `task_screen` block on a VIF whose subtype is generic or shell is Gate G9's problem —
> report it, do not model it.

**2c-visual. Visual business rules — MANDATORY source scan.**
For every `business_rule` whose `expected_outcome` mentions color/variant/animation/CSS:

1. Follow imports to the leaf component that renders the element. Extract the exact `className` / `variant` token per state. Prefer the most unique class (`bg-green-500`, not the full class string).
2. Fill `visual_assertions`: `type` (`has-class` | `has-attribute` | `has-animation`), `selector_scope` (Playwright locator scoping to the element), `value` (shortest unique substring), `note` (source file + const).
3. Update `expected_outcome` to quote the exact class.

> ⚠️ shadcn `variant="..."` without custom `className` → use `has-attribute` on `data-slot="badge"` and assert class contains the variant token. Never invent classes not in source.
> ⚠️ Source not accessible → `visual_assertions: []` + comment `# MANUAL: check source for badge CSS class`.

**2c-validation. Field validation matrix — MANDATORY for every form input.**
Each input has up to 4 dimensions. Emit one entry per dimension that applies — never collapse `;`/`and`/`,`-joined source rows.

| # | Dimension | Where to fill |
|---|-----------|---------------|
| 1 | **Required** (mandatory / conditional) | `validations[]` `constraint: "required"` |
| 2 | **Format** (regex / enum / IANA / E.164 / email / URL / ISO-8601 / JSON / numeric / uuid) | `validations[]` `constraint: "format"` + `description:` verbatim |
| 3 | **Boundary** (min/max length / value / date) | `boundary_constraints.<field>.min` / `.max` |
| 4 | **Cross-field** (after X / matches Y / differs from Z) | `validations[]` `constraint: "cross-field"` + `description:` |

Procedure:
1. List inputs from VIF Component Tree (or element-map.json). Build `(field × 4)` checklist.
2. Quote findings verbatim from sources, in this priority: VIF §Validation Rules / §Interactions → Entity spec §Properties / §Invariants / **§Behaviors** (0.3 alias: `## Domain Methods`) → Use Case §Preconditions / §Acceptance / **§Extensions** → Decision Spec. On grammar 0.4 the ES `## Properties` row itself carries the answer for dimensions 1 and 3 in dedicated columns — `Required`, `Nullable`, `Default`, `Normalization`, `Constraints` — so a blank cell is now an explicit *no constraint*, not an unknown; and CT `## Request DTOs` adds `ValidationTier` (`compiler` = rejected by the generated validator, `manual` = hand-written check) plus `Binding` (`reject-at-boundary` = 400 before the domain is reached, `bind-through` = the domain guard is the only gate). Use those two columns to decide whether the negative TC should expect a **client-side block**, a **400 at the boundary**, or a **domain error surfaced as 409/422** — guessing the layer is what makes a negative TC pass vacuously.
3. Emit one entry per filled cell. Silent cells get explicit `# NO_<dimension>_<field> — <reason>` comment — **silent omission forbidden**.

**Dimension 5 — the message LIFECYCLE (no spec source declares it).** The four dimensions above
only cover the direction the spec writes down: the message **appears**. Nothing in any VIF / UC /
ES ever mandates that it **disappears** once the user fixes the field, so a form whose validation
state is write-only stays green — observed on Decision Recording: `Rationale` kept showing
"Rationale is required" after a valid value was typed and the field blurred, with 82/82 TCs green.
No spec authoring is needed: the generator derives the lifecycle TCs from the `required` entries
you filled above (`category: validation-lifecycle`, one `clear-on-valid` TC per required field
plus `pristine` / `reappear` / `reset`), and the Step 4.5 gate hard-blocks when a required field
has none. Read [references/validation-lifecycle.md](validation-lifecycle.md) before
touching those TCs — the oracle accepts clearing on change OR on blur and fails only when the
message survives both, and a violation is an **out-of-spec UI/UX bug**, never a spec violation.

> ⚠️ Split multi-rule strings. `phoneNumber | Required; phone format` = TWO entries, not one.
> ⚠️ Resolve `depends_on: [ES-*]` even if not in `SPEC_FILES` — entity spec is authoritative for boundary/format.
> ⚠️ Spec-required but code-missing → still emit TC + wrap with `test.fail(true, 'BUG: <spec_ref> not implemented')` per §6c. Removing the annotation later = fix signal.

**2c-exception. Error catalogue + screen states — MANDATORY for every data-backed page.**
Every page that fetches data MUST enumerate its unhappy states so the generator can emit
EXECUTABLE bug-catching TCs (`build_exception_test_cases`). Fill, even when the exact copy is unknown:
- `error_messages[]` — **one entry per (status × endpoint)**. The generator is endpoint-aware
  (`derive_api_patterns` → collection vs item), so you must enumerate failures for EACH endpoint
  the page calls, and the `trigger` text is what routes the entry to the right endpoint:
  - **Collection / list** (`GET …/things`): `5xx/error`, `403/forbidden`, **`401/session-expired
    (in-session)`**, optional `404/empty`. Write the trigger against the bare collection path.
  - **Item / detail** (`GET …/things/{id}`): `404/not-found`, `403/forbidden`, `5xx/error`. The
    trigger MUST reference the item path (`/{id}` or `/*`) or say "clicked"/"detail"/"opened" so
    the entry is classified ITEM-scoped — otherwise it collapses into a collection TC and the
    detail variant is silently dropped (this was a real miss: SOP Browser had detail-403/500 gaps).
  - Set `status_code` (or a clear `trigger`); `ui_text` is optional (exact on-screen substring once
    you've seen the build — else the TC asserts the relevant content anchor is hidden).
  - **On grammar 0.4 stop inferring scope from prose — read CT `## Error Responses` `Applies To`.**
    That column lists the exact operationIds each error belongs to, so the collection-vs-item
    classification is now a lookup, not a guess. Carry it onto the entry as `applies_to:` and
    write the `trigger` to match that endpoint's path. An error whose `Applies To` names an
    operation the VIF binds but which you cannot route to a declared `api_contracts[]` endpoint
    means the page calls something the CT never scoped — report it (see 2c-errormap). Take
    `ui_text` verbatim from the CT `Message` cell; `{id}`-style placeholders make the string a
    **prefix/substring** assertion, never an exact match.
  - **401 is emitted twice**: an in-session 401 (data API returns 401 while authenticated → no
    stale rows) AND the unauthenticated→sign-in redirect. List one 401 entry; the generator does both.
- `screens[].states` — include `Loading`, `Empty`, `Error`, `Forbidden` whenever they apply (drives the loading-skeleton + not-found TCs).
- `api_contracts[].endpoint` (or `.pattern`) — REQUIRED for injection. For a master-detail page list BOTH the collection endpoint AND the item endpoint (`…/{id}`); without the item endpoint no detail-scoped error TCs can be generated.
- `testing_scope.content_anchor` — text present ONLY on the populated LIST. Collection exception TCs assert it is HIDDEN on 404/403/5xx/401 — a copy-independent bug-catcher.
- `testing_scope.detail_content_anchor` — text present ONLY inside a successfully-loaded DETAIL (dialog/sheet/panel), e.g. a steps line or a field value. **Required to make item-scoped (drill-in) error TCs executable** — they click the first row to open the detail, then assert this anchor is HIDDEN on detail 403/404/500. Omit it and the item TCs degrade to visible `spec_only` stubs.
- `business_rules[].alternate_values[]` — for enum/threshold variants the single live record cannot render (e.g. ControlSignal Adjust/Pivot/Investigate). Each mutates the API response so the variant renders, then asserts label mapping + distinct colour.

> ⚠️ Do NOT leave error states implicit because "the copy isn't in the spec". The trigger/status is what matters — the generator injects it via `page.route` and asserts the app degrades gracefully. A TC that FAILS here is a real finding, not a flaky test.
> ⚠️ Per-endpoint completeness: a page with a list + a detail dialog needs ≥7 exception entries (collection 5xx/403/401[/404-empty] + item 404/403/5xx). One generic "API error" entry is under-specified.
> ❌ Do not put descriptive prose in `ui_text` — it is asserted verbatim. Prose goes in `message`; `ui_text` is the literal on-screen substring or blank.

**2c-panel. Openable secondary data surfaces (expander / tab / drawer) — MANDATORY, one `api_contracts[]` entry each.**
A page usually fetches MORE than the primary list + detail: a **Version History** expander, an **Activity** tab, a **related-items** drawer — anything the user *opens* that fires **its own** fetch. `derive_api_patterns` only classifies the FIRST collection + FIRST item, so every additional data endpoint used to be silently dropped: its panel could error with **zero** test noticing — nothing ever asserted it *loads*. (Observed as Bug #145535: Version History `400`'d on the deployed app yet the suite reported 38/38 PASS, because the only TC touching it asserted `no edit/delete control` — an errored panel satisfies that too.) The fix is **endpoint-agnostic** — declare each such surface and the generator covers it:
- Add an `api_contracts[]` entry with `endpoint`/`pattern`, `method: GET`, a `trigger` that names the **open action + control label** (`"Expand Version History in detail sheet — GetGoalRevisionHistory"`), a `success`, and an `error` (put the 5xx copy in quotes: `"500 → 'Unable to load version history.'"`).
- `build_exception_test_cases()` then emits, for that surface, **BOTH**:
  - a **load-SUCCESS** TC (no mock) — opens the surface and asserts its content loads / the error copy is **hidden**. On a live-broken surface this FAILS. This is the check that was missing.
  - a **load-ERROR** TC (mock 5xx) — asserts the declared error copy surfaces gracefully (no crash / no silent-empty-as-success).
- The generator only auto-covers a **user-openable** surface (a discrete open verb in the `trigger`, **or** a nested sub-resource path `…/{id}/x`, **and** a clean short control label). A background/supporting fetch (e.g. a dropdown-populating call) is intentionally skipped — its failure is exercised by the flow that consumes it.
- **A surface state is not binary. Model THREE states, not two (ok / error).** A data surface commonly has an **Empty** state distinct from both success and error — a never-populated panel (e.g. a pre-activation history). The 2-state model (load-ok / 5xx-error) let two whole state branches ship uncaught, each a real bug:
  - **Empty-state oracle (Bug #145660 class).** Put the spec-mandated empty copy on the `api_contracts[]` entry as `empty: "No … yet."` (from VIF §Component Tree **Empty State**). When BOTH `empty:` and a quoted `error:` copy are present, the generator emits a THIRD TC: mock the surface **404 / no-rows** → assert the **empty copy is visible AND the error copy is hidden**. This catches a UI that routes "no data yet" (404/204) into the **Error** state (scary Retry) instead of the calm Empty state. Fully mockable — no seeding.
  - **State-fit layout (Bug #145661 class).** The generator also emits a `layout_stress.surface: state` TC that forces the surface into its **error** state (mock 5xx), opens it, and asserts (`assertControlsWithinContainer`) that every interactive control (alert + Retry) stays within the detail-surface right edge. This is a layout break that appears with **normal data** in a non-default state — the long-no-space overflow guard (Step 4d-auto) never triggers it because there is no long string.
> ⚠️ The load-success assertion uses a **page-wide `text=` selector**, not a `<main>`-scoped `getByText` — these panels render in a dialog/sheet **portal outside `<main>`**, where a scoped query would miss the text and pass vacuously (the very failure being fixed).
> 🚫 The Step 4.5 gate HARD-BLOCKS (dimension 2 → <3) when: (a) an openable data surface has NO TC referencing it, **or** (b) a surface declares an `empty:` copy but no TC asserts its Empty≠Error state (#145660), **or** (c) a surface has an error state but no `surface: state` layout TC (#145661). Declaring the `api_contracts[]` entry (with `empty:` where a distinct empty state exists) is what supplies the coverage the gate demands.

**2c-enforcement. Domain invariants + behavior guards — MANDATORY when the ES spec has a `## Invariants` or `## Behaviors` (0.3 alias `## Domain Methods`) section.**
The field pass emits VAL/boundary, the HTTP pass emits 4xx/5xx exceptions, and the state-machine pass emits only the **success** direction of each transition. A **server-side guard** is the rejection direction, and NONE of those passes read it — so it produces **zero** negative coverage unless declared here. (This is exactly why `Activate(): StartDate ≥ now` shipped untested until a human asked.)

On grammar **0.4** both guard sources are machine-readable, so there is no longer any excuse for a missed guard — read them literally, do not paraphrase:

**Source 1 — `## Invariants`, one guard per row.** The 7 columns are `ID | Target | Kind | Arguments | Category | Error Code | Description`. `Kind` + `Arguments` give you the violating input mechanically; `Error Code` is the oracle key; `Category` tells you which layer rejects (`argument` = constructor/setter, `business` = a behavior guard). Closed `Kind` vocabulary observed across the corpus (316 rows, 18 kinds) and the violation each one demands:

| `Kind` | Violating input to seed |
|---|---|
| `not-blank` | `""` and `"   "` (both — a whitespace-only value passing is the classic miss) |
| `not-empty` | empty collection / `[]` |
| `max-length` | `Arguments` `value=N` → send exactly `N` (must pass) and `N+1` (must be rejected) |
| `range` | below min, exact min, exact max, above max |
| `allowed-values` / `forbidden-values` | one value from outside / inside the set |
| `required-when` / `required-iff` | satisfy the `when=` condition, omit the `property=` — **and for `required-iff` also the reverse**: supply the property while the condition is false |
| `forbidden-when` | satisfy `when=`, supply the forbidden property |
| `allowed-when-state-in` | set the property while the entity is in a state **outside** `states=[…]` |
| `terminal-state` | attempt any transition from a state in `states=[…]` |
| `exactly-one-present` / `mutually-exclusive` | send **both**, then send **neither** (two TCs) |
| `all-or-none` | send a strict subset of the group |
| `cardinality` | one below and one above the declared bound |
| `unique-by` | two records with the same key |
| `compare` | violate the declared comparison in both directions |
| `json-object` / `json-array` | a scalar / wrong-shaped payload |

**Source 2 — `## Behaviors`, one guard per `throw` in the `Steps:` DSL.** Under each `### {Name}` the `Steps:` block is a numbered DSL, and every `if <cond>: throw '<ErrorCode>'` line is exactly one negative TC with the error code already supplied. The `From State` cell of that behavior's table is the extra guard (attempting the behavior from any other state must be refused). The DSL always has this **shape** — the tokens below are placeholders, one guard per `throw` whatever the behavior is:

```
1. if `$<Property> != @<EN-id>.<Value>`:            throw `'<BcName>:<Entity>:<RuleName>'`
2. if `<param> == @<EN-id>.<Value> and <p2> == null`: throw `'<BcName>:<Entity>:<RuleName>'`
3. if `<param> == @<EN-id>.<Value> and <p2> <= @now`: throw `'<BcName>:<Entity>:<RuleName>'`
4. `set $<Property> = <value>`                      ← a `set` step is NOT a guard; skip it
```
Count the `throw` lines, not the steps. A behavior with 11 steps and 3 throws yields 3 guards.

For each guard add one `enforcement_guards[]` entry — `build_enforcement_test_cases()` emits a NEGATIVE TC (`category: enforcement`, `type: Negative`) that seeds a **violating** state, attempts the guarded action, and asserts it is **rejected + state unchanged**:
```yaml
enforcement_guards:
  - id: ENF-{BC}-{NNN}-{NN}     # ENF-xxx — the gate (dimension 2) BLOCKS if a declared id has no TC
    target: "{BehaviorName}"    # the guarded behavior / domain method, verbatim from ES §Behaviors `### {Name}`
    rule: "{condition}"         # verbatim from the `Steps:` throw line or the Invariants row
    kind: "{Kind}"              # OPTIONAL — the `Kind` cell; picks the violation shape from the table above
    error_code: "{BcName}:{Entity}:{RuleName}"   # DOMAIN code (ES/UC) — the oracle key
    wire_code: "{BcName}:{Resource}:{RuleName}"  # CT §Error Responses code for the SAME condition.
                                #   "" = UNMAPPED (a real and common case) → see 2c-errormap
    violate: "{the state/input that breaks the rule}"
    action_ui: "{how the user attempts it through THIS screen}"
    reject_expected: "{rejected + which state must stay unchanged + where the error surfaces}"
    source: "{ES-id} §Behaviors {Behavior} Steps {N}; {UC-id} Ext {Na}"
```

> Placeholders on purpose. Fill every `{…}` from the specs this run actually opened — never
> carry a value over from another feature's guard, and never treat an example elsewhere in
> this file as a default.
- Source EVERY `## Invariants` row and EVERY `throw` in EVERY `Steps:` block — if a guard is also a value constraint the form blocks client-side (e.g. `max-length`), it still needs a server-side enforcement TC because the deployed app may not enforce it.
- Cross-check against the driving UC's `## Extensions`: on 0.4 each `**Exception — Na.**` names the same error code and is tagged `(Steps: N)`. An ES `throw` with no matching UC Exception, or a UC Exception with no ES `throw`, is a **spec-vs-spec divergence** to report — not something to reconcile silently.
- A shorthand string entry (`- "EndDate must be after StartDate when both set"`) is accepted; the generator fills sensible defaults.
- A `state_transitions[]` entry carrying a `guard:`/`precondition:` field is auto-promoted to a guard — no duplicate needed.
> ⚠️ When the enforcement TC **passes** (operation rejected), the guard is enforced — green. When it **fails** (operation succeeds despite the violation), the guard is unenforced → a real DEV-BUG: keep it red via `test.fail(true, 'DEV-BUG: …')` citing the `source`, so it flips loud when fixed.
> ⚠️ **`error_code` is an oracle, not a label.** When the app rejects the operation but surfaces a *different* code than the guard declares, that is still a divergence to report — the guard fired, the contract did not. Assert the code where the response is observable (`page.waitForResponse` on the mutation), and assert the user-visible consequence (state unchanged) always.

**2c-errormap. Domain error → wire contract mapping — MANDATORY on grammar 0.4, and the richest source of out-of-VIF bugs.**
This pass exists because a whole defect class lives in the **seam** between three specs and is invisible to every other pass: the domain raises an error, the boundary never publishes a code for it, so the UI has nothing to map and shows a generic toast — or nothing. No VIF section mandates the mapping, so no VIF-derived TC can ever catch it. Build the table explicitly:

1. Collect every **domain** error code: ES `## Invariants` `Error Code` column + every `throw '<code>'` in `## Behaviors` `Steps:`, plus every code named in the driving UC's `## Extensions`.
2. Collect every **wire** error code: CT `## Error Responses` `Error Code` column, with its `Applies To` (the operationIds it applies to) and its `Message`.
3. Join them and classify each row:

| Case | What it means | What to emit |
|---|---|---|
| domain code has a wire row, same operation | mapped correctly | normal exception TC asserting the CT `Message` verbatim |
| **domain code has NO wire row** | the condition can occur but the boundary cannot express it — the FE gets an unmapped 400/500 and almost always shows a generic failure | an enforcement TC with `wire_code: ""` **plus a reported finding**: cite the ES/UC line and the CT §Error Responses gap. This is a **spec gap (PnC)** when the CT is silent, a **dev bug** when the CT declares it and the API doesn't return it |
| **wire row has no domain source** | the boundary declares a condition the domain no longer enforces — a stale contract row | a TC that forces the condition and asserts the declared behaviour; if the app silently accepts, report the CT row as stale |
| codes differ only by namespace | the domain code keys off the **entity** and the wire code off the **resource** — `{Bc}:{Entity}:{Rule}` vs `{Bc}:{Resource}:{Rule}`, same `{Rule}` | expected — record the pairing, do not report |
| `Applies To` omits an operation the VIF binds | the VIF's trigger can produce an error the CT never scoped to that endpoint | report; emit the exception TC against the endpoint the VIF actually calls |

**Three recurring shapes, named so you can recognise them on any BC.** Each was first
observed on the CaptureInbox cluster in 2026-08, and each is invisible to a VIF-only pass:

| Shape | Signature | What to do |
|---|---|---|
| **Domain error with no wire code** | ES `Steps:` throws it and the UC `## Extensions` names it, but the CT has no row for that condition — two adjacent UC exceptions collapse onto one wire code | one enforcement TC that forces the condition + a reported gap. `wire_code: ""` |
| **Stale wire row** | the CT still declares an error the UC/ES deliberately stopped enforcing (the behavior now silently normalises the value instead of rejecting it) | force the condition, expect **success** + the normalised field, and report the CT row as stale |
| **Deliberate cause-collapse** | one status maps several distinct causes (not-found / wrong-state / nothing-to-do) into one undifferentiated outcome, stated as intentional in the CT's own note | **one** TC, and note the collapse. Do NOT file one bug per cause |

> ⚠️ Those three examples are dated observations, not standing facts — a CT row gets added, a
> UC exception comes back, a collapse gets split. **Re-derive the join from the specs this run
> opened** and never cite a remembered instance as current. What generalises is the three
> shapes and the 5-case table above them, not any particular error code.

> ⚠️ Use the VIF's own annotations as the cheapest input to this pass, not as a substitute for it.
> `<!-- CT-GAP: … -->` is a gap the VIF author already found (treat as a **candidate finding**,
> re-verify against the current CT before reporting). `<!-- COVERAGE: … -->` names UC steps
> deliberately handled elsewhere — read it **before** filing "feature missing", it is what
> prevents false bugs. `<!-- ERROR-SURFACE: … -->` says two errors intentionally share one
> surface — do not report the shared surface as a defect.
> 🚫 A domain code with no wire row and no emitted TC is a silent hole. If you cannot reach the
> condition through the UI, still emit the TC as a visible `spec_only` stub with the gap in
> `expected` — never drop it.

**2c-nav. Reachability — copy `**Nav:**` into `nav_entry:` when the VIF declares one.**
Every other TC in a suite arrives by `page.goto(route)`, so a screen whose menu entry was
never wired reports **100% GO while no user can find it**. That has already happened on this
platform. `nav_entry: {leaf, parent}` produces one TC that starts at the application root and
clicks its way in.

Two rules keep it honest:

- **`**Nav:**` is the trigger, never `**Route:**`.** Every VIF declares a route — including
  embedded panels (a VIF whose surface is a panel inside another page, not a page of its own) and drill-in
  detail screens reached from a list row. Demanding a menu entry for those fails correct
  screens. A VIF with no `**Nav:**` gets no nav TC, and that is not a coverage gap.
- **The oracle is reachability, not location.** Nav bar or sidebar both pass — apps put
  entries in either. Only absent from **both** is the defect.

⚠️ On first use for a feature, confirm the label by hand before filing. `**Nav:**` belongs to
the same machine-generated family as `**Route:**`, which was measured wrong on 8 of ~20 VIFs.
A stale label is a spec defect, not a missing menu entry — different owner, different bug.

**2c-a11y. Accessibility — assert what the VIF declares, and only that.**
`## Accessibility` is a real VIF requirement, not an optional extra: 33 of 36 VIFs fill all
five bullet groups, and the clauses are concrete enough to assert verbatim — `role="dialog"` on
a named sheet, `aria-live="polite"` on a named region, "auto-focus {field} on open",
"{Badge} uses {icon} + '{label}' text (not color alone)". Emit **one TC per bullet** —
`category: a11y`, typically 5–8 per VIF — with `spec_ref` citing the group
(`{VIF-id} §Accessibility {group}`). Copy each clause **verbatim**; never paraphrase it and
never carry one over from another VIF.

**The scope is the section. Nothing outside it.** No WCAG sweep, no landmark audit, no
contrast ratios, no keyboard contract the VIF is silent about. When the VIF says
*"No non-standard interactions — browser defaults apply"*, emit **zero** a11y TCs.

**Read [references/a11y-scoped.md](a11y-scoped.md) before writing any of them.** Three
traps in that file have each already cost a false finding on this project:
- reading `activeElement` immediately after `Tab` instead of polling the settled value, and
  placing the focus-trap sentinel *outside* the dialog — together these produced the false
  focus-trap bug **#147402**;
- sampling a toast once instead of polling it — produced the withdrawn bug **#148977**
  (Sonner auto-dismisses in ~4s);
- asserting `toBeVisible()` on a Base UI `Switch`/`Checkbox` `id`, which sits on a hidden 1×1
  `<input>` — a **guaranteed pass** whatever the UI does, and `.click()` times out on it.

> ⚠️ If a clause is unassertable through the DOM, emit it as a visible `spec_only` stub with
> the reason — never drop it silently.
> ⚠️ VIF silent on a behaviour that still looks broken → an observation for the run report, not
> a TC and not a bug. Never manufacture an a11y mandate (see [[no-spec-claim-without-evidence]]).

**2c-seed. Seed recipes block — data-independence policy (mode-conditional).**

> **Principle — tests should not depend on ambient DB data.** A live database can be
> wiped/reset at any time; a TC that asserts against a record that merely *happens to
> exist* fails the moment that record is gone. Default posture is **hermetic**: a TC
> either creates (seeds) the entity it reads, or mocks it.
>
> Applied by backend mode:
> - **`BACKEND_MODE=real` → self-seed is the HIGHEST priority.** For every real-mode
>   page whose TCs drill into a detail / edit / click a specific row / assert a named
>   record, you SHOULD fill `seed_recipes:` so the test creates that entity itself and
>   reads it via `seedData.<key>`. Do **not** point assertions at a pre-existing
>   id/name (e.g. a hard-coded initiative GUID). Falling back to an ambient record is
>   allowed **only when seeding is genuinely impossible** (e.g. time-based staleness,
>   an entity with no create endpoint) — when you do, leave a `# AMBIENT: <reason>`
>   note on the step so the dependency is explicit, not accidental.
> - **`BACKEND_MODE=mock` → use the UI's existing/mock data.** MSW / `page.route`
>   fixtures already provide deterministic data, so no API seeding is needed; tag those
>   TCs `fixture` (see 2c / Step 4b). `seed_recipes:` is not required for mock-only runs.

Add a top-level `seed_recipes:` block to the spec YAML with `cleanup:` (pre-run marker sweep) and `seeds:` (per-entity POST recipes, `scope: beforeAll|beforeEach`, with `exposes` keys consumed by TCs via `seedData.<key>`). Step 5.6 upserts this into the shared registry `setup/seed-recipes.generated.ts` (one entry per feature, shared engine in `setup/seed-runtime.ts`) — no per-feature file. See `templates/spec-template.yaml` for the full schema.

> ⛔ **Seeded content is BUSINESS-MEANINGFUL — a placeholder token is a defect.** Every
> seeded value must read like a record a real user of **this** screen would have entered.
> Derive the wording from the screen's own domain vocabulary: the VIF title and its
> §Purpose, the driving UC's actor + goal, the meaning of the ES property being filled.
> A note field on a purchasing screen gets *"Hàng dễ móp, yêu cầu đóng thùng carton và
> chèn xốp trước khi giao"* — not `MinhVoTest_x9f`, not `TEST-AUTO-Note-1`, not
> `"Seeded by automation skill"`, not `test` / `abc` / `string` / lorem ipsum.
>
> Two reasons this is a rule and not a nicety:
> 1. **The dev DB is shared.** Rows named `MinhVoTest_*` are unreadable litter to everyone
>    else looking at that screen, and nobody can tell a stale one from a live one.
> 2. **Placeholder text is a weak oracle.** A screen that truncates, wraps, or mis-escapes
>    real sentences renders `abc` perfectly. Business prose exercises the real rendering.
>
> **Naming contract** — one shape, applied per field:
>
> | Field kind | Shape | Example |
> |---|---|---|
> | The ONE field `cleanup.list_filter` matches | `<business text> [AUTO] ${suffix}` | `"Cut customer onboarding cycle time to 5 days [AUTO] ${suffix}"` |
> | Machine field the user never reads (slug/code/key/taskType) | `auto.seed.${suffix}` | `"auto.seed.${suffix}"` |
> | Free text nothing filters on (description, rationale, notes, steps) | pure business prose | `"Onboarding averages 11 days; the contract→provisioning handoff is where it is lost."` |
>
> - `[AUTO]` is the constant machine marker — the only reason a robot token appears at
>   all. Drop it and the row can never be swept, which is strictly *more* DB garbage.
>   Cleanup filters on it with the regex op: `list_filter: "title~=\\[AUTO\\]"`.
> - `${suffix}` MUST be the **last whitespace-delimited word**. `seededAgeMs()` in
>   `setup/seed-runtime.ts` decodes the row's age from the base36 token before the first
>   `_` of that last word. Glue it onto a prefix (`TEST-AUTO-Objective-${suffix}`) and the
>   age reads `null`, `stale_after_ms` classifies the row "too young to touch", and the
>   sweep never deletes it — the exact mechanism behind the current backlog.
> - Mark exactly ONE field per entity. Marking every field is what made the old rows
>   unreadable.
> - Values that must be **distinguishable from each other** (an ordering test, a filter
>   test) get distinguishable *business* text — `"Approve automated provisioning"` vs
>   `"Defer the CRM migration"` — never `Seed decision 1` / `Seed decision 2`.

**2c-layout. Layout-stress block — MANDATORY when a free-text field is rendered anywhere (repeating rows OR a detail surface).**
Fill `layout_stress` when the feature renders free-form text (names, reasons, descriptions, observations) either in cards/rows/tables **or** in a single-record detail Sheet/dialog/panel. Catches overflow, row bloat, `undefined` render. Skip only for static forms or fixed-enum-only pages.

Fields:
- `row_selector` — stable selector for ONE row (`[data-slot="..."]` > testid > role+name). Optional when only a `detail_surface` is stressed.
- `baseline_row_field` — short-value field for baseline row-height measurement.
- `stress_fields[]` with `type`: `free_text` (→ `longNoSpace` + `empty`) | `free_text_multi` (also `longSpaced`) | `free_text_intl` (also `cjkEmojiRtl`). Shared by both surfaces.
- `only_when` (optional) — gate on sibling value (e.g. `FailureReason` only when `Status: Failed`).
- `detail_surface` (optional but **MANDATORY when a free-text field is echoed in a Sheet/dialog/detail panel**) — the row pass only stresses list rows; a long **no-space** value overflows a detail Sheet title / full-text box independently of any row, and the row mechanism never touches it (this is exactly how the Capture Inbox triage-screen overflow — Bug #145274 — slipped through). Keys:
  - `container_selector` — the surface whose horizontal overflow is asserted (e.g. `[role="dialog"]`).
  - `text_selectors[]` — element(s) rendering the field inside the surface (title + body); each must stay within the container bounds.
  - `open_step` — how to open the surface (e.g. "Click the first queue row to open the triage-screen").
  - `item_api_pattern` — the detail (item) API glob the bad string is injected into (e.g. `/api/governance/capture-inbox/*`).

> ⚠️ **Verification-Fixtures are an overflow oracle (Spec is the Oracle).** Scan the VIF §Verification Fixtures for any fixture that mandates long text rendered "without overflow" / "truncates … full text visible" on a **named surface** (list vs. detail). Wire the named surface into `layout_stress` — if the surface is a detail Sheet/dialog, it MUST go in `detail_surface`, not just `row_selector`. A fixture like `fix-gov-001-03` ("full text visible in **triage-screen** without overflow") is a spec-mandated assertion, not a nicety.
> ⚠️ Never stress fixed-enum fields (Status, Priority, Role) — produces noise.
> ⚠️ No free-text anywhere (rows or detail) → `layout_stress: null` (skip).
> ⚠️ **On a spec DELTA re-test, re-derive `stress_fields` from the CURRENT column list.** A delta that adds a column (VIF §Data Binding / the list DTO) must add it to `stress_fields` in the same edit — otherwise every sentinel-injection TC keeps stressing the old columns and the new one ships untested. Any column whose value is **server-resolved free text with no length bound in the CT** (a display name, a title, a fallback identifier) is an unbounded-cell risk and belongs in `stress_fields`. This is the omission behind Bug #149093.

**2c-assert. Every oracle you write in prose must ALSO be written as a machine-readable `assert:` block.**

This is the single highest-value block in this file. Measured on the corpus before it existed: **775 of 2016 generated tests (38%) had no `expect()` in the body at all** and reported PASS whatever the app did — including all 8 user-flow happy paths of VIF-GOV-003, while the quality gate scored User Flow 5/5. The cause was not a weak oracle. It was that prose is the only thing that reached Step 6, where a three-keyword regex (`success` / a few error words / `displayed|visible|shows` + a quoted string) tried to guess an assertion and, on oracles averaging 288 characters, matched nothing 41 times out of 41.

Do not try to write prose the regex can parse. Write the `assert:` block. `generate_scripts.compile_assertions()` translates it 1:1 with no inference, and **raises rather than skipping** anything it does not recognise — a malformed oracle fails generation instead of silently producing an empty test.

The vocabulary is closed. One key selects the form:

```yaml
assert:
  - text: "Goal created"              # copy is on screen (substring, case-sensitive)
  - text: "Deactivate"                # …or must NOT be
    absent: true
  - text: "No goals set."
    in: "main"                        # optional CSS scope
  - element: "#sg-target"             # CSS selector, or role=button[name=Set Goal]
    state: editable                   # visible|hidden|enabled|disabled|editable|focused|empty|not-empty|checked
  - element: "#sg-start-date"
    state: not-empty                  # use when the correct content is COMPUTED (today-30d, a generated
                                      # code) so no exact literal can be named — still fails a blank field
  - rows: ">0"                        # =0 · >0 · >=2 · <5 …
    of: "tbody tr"                    # optional; defaults to tbody tr
  - attr: "aria-expanded"
    "on": "[data-slot=accordion-trigger]"   # QUOTE the key — YAML 1.1 reads bare `on` as true
    equals: "false"
  - url: "/governance/goals"
```

**Where it attaches.** Anywhere an oracle is already authored — the builders carry it from these seven places and nowhere else:

| Spec location | Reaches | Note |
| --- | --- | --- |
| `user_flows[].steps[].assert` | the UF happy-path TC | Emitted **in position**, right after that step's code. An `element: role=dialog, state: visible` on the open step and `state: hidden` on the submit step is correct and must not be hoisted. |
| `user_flows[].assert` | the same TC, at the **end** | The flow's final outcome — the machine-readable twin of `expected_outcome`. Use it for what must hold once the whole flow has run; use the per-step key for anything that is only true mid-flow. |
| `state_defaults[].assert` | the boot-state TC | Only rows with `observable: control`. |
| `a11y_requirements[].assert` | the a11y TC | One per clause group. |
| `enforcement_guards[].assert` | the negative guard TC | Assert the observable consequence, not the wire code. |
| `vif_acceptance_criteria[].assert` | the AC-gap TC | |
| `error_precedence[].assert` | the precedence TC | The `Display` cell almost always already quotes the copy — lift it verbatim. |

**Rules.**

1. **Ground every selector in the element map.** `#sg-target` because `analyze_page.py` found that id. Never invent one; a selector that matches nothing asserts nothing.
2. **Write the oracle the SPEC states, not what the app does.** VIF-GOV-003 declares TargetValue is Sovereign-typed, so the oracle is `state: editable` — and it correctly goes RED against a deployed build where the field is disabled (bug #147303). Relaxing it to `disabled` to get green is absorption; see the Spec Supremacy rule in SKILL.md.
3. **Attach the oracle to the step that produces the state**, not to the flow as a whole.
4. **Prose still matters** — `system_response` is carried into each step's `expected_result` and is what a human reads in review. Write both; they are not redundant.
5. **A section with no derivable assertion is a finding, not a blank.** If the VIF names no observable outcome, say so in the row rather than leaving `assert:` off silently — the Step 4.5 gate now names every TC that renders without an oracle and blocks on it.

**2d.** Write to `spec/ui/{feature}-spec.yaml` — **flat, one file per feature, no date folder.**

> ⚠️ **If the file already exists, OVERWRITE it.** It is the current oracle, not an archive: a re-test must leave exactly one spec per feature. Read the existing file FIRST and carry forward anything still true (it is the previous run's oracle), then write the reconciled result over it. Never write a second copy under a date folder — that is what produced 93 files across 59 folders before the 2026-08-20 cleanup.
> ⚠️ **Nothing is lost by overwriting.** `git log --follow spec/ui/{feature}-spec.yaml` lists every run, and `git show <sha>:<path>` restores any earlier version verbatim. The date folder was never a reliable record anyway — `spec/ui/2026-04-24/foundry-spec-factory-specs-new-spec.yaml` carried `date: "2026-04-21"`.
> ⚠️ **REQUIRED provenance keys** (top-level metadata, per `templates/spec-template.yaml`). These, not the path, are what make a run auditable:
>
> ```yaml
> date: "2026-08-20"          # REQUIRED — the day THIS run synthesized the spec
> updated: "2026-08-20"       # REQUIRED
> work_item_id: "148743"      # REQUIRED — $WORK_ITEM_ID
> run_backend_mode: real      # REQUIRED — $BACKEND_MODE; a mock-mode oracle is NOT evidence about the deployed build
> vif_id: "VIF-KNW-001"      # REQUIRED — HARD GATE: Step 4 exits 1 without these three
> vif_version: "1.6.0"       # REQUIRED — copy the resolve_specs.py block; never re-type
> vif_grammar: "0.3"         # REQUIRED — "0.4", or "0.3" (allowed, flagged as a fallback)
> source_specs:               # REQUIRED — every oracle read, each WITH its version
>   - "VIF-{BC}-{NNN}_{Screen_Name}.md v{X.Y.Z} (updated {YYYY-MM-DD})"
>   - "UC-{BC}-{NNN} v{X.Y.Z}"
> supersedes: "2026-07-23"    # OPTIONAL — the date: of the version this run replaces (omit on a first run)
> ```
>
> Halt and ask rather than guessing a version — an unversioned `source_specs` entry makes every downstream STALE/UNCOVERED judgement unprovable, and `run_backend_mode` is what stops a mock-mode pass being reported as a deployed-build GO.
> ⚠️ `{spec_yaml}` variable is now set to the output path. All subsequent steps use `{spec_yaml}` instead of `$SPEC_FILE`.

---

