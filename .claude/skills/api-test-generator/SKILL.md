---
name: api-test-generator
description: Generate and execute API test cases by scanning spec files and Swagger, then produce an HTML report. Scans specs/ and .specs-0.3/ automatically. Runs tests via Playwright test-runner (raw fetch + hard assertions), producing JUnit + HTML report.
when_to_use: >
  Use when asked to create API tests, validate endpoints, or test a specific API.
---

# API Test Generator

## Configuration

Config source: `.env` at `apps/testing/automation-testing/be-testing/`

| Variable         | Required | Meaning                              |
| ---------------- | -------- | ------------------------------------ |
| `SWAGGER_URL`    | Yes      | Swagger/OpenAPI JSON endpoint URL    |
| `API_BASE_URL`   | Yes      | Test execution base URL              |
| `TEST_USERNAME`  | Yes      | Test account email (password-grant login) |
| `TEST_PASSWORD`  | Yes      | Test account password (secret) |
| `API_AUTH_TOKEN` | No       | Auto-acquired by `global-setup.ts` from the credentials above; tests read it via `TOKEN()` |
| `RETELL_API_KEY` | No       | HMAC key for `@retell` webhook-signature tests |

This `.env` also carries per-role credential sets beyond `TEST_USERNAME`/`TEST_PASSWORD`
(e.g. `ENTERPRISE_SOVEREIGN_*`, `BC_SOVEREIGN_*`, `COCKPIT_VIEWER_*`, `SYSTEM_*`) plus fixture
ids (`SEED_*`, `TENANT_ID`, `TEST_BC_CODE`, …). Grep the file's own keys before assuming only
the token above is available — a 403/authz test may need a specific role's credentials, or a
fixture id may already exist instead of needing to be created.

