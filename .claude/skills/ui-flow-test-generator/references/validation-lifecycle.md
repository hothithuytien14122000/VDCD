# Validation-Message Lifecycle Invariants

Spec sources only ever mandate the **appearance** direction of validation — "field empty →
error shown". Nothing in a VIF / UC / ES / DS ever writes down that the message must **go
away** once the user fixes the field. So a purely spec-driven suite is structurally blind to
the whole disappearance half of the lifecycle, and a form that never re-validates ships green.

> Origin: found by manual eyeballing on **Decision Recording** (2026-07-28). `Rationale` shows
> "Rationale is required" after an empty submit; the user then types a rationale and clicks
> outside the field — the red message **stays**. 82 generated TCs, all green: every VAL TC
> asserted the message appears, none that it clears. Reproduced by the generated lifecycle TCs
> on `Rationale` (Record a Decision) and on `Rationale` in the Resolve form.

These are **UI/UX correctness** oracles, not spec oracles. Emitted by
`build_form_test_cases` (validation-lifecycle pass) as `category: validation-lifecycle`,
rendered by `_render_validation_lifecycle_test`, asserted by
`apps/testing/automation-testing/fe-testing/setup/validation-helpers.ts`, and enforced by the Step 4.5
gate (dimension 2 hard-blocks when a required field has no lifecycle TC).

## Invariants

1. **A field's validation message must not survive a valid value** (`kind: clear-on-valid`).
   Provoke the message (submit the empty form; if submit is gated, touch + blur the field),
   confirm it appeared, enter a valid value, then assert the message is gone.
   **Oracle timing is deliberately permissive:** clearing *on change* passes, clearing *only
   after blur* also passes. It FAILS only when the message survives **both** — that state is
   unambiguously broken, no matter which re-validation convention the form follows.
   One TC per required field.

2. **A pristine form shows no validation message** (`kind: pristine`).
   Right after the form/dialog opens and before any interaction, no field-level message may be
   visible. Catches messages rendered on mount and state leaking from a previous open of the
   same dialog. One TC per form.

3. **Validation re-arms** (`kind: reappear`).
   After the message clears, violating the rule again must surface it again. A validator that
   fires once and then goes silent lets an invalid value be submitted with no warning. One TC
   per required **typed** field (a Select cannot be returned to its unselected state).

4. **Clear/Reset returns the form to pristine** (`kind: reset`).
   After provoking messages and clicking Clear/Reset, no message may survive. The submit
   control is checked **only if it was enabled before** the errors were provoked — a form that
   gates submit until the input is valid is legitimately disabled on a just-cleared form, and
   asserting otherwise reports a false bug. One TC per form that exposes a Clear/Reset control.

## Widget handling

A valid value is entered the way the widget demands, derived by `_lifecycle_widget`:

| Widget | How a valid value is entered |
|---|---|
| input / textarea | `.fill(value)` |
| select / combobox | `openSelect(field)` → pick the first `option` |
| datepicker | not typeable → the TC skips with a typed reason (drive by hand, Step 4.7) |

A name that reads like a picker (`*-combobox`, `*type`, `status`, `objective`, `priority`, …)
is treated as a **select even when element-map captured an `<input>`** — a base-ui Combobox is
an `<input>` whose required-error only clears when an option is chosen, so typing free text
into it would report a false stale-validation bug.

## Why this is not covered by the VAL pass

| Pass | Asserts |
|---|---|
| `validations[]` (2c-validation) | message **appears** on the violation |
| `boundary_constraints` | min/max accepted / rejected |
| lifecycle (this doc) | message **disappears** when fixed, stays away when pristine, comes back when re-violated, is wiped by reset |

The first two can be 100 % green on a form whose validation state is write-only.

## On a violation — reconcile with spec BEFORE labelling it

Follows [[no-spec-claim-without-evidence]] and [[spec-oracle-never-tune-test-to-dev]].

- Grep the spec (`{feature}-spec.yaml` + the source `$SPEC_FILE`) for a line governing when
  the message clears (VIF §Interactions / §Validation Rules sometimes says "re-validate on
  blur" or "clear on change").
- **Spec has a verbatim line** → cite it; the finding is grounded on that line.
- **Spec is silent** (the normal case) → it is a **self-evident UI/UX defect = out-of-spec
  bug**. Keep it red with `test.fail(true, 'DEV-BUG: UI/UX — stale validation message …')`,
  evidence = the deployed DOM + the failure message, and state explicitly that the spec
  carries **no** mandate. Never manufacture a spec requirement, never call it a spec/design
  violation, and never relax the oracle to make the suite green.
