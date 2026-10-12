# Scripts & .env reference

## `.env` keys

Same convention as `workspace/ui-tests-self-assessment/.env.example` (simpler than the
enterprise multi-tenant setup `ui-flow-test-generator` targets — this app has no
tenant field):

```
BASE_URL=https://cds.geneat.pro
LOGIN_URL=https://cds.geneat.pro/#/vi/login
UI_AUTH_USERNAME=your.account@cds.local
UI_AUTH_PASSWORD=__PUT_YOUR_PASSWORD_HERE__
```

- Never ask for `UI_AUTH_PASSWORD` in chat — it would land in the transcript. Ask the
  user to fill it into `.env` by hand, then re-run.
- Look for an existing `.env` near the UC's related workspace (e.g.
  `workspace/ui-tests-self-assessment/.env`) before asking — the same test account is
  already shared across several suites in this repo; reuse it rather than creating a
  second one.
- `.env` must stay gitignored. If it isn't, say so before writing a password into it.

## `scripts/analyze_page.py`

Pure-Python HTML parser (no browser, no external deps beyond the stdlib) — turns a
page's HTML into `element-map.json`.

```bash
python3 scripts/analyze_page.py --url https://example.com/some/page --out element-map.json
python3 scripts/analyze_page.py --url authed-page.html --out element-map.json   # local file
python3 scripts/analyze_page.py --url file:///d:/path/to/page.html --out element-map.json
```

Output: a JSON object listing every `<input>`/`<select>`/`<textarea>`/`<button>`/link
found, each with `name`/`id`/`placeholder`/`required`/`type`/`options` (for selects)
and similar — this is what Step 3 (reconcile) and Step 5 (grounded wording) read from.

Takes a URL (fetched with `urllib`, no auth) or a local HTML file. For anything behind
a login, run `login_and_capture.py` first and feed its output HTML in here.

## `scripts/login_and_capture.py`

Playwright-driven login + authenticated page capture. Needs `playwright` installed
with a chromium binary (`python3 -m playwright install chromium`).

```bash
python3 scripts/login_and_capture.py --url https://cds.geneat.pro/#/vi/self-assessment-campaigns --out authed-page.html
```

- Reads `UI_AUTH_USERNAME` / `UI_AUTH_PASSWORD` / `UI_BASE_URL` / `LOGIN_URL` from the
  nearest `.env` (searched upward from the current directory) unless passed as flags.
- Tries a list of common selectors for the email/username field, password field, and
  submit button (see the script header) — works on most login forms without
  customization. If it reports "Email/username field not found", open the login page
  yourself and check the actual selector; the field layout may be unusual.
- On success, saves a Playwright storage state to `.auth/user.json` in the current
  directory and reuses it on the next run (skips re-login). Delete that file to force
  a fresh login.
- `--skip-login` captures the page with no auth at all (for a public page).
- `--storage-state <path>` loads a specific saved session instead of logging in.
- Exit code `2` means login failed — a `login-failed-*.html` debug file is written
  next to the intended output; read it to see what the login page actually showed
  (wrong selector guessed, captcha blocking automated login, account locked, etc.). A
  captcha-protected login may simply not be automatable — fall back to generating test
  cases from the UC's Field Specification table alone and say so in the Step 7 summary.

## `scripts/refresh_session_headless.js` (Step 9 — establishing a session to run tests)

The login form uses a real distorted-image captcha (not DOM text) — no script fills it
unattended. This one screenshots the captcha and polls for an answer file, same
handshake used during live-UI exploration.

Writes the same two files, same place/format, as a human running
`node scripts/save_auth_state.js` (inside `workspace/survey-api-tests`) — see that
script and `tests/helpers/ui.ts` for why two files: the login token lives in
`sessionStorage`, which `context.storageState()` never captures (only cookies +
`localStorage`), so it's read/restored separately via `context.addInitScript()`.

```bash
NODE_PATH="$(pwd)/workspace/survey-api-tests/node_modules" \
  node .claude/skills/uc-ui-testcase-generator/scripts/refresh_session_headless.js \
  --out-dir workspace/survey-api-tests/.auth \
  --env-file workspace/ui-tests-self-assessment/.env \
  [--chromium-path <path>]
```

| Flag | Required | Notes |
|---|---|---|
| `--out-dir` | Yes | Where to write `storageState.json` + `sessionStorage.json` — use the target Playwright project's `.auth/` so `tests/helpers/ui.ts` finds them |
| `--env-file` | No | `.env` to read `UI_AUTH_USERNAME`/`UI_AUTH_PASSWORD`/`BASE_URL` from; falls back to the process environment if omitted |
| `--chromium-path` | No | Explicit chromium binary, same as the other scripts in this skill |

**`NODE_PATH` is required** — the script's own folder has no `node_modules`, and
Node resolves `require()` by the file's location, not `cwd`. Pointing `NODE_PATH` at
the target project's `node_modules` (which already has `playwright-core`) avoids
copying the script in or installing a second Playwright.

Run it in the background, then:
1. Read the path it prints after `CAPTCHA_SCREENSHOT:` with your own image-reading tool.
2. Write the characters you read (no spaces) to the path it prints after
   `WAITING_FOR_CAPTCHA_ANSWER:`.
3. It resumes, logs in, and prints `Saved storageState: ...` / `Saved sessionStorage: ...`
   on success, or exits non-zero with a reason (misread captcha → exit 4, timed out
   waiting for the answer file → exit 5).

A session from either this script or the human-run `save_auth_state.js` is a drop-in
replacement for the other — nothing downstream cares which one produced it.

## `scripts/render_xlsx.py`

```bash
python3 scripts/render_xlsx.py \
  --in blocks.json --sheet-name Dang-Nhap --group-title "DANG NHAP HE THONG (UC1.1)" \
  --out testcases-xlsx/uc1-1-dang-nhap-he-thong-test-cases.xlsx
```

| Flag | Required | Notes |
|---|---|---|
| `--in` | Yes (repeatable) | Path to one Step-5 JSON file (see `testcase-format.md`) |
| `--sheet-name` | Yes (repeatable, paired with `--in` in order) | Sheet name for that JSON's data |
| `--group-title` | No | Override the JSON's own `group_title` for that sheet |
| `--out` | Yes | Output `.xlsx` path. Parent directory is created if missing |

Pass `--in`/`--sheet-name` more than once (same order) to combine several UCs' JSON
into one workbook with one Index sheet — each pair becomes its own data sheet, exactly
like the multi-sheet files already in `testcases-xlsx/`.

The script always writes a complete new workbook; it does not merge into an existing
`.xlsx` in place. If you want to add a UC to an already-existing combined workbook,
re-run with all the JSON files (the old ones plus the new one) rather than trying to
patch the binary file.