**Never `source .env` (or otherwise let a shell evaluate it) when reading a value for a manual
probe (e.g. login/JWT-decode investigation before writing `test_data`) — parse `KEY=value` lines
yourself instead.** A password containing shell metacharacters (`()@~,` confirmed present in this
repo's own `TEST_PASSWORD`) breaks `source`'s parsing and can echo the secret straight into a
shell error message. Read the file line-by-line (a `.split('=', 1)` in Python/Node, or `grep` for
one exact key) rather than sourcing or eval-ing it.

**Never echo the actual VALUE of any credential — `TEST_PASSWORD`, `TEST_USERNAME`,
`RETELL_API_KEY`, `API_AUTH_TOKEN`, any `*_PASSWORD`/`*_SECRET`/`*_API_KEY` var, or an acquired
Bearer token — in chat output, a tool command's printed/logged output, a generated `test-cases.yaml`
`bug_notes`/`notes:`, or a `.spec.ts` comment.** Reference credentials by variable name only (e.g.
"logged in via `TEST_USERNAME`/`TEST_PASSWORD`, decoded the JWT `sub`"), never by pasting the
secret itself. This applies even when a step above requires reading the value to actually perform a
login or decode a JWT — read it into a variable/into memory and use it, don't print it en route
(e.g. no `print(password)`, no `console.log(process.env.TEST_PASSWORD)`, no command whose own
argument list echoes it to a terminal that gets captured). A masked/redacted echo (`***`) for a
non-secret status check (e.g. "token acquired: yes/no") is fine; the raw value never is.

**A differently-named credential var is not proof of a differently-privileged account — decode
the JWT before trusting it.** Before writing an active (non-skipped) 403 test against a
role-prefixed credential, log in with it and decode the JWT's `sub`/`role` claims — if it matches
`TEST_USERNAME`'s own `sub`, the test cannot exercise that role and must be `status: skipped` with
the confirmed reason (cite the matching `sub`), not silently written as if it were a real negative
case. See `EXAMPLES.md` → Credential role collapse for a confirmed instance where 5
differently-named `.env` vars all resolved to the same account.

**`{name}` derivation:** be-testing folder/file names follow Node/JS convention — kebab-case
ASCII, no spaces, no `[`/`]`/underscore (confirmed 2026-08-21: bracket/space names broke
Playwright's own path-based test matching, `[`/`]` read as a regex character class). This is
independent of the driving spec file's own naming under `specs/`/`.specs-0.3/`, which stays
PascalCase+underscore (`UC-GOV-025_RouteDrtpToDecisionQueue.md`) — do not rename anything there.
- Kebab-transform the driving spec's own id+title for `{name}`: lowercase, drop `_`/other
  punctuation (collapse to a single `-`), keep the id's digits attached to its BC segment as-is —
  e.g. spec file `specs/mgi-governance/UC-GOV-025_RouteDrtpToDecisionQueue.md` →
  `{name} = uc-gov-025-routedrtptodecisionqueue`, producing
  `uc-gov-025-routedrtptodecisionqueue-test-cases.yaml` and
  `uc-gov-025-routedrtptodecisionqueue.spec.ts`. Do not derive a DIFFERENT name from the endpoint
  path when a driving UC/ES/EV spec exists — always kebab-transform the spec's own id+title.
- No single driving spec (raw endpoint with no matching UC) → fall back to `{last-segment}-{method}`
  (single method, e.g. `practice-config-get`) or `{last-segment}` (no method, e.g. `practice-config`).
- `{folder}` (the parent feature/UC-cluster directory) is likewise kebab-case, derived the same
  way from the parent ADO User Story title (e.g. `[GOV] F1 — CaptureInbox Cluster Implementation`
  → `gov-f1-captureinbox-cluster-implementation`).

---

## Workflow — 7 steps + 2 checkpoints

| Step | Action | Output |
| ---- | ------ | ------ |
| 1 | **Read config** | Extract vars from `.env` |
| 2 | **Scan + filter specs** | Glob `specs/**/*.md` and `.specs-0.3/**/*.md`; keep files relevant to target entity |
| — | **Confirm with user** | See checkpoint below — do not skip. |
| 3 | **Fetch Swagger** | GET `SWAGGER_URL`; extract endpoint schema — ground truth for parameter *names* (see Grammar 0.4 CT Awareness) |
| 4 | **Generate test cases** | Write `test-cases/api/{folder}/{name}-test-cases.yaml` |
| 5 | **Coverage self-audit** | Re-read the driving UC/CT prose sentence by sentence against Step 4's own file; revise it in place if a gap is found — see below |
| 6 | **Generate spec** | Write `script/api/{folder}/{name}.spec.ts` (Playwright, `apiCall` + hard-assert + tag) — then run the Pre-Checkpoint Quality Gate (Step 6) before presenting the checkpoint |
| — | **Confirm before running** | See checkpoint below — do not run without it. |
| 7 | **Run spec** | run `npx playwright test` → `report/junit-{timestamp}.xml` + `report/html-{timestamp}/` |

**Checkpoint after Step 2 — do not proceed on an assumed spec.** Present the user a short list —
one line per kept file: id, its actual relative path (`specs/...` or `.specs-0.3/...`), `status:`,
`grammar:`/`version:` — plus a one-line note on any precedence call made (e.g. "UC-X resolved from
`.specs-0.3/` because `specs/` copy is still `drafting`"). Ask the user to confirm this is the
right spec before moving to Step 3. This applies even when discovery found exactly one file per
id — a single match can still be the wrong file (stale mirror, superseded id, wrong BC folder).
Only proceed to Step 3 after the user confirms; if they redirect ("actually use X instead"),
re-run discovery against the corrected target rather than patching the wrong file's output later.

Include the existing-artifact version-check result (see below) in this same presentation — e.g.
"existing artifact at {path} is current, no regeneration needed" or "existing artifact cites
{id} v{old}, current is v{new} — will regenerate" — so the user confirms (or overrides) that
decision at the same checkpoint, not after work has already started.

---

## Step 2 — Spec Discovery

Scan `specs/**/*.md` · `.specs-0.3/**/*.md`

Keep a file if it contains: field definitions, `VAL-xxx`/`SRV-xxx` rules, state transitions, permissions, or business constraints for the target entity.

For a UC spec specifically, check frontmatter `execution_type` (0.4) or `cqrs_kind` (0.3) before
generating anything HTTP-based — a `Automation`/`EventHandler` UC (or a 0.3 UC whose Main Flow
describes a trigger, not a caller) has no HTTP surface at all; see Grammar 0.4 UC & PM Awareness.

Also keep a **DS** (decision), **PS** (process/BPMN/Zeebe), **EV** (integration event), or **IS**
(analytics) spec whenever it's reachable from the target UC/entity's own cluster — these never
become their own `.spec.ts` file, but feed test cases into whichever UC's file actually calls
them. See `REFERENCE.md` → Grammar 0.4 DS/PS/EV/IS Awareness before deciding these are out of
scope; they usually aren't — they just can't be tested the same way as a UC+CT pair.

Always re-glob at run time — never assume a fixed path for a UC/ES/PM id. The spec tree gets
reorganized between runs (active spec-sync migration), so an id alone doesn't pin down where the
spec currently lives. For each kept file, record its actual relative path and carry it forward
into Step 4's `spec_refs` (id + path), not just the id.

**Directory precedence:** `specs/` is the live spec-sync mirror target (newer grammar, e.g. 0.4)
but may be incompletely populated for a given BC; `.specs-0.3/` is a fuller backfill but can trail
`specs/` by one or more versions. If the same spec id exists in both, diff them and check `status:`
**before** `version:`/`grammar:` — a per-id grammar lift can land in `specs/` at `status: drafting`
while its own sibling specs (ES/PM/VO/CT for the same BC) are already `approved` at 0.4 (see
`EXAMPLES.md` → Directory precedence — UC-KNW-001). `status: approved` wins regardless of
grammar/version; only compare `version:`/`grammar:` among copies that are equally approved. This
means the driving UC and its structural specs (ES/PM/VO/CT) can legitimately resolve from
*different* directories in the same run — cite each from wherever its own approved copy lives,
don't force all of one id's cluster to come from the same directory. Note the discrepancy in
`notes:` if a drafting-only field would otherwise go uncited.

**Exception — don't apply the approved-wins rule in isolation from the driving UC's own cluster.**
Before defaulting to a lower-grammar `approved` copy over a higher-grammar `in-review`/`drafting`
one, check whether the UC's own `depends_on` cluster (its CT/ES/PM) has ALREADY resolved to the
higher grammar. If every sibling spec this UC drives against is already 0.4, resolving the UC
itself from a 0.3-approved copy just re-introduces the retired 0.3 shape (top-level `permission:`,
prose Main Flow, no `execution_type`) into an otherwise-0.4 test run, and its own `## Related`
section may point at the WRONG version of a shared dependency (see `EXAMPLES.md` →
Cluster-consistency exception — UC-GOV-019). This is a genuine tension, not a mechanical
tie-break — surface BOTH candidates and the cluster-consistency observation at the Step 2
checkpoint and let the user decide, rather than silently resolving either way.

Never use
`.mgi-codex/`, `.mgi-codex-v2/`, or `mgi-codex-v2.1/` as spec authority — these are stale mirror
snapshots with no live KNW/current-grammar content; `bpmn/specs/` does not exist in this repo.

**Also glob `test-cases/api/**` and `script/api/**` for a pre-existing artifact for the target
UC/entity before writing anything.** Whether it is authoritative depends on what it can prove
about itself — check this BEFORE deciding to regenerate, so an unchanged spec doesn't cost a full
re-generation pass every time this skill runs (confirmed feedback: regenerating unconditionally
makes preparing test cases/scripts ahead of time pointless — see `spec_refs` versioning below):

- **No version recorded per `spec_refs` entry, or the file predates this convention** (a `.ps1`, a
  bare `.md`, or a `.yaml` whose `spec_refs` cites an id with no version) — informational only,
  never authoritative. A prior suite must not be reused, patched, or trusted as evidence about
  current behavior, even if it currently reports all green — a green legacy result is not
  counter-evidence against a newly-found drift (see `EXAMPLES.md` → Legacy artifact false-negative
  — UC-GOV-011, a confirmed case where a green legacy suite asserted the opposite of the current
  spec). Name its path in the Step 2 checkpoint alongside the specs, and write the fresh suite from
  current spec regardless of what it shows — per this repo's "full suite, ignore old file"
  convention.
- **Every `spec_refs` entry IS versioned** — diff each cited `id vX.Y.Z` against the version the
  current spec file actually carries in its own frontmatter (already resolved by Step 2 above,
  same read that produced the table in the checkpoint).
  - **Every cited version matches exactly** → the existing `test-cases.yaml`/`.spec.ts` pair is
    already current against everything it draws from. State this at the Step 2 checkpoint (e.g.
    "existing artifact at {path} is current — spec_refs match UC-GOV-011 v1.2.6, CT-GOV-002 v0.1.3
    exactly") and **stop — skip Steps 3-7 entirely** for this UC/entity. Regenerating identical
    content from an unchanged spec is the exact wasted effort this check exists to avoid.
  - **Any cited version is older than the spec's current version** — proceed through Steps 3-7 as
    a full regeneration (same "full suite, ignore old file" rule as the no-version case above; a
    partial patch risks missing a cascading change elsewhere in the same file, which is exactly the
    failure mode the full-rewrite convention exists to prevent). Name the stale version(s) at the
    checkpoint (e.g. "existing artifact cites CT-GOV-002 v0.1.0, current is v0.1.3 — regenerating").

This is why every `spec_refs` entry from this point on MUST carry an exact version (Step 4's YAML
template) — an unversioned entry makes this check unprovable on the next run and forces a full
regenerate every time, the same problem this section exists to solve.

---

## Grammar 0.4 CT Awareness

CT specs are migrating from grammar 0.3 (prose Request/Response DTO tables, prose Error
Responses) to grammar 0.4 (structured columns + a machine-parseable constraint DSL). Check the
CT's frontmatter `grammar:` field before generating test cases — what you can read mechanically
differs by version.

**Endpoints table (0.4 adds):**
- `Success Status` — the exact happy-path status *per endpoint*. Do not assume 200 uniformly:
  a `command` creating a resource is commonly 201, a `void` command commonly 204, a `query` 200 —
  but read this column, don't infer from CQRS kind.
- `Response Shape` — `handlerResult` (the endpoint returns its driving UC's own `## Output` shape
  verbatim; the CT has **no separate `## Response DTOs` subsection for it** — open the UC file for
  the field list) | `void` (204, no body — don't call `res.json()`) | `customDto` (CT declares its
  own Response DTO, as in grammar 0.3).
- `Request Dto Ref` / `Response Type Ref` — the exact DTO/UC to open for field-level shape.
- `Driving UC Ref`, `Auth Mechanism` — traceability + confirms Bearer vs a different scheme.

**Request DTO tables (0.4 adds a per-field DSL):** `Condition` (trigger for a `conditional`
Required field, e.g. `tenantId present`) · `Binding` (`reject-at-boundary` = framework/compiler
layer, generic 400 before business logic runs; `—` = not boundary-enforced) · `Constraints` — a
parseable token grammar: `Size(min=,max=)`, `Pattern(regex=...)`, `Format(kind=json)`,
`Range(min=,max=,minExclusive=,maxExclusive=)`, `Default(value=...)` · `ValidationTier`
(`compiler` = framework-level; any other value names a business-layer check) · `Error Ref` — the
exact code to assert (or `— (framework default)` for a generic 400 with no business code).

Derive Step 4's Boundary/Required-Field rows mechanically from this DSL instead of inferring from
prose: `Size(min=1,max=200)` → boundary cases at 0/1/200/201 chars; `Pattern(regex=^[A-Z]{2,5}$)`
→ a case each for too-short/too-long/lowercase/digits; the row's own `Error Ref` names the exact
expected error code. Fall back to prose-derived boundaries only when the CT is still grammar 0.3
(no `Constraints` column present).

**A `ValidationTier: manual` row with a VO/ES-typed field is a POINTER, not the full constraint —
open the referenced VO/ES's own `## Invariants` DSL table for the actual negative-case scenarios,
don't stop at the CT's one-line `Rule Ref`.** A `manual`-tier row exists specifically because the
CT's own Constraints DSL (Size/Range/Pattern/Default) cannot express the check — the real rule
lives one level down, in the VO/ES that owns the field's type, as its own `## Invariants` table
(vo-rules §8 / es-rules equivalent). See `EXAMPLES.md` → Manual-tier VO/ES pointer — UC-GOV-014 /
VO-GOV-003 for a confirmed case where this surfaced a negative case the driving UC's own
`## Extensions` table never mentioned at all — not findable from the UC or CT alone.

**This pointer discipline is not limited to a row explicitly marked `ValidationTier: manual`.** On
a write endpoint (POST/PUT), a `compiler`-tier or entirely unmarked field can still be gated by a
VO/ES invariant the CT's Constraints DSL has no token to express at all — a rule spanning multiple
fields, or one that reads entity state rather than a single field's shape. Before treating a write
endpoint's CT Request DTO table as the complete negative-case list, open the driving ES's own
`## Invariants` table regardless of whether any CT row cites it as `manual` — the CT's own DSL
coverage of an aggregate's invariants is not guaranteed complete just because every row shows a
"normal" tier.

**Corollary — do NOT assume the VO/ES's own per-invariant `Error Code` reaches the wire; verify
live what the actual `error.code` is before asserting one.** A `manual`-tier row's `Error Ref` on
the CT is usually one single generic code shared by every invariant on that field, even when the
VO/ES declares several invariants each with their own distinct `Error Code` (see `EXAMPLES.md` →
Error-code collapse on the wire — VO-GOV-004, where 5 distinct declared error codes all collapsed
to the same generic FluentValidation message live). Test each declared VO/ES invariant as its own
case regardless (each is still a real branch worth a regression test — see Step 5's "3 explicit
conditions = 3 branches" rule), but assert whatever code/message actually appears live, not the
VO/ES's own declared per-row `Error Code` — and note in `bug_notes` when several invariants turn
out indistinguishable on the wire, since that's itself a worthwhile diagnosability finding to
surface to the BC's dev owner.

**Error Responses table (0.4 adds):** `Applies To` — the exact operation-id list a shared error
row covers; use it directly instead of re-deriving from citation prose. `Error Body Schema Ref` is
now a namespaced pointer (`abp:RemoteServiceErrorResponse`, etc.) — same wrapper shape as before
(`{ "error": {...} }`).

**Swagger stays ground truth for parameter NAMES regardless of spec grammar/version.** A spec bump
can document an intended rename before the backend ships it (see `EXAMPLES.md` → Swagger
param-name drift — CT-KNW-001). Always cross-check the CT's Request DTO field names against the
fetched Swagger operation's actual parameters before writing `test_data` — a mismatch is a drift
finding (`bug_notes` / Known Gaps section), never a silent pick-the-newer-name resolution.

**A boolean/presence-style filter needs its POLARITY verified live, not just its name — a
same-shaped renamed parameter can still mean the opposite.** Matching a parameter's name (or even
its type) is not enough to confirm its semantics match (see `EXAMPLES.md` → Boolean-polarity
inversion — UC-GOV-011, where the spec's field names didn't exist live at all and the real
same-shaped parameters had inverted polarity, silently ignored by model binding rather than
erroring). Whenever a Constraints/Notes column describes a field as a presence test, a
`has*`/`is*`/`*IsNull` toggle, or an eq/neq-against-null tri-state, call the live endpoint with BOTH
boolean values (or both tri-state branches) and diff the two result sets before writing `test_data`
— a name match alone only proves a same-shaped parameter exists, not that `true` means the same
thing on both sides.

**Assertions target the spec's claim, not live — this applies to every expected value (status
code, error code, field shape), not only parameter names.** Swagger and a live call may be used to
*confirm* a drift exists and to build valid `test_data`, but the test whose own stated purpose is
to verify that exact contract element (e.g. "endpoint returns the documented success status")
must assert the **spec's** value, so it fails and the failure itself is the tracked signal — see
`EXAMPLES.md` → Assert-spec-not-live miss — UC-KNW-001 TC-01 for the exact mistake this guards
against. Cite the confirmed live behavior in `bug_notes`, but assert spec.
Exception: OTHER tests in the same file that exercise the same endpoint for an unrelated purpose
(a different field's behavior, response shape, a different branch) and would abort before reaching
their own assertion if forced onto the broken spec value may use the confirmed-live value as a
documented precondition — comment/`bug_notes` it as "known drift, see TC-NN", don't silently drop
the fact that it's a drift, and don't duplicate the drift signal across every such test.

**Swagger is not "live" — it is a third, independent document that can be the one that's wrong.**
Spec, swagger, and actual live behavior are three separate claims; two of them agreeing does not
prove anything about the third, it only tells you which pair to trust for that one fact. A test
that asserts spec and passes only proves spec == live — it says nothing about swagger, because
nothing in the test asserts against swagger. So: diff the CT's claims against the fetched Swagger
schema explicitly during Step 2/3 for every fact you're about to assert (status codes and response
shape, not only parameter names) — do this regardless of whether the eventual test is expected to
pass. If spec and live agree but swagger disagrees, that's a **swagger/codegen finding** (a stale
`[ProducesResponseType]`/generation quirk, or a cached `swagger.json` behind the current deploy) —
distinct from a spec-vs-runtime drift, and still worth reporting: anything that generates a client
from swagger (frontend codegen, Postman, another team) inherits the wrong contract even though the
backend and spec agree. Resolve any spec-vs-swagger disagreement with an actual live call, never by
assuming either document is more authoritative than the other.

**A green behavior-test run proves nothing about swagger — make the swagger check its own test,
and make it mandatory, not a judgment call.** TC-01..N asserting spec against a live call only
ever compares spec vs live; nothing there ever looks at swagger, so a swagger-only drift stays
invisible forever behind an all-green report unless something explicitly checks it. For **every**
fact a grammar-0.4 CT declares in its Endpoints table (`Success Status`, `Response Shape`) or
Error Responses table (`HTTP Status`/`Error Code` per row), add one test under a
**`## Doc Conformance`** section that fetches `swagger.json` fresh (plain
`fetch(process.env.SWAGGER_URL)`, no auth needed) and asserts the CT's claim against it directly —
independent of the behavior test for the same endpoint. Do not skip this section because the
behavior test already looks green or already looks red for the same fact — each test isolates a
different pair of the three claims (spec, swagger, live) and only exists to name *which* pair
disagrees; skipping it just because one other signal already exists throws away the one piece of
evidence that tells you whether swagger itself (not just spec-vs-live) is the thing that's wrong.
This turns a one-time manual Step-2/3 diff into a standing regression check that reruns every time
the suite runs, and its failure message names the fact and the swagger-vs-spec mismatch directly
(e.g. `swagger declares success status [200], spec says 201`), instead of relying on someone
remembering to re-diff by hand. There is no CI in this repo (no `.github/workflows`, no
`azure-pipelines.yml`), so every Doc Conformance test only re-verifies when someone explicitly
runs that spec file again — see `EXAMPLES.md` → Doc Conformance precedent file for the one existing
precedent in this repo (which is narrowly scoped to two closed bugs, not a general sweep) and the
fetch pattern to reuse (`process.env.SWAGGER_URL`, once in `beforeAll`).

**Extend Doc Conformance to the Request DTO's own parameter NAMES too, not just Success
Status/Response Shape/Error Responses.** A parameter-name/arity/polarity mismatch (see the two
rules above) is exactly the class of drift likely to silently regress later — a future spec edit
re-renames a field, a future backend change adds/removes a param — with nothing rerunning to catch
it. For a grammar-0.4 CT's Request DTO table, add one `[DOC-NN]` test per documented field
asserting (a) it actually appears in
`swagger.paths[...].get.parameters` (or the request body schema for a non-GET) by name, AND
(b) for a field the CT documents as a list/array type (e.g. `List<EN-GOV-001>`), that swagger's own
parameter schema is *also* array-shaped — not just present under the same name. Name-only checks
and arity checks catch different failure modes — see `EXAMPLES.md` → Doc Conformance precedent file
for a confirmed case where a name-only check alone would have missed an arity-only drift. Both are
cheap (same shared `swagger` fixture already fetched once in `beforeAll`, no extra live call).

**A CT's `Error Body Schema Ref: abp:RemoteServiceErrorResponse` claim is not blanket-true for
EVERY error row — the actual envelope shape depends on WHICH VALIDATION LAYER rejects the request,
not on "GET vs POST" or "framework vs business" alone.** Two structurally different envelopes exist
(`{ type, title, status, errors: {...} }` ASP.NET `ProblemDetails`/`HttpValidationProblemDetails`
vs `{ error: { code, message, ... } }` the ABP wrapper), and a test that only checks `res.status`
never catches which one came back. The split tracks the validation layer specifically:
- **Query-string/route model binding** (ASP.NET's own binder, runs before any handler/validator
  code) → bare `ProblemDetails`, no `error` wrapper at all.
- **JSON request-body validation** (the FluentValidation pipeline ABP wires in front of the
  handler) → ABP-wrapped, with a shared generic `error.code` (`"VALIDATION_ERROR"` — a real,
  stable string, not absent/null despite the CT's own `— (framework default)` phrasing) and a
  `validationErrors` array.
- 401/403 (missing/insufficient auth, checked even before model binding) also return bare
  `ProblemDetails`/`HttpValidationProblemDetails` — confirmed independently via swagger's own
  response schemas (`oneOf: [ProblemDetails, HttpValidationProblemDetails]`), vs a direct
  `RemoteServiceErrorResponse` $ref for business-logic 404/422 rows.

See `EXAMPLES.md` → Error-envelope split by validation layer — UC-GOV-019 / UC-GOV-014 for the
confirmed request/response bodies behind each bullet above.

So: a GET's query-string constraints and a POST/PUT's JSON-body constraints on the SAME CT can
legitimately surface under two different envelope shapes even when both are `ValidationTier:
compiler` rows — don't assume one shape for the whole file based on one already-tested row. Cross-
check swagger's own response schema for the specific status code before trusting the CT's blanket
claim, and for any `Error Responses` row whose `Trigger Condition` is a framework-level check
(model binding, boundary validation, missing/bad auth) rather than a business rule the handler
explicitly throws, add one Doc Conformance–style test that provokes that exact error on that exact
surface (query-string vs JSON body) live and asserts the actual shape — expect the query-string/
route-binding rows to routinely fail against a CT's blanket ABP-wrapper claim until each CT's Error
Responses table is corrected to carve those out separately from JSON-body/business-logic rows.

**Reconciling the three-way result — classify the finding by which pair agrees, don't just report
"drift" and move on.** `swagger.json` is generated *from* the actual backend code, so in principle
it should always equal live — when it doesn't, that itself is a distinct, reportable finding class
(a stale generation artifact), separate from an ordinary spec-vs-implementation gap. With the
behavior test (spec vs live) and the Doc Conformance test (spec vs swagger) both in place, put a
classification directly in `bug_notes` — see `REFERENCE.md` → Drift Classification for the full
4-outcome table (no finding / swagger generation drift / spec-vs-implementation drift / pure
swagger generation bug) and which system needs the fix for each. Never resolve a swagger-vs-spec
disagreement by assuming either document is authoritative — the table already tells you which side
to trust for that fact (spec always drives the test's own assertion, per "assert spec" above); what
changes per outcome is only which system needs the actual fix.

Never add a third, direct `swagger vs live` test — (spec vs live) and (spec vs swagger) already
determine the third pairwise relationship for free (equality is transitive), and a direct
`swagger vs live` test would need its own live call, wastefully duplicating the behavior test's
call (actively harmful for a mutating command — a second `POST` means a second real side effect).
See `REFERENCE.md` → Drift Classification for the full reasoning.

**A UC's own Input/Output table can disagree directly with its driving CT's Request/Response DTO
table — a fourth document the three-way (spec/swagger/live) reconciliation above doesn't name.**
This is distinct from the CT-vs-swagger case: here the two *spec* documents themselves conflict on
a Constraints-DSL-level fact (a Range bound, whether a query param is caller-facing at all) before
swagger or live even enter the picture. Confirmed 2026-09-09 on `UC-GOV-013` v0.1.1 vs `CT-GOV-003`
v5.5.1: the UC's Input table claimed `maxResultCount` max=100 and that ordering was "not
caller-selectable"; the CT's `GetGoalListInput`/Pagination section claimed max=1000 and a
`sorting` override IS supported — and a live probe confirmed the CT was right on both counts.
Resolve the same way as CT-vs-swagger: treat swagger + a live call as the tie-breaker, assert
whichever spec agrees with them, and cite the disagreeing spec in `bug_notes`/Known Gaps as
needing an editorial fix — never silently prefer the UC or the CT by default just because one is
"the driving spec". See `EXAMPLES.md` → UC vs CT value conflict for the confirmed case.

---

## Grammar 0.4 UC & PM Awareness

Like CT, UC and PM specs are mid-migration from grammar 0.3 to 0.4 — check each file's own
frontmatter `grammar:` before reading it mechanically. Confirmed live 2026-08-21: 61 of ~90 UC
specs under `specs/` have already adopted 0.4 (real, `status: approved`/`in-review` files, not a
draft proposal); the rest remain 0.3 (top-level `permission:` field, prose-only Main Flow, no
`execution_type`). PM specs are further along — e.g. `PM-ACT-001` is 0.4 at `status: approved`,
v0.25.0.

**`execution_type` is a hard gate on whether an HTTP surface exists at all — check it before
writing anything.**
- `Command` / `Query` → normal HTTP-facing UC; proceed as usual.
- `Automation` / `EventHandler` → **no HTTP endpoint exists for this UC.** Its
  `## Execution Contract` names a `Runtime Adapter` (`abp-background-job`, `abp-periodic-worker`,
  `abp-local-event-handler`, `abp-distributed-event-handler`) instead of `None`, and it carries no
  `## Authorization`/`## Output` at all (forbidden by grammar 0.4 for these two types). Do not
  write an HTTP-based `.spec.ts` against it — there is nothing to call. This is the exact same
  shape as several "zero HTTP surface" / "in-process query" / "consumer unwired" findings already
  confirmed manually one UC at a time before this field was checked systematically (background
  job never wired, event boundary that never fires HTTP-side, a plain in-process call with no
  transport). Reading `execution_type` up front turns that repeated one-off investigation into a
  one-line frontmatter check. If the CT driving this UC still documents an endpoint anyway, that
  itself is a spec-vs-spec drift finding (CT claims a route the driving UC's own execution model
  says doesn't exist) — report it, don't test it as if it worked.
- Grammar-0.3 UCs still use `cqrs_kind: command|query` (only two values — no
  Automation/EventHandler discriminator), so a background-job/event-consumer UC may be mis-tagged
  `command`. If a 0.3 UC has no corresponding CT route and its Main Flow describes a trigger
  (schedule, event, queue) rather than a caller, treat it the same as a 0.4
  `Automation`/`EventHandler` — no HTTP surface — even without the frontmatter field to confirm it
  mechanically.

**`## Authorization` replaces the old top-level `permission:` field for Command/Query UCs — read
the table, don't infer from title/actor prose.** Shape is either a `Permission`/`Policy Ref` table
or literal `None` (no UC-level permission gate). Use the exact `Permission` string for the 403
test's expected authz check, and follow `Policy Ref` (a PM spec id) to the canonical owner (see PM
below) rather than trusting the UC's own copy if the two disagree — confirmed live 2026-08-20 that
`UC-ACT-004` vs `PM-ACT-001` disagree on the exact permission string even though both are already
`approved` at grammar 0.4 (`Actors.Actor.Update` in `CT-ACT-001` vs `MgiAct.Actors.Update` in
`PM-ACT-001`). Cite the drift in `bug_notes`, don't silently pick one.

**`## Execution Steps`' `fail error:{Code}` lines are a mechanical source for expected
negative-case error codes — read them directly instead of inferring from `## Extensions` prose.**
Each `fail error:X` sits on a numbered step that `## Extensions`' own Exception branches cite back
by step range and owning spec (CT/ES) — cross-check both citations agree before asserting `X` as
the expected error code in `test_data`/`bug_notes`.

**`## Business Rules`' `Used At` column ties each rule to an exact Execution Step number** — use
it to build Step 4's "Each VAL-xxx/SRV-xxx rule" negative-case rows mechanically instead of
scanning Main Flow prose for rule mentions.

**PM specs' `Granted To` column is the canonical source for which `.env` role legitimately holds a
permission — cross-check it before writing an authz test.** A grammar-0.4 PM's Permission Tree
table names exact roles per permission (e.g. `PM-ACT-001`: `MgiAct.Actors.Update` →
`BC Sovereign, Admin (platform), System`). Combine with the JWT-`sub` credential check above: pick
a role from `Granted To` for the positive-authz case, and a role genuinely absent from that list
for the 403 case — only after confirming via JWT decode that the two `.env` credentials really are
distinct accounts. `TenancySide` (`Host`/`Tenant`/`Both`) tells you whether the call needs a
host-scoped or tenant-scoped token.

**A tenant-scoping/cross-tenant-isolation claim with no second-tenant fixture available is a
documented scope exclusion, not a silently-dropped test — same treatment as the 403-skip convention
above.** When a UC's `## Preconditions`/`## Business Rules`/AC text asserts results are scoped to
(or isolated across) the caller's tenant, and no `.env` credential exists for a second, genuinely
distinct tenant (check `TENANT_ID`/`BC_SOVEREIGN_TENANT`/`COCKPIT_VIEWER_TENANT`-style vars for a
real second value, not just a second name — same JWT-decode caution as the role check above), do
not just omit the test silently. Add a `notes:` line, or a `status: skipped` case with
`skip_reason` mirroring the 403 pattern, naming exactly what's untestable and why — so a reviewer
can tell "no fixture available" apart from "nobody thought to check tenant-scoping at all".

**When a second-tenant fixture DOES exist, only ever exercise it read-only — never write, update, or
delete against a tenant the suite doesn't own, even for a deliberate cross-tenant negative probe.**
A cross-tenant test's whole point is proving isolation (e.g. "id from tenant B 404s for tenant A's
caller," UC-GOV-010's AC2), and that's provable with a GET/query alone — nothing about proving
isolation requires actually mutating tenant B's data, and doing so writes real data into an
environment/tenant this suite has no ownership over or cleanup responsibility for. Case in Step 4's
`test-cases.yaml`: a cross-tenant row's own `test_data.method` must be `GET` (or another read
verb); if verifying the isolation claim would require a write (e.g. "tenant B's record becomes
visible to tenant A after an update" — an unlikely claim, but check for it), treat that as a
`status: skipped` scope exclusion with a `skip_reason` explaining why, the same as the
no-fixture-available case above, rather than writing the mutating call anyway. This is also what
Step 6's `@cross-tenant` tag encodes — see Step 6, Tags.

---

## Grammar 0.4 DS/PS/EV/IS Awareness

Only relevant when the target cluster (from Step 2) includes a DS, PS, EV, or IS spec — most
plain UC+CT+ES+PM clusters don't. When it does, read `REFERENCE.md` → Grammar 0.4 DS/PS/EV/IS
Awareness before Step 4: none of these four spec types has a synchronous HTTP surface of its own,
so "testing" one means testing its *effect* through whichever UC/CT already has one, added to
that UC's own file rather than a standalone `.spec.ts`. Covers DS (test via the calling UC/PS, one
case per DMN row or Operations branch), PS (E2E only via `pollUntil`, the `Milestone.Start()`-gap
failure pattern), EV (prefer a QA-simulate endpoint over the full producer→consumer chain), and IS
(read side only — the compute/cadence side is rarely black-box testable).

---

## Step 4 — Test Case Format

File: `test-cases/api/{folder}/{name}-test-cases.yaml` (one folder per UC/feature, matching the paired `script/api/{folder}/`) · TC ID: `TC-01` / `GET-01` / `PATCH-01`

See `REFERENCE.md` → Test Case YAML Template for the full field-by-field skeleton (`feature`,
`module`, `spec_refs`, per-case `id`/`priority`/`type`/`status`/`spec_ref`/`preconditions`/
`test_steps`/`test_data`/`expected_result`/`bug_notes`).

Group test cases under `# ── {Section} ──` comments (Happy Path / Required Field Validation / Business Rule Invariants / Boundary Values / Enum Validation / Security & Authorization / E2E Lifecycle / Doc Conformance / Known Gaps), mirroring the coverage matrix below (Doc Conformance mandate — see that row).

**Coverage required:**

| Type | Include |
| ---- | ------- |
| Happy Path | All CRUD with valid data; all enum values |
| Negative | Each VAL-xxx and SRV-xxx rule; null/missing required |
| Boundary | min, min-1, max, max+1 for every constrained field |
| State Transitions | pre-condition + post-state for each transition |
| Authorization | 401 (no token), 403 (wrong role) per spec actor |
| Doc Conformance | **Mandatory whenever the driving CT is grammar 0.4** and declares a `Success Status`/`Response Shape`/Error Responses row, or a Request DTO field name, for this endpoint — one test per declared fact, per the Grammar 0.4 CT Awareness reconciliation table. Omit only for a grammar-0.3 CT with no such structured facts to check |
| Combined Filters | One case combining 2+ optional filters, asserting every returned item satisfies ALL of them — proves AND semantics whenever Dependencies/Execution Steps prose states filters combine that way |
| Default Values | For every `Default(value=X)` Constraints token, one case that OMITS the field entirely and asserts the default was actually applied — distinct from the Range-derived min/max boundary cases |
| Functional Pagination | For a paginated list endpoint, one case proving `skipCount` actually offsets (e.g. two pages return disjoint records) — distinct from the boundary cases that only validate `skipCount`/`maxResultCount`'s own numeric range |
| Protocol Conformance | A DIFFERENT layer from every row above (business spec), not a duplicate of it: every error-path test (any 4xx/5xx expectation) additionally asserts `Content-Type: application/json` + a JSON-parseable body via `expectJsonContentType`, and every 401 test additionally asserts a `WWW-Authenticate` header via `expectWwwAuthenticateHeader` — see Step 6. Catches a "status code stayed correct, body silently became an HTML error page" class of bug that a status-only or business-field-only assertion cannot |

---

## Step 5 — Coverage Self-Audit

**Before moving to Step 6, re-read the driving UC (and the CT's Dependencies/Business Rules/
Execution Steps prose) sentence by sentence against Step 4's own file — not "does every AC have at
least one test" but "does every independently-testable clause inside each AC have its own case".**
The first pass through Step 4 naturally stops as soon as one test satisfies an AC's most obvious
reading; this audit is what catches the clauses that reading skipped (see `EXAMPLES.md` →
Coverage self-audit miss classes — UC-GOV-011 for a confirmed run where this caught 6 gaps a
first AC-by-AC pass missed entirely). If this audit finds a gap, revise Step 4's
`-test-cases.yaml` in place (add the missing case, keep everything else) before writing or
regenerating the `.spec.ts` in Step 6 — don't defer it to "a later pass."

Concretely, check for each of these patterns:

- **A sentence with "and/or", "or", "either/or", or an enumerated list of 2+ conditions collapsed
  into one test.** Each condition needs its own case, not one combined test that happens to also
  satisfy the sentence's most obvious reading.
- **A Business Rule row cited as execution-relevant (`## Business Rules`' `Used At` column) — check
  whether the case tests the RAW INVARIANT itself, not just the FILTER MECHANISM the rule happens to
  enable.** These are different claims; testing one doesn't cover the other.
- **A Dependencies-table or Execution-Steps sentence stating a cross-filter semantic** (e.g.
  "applies all provided filters under AND semantics") **— add a dedicated Combined Filters case**
  (see the coverage table above). This class of claim lives in prose outside the Constraints DSL, so
  following the DSL-driven boundary rules alone will never surface it.
- **A Constraints DSL `Default(value=X)` token with no matching omit-the-field case** — add one (see
  Default Values in the coverage table). A boundary test at the field's own `min`/`max` never
  exercises "what happens when nothing is supplied at all."
- **A paginated list endpoint with no Functional Pagination case** (see coverage table) — boundary
  tests on `skipCount`/`maxResultCount` only validate the parameter's own numeric range, never that
  paging actually returns different records.
- **Before dropping a case as "redundant / same finding as another test" under the "don't duplicate
  the drift signal" exception (Grammar 0.4 CT Awareness, above) — confirm the AC/rule text actually
  states that condition is a mere restatement, not a separately enumerated branch.** An AC listing 3
  explicit conditions (e.g. "filters by X=true, by Y=true, or by both=false") is 3 branches to cover,
  not 1 finding to report once — misapplying that exception is the single most likely way a real
  branch gets silently dropped instead of tested.

This audit is self-directed — it does not require another user checkpoint like Step 2's spec
confirmation. It is also not a license to invent speculative edge cases beyond what the UC/CT text
itself states; only add a case for a clause that is actually written down and actually
independently testable.

---

## Step 6 — Playwright Spec Rules

Emit **Playwright `.spec.ts`** — NOT PowerShell. Every HTTP call goes through the raw-fetch guardrail
so accuracy is byte-level (no redirect masking, no auto-injected auth).

- **File:** `apps/testing/automation-testing/be-testing/script/api/{folder}/{name}.spec.ts` (one folder per UC/feature).
- **HTTP:** call `apiCall(method, path, { token?, body?, rawBody?, headers? })` from `../../../lib/http`.
  Returns a WHATWG `Response` → `res.status` is a property, `res.json()`/`res.text()` are async.
  - `apiCall` uses `redirect: 'manual'` → a 302 auth challenge stays visible (never masked as 404).
  - Token is ALWAYS explicit. Authenticated tests read the shared token via `TOKEN()` (acquired once by
    `global-setup.ts`). Auth-negative tests pass NO token (or a bad one) so the 401/302 truly surfaces.
- **Assertions (hard):** from `../../../lib/assert` —
  - `expectStatus(res, 200)` — exact status equality (never `.not.toBe`, never a loose 2xx check).
    On a grammar-0.4 CT, the expected value is that endpoint's own `Success Status` column, not a
    uniform 200/201 guess (see Grammar 0.4 CT Awareness); a `Response Shape: void` endpoint asserts
    the status only and never calls `res.json()`.
  - `expectSuccessBody(res)` — for endpoints that can return HTTP 200 WITH an error envelope
    (e.g. Retell functions `{ status: "slot_unavailable" }`): asserts no `error` and returns the body.
  - `expectError(res, 401)` — reads clearer at auth/validation-negative call sites.
  - Multi-valued expectations stay as `expect([400, 422]).toContain(res.status)`.
  - **`expectJsonContentType(res)` is MANDATORY on every error-path test (any 4xx/5xx
    expectation), not optional or reserved for a suite that's already suspicious of a
    Content-Type bug.** Call it alongside `expectStatus`/`expectError`, every time, even on a
    business-negative case that also parses specific fields. This is a genuinely different layer
    from every other assertion in this file: a "business spec" test proves the CORRECT error was
    returned; this proves the response is STILL VALID JSON at all. A bug that keeps the status
    code correct but silently swaps the body for an HTML error page (e.g. a load balancer/reverse
    proxy error page, or a middleware ordering bug that skips JSON serialization) is invisible to
    every other assertion in this skill, because none of them ever check `Content-Type` or
    JSON-parseability on their own — they all assume the body already parsed. `apiCall`'s
    `redirect: 'manual'` is a precondition for this check being meaningful (a followed redirect
    would silently swap the real body away before either check runs) — never remove it.
  - **`expectWwwAuthenticateHeader(res)` is MANDATORY on every test asserting `expectStatus(res,
    401)`.** RFC 7235 requires a `WWW-Authenticate` header on an unauthenticated-challenge
    response; its absence can mean the challenge itself is malformed even when the status code
    alone looks right (e.g. a generic exception handler returning a bare 401 instead of the
    framework's real auth-challenge path).
  - **When investigating (or writing a standing regression test for) a suspected Content-Type/body
    drift tied to ABP's own API-vs-browser content negotiation, add a toggle pair, not a single
    case:** one call with the default `Accept: application/json` (every `apiCall` sends this
    already) and one with it explicitly stripped — `apiCall(method, path, { headers: { Accept:
    undefined } })` (this removes the header entirely; it does NOT send the literal string
    `"undefined"`). ABP's `UnifyResult`/exception-to-response pipeline commonly branches on
    whether the request "looks like" an API call partly via this header — a missing `Accept` can
    make the same error path return an HTML page instead of a JSON error envelope even though the
    status code is identical either way. This pair isolates the header as the actual mechanism
    rather than assuming it from prose.
- **Retell / signed webhooks:** `retellSignature(rawBody)` from `../../../lib/retell-signature`; sign the EXACT
  bytes and send them via `{ rawBody, headers: { 'x-retell-signature': sig } }`.
- **PS/EV async effects:** `pollUntil(check, opts)` from `../../../lib/poll` — never a bare
  `expectStatus` immediately after a trigger call when the effect is only visible on a later read
  (see `REFERENCE.md` → Grammar 0.4 DS/PS/EV/IS Awareness). Do not hand-roll a retry loop per spec file.
- **Doc Conformance tests share one swagger fetch, never one per test.** `swagger.json` is a large
  file and each fetch costs real wall-clock (see `EXAMPLES.md` → Doc Conformance fetch cost —
  UC-KNW-011). Fetch it once in `beforeAll` (same pattern as acquiring `token`), store the parsed
  JSON in a `let swagger: any` closed over by the describe block, and have every `[DOC-NN]` test
  read from that shared variable. Do not add a per-test `fetch(swagger.json)` — this compounds
  badly now that Doc Conformance is mandatory (a rich CT can need many facts checked in one file).
- **Tags (CI selection):** put BC + auth-scheme tags on the outermost `test.describe` (inherited by all
  children); add case-type tags per test. Taxonomy:
  - BC: `@gov` (Governance) `@ana` (Analytics) `@str` (Strategy) `@knw` (Knowledge) `@act`
    (Actors) `@orc` (Orchestration). `@sf` (Spec Factory) is reserved — confirmed 2026-09-08 no
    `.spec.ts` carries it yet; do not treat its absence from a grep as evidence Spec Factory has no
    API surface, just that no test has been generated against it so far.
  - `@ops`/`@conv` do not exist as BC tags — resolved 2026-09-08: the Actors cluster (`act-f1`
    through `act-fn`, all sequential feature slices of the one Actors BC epic, not a deliberate
    cross-BC functional split) had `@ops`/`@conv` on ~56 files as leftover drift from before `@act`
    was adopted as the BC tag; all were retagged to `@act` (61 total occurrences now). If either
    string resurfaces on a new file, it is a regression — tag Actors tests `@act`.
  - Auth scheme: `@bearer` | `@retell`
  - Case type: `@happy` `@negative` `@boundary` `@authz` — always tag auth-negative tests `@authz`.
  - **Mutation safety: `@readonly` | `@mutating` — mandatory on every test, derived directly from
    the HTTP method in that test's own `apiCall(method, ...)` call, never from CQRS kind or prose.**
    `GET`/`HEAD` → `@readonly`; `POST`/`PUT`/`PATCH`/`DELETE` → `@mutating`. This split exists
    because prod monitoring runs against the real production API and is deliberately restricted to
    never create/modify/delete real data — `npx playwright test --grep @readonly` is how a
    monitoring run selects only the tests that are safe there, while dev keeps running the full
    suite (`@readonly` and `@mutating` together). Derive from the actual method, not
    `execution_type`/`cqrs_kind`: a `Command` UC can still be side-effect-free on retry (e.g. an
    idempotent acknowledge that 200s without changing state), and the tag's whole job is answering
    "does calling this against prod write anything", which only the wire-level HTTP method answers
    reliably. A `[DOC-NN]` Doc Conformance test never calls the API under test at all (it only
    fetches the static `swagger.json`), so it is always `@readonly` regardless of which method the
    endpoint it's checking uses.
  - **Tenant scope: `@own-tenant` | `@cross-tenant` — add `@cross-tenant` only on a test that
    deliberately targets a tenant other than the suite's own (e.g. a cross-tenant-isolation/404
    probe like UC-GOV-010's AC2).** A `@cross-tenant` test must also be `@readonly` — never write a
    mutating test against a tenant this suite doesn't own, even as a deliberate negative probe;
    that tenant's data isn't this suite's to create/modify/delete, and a monitoring run has no way
    to know that a `@mutating`-looking call is "supposed to" target someone else's tenant. A test
    with no explicit `@cross-tenant` tag is implicitly own-tenant — most tests in a suite will be,
    so this only needs stating on the exception.
  - **Before running the suite live, grep the finished `.spec.ts` for every `test(`/`test.skip(`
    call and confirm each one (including every `[DOC-NN]`) carries a `@readonly`/`@mutating` tag —
    don't trust that writing the rule once means it was applied everywhere it should have been.**
    Confirmed live 2026-08-26 on `UC-ACT-001`: all `[TC-NN]` business-logic tests were tagged
    correctly, but all five `[DOC-NN]` tests were generated with no tag object at all — the
    `[DOC-NN]` section is written last, after the `[TC-NN]` mutation-safety tagging is already
    "done" in the author's own attention, so it's the section most likely to silently regress even
    when the rule above is fresh in context two screens up. A quick `grep -c "test(" file.spec.ts`
    vs `grep -c "tag: \[" file.spec.ts` (accounting for `test.skip` calls, which carry no tag by
    convention) catches this mechanically instead of relying on re-reading the whole file.
  - **The BC tag itself has no script enforcing it (unlike FE's `ui-flow-test-generator`, which
    validates `--domain-tag` against `CANONICAL_DOMAIN_TAGS` in code) — it is chosen by whoever
    runs this skill, so re-check it against this file's own BC list before finalizing Step 6,
    every time, not just when the BC is unfamiliar.** Confirmed 2026-09-08: the Actors cluster
    drifted to `@ops`/`@conv` on ~56 files across multiple generation passes before anyone caught
    it, precisely because nothing mechanical compared the tag written against the driving spec's
    actual BC folder (`specs/mgi-{bc}/...`). Before treating a `.spec.ts` as done, grep its own BC
    tag and confirm it's both in this list and matches the driving UC/CT's actual `specs/mgi-{bc}/`
    (or `.specs-0.3/mgi-{bc}/`) directory — don't assume a tag copied from a nearby sibling file in
    the same cluster is correct just because it's already there.
- **Coverage:** same matrix as Step 4, as audited in Step 5.
- **No self-built report / no `pwsh`:** the reporter (list + HTML + JUnit) is configured in
  `playwright.config.ts`. Do not write a report builder or a `.ps1` file.
- **No hardcoded environment fallback values — required config fails loudly, not silently.** Never
  write `process.env.X ?? '<some literal>'` for a base URL, host, OIDC client id/scope, or any
  other environment/infra config value — if `X` is missing, throw a clear error naming the
  variable, don't silently fall back to a specific environment's value (a CI stage that forgets to
  set the var would otherwise silently run against the wrong target instead of failing the build).
  This applies to shared config (`lib/http.ts`'s `BASE_URL`, `global-setup.ts`, `playwright.config.ts`)
  as much as to a single generated spec (see `EXAMPLES.md` → Hardcoded env fallback fix for a
  confirmed instance across all three of those files).
  Arbitrary **test data** literals (a boundary-value string, a syntactically-valid-but-fixture-free
  enum code used only to trigger a Condition, a title in a happy-path body) are NOT config and are
  fine to hardcode — the distinction is: does this value change per environment/deployment, or is
  it inherent business test data? Only the former must come from `.env` or fail loudly if absent.
- **Never use `Guid.Empty` (`00000000-0000-0000-0000-000000000000`) as the "deliberately wrong but
  valid-shaped" id in a value-is-ignored / ownership-mismatch probe — use any other non-empty
  literal instead.** Many ABP/FluentValidation `NotEmpty()` checks treat `Guid.Empty` as equivalent
  to an omitted value, so it 400s as "must not be empty" instead of demonstrating that a genuinely
  wrong-but-present value is silently accepted/ignored — a different, unrelated finding from the
  one the test was trying to isolate. See `EXAMPLES.md` → Guid.Empty breaks a value-is-ignored probe
  for a confirmed case where this broke an entire suite's `beforeAll` fixture on the first run.
- **Immediately before hardcoding a fixture id's expected field values into `test_data`/`bug_notes`
  or a `.spec.ts` assertion, re-read the exact probe output text for that fixture — don't rely on a
  memory or summary of a tool call from earlier in the run.** A live-probing session commonly
  fetches several fixtures across several tool calls (checking one for a happy-path case, another
  for a null-field negative case, a third for a boundary case); by the time the write step happens,
  it's easy to misremember which fixture actually had which field set. This is the same class of
  mistake as the `Guid.Empty` pitfall above — both are cases where an assumption about a fixture's
  shape, formed earlier, turns out not to match what the fixture actually returned — except this one
  is about the write step forgetting the read step's own evidence rather than about the read step
  itself. When multiple fixtures are in play, re-fetch (or re-scroll to and re-read) the specific
  JSON for the one about to be cited, field by field, rather than trusting an earlier paraphrase.
  This costs one extra look at data you already have; a wrong fixture choice costs a failed first
  run, a re-probe, and a rewrite of both the YAML and the spec — see `EXAMPLES.md` → Misremembered
  fixture field from an earlier probe — UC-GOV-010 for a confirmed case where this surfaced a new,
  genuine finding (a candidate invariant violation) rather than just being a wasted cycle.

### Spec skeleton

See `REFERENCE.md` → Playwright Spec Skeleton for the full example (`beforeAll` token+swagger
setup, `[TC-NN]` happy/negative/authz cases, `[DOC-NN]` Doc Conformance cases).

### Pre-Checkpoint Quality Gate

Run this checklist mechanically against the freshly-written `-test-cases.yaml` + `.spec.ts` pair
**before** presenting the Step 6 checkpoint below — every item is a grep/count check, not a
judgment call. A failing item gets fixed in the file immediately and the whole gate re-run; the
checkpoint message then reports the gate as entirely green ("Quality Gate: 10/10 passed"), never
"all but one" or silently omitted. This consolidates checks that were previously scattered as
prose reminders across Step 6 into one enforced pass, plus two checks (4, 9) not stated elsewhere.

1. **Every `spec_refs` entry carries an exact version.** Each line matches `id vX.Y.Z (path)` — an
   unversioned entry defeats the Step 2 pre-existing-artifact short-circuit on every future run.
2. **Tag parity.** Every actual `test(` *definition* (not an inline `test.skip(cond, reason)` call
   inside a running test) carries a `tag: [...]` array including exactly one of `@readonly` /
   `@mutating`, derived from that test's own `apiCall` method — never from CQRS kind or prose.
   `grep -c "^  test('\["` vs counting `tag: \[` on those same lines.
3. **BC tag matches the driving spec's real folder.** The outermost `test.describe`'s BC tag
   (`@gov`/`@ana`/`@str`/`@knw`/`@act`/`@orc`) equals the actual `specs/mgi-{bc}/` (or
   `.specs-0.3/mgi-{bc}/`) directory the UC/CT resolved from in Step 2 — not copied from a nearby
   sibling file in the same cluster.
4. **TC/DOC 1:1 parity between the two output files.** Every `id:` in the yaml has a matching
   `[ID]` in the `.spec.ts` and vice versa — diff `grep -oE '\[(TC|DOC|GET|POST|PUT|PATCH)-[0-9]+\]'
   file.spec.ts | sort -u` against the yaml's own `id:` list. A mismatch means one file was
   hand-edited after the other, or Step 5's self-audit revised the yaml without regenerating the
   spec to match.
5. **Doc Conformance present when mandatory.** If the driving CT's `grammar:` is `0.4`, the
   `.spec.ts` contains a `## Doc Conformance` block with at least one `[DOC-NN]` per
   Success-Status/Response-Shape/Error-Responses/param-name fact the CT declares for this endpoint
   (Step 4 coverage table) — absence is a gate failure, not a note for later.
6. **Protocol Conformance wired, not just claimed.** Every test asserting a 4xx/5xx status also
   calls `expectJsonContentType`; every test asserting 401 also calls `expectWwwAuthenticateHeader`.
   Grep every `expectStatus(r, 4`/`expectStatus(r, 5`/`expectError(r, 4` hit and confirm both calls
   appear before that test block closes.
7. **No secret literal landed in either file.** Grep both files for a real credential/token VALUE
   pattern (not a variable name) — a hard stop if found; redact and re-derive from `.env`/`TOKEN()`
   instead, per the Configuration section's echo rule.
8. **No hardcoded environment fallback.** No `process.env.X ?? '<literal>'` for a base URL, host,
   or OIDC client id/scope in the generated spec — a missing var must throw, never silently target
   a default environment.
9. **Every `status: skipped` / inline `test.skip(true, ...)` names a CONFIRMED reason, not a
   carried-forward guess.** The reason must cite what was actually checked this pass (a JWT `sub`
   decode result, a `.env` tenant-var comparison) — if it wasn't re-checked this run, check it now
   rather than citing an old EXAMPLES.md date as if it were re-verified today.
10. **The file loads.** `./node_modules/.bin/playwright test --list "script/api/{folder}/{name}.spec.ts"`
    enumerates every expected test with zero syntax/import errors — run this now, as part of the
    gate, not only right before Step 7's live run.

**Checkpoint after Step 6 — do not run without confirmation.** Writing the `.spec.ts` does not
imply running it. Once the file is written and the Quality Gate above passes, stop and tell the
user the file path, the gate result, and how many `[TC-NN]`/`[DOC-NN]` cases it contains, then ask
whether to run it now (Step 7) or defer execution for later. Only proceed to `### Run` below after
the user confirms; if they say "generate only" / "don't run yet" / equivalent, stop here — the
test-cases.yaml and .spec.ts are the deliverable for this invocation, not a prelude to an
execution that happens regardless.

### Run

From `apps/testing/automation-testing/be-testing`:
```bash
npx playwright test "script/api/{folder}/{name}.spec.ts"   # one file
npx playwright test --grep @gov                            # by tag
```
Writes `report/junit-{timestamp}.xml` + `report/html-{timestamp}/` — each invocation gets its own
timestamp (set in `playwright.config.ts`, ISO-8601 with `:`/`.` replaced by `-`) so a later run
never overwrites an earlier one's report. **Passing `--reporter=list` on the CLI replaces this
entire array — it silently skips writing junit/html for that run**, confirmed live 2026-08-21
(useful for a quick chat-readable console run, but don't rely on it to have produced a report
file afterward). Verify a new file loads with
`./node_modules/.bin/playwright test --list "<file>"` before running it live.

**Mandatory — before citing any report file path to the user, verify the JUnit's own root
`<testsuites>` summary (`tests=`/`failures=`/`skipped=`) matches the console's own pass/fail/skip
line from the same run.** Don't assume a report file existing means it holds this run's real
results — see `EXAMPLES.md` → Report-vs-console mismatch for a confirmed case where a self-inflicted
`--reporter=list` flag produced a junit file claiming 0 failures (all 25 tests "skipped",
`time≈0.12s`) while the console's own output for the exact same invocation showed 19 passed/3
failed/3 skipped over 45s. This check generalizes past that one flag — it catches ANY
report-generation failure mode, not just this specific mistake — so run it every time, not only
when `--reporter=list` was used.

---

## Output Files

| File | Content |
|------|---------|
| `test-cases/api/{folder}/{name}-test-cases.yaml` | Test case docs |
| `script/api/{folder}/{name}.spec.ts` | Playwright test spec (`apiCall` + hard-assert + tags) |
| `lib/http.ts` · `lib/assert.ts` · `lib/retell-signature.ts` · `lib/poll.ts` | Shared guardrail helpers (do not duplicate) |
| `report/junit-{timestamp}.xml` | JUnit results, one file per run (CI Tests tab, once CI exists — none does today) |
| `report/html-{timestamp}/` | Playwright HTML report, one folder per run |

`scripts/execute_and_report.py` is an optional local helper — not part of this workflow's own
steps above, and never invoked automatically. Run it by hand after `npx playwright test` to get a
consistently-formatted GO/NO-GO markdown summary (`report/test-report.md`); it does not post to
Azure DevOps itself. See README.md → "A Note on the scripts/ folder" for the full explanation.
