from pathlib import Path
import zipfile
root = Path('/private/tmp/legado-webfile-choice-fixture')
root.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(root / 'bundle.zip', 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    archive.writestr('第一本.txt', '第一章 第一册\n仅用于本机测试：第一本正文。')
    archive.writestr('第二本.txt', '第一章 第二册\n仅用于本机测试：第二本正文。')
