from pypdf import PdfReader, PdfWriter
import sys

cover_path = sys.argv[1]
report_path = sys.argv[2]
out_path = sys.argv[3]

reader_cover = PdfReader(cover_path)
reader_report = PdfReader(report_path)
writer = PdfWriter()

# add cover page(s)
for p in reader_cover.pages:
    writer.add_page(p)
# add all pages from report except the first
for p in reader_report.pages[1:]:
    writer.add_page(p)

with open(out_path, 'wb') as f:
    writer.write(f)

print('wrote', out_path)
