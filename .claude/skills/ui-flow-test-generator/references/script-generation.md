# Step 6 — Script Generation Reference

> Loaded on demand by SKILL.md Step 6a.

### 6a. Run generator

```bash
python3 generate_scripts.py \
  --testcases test-cases/ui/{feature}-test-cases.yaml \
  --element-map element-map.json \
  --page-url $PAGE_URL \
  --feature {feature} --out-dir script/ui \
  --backend-mode $BACKEND_MODE \
  --domain-tag {domain}        # e.g. sop | actors | strategy | releases | ...
```

> ⚠️ `--backend-mode real` makes the generated spec: (1) skip TCs with any `data_dependency: fixture` step, (2) emit `const T = 15000` for `toBeVisible/toBeHidden` timeouts, (3) inject `await settled(page)` → `waitForLoadState('networkidle')` after every `page.goto`. Defaults to `mock` if unset.

> 🏷️ **Playwright native tags (CI sharding) — PASS `--domain-tag`.** CI selects tests with `npx playwright test --grep @<tag>` (see `.azure/azure-pipelines.automation-testing.yaml`). The generator emits `test.describe(name, { tag: ['@<domain>', '@<tier>'] }, …)` on the top-level describe.
> - **`--domain-tag`** — one canonical domain: `sop`, `analytics`, `drtp`, `releases`, `governance`, `operations`, `forge`, `capture`, `channel`, `strategy`, `testing`, `actors`. **Always pass it** — you know the BC from the spec; the domain is NOT 1:1 with the URL (e.g. `/knowledge/sops`→sop but `/knowledge/rag-sync`→operations; `/actors/*` splits into testing/channel/actors). If omitted, the script infers from `--page-url` and prints a `VERIFY` notice; if nothing matches it warns and emits only the tier tag.
> - **`--tier`** — defaults to `regression` (every generated spec is a regression test). Use `--tier smoke` only for the hand-curated smoke set; normally leave it.
> - The canonical list lives in two places that must stay in sync: the pipeline `testTag` param and `CANONICAL_DOMAIN_TAGS` in `generate_scripts.py`. Adding a new domain means editing **both** + `URL_DOMAIN_FALLBACK`.
> - **`@readonly` / `@mutating` — the safety tag, emitted automatically, PER TEST.** Nothing to pass. Domain and tier sit on the describe; this one goes on each `test(...)` because within one screen "the list renders sorted" and "submitting creates a record" belong on different sides of the line.
>
>   **Why it exists.** The same suite runs against two kinds of target:
>   - our own test tenant (`UI_AUTH_TENANT=root`, dev) — everything runs, writes included;
>   - **production monitoring**, or any tenant that is not ours — only tests that cannot create/update/delete may run. Prod monitoring selects them with `npx playwright test --grep @readonly`.
>
>   **How a test is classified** (`scripts/mutation_tags.py`, applied to the finished file so nothing is missed). `@mutating` when the test — or a `beforeEach`/`beforeAll` enclosing it, or a helper it calls — reaches any of:
>   | signal | what it means |
>   |---|---|
>   | `api-write` | `.post/.put/.patch/.delete(`, or an explicit non-GET `method:` |
>   | `click-write` | an action on a control whose name carries a write verb (`submitBtn`, `Approve`, `Delete`, `Log Callback`, …) |
>   | `seed` | uses the `seedData` fixture, i.e. depends on records the `seed` project wrote |
>
>   Everything else is `@readonly`. **The classification deliberately errs toward `@mutating`**: losing a read-only test from the prod run costs coverage, leaking a write into someone else's tenant does damage. Consequences worth knowing: a hook that writes marks *every* test it encloses, and a test that clicks submit but mocks the endpoint with `page.route` is still `@mutating` (the mock only holds in mock mode).
>
>   **`@shared-seed` — the reuse tag, also automatic, also per test.** Added when the
>   classifier's only signal is `seed`: the test reads a seeded entity and writes nothing
>   of its own. `setup/seed-runtime.ts` then hands every such test in the file the SAME
>   seeded entity (one per worker) instead of running the recipes again per test.
>
>   Why it is a separate tag and not just `@readonly`: using `seedData` is itself counted
>   as a write signal — seeding IS a POST — so **every** seeded test is `@mutating` by
>   construction, and a `@readonly` check would fire on exactly none of them. The two tags
>   answer different questions: `@readonly` asks "may this run against prod?", `@shared-seed`
>   asks "does the BODY write, beyond the seeding?".
>
>   It matters because `seedData` is a **test-scoped** fixture: a `scope: 'beforeAll'` recipe
>   seeds one fresh entity PER TEST, which measured 337 new rows per full run — on a backend
>   with 4 DELETE routes across 219 paths, none of which can remove them. One Initiative has
>   already accumulated 683 such rows. Sharing the read-only ones cuts that by 53%.
>
>   Opt-IN by design: an untagged test keeps its private entity, so a misclassification
>   wastes rows instead of leaking one test's writes into another's fixture.
>
>   **Two things the safety tag does NOT cover.** The `seed` project itself writes and runs before everything — disable that project when pointing the suite at a tenant you must not write to; `--grep` cannot exclude it. And `@readonly` means "writes nothing", not "safe to run at any volume".
>
>   The `lint:tests` gate (rule **R7**) fails the build if a test carries neither tag or both. Never hand-pick a tag to get past it — fix the body, or accept `@mutating`.

> ⚠️ Pass the relative `$PAGE_URL` (a full URL also works — host is stripped via `to_relative_url()`); emitted `const PAGE_URL` / `page.goto(...)` come out root-relative. Details + rationale: **URL Convention**.

> ⚠️ `element-map.json` button `text` fields concatenate nested span text (BeautifulSoup limitation). The beacon selector uses only `words[0]` (first whitespace-split token) to match Playwright's accessible name resolution.

> ⚠️ Button selectors auto-detect first-word regex collisions across the full element map (e.g. `/All/i` matching both "All Tasks" and "Source: All"). Collisions are auto-upgraded to `exact: true`. No configuration needed.

