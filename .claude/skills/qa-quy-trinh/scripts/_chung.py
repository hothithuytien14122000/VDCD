"""Hàm dùng chung cho các công cụ QA."""
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit('Thiếu thư viện: pip install pyyaml openpyxl')


def doc_yaml(p):
    p = Path(p)
    if not p.exists():
        return None
    try:
        return yaml.safe_load(p.read_text()) or {}
    except yaml.YAMLError as e:
        sys.exit(f'YAML sai cú pháp ở {p}: {e}')


def ghi_yaml(p, data):
    Path(p).parent.mkdir(parents=True, exist_ok=True)
    Path(p).write_text(yaml.safe_dump(data, allow_unicode=True, sort_keys=False, width=200))


def cac_trang(qa):
    qa = Path(qa)
    return sorted({f.stem for d in ('yeu-cau', 'testcase') for f in (qa / d).glob('*.yaml')})


def rut_gon(ds, toi_da=25):
    return ds if len(ds) <= toi_da else ds[:toi_da] + [f'... và {len(ds) - toi_da} mục nữa']
