"""Thư viện rút gọn để viết TC bằng code thay vì YAML dài. Dùng: viết 1 file generator ngoài repo
(vd. /tmp/gen/<uc>.py), `from tcgen import *`, gọi req/oq/tc/tc_table, cuối cùng dump(...).
Chạy với: PYTHONPATH=.claude/skills/uc-testcase-excel-yaml/scripts python3 /tmp/gen/<uc>.py
Locator tự gom từ target đã dùng; ID TC_<uc>_<NNN> tự đánh số; test_data/${biến} tự kiểm bởi build_outputs.py."""
import copy, yaml

REQS, TCS, OQS, LOC, CNT = [], [], [], set(), {}
EXPECT_OK, EXPECT_NC = "confirmed", "needs_confirmation"

def req(i, typ, text, status="clear"):
    REQS.append({"id": i, "type": typ, "text": text, "status": status})

def oq(i, text, refs):
    OQS.append({"id": i, "text": text, "requirement_refs": refs})

def s(action, target, inp, desc, exp="—", msg=None, nc=False):
    """1 step. msg: chuỗi message mong đợi -> tự sinh assertion text_contains. nc=True: expected chưa chắc."""
    if target: LOC.add(target)
    ass = []
    if msg:
        tg = target if action == "verify" and target else "toast_message"
        LOC.add(tg); ass = [{"type": "text_contains", "target": tg, "value": msg}]
    return {"action": action, "target": target, "input": inp, "description": desc,
            "expected": {"description": exp, "assertions": ass, "status": EXPECT_NC if nc else EXPECT_OK}}

def tc(uc, title, typ, tech, prio, refs, pre, data, steps, result,
       auto="partial", blockers=None, notes=None, unconfirmed=False):
    CNT[uc] = CNT.get(uc, 0) + 1
    steps = copy.deepcopy(steps)           # tránh dùng chung dict giữa các TC (YAML anchor)
    for n, x in enumerate(steps, 1):
        x["seq"] = n
    if unconfirmed: steps[-1]["expected"]["status"] = EXPECT_NC
    TCS.append({"id": f"TC_{uc}_{CNT[uc]:03d}", "title": title, "type": typ, "techniques": tech,
        "priority": prio, "requirement_refs": refs, "preconditions": pre, "test_data": data or {},
        "steps": [{"seq": x["seq"], **{k: v for k, v in x.items() if k != "seq"}} for x in steps],
        "expected_result": result,
        "automation": {"automatable": auto, "blockers": blockers or ["Thiếu locator"]}, "notes": notes})

def tc_table(uc, tmpl, rows):
    """Nhân 1 mẫu thành nhiều TC. tmpl: hàm(**row) -> dict kwargs cho tc() (không gồm uc). rows: list dict.
    Dùng cho tổ hợp trạng thái x vai trò, biên, từng message lỗi... Mỗi dòng bảng chỉ tốn vài token."""
    for r in rows: tc(uc, **tmpl(**r))

def dump(path, uc_id, uc_title, source, base_url="${env:BASE_URL}", credentials=None, route_hint=None):
    doc = {"schema_version": "1.0",
      "meta": {"uc_id": uc_id, "uc_title": uc_title, "source_file": source, "generated_at": __import__("datetime").date.today().isoformat(), "language": "vi", "total_test_cases": len(TCS)},
      "automation_config": {"framework": "playwright", "base_url": base_url, "route_hint": route_hint,
        "credentials": credentials or {},
        "locators": {k: {"strategy": None, "value": None, "status": "missing"} for k in sorted(LOC)},
        "api_endpoints": {}, "action_mapping": {"click": None}},
      "requirements": REQS, "open_questions": OQS, "test_cases": TCS}
    yaml.safe_dump(doc, open(path, "w"), allow_unicode=True, sort_keys=False, width=200)
