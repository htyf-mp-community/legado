"""Prepare disposable iOS restore-policy archives from the app's own normal WebDAV backup."""
import argparse, copy, hashlib, json, zipfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('archive',type=Path);p.add_argument('--output',type=Path,required=True);a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(a.archive) as z: files={n:z.read(n) for n in z.namelist() if not n.endswith('/')}
original=json.loads(files['backup-htyf.json']);books=json.loads(original['entries']['library.v1']['value']);book=copy.deepcopy(next(b for b in books if b['id']=='ios-web-cover-fixture'));book['id']='imported-book-url-identity';book['customIntro']='iOS合并恢复验收'
def entry(v):return {'type':'string','value':json.dumps(v,ensure_ascii=False)}
image=files[original['media']['files'][0]['path']];background='bg/restore-policy.png';payload={k:copy.deepcopy(original[k]) for k in ['format','version','storageId','createdAt']}
payload['entries']={'library.v1':entry([book]),'reader.preferences.v1':entry({'fontSize':12,'paperBackgroundImage':'file:///previous-device/Documents/bg/restore-policy.png'}),'app.preferences.v1':entry({'themeMode':'dark','language':'zh-CN'}),'backup.preferences.v1':entry({'deviceName':'foreign-restore-policy','autoBackup':True,'webDavBookAutoRestore':True}),'source-cookie.v1.restore-policy':entry({'sid':'skip-public-fixture'}),'legacy.runtime-source-cache.v1':entry([{'key':'restore-policy','value':'skip-public-fixture'}])}
payload['media']={'version':1,'references':{'file:///previous-device/Documents/bg/restore-policy.png':background},'files':[{'path':background,'sha256':hashlib.sha256(image).hexdigest(),'size':len(image)}]}
def write(name,content):
 with zipfile.ZipFile(a.output/name,'w',zipfile.ZIP_DEFLATED) as z:
  for path,data in content.items():z.writestr(path,data)
write('backup2026-10-28-restore-policy-partial.zip',{'backup-htyf.json':json.dumps(payload,ensure_ascii=False).encode(),background:image})
# Restore just the changed record after acceptance; avoid needless media remapping of unchanged books.
cleanup={k:copy.deepcopy(original[k]) for k in ['format','version','storageId','createdAt']};cleanup['entries']={'library.v1':entry([next(b for b in books if b['id']=='ios-web-cover-fixture')]),'app.preferences.v1':copy.deepcopy(original['entries']['app.preferences.v1'])}
write('backup2026-10-28-restore-policy-cleanup.zip',{'backup-htyf.json':json.dumps(cleanup,ensure_ascii=False).encode()})
write('backup2026-10-28-restore-policy-baseline.zip',files)
print(json.dumps({'booksBefore':len(books),'partialBooks':1,'partialEntries':len(payload['entries']),'mediaFiles':1}))
