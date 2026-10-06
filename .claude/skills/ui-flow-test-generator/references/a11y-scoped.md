# Accessibility — scoped to what the VIF declares

**Scope rule (the whole policy):** assert exactly the clauses written in the VIF's
`## Accessibility` section. Do not add a WCAG audit, do not sweep for landmarks or contrast
ratios, do not invent a keyboard contract the VIF is silent about.

Two reasons this is a scope and not a shortcut:

1. `## Accessibility` **is** a spec requirement — nearly every VIF in this corpus fills all
   five bullet groups, and the clauses are concrete enough to assert verbatim
   (`role="dialog"`, `aria-live="polite"`, "auto-focus {field} on open"). Scoped a11y is
   spec conformance, not an extra.
2. Unscoped a11y probing has already produced a **false bug** on this project (#147402, the
   focus-trap probe). A probe family that manufactures findings is worse than no probe.

Typical yield: ~1 TC per clause, so 5–8 TCs per VIF. `category: a11y`.

---

## The five clause groups → how to assert each

### 1. ARIA roles — `role="dialog"`, `aria-live="polite"`, `role="status"`, `role="alert"`

Assert the attribute on the named component, not on a guessed ancestor.

```ts
await expect(page.getByRole('dialog')).toBeVisible()          // named sheet is open
await expect(page.locator('[aria-live="polite"]')).toHaveCount(1)
```

- `aria-live` regions are usually **empty until something happens** — assert the container
  exists, then assert it *receives* the text, never that it is non-empty at page load.
- `role="alert"` is announced immediately on render, `role="status"` is polite. When a VIF
  assigns them to *different* components (an actionable warning banner vs. a passive status
  badge), that distinction IS the oracle: assert the specific role the clause names on the
  component it names — never "some live region exists".

### 2. Keyboard shortcuts — `Esc` closes, `Enter` submits, `Tab` order

`Esc` and `Enter` are behavioural and safe to assert directly:

```ts
await page.keyboard.press('Escape')
await expect(page.getByRole('dialog')).toBeHidden()
```

**Tab order:** only assert it when the VIF states an order ("Tab cycles through form fields
in declared order"). Walk `Tab` and collect the settled `activeElement` after each press
(see the settled-read rule below), then compare the sequence to the VIF's field order. Never
assert an absolute index — a spec delta adding one field would break every later assertion.

### 3. Focus management — trap, auto-focus, restore

**⚠️ Read the settled `activeElement`, never the value immediately after `Tab`.** An
immediate read catches the pre-focus state and reports a working trap as broken — this is
exactly what produced the false BUG-4 / #147402. Poll until it stops changing:

```ts
async function settledActiveElement(page: Page): Promise<string> {
  let last = '', stable = 0
  for (let i = 0; i < 20 && stable < 3; i++) {
    const cur = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      return el ? `${el.tagName}#${el.id}.${el.className}` : ''
    })
    stable = cur === last ? stable + 1 : 0
    last = cur
    await page.waitForTimeout(50)
  }
  return last
}
```

**⚠️ A focus-trap sentinel must live INSIDE the dialog, never outside it.** Guarding with an
element outside the dialog inverts the test: normal trap behaviour then looks like a failure.
Assert the trap by tabbing `n+1` times through `n` focusables and checking focus **returned
to the first focusable inside the dialog** — not by checking some outside element never gains
focus.

**Auto-focus:** assert on open, before any interaction, using the settled read.
**Restore:** capture the trigger's identity before opening, close, then assert the settled
`activeElement` matches it.

### 4. Screen reader announcements

The VIF quotes the string ("Item triaged — {disposition}"). Assert that string appears in the
live region — a `{placeholder}` makes it a **substring/prefix** assertion, never exact.

**⚠️ Poll, do not sample.** Sonner-style toasts auto-dismiss in ~4s; a single delayed read
produced the withdrawn bug #148977. Use `expect(...).toBeVisible()` (which retries) or poll.

### 5. Non-color indicators

The most defect-prone group and the one worth keeping even if everything else were dropped:
it is a **functional** assertion wearing an a11y label. Two states that differ only in colour
are indistinguishable in a screenshot, a colourblind view, and a diff.

```ts
const badge = row.getByTestId('{badge-testid}')     // scope to the ROW, never page-wide
await expect(badge).toContainText('{label}')        // the text label the clause quotes
await expect(badge.locator('svg')).toBeVisible()    // and an icon, not colour alone
```

Scope every badge assertion to its row — a page-wide badge locator passes off an unrelated
row and has produced vacuous passes before.

---

## Widget traps that make an a11y assertion lie

**Base UI / shadcn `Switch` and `Checkbox` put the `id` on a hidden 1×1 `<input>`.**
`expect(page.locator('#myToggle')).toBeVisible()` is then a **guaranteed pass** regardless of
the UI, and `.click()` times out on it. Use the role and the ARIA state:

```ts
const sw = page.getByRole('switch', { name: '{accessible name}' })
await expect(sw).toHaveAttribute('aria-checked', 'false')
await sw.click()
await expect(sw).toHaveAttribute('aria-checked', 'true')
```

**`getByRole(..., { name })` matches the accessible name, not the visible text.** When
`aria-label` differs from the rendered label, a role query can find an element the user never
sees — assert visible text separately when the VIF names on-screen copy.

---

## On a violation

Follows the same ladder as the render invariants:

- **VIF `## Accessibility` states it verbatim** → a real conformance finding; quote the clause
  as `spec_ref` (`{VIF-id} §Accessibility {group}`).
- **VIF is silent** → out of scope. Do **not** file it, do not add the TC. If it looks
  genuinely broken, mention it as an observation in the run report and let a human decide;
  never manufacture a spec mandate, and never let it fail the suite.
