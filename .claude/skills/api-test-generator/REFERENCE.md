# API Test Generator — Reference Material

Supporting reference for [SKILL.md](./SKILL.md) — consult on demand (drift found, template
needed, or the target cluster includes a DS/PS/EV/IS spec), not on every invocation.

## Grammar 0.4 DS/PS/EV/IS Awareness

Referenced by: Step 2 (Spec Discovery) — read this once Step 2 confirms the target cluster
includes a DS, PS, EV, or IS spec (most UC+CT+ES+PM clusters don't; skip this section entirely
when none are present).

Unlike UC+CT, none of these four spec types has a synchronous request→response HTTP surface of
its own. "Testing" one means testing its *effect*, observed through whichever UC/CT already has
an HTTP surface — never a standalone `.spec.ts` file named after the DS/PS/EV/IS id itself. Add
the cases to the file of whichever UC drives them (the trigger, or the read that proves the
effect landed), and cite the DS/PS/EV/IS id in that test's `spec_ref`/`bug_notes`, not as its own
`spec_refs` entry with its own file.

**DS (Decision) — test via whichever UC/PS calls it, one case per rule/branch.**
- `compilation_target: camunda-dmn` — open the DMN's source rule table (grammar 0.3 tabular rows,
  or wherever the DS file lists them); each row is one equivalence class. For each row, find input
  values that land in it and assert the row's own output through the calling UC's response —
  never assert against the DMN engine directly, there is no HTTP surface for it.
- `compilation_target: dotnet-domain-service` — same idea, but the branches come from `##
  Operations`' `Steps` DSL (numbered branches/conditions) instead of DMN rows.
- If NO UC/PS in the current spec tree calls this DS at all (a genuinely orphaned decision), that
  is itself a finding (spec-graph gap) — note it, don't invent a caller to force a test.

**PS (Process — BPMN/Zeebe) — E2E only, via `pollUntil` (`lib/poll.ts`), never a bare
`expectStatus` right after the trigger.**
- Main BPMN (`compilation_target: camunda-bpmn`): call whatever UC starts the process instance,
  then `pollUntil(() => <read endpoint shows the expected post-process state>)`. A `type:
  user-task` step inside it is a human gate — don't try to automate past it; test up to the
  gate and assert the process reached the waiting state.
  ```ts
  test('process reaches Completed after trigger (PS-XXX-NNN)', async () => {
    await apiCall('POST', triggerPath, { token, body });
    const item = await pollUntil(async () => {
      const r = await apiCall('GET', readPath, { token });
      if (r.status !== 200) return null;
      const b = await r.json();
      return b.status === 'Completed' ? b : null;
    }, { timeoutMs: 8000, message: 'process never reached Completed' });
    expect(item.status).toBe('Completed');
  });
  ```
- Zeebe Worker (`ps_subtype: zeebe-worker`): the worker only runs if its own process instance was
  actually started — confirmed recurring root cause in this repo (`Milestone.Start()` gap: a
  missing upstream publish means the worker's process instance never starts, so the worker itself
  is unreachable no matter how correct its own code is). Before writing a PS-worker test, first
  confirm via a read endpoint that the *triggering* process instance exists/started; if it never
  does, that's a blocking finding one layer up (the boundary/message-catch event), not a defect in
  the worker under test — say so in `bug_notes` rather than marking the worker itself broken.
- Timeout budget: default `pollUntil` to 5s; widen only when the process's own spec documents a
  slower cadence (a scheduled/periodic trigger) — cite that cadence in the test's `message` so a
  timeout failure reads as "didn't happen" not "arbitrary flake".

