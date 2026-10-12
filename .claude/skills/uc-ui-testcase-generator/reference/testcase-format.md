# Test case data shape & xlsx format

## Intermediate JSON (input to `render_xlsx.py`)

```json
{
  "group_title": "DANG NHAP HE THONG (UC1.1)",
  "group_subtitle": "Nguon: UC1.1_Dang-nhap-he-thong.md + khao sat UI thuc te qua Playwright ngay 2026-10-11",
  "blocks": [
    {
      "function": "Dang nhap he thong (UC1.1)",
      "items": [
        {
          "id": "TC_UC1.1_001",
          "title": "Hien thi man hinh dang nhap mac dinh",
          "pre": "- Chua dang nhap he thong",
          "steps": "1. Truy cap trang dang nhap",
          "expected": "- Hien du 3 truong bat buoc: Ten dang nhap, Mat khau, Ma xac nhan",
          "priority": "Cao"
        }
      ]
    }
  ]
}
```

`group_title`/`group_subtitle` become the two merged banner rows at the top of the
sheet. Each `blocks[]` entry becomes one blue "Chuc nang: <function>" banner followed
by its items. Write `group_subtitle` with the same provenance style already used in
`workspace/ui-tests-self-assessment/testcases_data_*.py`: UC source file, whether the
UI was checked live (and when), and the target URL.

## Item fields

| Field | Required | Notes |
|---|---|---|
| `id` | Yes | `TC_<UC-id>_<NNN>`, zero-padded 3-digit, sequential within the UC (e.g. `TC_UC1.1_001`, `TC_UC1.1_002`) |
| `title` | Yes | Short, ASCII-only (no Vietnamese diacritics) |
| `pre` | No | Preconditions; multi-line with `\n` renders as separate lines in the cell |
| `steps` | Yes | Numbered steps, `\n`-joined |
| `expected` | Yes | Expected result — must trace to a UC business rule/flow/field spec row, or to a literal observation from the live capture. No invented copy. |
| `priority` | Yes | Exactly `"Cao"`, `"Trung binh"`, or `"Thap"` — these three strings drive the conditional color in the xlsx |

Mark anything unverifiable as `[CAN XAC NHAN]` inside `expected` (or `pre`) rather than
omitting the test case or inventing the answer — this is the same marker the UC `.md`
files in this repo already use for open questions.

## xlsx column layout (produced by `render_xlsx.py`)

| Column | Source key | Width |
|---|---|---|
| ID | `id` | 16 |
| TITLE | `title` | 42 |
| DIEU KIEN TIEN QUYET | `pre` | 34 |
| STEP | `steps` | 46 |
| KET QUA MONG DOI | `expected` | 54 |
| DO UU TIEN | `priority` | 12 |
| STATUS KHI RUN TEST | *(blank, dropdown)* | 20 |

This is the identical column set used by every file already in `testcases-xlsx/`.

## Styling reused (not reinvented)

`render_xlsx.py` reproduces, byte-for-byte in spirit, the styling from
`workspace/ui-tests-self-assessment/build_xlsx.py`:

- Title row (merged, bold, size 15, `#1F4E78`) + subtitle row (italic, grey)
- One blue banner row per function (`#2E75B6` fill, white bold text): `Chuc nang: <name>`
- Header row: dark-blue fill (`#1F4E78`), white bold text, frozen below it
- `DO UU TIEN` cell font color: `Cao` = red/bold, `Trung binh` = orange, `Thap` = green
- `STATUS KHI RUN TEST` column: a data-validation dropdown with exactly four options
  (`Dat`, `Khong dat`, `Chan (Blocked)`, `Chua thuc hien`) and conditional fill per
  value (green/red/yellow) — this column is intentionally left blank; QA fills it in
  when they execute the suite (which this skill does not do)
- A generated "Index" sheet: one row per function with a hyperlink into its banner row,
  item count, and a grand-total formula

If a test case's title contains the literal substrings `[Edge case]`, `[Validation]`,
or `[Bug ghi nhan]`, its row gets a light highlight fill (yellow for edge/validation,
orange for a logged bug) — same convention as the existing hand-written data files.
`render_xlsx.py` detects these substrings automatically; you don't need to set a
separate flag.

## The .md twin (`Testcase/{feature-slug}-test-cases.md`)

`render_md.py` takes the exact same input JSON as `render_xlsx.py` and renders it as
plain Markdown: an overview table (function → count) followed by one `##` section and
one table per function, columns ID / TITLE / DIEU KIEN TIEN QUYET / STEP / KET QUA
MONG DOI / DO UU TIEN — the same six content columns as the xlsx, minus STATUS KHI RUN
TEST (that column exists to be filled in during a test run; a Markdown file checked
into git is a reviewable snapshot, not a run tracker — status-tracking stays the
xlsx's job). Multi-line `pre`/`steps`/`expected` are flattened to `<br>`-separated
lines so the Markdown table grid stays valid.

Always generate the `.md` from the same `blocks.json` you used for the `.xlsx` in the
same run — never write one by hand and the other from a script, or they will drift out
of sync with each other.

```bash
python3 render_md.py --in blocks.json --out "Testcase/{feature-slug}-test-cases.md"
```

## Multiple UCs in one file

`render_xlsx.py` always writes one fresh workbook per run (Index sheet + one data
sheet). If you need several UCs combined into one workbook the way
`testcases_quan-ly-tu-danh-gia.xlsx` combines several feature groups, generate each
UC's JSON separately and pass all of them in one `render_xlsx.py` call with repeated
`--in`/`--sheet-name` pairs (see `--help`) rather than hand-editing the script.
