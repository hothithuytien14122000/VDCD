# API Test Generator — Confirmed-Live Examples

Supporting evidence for rules in [SKILL.md](./SKILL.md). Each section backs one rule there by
name — read this file on demand when you need the specific confirmed instance, not on every skill
invocation. Nothing here is its own rule; the actionable instruction lives in SKILL.md, this file
only supplies the "why" (and the exact citation, if you need to defend a finding later).

## Credential role collapse (→ Configuration)

Confirmed live 2026-08-21: in this repo's own `be-testing/.env`, `BC_SOVEREIGN_*`,
`COCKPIT_VIEWER_*`, `ENTERPRISE_SOVEREIGN_*`, `SYSTEM_*`, and `SOVEREIGN_*` all log in to the exact
same account (`sub` claim, role `EnterpriseSovereign`) as `TEST_USERNAME` — none of them exercises
a distinct role despite the naming. This single misconfiguration is a plausible root cause for the
"no account without permission X available" skip reason recorded against many prior UCs across BCs.

## Directory precedence — UC-KNW-001 (→ Step 2, Directory precedence)

Confirmed: `UC-KNW-001` sits at grammar 0.4/drafting in `specs/` vs grammar 0.3/**approved** in
`.specs-0.3/`, same business content, just missing its Execution Steps DSL closure, while its own
sibling specs (ES/PM/VO/CT for the same BC) are already `approved` at 0.4.

## Cluster-consistency exception — UC-GOV-019 (→ Step 2, Exception to approved-wins)

Confirmed on `UC-GOV-019` (2026-08-24): `.specs-0.3/UC-GOV-019` was `approved`/0.3/v1.6.0 vs
`specs/UC-GOV-019` at `in-review`/0.4/v0.1.0, but CT-GOV-004/ES-GOV-004/EN-GOV-008/PM-GOV-001 —
every spec this UC actually depends on — had already resolved to their own 0.4 copies; the
approved-wins rule alone would have picked the 0.3 UC copy, mismatched against an otherwise-0.4
cluster.

## Legacy artifact false-negative — UC-GOV-011 (→ Step 2, pre-existing artifact check)

Confirmed live 2026-08-24 on `UC-GOV-011`: a legacy `.ps1` suite reported 23/24 "passed" while
citing `CT-GOV-002 v5.13.0` — a version matching neither current copy (`specs/` v0.1.0,
`.specs-0.3/` v6.5.0) — and its assertions for the `decisionType` multi-value filter and `Sorting`
caller-selectability were written against that superseded contract, so they silently asserted the
*opposite* of the current UC's own AC4/Main-Flow claims.

## Manual-tier VO/ES pointer — UC-GOV-014 / VO-GOV-003 (→ Grammar 0.4 CT Awareness)

Confirmed live 2026-08-24 on `UC-GOV-014`/`CT-GOV-004`'s `mutationSpace: VO-GOV-003` field
(`ValidationTier: manual`, `Rule Ref: spec:UC-GOV-014.ES-GOV-004`): reading VO-GOV-003's own
Invariants table surfaced `INV-PARAMETERS-002` (duplicate `Parameters[*].Key`) — a negative case
the driving UC's own `## Extensions` table never mentions at all (it only names "no parameters"
and "forbidden mutation outside declared set"). This would not have been found by reading the UC
or CT alone.

## Error-code collapse on the wire — VO-GOV-004 (→ Grammar 0.4 CT Awareness corollary)

Confirmed live 2026-08-24 on `VO-GOV-004` (`MutationParameter`, nested inside
`VO-GOV-003.Parameters`): it declares 5 distinct invariants with 5 distinct `Error Code`s
(`KeyBlank`/`MinValueExceedsMaxValue`/`StepSizeNotPositive`/`StepSizeExceedsRangeWidth`/
`InitialValueOutOfRange`), but live collapses ALL FIVE to the exact same generic FluentValidation
message ("The specified condition was not met for 'Mutation Space Parameters'.") with
`error.code: null` beneath a shared outer `"VALIDATION_ERROR"` — no distinguishing signal survives
to the caller at all. Contrast with the sibling `VO-GOV-003`-level invariants on the same endpoint,
which DO carry a distinguishing free-text `error.data.Reason` even though their own top-level
`code` is likewise the field's one shared generic value.

## Swagger param-name drift — CT-KNW-001 (→ Grammar 0.4 CT Awareness)

Confirmed live 2026-08-21: `CT-KNW-001` v0.14.0 documents `SkipCount`/`MaxResultCount` for
`GetStaleSops`/`GetPriorSopsForTaskType`, but the live `swagger.json` still binds `Page`/`PageSize`
for both.

## UC vs CT value conflict — UC-GOV-013 / CT-GOV-003 (→ Grammar 0.4 CT Awareness)

Confirmed live 2026-09-09: `UC-GOV-013` v0.1.1's own Input table for `GetGoalList` states
`maxResultCount` max=100 and that result ordering is "not caller-selectable". Its driving
`CT-GOV-003` v5.5.1 (`GetGoalListInput`/Pagination section) states max=1000 and that a `sorting`
override IS supported. Both are grammar-0.4/`status: approved`, so neither wins on document
metadata alone. A live probe against dev settled it: `maxResultCount=1000` is accepted,
`maxResultCount=1001` is rejected (400), and `sorting=updatedAt asc` genuinely reverses the
default DESC order — matching the CT and swagger's own schema (`maximum: 1000`, a `sorting` query
parameter present), not the UC. Tests were written asserting the CT+swagger-confirmed values, with
`bug_notes` naming UC-GOV-013's Input table as the side needing an editorial fix.

## Boolean-polarity inversion — UC-GOV-011 (→ Grammar 0.4 CT Awareness)

Confirmed live 2026-08-24: `UC-GOV-011`/`CT-GOV-002`'s `hasDecisionQueueEntryOrigin`/
`hasEscalationItemOrigin` (`true` = HAS that origin) don't exist as live query parameters at all —
the real ones are `DecisionQueueEntryIdIsNull`/`EscalationItemIdIsNull`, with INVERTED polarity
(`true` = does NOT have that origin). Sending the spec's own field name is silently ignored by
ASP.NET model binding — the call returns 200 with the full unfiltered page, not an error, so a
value-mismatch check alone can miss this entirely.

## Assert-spec-not-live miss — UC-KNW-001 TC-01 (→ Grammar 0.4 CT Awareness)

The mistake caught live 2026-08-21 on `UC-KNW-001` TC-01: `Success Status: 201` was first asserted
as the confirmed-live `200` instead, which would have passed forever and never re-surfaced the
drift.

## Doc Conformance precedent file (→ Grammar 0.4 CT Awareness, Doc Conformance mandate)

Precedent already in this repo:
`script/api/api-compliance-fix-api-contract-conformance-violations-and-sync-ct-spec-pi4-2026/swagger-doc-conformance.spec.ts`
— fetch `` `${BASE_URL}/swagger/v1/swagger.json` `` (derived from the already-exported `BASE_URL`,
no separate `SWAGGER_URL` read needed) once in `beforeAll`, then assert directly against
`swagger.paths[...]`/`swagger.components.schemas[...]`. That precedent file only covers two closed
historical bugs (Retell/ApiKey security-scheme mismatch, `businessHours` nullability) — it is not a
general swagger-conformance sweep, and no such sweep exists anywhere else in this repo (see
SKILL.md → Grammar 0.4 CT Awareness, Doc Conformance mandate, for why this doesn't rerun on its
own — no CI in this repo).

Also confirmed 2026-08-24 on `UC-GOV-011`: a name-only parameter check would have caught
`hasDecisionQueueEntryOrigin`/`hasEscalationItemOrigin` automatically (missing from swagger's
parameter list entirely) but would have MISSED the `decisionType` drift — swagger's `DecisionType`
parameter exists under the exact documented name, it's just a bare scalar enum ref where the CT
documents `List<EN-GOV-001>`; only an arity check catches that one.

## Error-envelope split by validation layer — UC-GOV-019 / UC-GOV-014 (→ Grammar 0.4 CT Awareness)

Confirmed on two distinct endpoints 2026-08-24 — see SKILL.md → Grammar 0.4 CT Awareness (Error
Body Schema Ref block) for the general rule this instance confirms:
- **Query-string/route model binding.** Confirmed on `UC-GOV-019`
  (`GET .../optimization-directives`): an out-of-range enum on a query parameter (`Status=99`)
  returned `400` as `{"type":"...","title":"One or more validation errors
  occurred.","status":400,"errors":{"Status":[...]}}`.
- **JSON request-body validation.** Confirmed on `UC-GOV-014`
  (`POST .../optimization-directives`): a missing required field, an out-of-range scalar, and even
  a nested VO-level `.Must()` failure all returned `{"error":{"code":"VALIDATION_ERROR","details":
  "...","validationErrors":[{"message","members"}]}}`.
- **Refinement confirmed on `UC-GOV-019` 2026-08-26 — the query-string bucket above is not one
  tier, it's two.** A TYPE-COERCION failure (wrong wire shape for the declared type —
  `objectiveId=not-a-guid`, `maxResultCount=abc`, an out-of-range enum like `status=99`) is caught
  by the model binder before any validator runs, and returns bare `ProblemDetails` as the bullet
  above says. But a RANGE/SIZE constraint violation on an otherwise well-typed query value
  (`maxResultCount=101` against `Range(min=1,max=100)`, `objectiveIds` with >100 ids against
  `Size(max=100)`) still reaches ABP's FluentValidation pipeline even though it arrived via the
  query string, not a JSON body — and returns the SAME ABP-wrapped envelope
  (`application/json`, `{"error":{"code":"VALIDATION_ERROR",...}}`) as a JSON-body validation
  failure. So "query-string → bare ProblemDetails" only holds for type-coercion failures; a
  well-typed-but-out-of-range query value is ABP-wrapped regardless of where on the wire it
  arrived. Don't assume one envelope shape for an entire GET endpoint's error rows based on
  testing only one kind of violation — check both a type-coercion case and a range/size case
  per query parameter that carries both a `Type` and a `Constraints` token.

## Coverage self-audit miss classes — UC-GOV-011 (→ Step 5)

A first-pass suite (23 test cases, all individually reasonable) turned out to have 6 gaps that
only surfaced once the sentence-by-sentence re-read was actually done as its own step — none were
caught by generating tests AC-by-AC the first time. Specific miss classes confirmed on that run:
- AC3 ("`startDate` and/or `endDate`") was first written as ONE combined-filter test; the
  independent startDate-alone / endDate-alone / inverted-range cases were absent until the audit
  ran.
- `ES-GOV-002#INV_DEC_016`: testing the `hasXOrigin` filter's narrowing behavior never directly
  asserted "no record has both fields populated" as its own case.
- AC6's third branch (`hasXOrigin=false` on both fields together) was nearly dropped by
  misapplying the "don't duplicate the drift signal" exception — it is a separately enumerated
  branch, not a mere restatement.

## Doc Conformance fetch cost — UC-KNW-011 (→ Step 6)

Confirmed live 2026-08-21: ~4.2-4.6s per fetch on `UC-KNW-011`'s 2 Doc Conformance tests, vs
80-600ms for every other test in the same file — fetching it twice cost more than every other test
in the file combined.

## Guid.Empty breaks a value-is-ignored probe (→ Step 6, test data)

Confirmed live 2026-08-25 on `UC-GOV-001`: a `beforeAll` fixture used
`sovereignId: '00000000-0000-0000-0000-000000000000'` (`Guid.Empty`) as the "deliberately wrong"
value for a probe whose whole point was proving the server silently ignores whatever `sovereignId`
is sent (it always uses the caller's real identity from the Bearer token instead). The call 400'd
instead of the expected 200 — `{"error":{"code":"VALIDATION_ERROR","details":"SovereignId:
'Sovereign Id' must not be empty."}}`, the EXACT SAME error as omitting the field entirely — which
cascaded into `beforeAll` throwing and 20 of the file's 22 tests being skipped on the first run.
Root cause: the server's FluentValidation `NotEmpty()` check on a Guid field treats `Guid.Empty`
as indistinguishable from "not provided", so it can never reach the "value provided but wrong/
ignored" code path a mismatch probe is trying to exercise. Switching to a non-empty-but-still-wrong
literal (`00000000-0000-0000-0000-000000000099`) fixed it immediately and reproduced the intended
finding (value silently ignored, real identity used instead). The Guid.Empty behavior itself
turned out to be a separate, genuine finding in its own right — kept as its own test case
(`POST-15b`) rather than discarded.

## Report-vs-console mismatch — self-inflicted `--reporter=list` (→ Step 6, Run)

Confirmed live 2026-08-25 on `UC-GOV-010`: running the final verification with `--reporter=list`
on the CLI (violating the very rule stated just above this one) produced a `junit-{timestamp}.xml`
whose root `<testsuites>` claimed `tests="25" failures="0" skipped="25" ... time="0.119..."` — every
test marked skipped, zero failures — while the console output for that exact same invocation
showed `19 passed, 3 failed, 3 skipped` over `45.3s`. The file was not stale or from a different
run (its timestamp and mtime matched); the junit/html reporters were simply never attached because
`--reporter=list` had replaced the configured array, so whatever wrote the file did so with
placeholder data instead of real results. Re-running the identical command without
`--reporter=list` produced a junit file whose root attributes (`failures="3" skipped="3"
time="40.5..."`) matched the console exactly, and cross-checking all 25 individual `<testcase>`
entries against the `-test-cases.yaml`'s own `status:`/id list came back with zero mismatches.
Lesson: a report file's mere existence, correct timestamp, and correct location are not proof it
holds real results — only comparing its own summary counts against the console's is.

## Hardcoded env fallback fix (→ Step 6)

Confirmed live 2026-08-21: `lib/http.ts`'s `BASE_URL`, `global-setup.ts`, and `playwright.config.ts`
all had exactly the fallback pattern `?? 'https://dev-api-mgios.4mgi.com'` — fixed to throw instead.

## DOC-NN tests generated with no mutation-safety tag — UC-ACT-001 (→ Step 6, Tags)

Confirmed live 2026-08-26 on `UC-ACT-001` (`RegisterActor`): the finished `.spec.ts` correctly
tagged every `[TC-NN]` business-logic test `@mutating` (the endpoint is a `POST`), but all five
`[DOC-NN]` Doc Conformance tests (`DOC-01`–`DOC-05`) were written with no `{ tag: [...] }` object
at all — despite the `@readonly` rule for `[DOC-NN]` tests already being correctly stated in this
same SKILL.md and correctly demonstrated in `REFERENCE.md`'s own Playwright Spec Skeleton at the
time this file was generated. The gap was not a missing rule — it was the rule not being re-applied
when attention shifted from the `[TC-NN]` section (where mutation-safety tagging felt "handled") to
the `[DOC-NN]` section written afterward, which asserts against a static `swagger.json` fetch and
never calls the API under test at all. Caught only when a user asked "how are the tags on the file
that just ran," at which point a `grep` over the file showed the five untagged tests directly. Fixed
by adding `{ tag: ['@readonly'] }` to all five.

## Misremembered fixture field from an earlier probe — UC-GOV-010 (→ Step 6, test data)

Confirmed live 2026-08-26 on `UC-GOV-010` (`GetDecision`): while probing live fixtures across
several tool calls to build AC5/AC6/AC7/AC8/AC9 test data, one fixture
(`7f10e7dc-6757-48fe-9200-10ece0a321f9`) was fetched and its JSON printed, showing `drtpId` SET
(`00000000-0002-0000-0000-000000000002`) and `confidenceLevel: null`. Several tool calls later,
when writing `-test-cases.yaml` and the `.spec.ts` for the AC5 negative case ("Decision not tied to
a DRTP carries null `confidenceLevel`"), that same fixture was cited from memory as having `drtpId:
null` — the opposite of what its own probe output had actually shown — and the test asserted
`expect(body.drtpId).toBeNull()` against it. The first live run of the generated suite failed
immediately on that assertion (`drtpId` was the populated Guid, not null), which is what surfaced
the mistake — re-reading the original probe output confirmed the fixture never had a null `drtpId`
at all.

Root-caused and fixed by re-fetching the fixture live, switching TC-12 to a different fixture that
genuinely had `drtpId: null` (one of the freshly-created budget/policy-override fixtures from the
same run), and — rather than just discarding the original fixture's odd combination — turning it
into its own new test case (TC-11b) asserting the confirmed-live anomaly directly: a Decision with
`drtpId` set but `confidenceLevel` still null, which reads as a candidate violation of
`ES-GOV-002`'s own `INV-DEC-006` (`ConfidenceLevel` required-iff `DrtpId` is present). The
combination of misremembered evidence + a broken assertion had accidentally been sitting on top of
a real, previously-undocumented finding — discarding the mismatch instead of investigating it would
have thrown that finding away along with the mistake.
