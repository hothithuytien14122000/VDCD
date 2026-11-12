#!/bin/bash
# Xem trước tài liệu: docx → PDF (LibreOffice) → ảnh PNG từng trang để soát bố cục.
# Dùng: hdsd/tools/preview.sh <file.docx> <thư-mục-ra> [trang,trang,...]
# Cần LibreOffice: SOFFICE=/đường/dẫn/soffice (mặc định /tmp/lo/root/opt/libreoffice26.8/program/soffice)
#   và PyMuPDF: PYMUPDF_PY=/đường/dẫn/python (mặc định /tmp/pdfenv/v/bin/python)
set -e
DOCX=$(realpath "$1"); OUT=$(mkdir -p "$2" && realpath "$2"); PAGES=$3
SOFFICE=${SOFFICE:-/tmp/lo/root/opt/libreoffice26.8/program/soffice}
PY=${PYMUPDF_PY:-/tmp/pdfenv/v/bin/python}
PROFILE="file:///tmp/lo/profile-$(basename "$DOCX" .docx)"   # mỗi tài liệu 1 profile → chạy song song được
timeout 300 "$SOFFICE" -env:UserInstallation="$PROFILE" --headless --convert-to pdf "$DOCX" --outdir "$OUT" >/dev/null 2>&1
PDF="$OUT/$(basename "$DOCX" .docx).pdf"
"$PY" -I - "$PDF" "$OUT" "$PAGES" <<'PY'
import pymupdf, sys
d = pymupdf.open(sys.argv[1]); out = sys.argv[2]
pages = [int(x) - 1 for x in sys.argv[3].split(',')] if len(sys.argv) > 3 and sys.argv[3] else range(d.page_count)
for i in pages:
    if 0 <= i < d.page_count:
        d[i].get_pixmap(dpi=60).save(f'{out}/trang-{i + 1:03d}.png')
print(f'{sys.argv[1]}: {d.page_count} trang → {out}/trang-NNN.png')
PY
