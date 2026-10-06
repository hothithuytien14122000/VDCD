"""Classify Playwright tests as @readonly or @mutating, and stamp the tag on them.

WHY this exists
---------------
The same suite runs against two kinds of target:

  * dev / our own test tenant (UI_AUTH_TENANT=root) — everything may run, writes included;
  * production monitoring, or any tenant that is not ours — only tests that cannot
    create, update or delete anything may run.

Playwright selects that split with `--grep @readonly`. For it to be trustworthy EVERY
test must carry exactly one of the two tags, and a test that writes must never be
labelled read-only: a wrong tag here writes real data into someone else's tenant.

The classification therefore errs toward @mutating. Losing a read-only test from the
prod run costs coverage; leaking a write does damage.

A test is @mutating when it, a hook enclosing it, or a helper either reaches:
  * api-write   — a .post/.put/.patch/.delete call, or an explicit non-GET `method:`
  * click-write — an action (click/press/check/selectOption/...) on a control whose
                  name carries a write verb (submit/save/create/delete/approve/...)
  * seed        — the `seedData` fixture, i.e. it depends on records the seed project wrote
Everything else is @readonly.
"""
import re
import pathlib

TEST_DECL = re.compile(
    r"""^(?P<indent>[ \t]*)test(?P<mod>\.(?:skip|fail|fixme|only))?\(\s*(?P<q>['"`])(?P<title>(?:\\.|(?!(?P=q)).)*)(?P=q)""")
HOOK_DECL = re.compile(r"^(?P<indent>[ \t]*)test\.(?:beforeEach|beforeAll)\s*\(")

# Write-verb detection is TOKEN-based, not a plain \b regex: identifiers in this suite are
# camelCase (`submitBtn`, `addSubmit`, `delegateTrigger`) and a \b-anchored match misses
# every one of them — that is how `submitBtn(page).click()` first read as read-only.
TOKEN = re.compile(r"[A-Z]+(?![a-z])|[A-Z][a-z]*|[a-z]+")
WRITE_STEMS = (
    "submit", "save", "creat", "add", "delete", "remov", "discard", "confirm", "publish",
    "retire", "revis", "approv", "reject", "deny", "denie", "revok", "delegat", "escalat",
    "assign", "updat", "edit", "record", "apply", "activat", "deactivat", "suspend",
    "reactivat", "resolv", "acknowledg", "handoff", "retry", "dismiss", "govern",
    "charter", "complet", "block", "unblock", "deprecat", "enabl", "disabl", "trigger",
    "import", "upload", "generat", "seed", "promot", "send",
)
# NOT write verbs, on purpose: cancel, close, view, open, load, clear, back, next, prev,
# filter, search, sort, expand, collapse, copy, export, download, refresh, select.
NOT_WRITE = {"address", "addresses", "addressed", "addressing", "sender", "recorder"}
# Domain submit labels no stem can reach without dragging in noise ("log" would hit
# login/logout, "change" would hit "changed" everywhere). Extend as new screens land.
EXTRA_WRITE_LABELS = re.compile(r"log\s*callback|pick\s*up|change\s*status", re.I)

API_WRITE = re.compile(
    r"""\.(?:post|put|patch|delete)\s*\(|\bmethod\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]""",
    re.I)
SEED = re.compile(r"\bseedData\b")
ACT = re.compile(
    r"\.(?:click|dblclick|setChecked|check|uncheck|selectOption|setInputFiles|press)\s*\(")


def strip_comments(src: str) -> str:
    """Blank out // and /* */ comments, preserving offsets and line count.

    Comment prose is full of write verbs ("creates a decision", "delete is forbidden"),
    which is exactly what the verb heuristic keys on — leaving comments in marked whole
    files as mutating.
    """
    out, i, n = [], 0, len(src)
    while i < n:
        c = src[i]
        if c in "'\"`":
            q, j = c, i + 1
            while j < n and src[j] != q:
                j += 2 if src[j] == "\\" else 1
            out.append(src[i:min(j + 1, n)]); i = j + 1
        elif src.startswith("//", i):
            j = src.find("\n", i); j = n if j < 0 else j
            out.append(" " * (j - i)); i = j
        elif src.startswith("/*", i):
            j = src.find("*/", i + 2); j = n if j < 0 else j + 2
            out.append("".join(ch if ch == "\n" else " " for ch in src[i:j])); i = j
        else:
            out.append(c); i += 1
    return "".join(out)


def block_span(lines, i, indent):
    """(start, end) of a block opened on line i and closed by `})` at the same indent."""
    close = re.compile(r"^%s\}\s*\)\s*;?\s*$" % re.escape(indent))
    for j in range(i + 1, len(lines)):
        if close.match(lines[j]):
            return i, j
    return i, len(lines) - 1


