# Mock Strategies — Reference

Load this when wiring API mocks in Step 6 (script generation) or when a TC needs an error / empty / loading state.

## 1. Detect MSW mode before generating scripts

| Check | Result | Mock strategy |
|-------|--------|---------------|
| `public/mockServiceWorker.js` exists in the app source tree | **Service Worker MSW** | Use `page.route()` — intercepts before the service worker. `addInitScript` has NO effect. |
| `NEXT_PUBLIC_ENABLE_MOCKS=true` in `.env.development`, no `mockServiceWorker.js` | **Handler-only MSW** | Use `overrideFetchWithMock()` / `overrideFetchWithStatus()` via `addInitScript`. Pass `--msw` to the generator. |
| `NEXT_PUBLIC_ENABLE_MOCKS=false` or missing | **Real backend** | No mocking for happy path. Use `page.route()` for error/empty TCs. |

Set `BACKEND_MODE=mock|real` in `.env` after detection so the generator can read it.

> ❌ Do not rely on `page.route()` to mock the **initial list/detail GETs** of a Next.js App Router page — RSC fetches happen server-side before HTML reaches the browser. For read-only assertions use live seed data; for empty/error states trigger a client-side refetch after registering the route.

> ⚠️ MSW in-memory arrays persist mutations across page loads in the same browser context. Always mock the GET endpoint via `page.route()` per test with a known fixture — never rely on live MSW state for status-dependent tests.

## 2. Mode-specific patterns

**Service Worker MSW — `page.route()`:**
```typescript
await page.route('**/api/orchestration/tasks/my', route =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
);
await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
```
Do NOT use `overrideFetchWithMock` / `addInitScript` when this strategy is active.

**Handler-only MSW (`--msw` flag):** Generator emits `overrideFetchWithMock()` / `overrideFetchWithStatus()` automatically. Call them BEFORE `page.goto()` inside each test body — do NOT call them in `beforeEach`.

**Sub-routes** (e.g. `/build-records` + `/build-records/artifact-keys`): use `overrideFetchWithMockExcludeMany` / `overrideFetchWithStatusExcludeMany` from `setup/api-helpers.ts`. Scaffold from `api-helpers.template.yaml` if missing.

## 3. Post-generation mock-strategy scan (MANDATORY before Pre-Submit Gate)

For **handler-only MSW**:
```powershell
Select-String -Path "script/ui/{feature}.spec.ts" -Pattern "page\.route\(" | Select-Object -First 5
```
Any hits → stop and replace ALL `page.route(...)` with `overrideFetchWithMock` / `overrideFetchWithStatus`.

For **service worker MSW**:
```powershell
Select-String -Path "script/ui/{feature}.spec.ts" -Pattern "overrideFetchWithMock|addInitScript" | Select-Object -First 5
```
Any hits → stop and replace with `page.route()`.

## 4. Mock-first strategy — never leave `test.skip` for mockable scenarios

| Pattern | When | Implementation |
|---------|------|----------------|
| **A — Error HTTP** (404, 500, 409, 400) | TC requires error response | Mock the route with the target status BEFORE `page.goto()` |
| **B — Empty state** | TC requires no data | Mock the route to return `{ items: [], totalCount: 0 }` BEFORE `page.goto()` |
| **C — Loading skeleton** | TC requires loading UI | Delay route handler 3000ms (see pattern below), assert skeleton visible within 2000ms |
| **D — Unauthenticated** | TC requires no-auth context | `await browser.newContext({ storageState: { cookies: [], origins: [] } })` |
| **E — State-transition duplicates** | TC duplicates another TC's behavior | Remove entirely, renumber remaining TCs |

**Delayed-route pattern** (loading skeleton, double-click prevention):
```typescript
await page.route(API_TASKS, async route => {
  await new Promise(r => setTimeout(r, 3000));
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
});
await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
await expect(page.locator('[data-slot="skeleton"]')).toBeVisible({ timeout: 2000 });
```

**Known-bug TCs:** When a TC's `expected_outcome` documents missing functionality, use `test.fail(true, 'BUG: <description>')` — never `test.skip`. The test PASSES while the bug is present and FAILS once the code is fixed, prompting removal of the annotation.

## 5. Backport mocks to YAML (MANDATORY)

Every TC whose script calls `page.route(...)` / `overrideFetchWithMock(...)` / `overrideFetchWithStatus(...)` MUST have the matching response data in the YAML's `test_data` map. Naming:
- `mock_<resource>_body` — response body
- `mock_<resource>_status` — HTTP status (omit if 200)
- `<resource>` = `list` | `detail` | `create` | `update` | `<endpoint>`

Step 1 of each such TC must read: *"Force <METHOD> <endpoint pattern> to return `mock_*_body` / `mock_*_status` (see test_data)"* — never vague phrasings like "Intercept and return error".

**Drift check:**
```powershell
$script = (Select-String -Path "script/ui/{feature}.spec.ts" -Pattern "page\.route\(|overrideFetchWith(Mock|Status)" | Measure-Object).Count
$yaml   = (Select-String -Path "test-cases/ui/{feature}-test-cases.yaml" -Pattern "mock_\w+_body" | Measure-Object).Count
if ($script -ne $yaml) { Write-Error "YAML/script mock count mismatch: script=$script yaml=$yaml" }
```

## 6. `BACKEND_MODE=real` — fixture-skip wrappers

For every TC step tagged `data_dependency: fixture`, the generated script wraps the assertion in `test.skip(true, 'SEED: <value> may not exist in real backend')`. `data_dependency: any` steps generate normally.

When `BACKEND_MODE=real`, count assertions (`toHaveCount(6)`) are fixture-dependent — change to `toHaveCount(greaterThan(0))` and tag `fixture` in the TC step.
