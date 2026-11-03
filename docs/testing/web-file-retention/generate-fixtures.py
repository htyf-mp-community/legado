from pathlib import Path
import struct
import zipfile

root = Path('/private/tmp/legado-webfile-native-fixture')
root.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(root / 'native.epub', 'w') as archive:
    archive.writestr('mimetype', 'application/epub+zip', compress_type=zipfile.ZIP_STORED)
    archive.writestr('META-INF/container.xml', '<container><rootfile full-path="book.opf"/></container>')
    archive.writestr('book.opf', '<package><metadata><dc:title>本地 EPUB 测试</dc:title><dc:creator>测试作者</dc:creator></metadata><manifest><item id="c" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c"/></spine></package>')
    archive.writestr('chapter.xhtml', '<html><head><title>第一章</title></head><body><p>模拟器文件保留验证</p></body></html>')
html = '<h1>第一章</h1><p>模拟器文件保留验证</p>'.encode()
data = bytearray(240 + len(html))
for offset, value, fmt in [(76, 2, '>H'), (78, 94, '>I'), (86, 240, '>I'), (94, 1, '>H'), (98, len(html), '>I'), (102, 1, '>H'), (122, 65001, '>I')]:
    struct.pack_into(fmt, data, offset, value)
data[110:114] = b'MOBI'
data[240:] = html
(root / 'native.mobi').write_bytes(data)