**EV (Integration Event) — prefer a QA-simulate endpoint over a full producer→consumer chain.**
- Some BCs expose a QA-only "trigger-simulation" surface (e.g. this repo's `CT-GOV-008` pattern)
  that lets a test POST a synthetic event payload directly, isolating the *consumer's* handling
  from the producer's own correctness. Always check for one before falling back to the full chain
  — it's faster, more isolated, and doesn't require the producer UC to be independently working.
- No simulate endpoint → full E2E: call the producer UC, then `pollUntil` the consumer BC's own
  read endpoint for the expected cross-BC effect. Correlate by whatever field both sides actually
  share (confirmed pattern: `entryIdentifier` set-diff when no shared `initiativeId` field exists)
  — check both DTOs for a real shared key before assuming one, and note in `bug_notes` if none
  exists (that absence is itself worth flagging, not silently worked around).
- A consumer BC with no read endpoint at all that would reveal the event landed is out of scope —
  same "zero HTTP surface" exclusion as an `Automation`/`EventHandler` UC.

**IS (Intelligence/Analytics) — test only the read side; the compute/cadence side is usually
out of scope for black-box HTTP.**
- If the IS's metric has a query endpoint (a UC/CT reading a computed value), test that endpoint
  normally — same as any other Query UC.
- The refresh/aggregation job that populates the metric is almost never independently testable
  black-box: it runs on its own cadence with no forceable "recompute now" trigger in the common
  case, and the read endpoint may serve a stored snapshot rather than a live computation
  (confirmed pattern: an Analytics endpoint reading a stored snapshot, not calling through to a
  live source). Don't write a test asserting a specific refresh latency unless a force-refresh
  trigger or documented cadence actually exists to test against — otherwise it's an untestable
  precondition, not a bug, and belongs in `notes:` as a scope exclusion.

## Drift Classification (spec vs swagger vs live)

Referenced by: Grammar 0.4 CT Awareness → "Reconciling the three-way result."

`swagger.json` is generated *from* the actual backend code (Swashbuckle/NSwag reading controller
attributes), so in principle it should always equal live — when it doesn't, that itself is a
distinct, reportable finding class (a stale generation artifact or a `[ProducesResponseType]`/
annotation that itself disagrees with the handler body), separate from an ordinary
spec-vs-implementation gap. With the behavior test (spec vs live) and the Doc Conformance test
(spec vs swagger) both in place, the four outcomes classify as follows — put this classification
directly in `bug_notes`, don't just say "drift":

| Behavior test (spec≟live) | Doc Conformance (spec≟swagger) | Implied swagger≟live | Finding | File against |
|---|---|---|---|---|
| pass | pass | equal (both match spec) | No finding | — |
| **fail** | pass | swagger ≠ live (swagger agrees with spec, not with the code it was generated from) | **Swagger generation drift** — swagger itself is stale or its source annotation disagrees with the handler; distinct from the spec-vs-live gap below, and easy to miss since Doc Conformance alone looks green | Dev: regenerate/fix the swagger artifact or its `[ProducesResponseType]` annotation |
| fail | **fail**, and swagger's value equals live's | swagger = live (both disagree with spec) | **Spec-vs-implementation drift** — code and its own swagger agree with each other; spec is the outlier (the `CreateObjective` 201-vs-200 case: swagger=200=live, spec=201) | Dev: fix the handler to match the approved spec (don't downgrade the spec to match code without a spec-owner decision) |
| pass | fail | swagger ≠ live (swagger disagrees with both spec and the live code it supposedly reflects) | **Pure swagger generation bug** — rare; swagger is wrong even though spec and live agree with each other | Dev: same as row 2, swagger-side fix only |

Never resolve a swagger-vs-spec disagreement by assuming either document is authoritative — the
classification above already tells you which side to trust for that fact (spec, per the "assert
spec" rule, always drives the test's own assertion regardless of which row applies); what changes
per row is only which **system** (spec vs live-code vs swagger-generation) needs the actual fix.

**Why (spec vs swagger) + (spec vs live), and never a direct (swagger vs live) test.** Three
claims (spec, swagger, live) have three possible pairs, but equality is transitive — any 2 of the
3 pairwise comparisons already determine the 3rd (if spec=swagger and spec≠live, then swagger≠live
follows for free; no test needs to check it directly). (spec vs live) is the behavior test, which
must exist regardless — it's the whole point of the suite. Of the remaining two candidates for the
second comparison, (spec vs swagger) beats (swagger vs live) on cost, not just redundancy: `Doc
Conformance` only reads a static `swagger.json` — no live call, no auth, no side effects. A direct
`swagger vs live` test would need its *own* live call to get "live"'s value, duplicating the
behavior test's live call for the exact same fact — wasteful for any endpoint, and actively harmful
for a mutating command (a second `POST` means a second real side effect, e.g. a second Objective
created, just to re-derive information the first call plus a free document read already gave you).
So: never add a third `swagger vs live` test — when a classification needs that fact, derive it
from the other two test results (their failure messages already show the actual received values).

## Test Case YAML Template

Referenced by: Step 4 — Test Case Format.

```yaml
feature: "{Feature Name}"
module: "{bc-module, e.g. analytics}"
base_url: "{{API_BASE_URL}}"
spec_refs:                                    # REQUIRED — every id WITH its exact version, no exceptions
  - "UC-xxx vX.Y.Z (specs/path/to/UC-xxx.md)"  # or .specs-0.3/... — whichever actually held it this run
  - "ES-xxx vX.Y.Z (.specs-0.3/path/to/ES-xxx.md)"
  - "PM-xxx vX.Y.Z (specs/path/to/PM-xxx.md)"
# An unversioned entry makes the Step 2 "existing artifact" version-check unprovable on the next
# run (see SKILL.md → Step 2, pre-existing artifact check) — it forces a full regenerate every
# time instead of short-circuiting when nothing actually changed. Always include the version.

notes: >
  Optional: scope notes, rewrite history, known spec-vs-runtime drift, env vars required.

test_cases:

  - id: TC-01
    title: "{Title}"
    priority: High/Medium/Low
    type: Positive/Negative/Edge
    status: active   # or: skipped (pair with skip_reason)
    spec_ref: "UC-xxx ACn / VAL-xxx / §Section"
    preconditions:
      - "API is reachable"
      - "Caller holds {permission}"
    test_steps:
      - step: 1
        action: "{HTTP verb} {path} with {key params}"
        expected_result: "{what}"
      - step: 2
        action: "Verify {what}"
        expected_result: "{expected}"
    test_data:
      method: "GET"
      endpoint: "/api/..."
      headers:
        Authorization: "Bearer {{API_AUTH_TOKEN}}"
      body:
        field: value
    expected_result: "HTTP {status} · {body assertion}"
    bug_notes: >
      Optional: only when this case documents a confirmed spec-vs-runtime drift or known bug —
      cite the confirmed live behavior, not an assumption.
```

## Playwright Spec Skeleton

Referenced by: Step 6 — Playwright Spec Rules.

```ts
import { test, expect } from '@playwright/test';
import { apiCall, TOKEN } from '../../../lib/http';
import { expectStatus, expectError, expectSuccessBody, expectJsonContentType, expectWwwAuthenticateHeader } from '../../../lib/assert';

const PATH = '/api/governance/goals';   // endpoint under test

test.describe('{Entity} API', { tag: ['@gov', '@bearer'] }, () => {
  let token = '';
  let swagger: any;   // shared across every [DOC-NN] test — fetched once, never per-test

  test.beforeAll(async () => {
    token = TOKEN() ?? '';
    expect(token, 'Auth token empty — check .env credentials / global-setup').not.toBe('');
    swagger = await (await fetch(process.env.SWAGGER_URL!)).json();
  });

  // @readonly/@mutating is MANDATORY on every test (not just case-type tags like @negative/@authz)
  // — derived from the HTTP method in that test's own apiCall() call, see Step 6, Tags. This is
  // what lets a prod-monitoring run select `--grep @readonly` and skip every test that would
  // create/modify/delete real data.

  test('[TC-01] valid input → 200', { tag: ['@mutating'] }, async () => {
    const res = await apiCall('POST', PATH, { token, body: { /* ... */ } });
    expectStatus(res, 200);
    const id = await res.json();
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  test('[TC-02] missing required field → 400', { tag: ['@negative', '@mutating'] }, async () => {
    const res = await apiCall('POST', PATH, { token, body: { /* incomplete */ } });
    expectStatus(res, 400);
    await expectJsonContentType(res);   // MANDATORY on every error-path test, see Step 6
  });

  test('[TC-03] no auth token → 401', { tag: ['@authz', '@mutating'] }, async () => {
    const res = await apiCall('POST', PATH, { body: { /* ... */ } });   // no token on purpose
    expectStatus(res, 401);
    expectWwwAuthenticateHeader(res);   // MANDATORY on every 401 test, see Step 6
    await expectJsonContentType(res);
  });
  // TC-03 is @mutating even though it 401s before any write: the underlying call is still a POST
  // against a mutating route — a prod-monitoring run has no way to know the call fails before it's
  // sent, so the tag reflects the route's own method, not whether this particular case reaches the
  // handler.

  test('[TC-04] cross-tenant id resolves as not-found', { tag: ['@negative', '@readonly', '@cross-tenant'] }, async () => {
    // Deliberately targets a different tenant's fixture — @cross-tenant is read-only-only (GET
    // here), never a write against a tenant this suite doesn't own. See Grammar 0.4 UC & PM
    // Awareness, "only ever exercise it read-only."
    const res = await apiCall('GET', `${PATH}/{cross-tenant-fixture-id}`, { token });
    expectError(res, 404);
    await expectJsonContentType(res);
  });

  // [DOC-NN] tests never call the API under test — they only read the static swagger.json already
  // fetched in beforeAll — so they're always @readonly regardless of the endpoint's own method.

  test('[DOC-01] swagger declares Success Status 200 (per CT)', { tag: ['@readonly'] }, async () => {
    expect(Object.keys(swagger.paths[PATH].post.responses)).toContain('200');
  });

  test('[DOC-02] swagger request schema has every CT-documented field name', { tag: ['@readonly'] }, async () => {
    // One assertion per CT Request DTO row — catches a future rename/drop that a behavior test
    // alone would miss (see Grammar 0.4 CT Awareness: boolean-polarity + parameter-name notes).
    // For a GET, read `.get.parameters.map(p => p.name)` instead of a body schema's `properties`.
    const bodySchemaRef = swagger.paths[PATH].post.requestBody.content['application/json'].schema.$ref;
    const schema = swagger.components.schemas[bodySchemaRef.split('/').pop()];
    for (const field of ['title', 'description', 'dueDate']) {
      expect(Object.keys(schema.properties), `CT-documented field "${field}" missing from swagger`).toContain(field);
    }
  });
});
```
