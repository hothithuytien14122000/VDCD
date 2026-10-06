# Error Recovery — Reference

Use when Step 8 (test execution) returns a non-zero exit code. Load this file the moment you see Playwright crash output, missing-dependency errors, or auth failures.

## 1. Classify the failure

| Type | Signs | Action |
|------|-------|--------|
| **Test failure** | Assertion fail, element not found, wrong text | Real test result → proceed to Step 9 normally |
| **Infra failure** | Network timeout, Playwright crash, missing deps, auth expired, browser launch fail | Diagnose → auto-fix → re-run (max 2 retries) |

## 2. Infra failure auto-fix recipes

| Symptom | Fix |
|---------|-----|
| Missing Node deps | `npm install` |
| Missing Playwright browsers | `npx playwright install` (or `chromium` only) |
| Auth expired / stale `.auth/user.json` | Delete `.auth/user.json` — next run auto-re-logs in |
| Login broken but session still valid | Re-run with `--no-deps` to skip auth setup and reuse `.auth/user.json` |
| Port conflict | Kill the blocking process |
| Network timeout | Increase timeout, retry |
| Browser launch fail | `npx playwright install chromium` |

## 3. Stop conditions

- After 2 infra-fix retries with no improvement → **STOP workflow**. Print the specific error + what was attempted. Do NOT proceed to Step 9 or post to Azure DevOps — results are meaningless.
- Only proceed to Step 9+ when at least 1 test completed execution (pass or fail).

## 4. `file://` PAGE_URL note

When `PAGE_URL` is a local HTML prototype, tests use `test.fail(true)` — PASS means "correctly expected to fail on prototype". Re-run against the live URL before any GO decision.
