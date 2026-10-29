"""Create disposable native JSON ZIP and reader-setting cleanup from a normal app backup."""
import argparse,json,zipfile,urllib.request
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('baseline',type=Path);p.add_argument('--output',type=Path,required=True);a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
fixture=json.load(urllib.request.urlopen('http://127.0.0.1:18203/fixture.json',timeout=5))
with zipfile.ZipFile(a.baseline) as z:original=json.loads(z.read('backup-htyf.json'))
Path('.htyf-migration/evidence/ios/reading-position-baseline.json').write_text(json.dumps(original,ensure_ascii=False,indent=2)+'\n')
Path('.htyf-migration/evidence/ios/reading-position-fixture.json').write_text(json.dumps(fixture,ensure_ascii=False,indent=2)+'\n')
def write(name,files):
 with zipfile.ZipFile(a.output/name,'w',zipfile.ZIP_DEFLATED) as z:
  for file,value in files.items():z.writestr(file,json.dumps(value,ensure_ascii=False))
write('backup2026-10-29-reading-native.zip',{'bookshelf.json':[fixture['nativeBook']],'bookSource.json':[fixture['source']],'readConfig.json':[{'pageAnim':1,'textSize':20,'lineSpacingExtra':10,'paragraphIndent':'　　','titleMode':0}]})
cleanup={k:original[k] for k in ['format','version','createdAt','storageId']};cleanup['entries']={'reader.preferences.v1':original['entries'].get('reader.preferences.v1',{'type':'string','value':Path('/private/tmp/legado-ios-debug/reader-position-defaults.json').read_text()})}
write('backup2026-10-29-reading-settings-original.zip',{'backup-htyf.json':cleanup})
print(json.dumps({'booksBefore':len(json.loads(original['entries']['library.v1']['value'])),'nativeIndex':fixture['nativeBook']['durChapterIndex'],'expectedLoadedIndex':fixture['expected']['loadedChapterIndex'],'nativePosition':fixture['expected']['position']}))
