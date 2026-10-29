"""Derive local acceptance archives from the simulator's own uploaded ZIP."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('archive', type=Path)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(args.archive) as archive:
    content = {name: archive.read(name) for name in archive.namelist() if not name.endswith('/')}
payload = json.loads(content['backup-htyf.json'])
original = copy.deepcopy(payload)
refs = payload['media']['references']
replace = {path: '/previous-device/Documents/' + relative for path, relative in refs.items()}
payload['media']['references'] = {replace[path]: relative for path, relative in refs.items()}
books = json.loads(payload['entries']['library.v1']['value'])
for book in books:
    for field in ['persistedCoverUrl', 'customCoverUrl']:
        if book.get(field) in replace:
            book[field] = replace[book[field]]
payload['entries']['library.v1']['value'] = json.dumps(books, ensure_ascii=False)
image = content[payload['media']['files'][0]['path']]
for relative in ['covers/other image.png', 'bg/paper image.png']:
    content[relative] = image
    payload['media']['files'].append({'path': relative, 'sha256': hashlib.sha256(image).hexdigest(), 'size': len(image)})
    payload['media']['references']['/previous-device/Documents/' + relative] = relative
groups = json.loads(payload['entries']['bookshelf.groups.v1']['value'])
next(group for group in groups if group['id'] == '1')['cover'] = '/previous-device/Documents/covers/other image.png'
payload['entries']['bookshelf.groups.v1']['value'] = json.dumps(groups, ensure_ascii=False)
payload['entries'].setdefault('reader.preferences.v1', {'type': 'string', 'value': '{}'})
reader = json.loads(payload['entries']['reader.preferences.v1']['value'])
reader['paperBackgroundImage'] = 'file:///previous-device/Documents/bg/paper%20image.png'
payload['entries']['reader.preferences.v1']['value'] = json.dumps(reader, ensure_ascii=False)
content['backup-htyf.json'] = json.dumps(payload, ensure_ascii=False).encode()
def write(name, files):
    with zipfile.ZipFile(args.output / name, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path, data in files.items():
            archive.writestr(path, data)
write('backup2026-10-28-portable.zip', content)
broken = dict(content)
first = payload['media']['files'][0]['path']
data = bytearray(broken[first])
data[-1] ^= 1
broken[first] = data
write('backup2026-10-28-broken.zip', broken)
write('backup2026-10-28-original.zip', {**{name: data for name, data in content.items() if name in [file['path'] for file in original['media']['files']]}, 'backup-htyf.json': json.dumps(original, ensure_ascii=False).encode()})
write('backup2026-10-28-native.zip', {
    'bookshelf.json': json.dumps([{'name': 'iOS原版媒体预览', 'author': '验收作者', 'bookUrl': 'preview-native', 'intro': '原简介', 'customIntro': '私人简介', 'coverUrl': 'https://example.test/source.png', 'persistedCoverUrl': '/old/covers/a.jpg'}], ensure_ascii=False).encode(),
    'covers/a.jpg': image,
})
print(json.dumps({'books': len(books), 'media': len(payload['media']['files']), 'files': 4, 'oldDevice': '/previous-device/Documents'}, ensure_ascii=False))