def helper_bodies(src: str) -> dict:
    """name -> its ACTUAL body, delimited by brace matching, incl. helpers nested in a
    describe. A fixed-size slice spills into whatever follows the helper (which made a
    3-line `settled()` look like it wrote); an unindented-only pattern misses every
    helper declared inside `test.describe(...)`."""
    out = {}
    decl = re.compile(r"^[ \t]*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(|"
                      r"^[ \t]*(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?[(<]", re.M)
    for m in decl.finditer(src):
        name = m.group(1) or m.group(2)
        b = src.find("{", m.start())
        if b < 0:
            continue
        depth, j, n = 0, b, len(src)
        while j < n:
            if src[j] == "{":
                depth += 1
            elif src[j] == "}":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        out.setdefault(name, src[b:j + 1])
    return out


def has_write_verb(text: str) -> bool:
    if EXTRA_WRITE_LABELS.search(text):
        return True
    for t in TOKEN.findall(text):
        low = t.lower()
        if low not in NOT_WRITE and low.startswith(WRITE_STEMS):
            return True
    return False


def direct_signals(text: str) -> set:
    hits = set()
    if API_WRITE.search(text):
        hits.add("api-write")
    if SEED.search(text):
        hits.add("seed")
    for m in ACT.finditer(text):
        if has_write_verb(text[max(0, m.start() - 200):m.start()]):
            hits.add("click-write")
            break
    return hits


def signals(text, helpers, depth=0, seen=frozenset()) -> set:
    hits = direct_signals(text)
    if depth < 3:
        for name, body in helpers.items():
            if name in seen:
                continue
            if re.search(r"(?<![\w.])%s\s*\(" % re.escape(name), text):
                sub = signals(body, helpers, depth + 1, seen | {name})
                real = {s for s in sub if not s.startswith("via:")}
                if real:
                    hits.add("via:" + name)
                    hits |= real
    return hits


def classify_source(src: str, extra_helper_src: str = "") -> list:
    """[(line_index, 'readonly'|'mutating', signals)] for every test in `src`."""
    stripped = strip_comments(src)
    lines = stripped.split("\n")
    helpers = helper_bodies(stripped)
    if extra_helper_src:
        for k, v in helper_bodies(strip_comments(extra_helper_src)).items():
            helpers.setdefault(k, v)

    hooks = []
    for i, ln in enumerate(lines):
        hm = HOOK_DECL.match(ln)
        if hm:
            hs, he = block_span(lines, i, hm.group("indent"))
            sg = {"hook:" + x for x in signals("\n".join(lines[hs + 1:he + 1]), helpers)
                  if not x.startswith("via:")}
            hooks.append((sg, len(hm.group("indent"))))

    out = []
    for i, ln in enumerate(lines):
        m = TEST_DECL.match(ln)
        if not m:
            continue
        s, e = block_span(lines, i, m.group("indent"))
        # BODY ONLY — the declaration line is excluded on purpose. Test TITLES are full of
        # write verbs ("... Retry button is visible", "... when the channel is enabled")
        # while the body only asserts, and including the title both produced false
        # `mutating` and made the verdict depend on how long the title happened to be.
        hits = signals("\n".join(lines[s + 1:e + 1]), helpers)
        # A hook runs for every test it encloses, so its writes belong to those tests.
        for sg, hind in hooks:
            if hind <= len(m.group("indent")):
                hits |= sg
        out.append((i, "mutating" if hits else "readonly", sorted(hits)))
    return out


def tag_source(src: str, extra_helper_src: str = "") -> str:
    """Return `src` with `{ tag: ['@readonly'] }` / `['@mutating']` on every test that
    does not already carry one, plus `'@shared-seed'` on every seeded test whose body
    never writes. Idempotent."""
    lines = src.split("\n")
    for i, verdict, sigs in reversed(classify_source(src, extra_helper_src)):
        m = TEST_DECL.match(lines[i])
        if not m:
            continue
        q = "'" if m.group("q") == "`" else m.group("q")
        # `seed` is the ONLY signal: the test reads a seeded entity and writes nothing of
        # its own, so it can share one entity with the file's other such tests instead of
        # POSTing a private one per test. See the shared-fixture note in
        # setup/seed-runtime.ts — measured -177 rows/run across the three seeded suites.
        #
        # It cannot be folded into @readonly: `signals()` counts the mere use of seedData
        # as a write (seeding IS a POST), so every seeded test is @mutating by
        # construction and a @readonly check would never fire.
        share = f", {q}@shared-seed{q}" if sigs == ["seed"] else ""
        if "tag:" in lines[i][m.end(): m.end() + 40]:
            # Already tagged — only backfill @shared-seed into the existing array.
            if share and "@shared-seed" not in lines[i]:
                arr = re.search(r"tag:\s*\[([^\]]*)\]", lines[i])
                if arr:
                    lines[i] = lines[i][:arr.end(1)] + share + lines[i][arr.end(1):]
            continue
        lines[i] = lines[i][:m.end()] + f", {{ tag: [{q}@{verdict}{q}{share}] }}" + lines[i][m.end():]
    return "\n".join(lines)
