# UI-Render Correctness Invariants

Page-agnostic render defects that are DOM-observable and cheap to assert, but slip past
spec-driven TCs because no BR/VAL explicitly names them. Emit **one exploratory TC per
applicable widget** found in `element-map.json`, on any page (`rationale: "UI-render
invariant — <name>"`). These are UI/UX correctness checks, **not** spec oracles.

> Origin: caught only by manual eyeballing on the Conversation Lifecycle run —
> (1) a Channel `Select` showing the raw enum index `"0"` instead of `"Inbound Voice"`,
> (2) a column-visibility popover rendering detached/empty at the page bottom while the
> click still worked. Both are basic; the skill must not rely on a human to spot them.

## Invariants

1. **Select / dropdown trigger renders the human-readable label, not the raw value.**
   After choosing an option, assert the trigger's visible text **equals the option's
   label** and is **not** its underlying `value` (enum index, id, code). Concretely: the
   trigger text must not match `^\s*\d+\s*$` (a bare index) and must not equal the
   selected item's `value`. Root cause pattern: Base UI `Select.Value` rendered without an
   `items` map or a render function → it prints the raw `value`.

2. **Popover / dropdown-menu / column-toggle / combobox overlay is anchored and non-empty.**
   After opening, assert the panel is **visible**, **has non-empty content** (≥1 option/row),
   and is **positioned near its trigger** — overlapping or within a small gap of the
   trigger's bounding box, not stranded at `x/y ≈ 0` or the page footer. Catches portalled
   overlays that mount detached or render empty while the click still registers.

## On a violation — reconcile with spec BEFORE labelling it

Follows [[no-spec-claim-without-evidence]]. Do not guess a spec requirement.

- Grep the spec (`{spec_yaml}` + the source `$SPEC_FILE`) for an explicit design rule on
  that widget's rendering.
- **Spec has a verbatim line requiring it** → ground the finding on that line, quote it in
  `expected` / the bug Evidence (may be `Spec Bug`).
- **Spec is silent** → it is a **self-evident UI/UX correctness** defect = an **out-of-spec
  bug**. Keep it red (`test.fail(true, 'DEV-BUG: UI/UX — …')`), evidence = the **deployed
  DOM**, and state explicitly that the spec carries no mandate. Never manufacture a spec
  requirement to justify it, and never call it a spec/design violation.

---

## Invariant 8 — horizontal overflow inside a scroll box (Bug #149093, 2026-08-19)

`assertNoHorizontalOverflowInScrollBox(page, scope, label, minViewportWidth = 1024)`

A declared horizontal scroller (`overflow-x: auto|scroll`) whose content is **wider than its
box** has pushed columns off-screen. shadcn's default `<Table>` wrapper is literally
`relative w-full overflow-x-auto`, so **every table screen in this app is a candidate.** One
unbounded cell — a long display name, an unresolved GUID, a pasted blob — widens its column
and takes the trailing columns with it, including any row-action button.

**Why this needed a NEW invariant — all three existing checks passed green on a screen that
was visibly broken.** Measured on `/governance/bc-sovereignty` at 1280x720, where a 200-char
`sovereignName` widened the Sovereign column to 1816px:

| Existing check | Result | Why it is structurally blind |
|---|---|---|
| `assertNoHorizontalPageScroll` | **PASS (vacuous)** | `documentElement.scrollWidth` 1280 == `clientWidth` 1280. The `overflow-x-auto` wrapper **absorbs** the overflow, so the *document* never scrolls. Any page-level horizontal check cannot see a table inside a scroll box. |
| `assertChildWithinParent(cell, row)` | **PASS (vacuous)** | childRight 2219 ≤ parentRight 2776 — the `<tr>` widened *along with* the table, so a cell is **always** "within" its row. Comparing a cell to its own row can never detect column-driven table overflow; the meaningful parent is the scroll container. |
| `assertTextWithinViewport` | would have FAILED | but it only fires on an **injected sentinel** located by text prefix, and the field must appear in `layout_stress.stress_fields` to be injected. The column was added in a spec delta and never added to `stress_fields`, so nothing ran. |

**Two lessons, both generalizable:**

1. **A page-level geometry assertion is vacuous the moment an inner container declares
   `overflow`.** Assert against the container that actually bounds the content, not the
   document. The same trap applies vertically — which is why invariant 7 walks elements
   rather than checking the page.
2. **Any invariant that depends on an author-maintained field list will silently stop
   covering a screen the first time a spec delta adds a column.** The sentinel-injection
   guard is the *secondary* net; the primary net must be selector-free and fixture-free so
   it fires on the data the backend actually returns. That is why invariant 8 sits in the
   ALWAYS-ON family (`surface: hscroll`) alongside invariants 7 and `assertNoCollapsedScrollRegion`,
   not in the `stress_fields` family.

**Precision:** declared horizontal scrollers only (`overflow-x: hidden` deliberately excluded
— common in legitimate animation containers and unmeasured); skip surfaces narrower than 30%
of the viewport (a combobox popover is legitimately its own scroller); 8px epsilon; and a
**desktop-only** guard (`minViewportWidth = 1024`) because VIF §Responsive Rules routinely
*mandates* a horizontal `ScrollArea` at the tablet breakpoint. False-positive rate measured
**0/7** on other Command Center screens using the same shadcn wrapper — only the genuinely
broken screen fired.

**Spec grounding:** VIF `## Acceptance Criteria` almost always carries a "responsive layout
… with **no overflow**" clause (a VIF §Acceptance Criteria "no overflow" clause), and §Responsive Rules states per-breakpoint
whether horizontal scroll is permitted. Cite the AC line, not the CSS.
