const mockValues = new Map<string, string | number | boolean>();
jest.mock('react-native-mmkv', () => ({createMMKV:()=>({
  getAllKeys:()=>[...mockValues.keys()],getString:(key:string)=>typeof mockValues.get(key)==='string'?mockValues.get(key):undefined,
  getNumber:(key:string)=>typeof mockValues.get(key)==='number'?mockValues.get(key):undefined,
  getBoolean:(key:string)=>typeof mockValues.get(key)==='boolean'?mockValues.get(key):undefined,
  set:(key:string,value:string|number|boolean)=>mockValues.set(key,value),clearAll:()=>mockValues.clear(),
})}));
jest.mock('react-native-quick-crypto', () => ({}));
jest.mock('@dr.pogodin/react-native-fs',()=>({CachesDirectoryPath:'/cache',DocumentDirectoryPath:'/docs',exists:jest.fn(async()=>false),readDir:jest.fn(),readFile:jest.fn(),unlink:jest.fn(),mkdir:jest.fn(),copyFile:jest.fn()}));
jest.mock('@react-native-documents/picker',()=>({keepLocalCopy:jest.fn()}));
jest.mock('react-native-nitro-unzip',()=>({getUnzip:jest.fn()}));
import {readDir,readFile} from '@dr.pogodin/react-native-fs';
import {inspectLegacyBackupDirectory} from '../src/core/legacyBackupArchive';
import {convertLegacyBackup} from '../src/data/legacyBackup';
import {restoreLegacyBackup} from '../src/data/legacyRestore';
import {appStorage} from '../src/data/storage';

const xml=(content:string)=>`<?xml version='1.0' encoding='utf-8' standalone='yes' ?><map>${content}</map>`;
const current=()=>JSON.parse(String(mockValues.get('reader.preferences.v1')));
beforeEach(()=>{mockValues.clear();jest.clearAllMocks();mockValues.set('reader.preferences.v1',JSON.stringify({fontSize:25,screenTimeoutSeconds:600,theme:'night'}));});

test('readConfig.json without config.xml preserves the current timeout', async()=>{
  const preview=convertLegacyBackup({'readConfig.json':'[{"textSize":21}]'});
  await restoreLegacyBackup(JSON.stringify(preview.payload),appStorage,{});
  expect(current()).toMatchObject({fontSize:21,screenTimeoutSeconds:600});
});

test('loads real snapshot shape and applies keep_light after readConfig without losing other preferences', async()=>{
  const files={'config.xml':xml('<string name="keep_light">&#51;00</string><boolean name="unrelated" value="true" />'),'readConfig.json':'[{"textSize":21}]'};
  jest.mocked(readDir).mockResolvedValue(Object.keys(files).map(name=>({name,path:'/stage/'+name,isFile:()=>true,isDirectory:()=>false})) as never);
  jest.mocked(readFile).mockImplementation(async path=>files[String(path).split('/').pop() as keyof typeof files]);
  const preview=await inspectLegacyBackupDirectory('/stage','','token',{});
  expect(preview.importedFiles).toContain('config.xml');
  expect(preview.warnings.join(' ')).toMatch(/其他|部分/);
  await restoreLegacyBackup(JSON.stringify(preview.payload),appStorage,{});
  expect(current()).toMatchObject({fontSize:21,screenTimeoutSeconds:300});
});

test('keep_light is restored even when readConfig is ignored, as in BackupConfig', async()=>{
  const preview=convertLegacyBackup({'config.xml':xml('<string name="keep_light">-1</string>'),'readConfig.json':'[{"textSize":21}]'});
  await restoreLegacyBackup(JSON.stringify(preview.payload),appStorage,{readConfig:true});
  expect(current()).toMatchObject({fontSize:25,screenTimeoutSeconds:-1,theme:'night'});
});

test('last duplicate preference wins and unsupported values do not reset existing settings', async()=>{
  const valid=convertLegacyBackup({'config.xml':xml('<string name="keep_light">60</string><string name="keep_light">0</string>')});
  await restoreLegacyBackup(JSON.stringify(valid.payload),appStorage,{});
  expect(current().screenTimeoutSeconds).toBe(0);
  for(const item of ['<string name="keep_light">123</string>','<int name="keep_light" value="60"/>','<string name="keep_light"> 60 </string>']) {
    const preview=convertLegacyBackup({'config.xml':xml(item),'bookSource.json':'[{"bookSourceUrl":"https://test.invalid","bookSourceName":"test"}]'});
    expect(preview.warnings.join(' ')).toContain('config.xml');
    await restoreLegacyBackup(JSON.stringify(preview.payload),appStorage,{});
    expect(current().screenTimeoutSeconds).toBe(0);
  }
});

test('malformed XML, unsupported entities and nesting never apply a value', async()=>{
  for(const config of [xml('<string name="keep_light">60</map>'),xml('<string name="keep_light">&secret;</string>'),xml('<set name="x"><string name="keep_light">60</string></set>'),xml('<string name="keep_light">60</string><broken>'),xml('<string name="keep_light">60</string><int name="invalid" value="oops"/>')]) {
    const preview=convertLegacyBackup({'config.xml':config,'bookSource.json':'[{"bookSourceUrl":"https://test.invalid","bookSourceName":"test"}]'});
    await restoreLegacyBackup(JSON.stringify(preview.payload),appStorage,{});
    expect(current().screenTimeoutSeconds).toBe(600);
  }
});

test('accepts normal escaped XML attributes and CDATA in snapshots', async()=>{
  const preview=convertLegacyBackup({'config.xml':xml('<string name="author\'s name">A &amp; B</string><string name="keep_light"><![CDATA[60]]></string>')});
  await restoreLegacyBackup(JSON.stringify(preview.payload),appStorage,{});
  expect(current().screenTimeoutSeconds).toBe(60);
});

test('rejects DTDs and overly large tags without altering preferences', async()=>{
  for (const config of [
    '<!DOCTYPE map [<!ENTITY x "60">]>'+xml('<string name="keep_light">&x;</string>'),
    xml('<string name="'+ 'x'.repeat(70_000) +'">unused</string><string name="keep_light">60</string>'),
  ]) {
    const preview=convertLegacyBackup({'config.xml':config,'bookSource.json':'[{"bookSourceUrl":"https://test.invalid","bookSourceName":"test"}]'});
    await restoreLegacyBackup(JSON.stringify(preview.payload),appStorage,{});
    expect(current().screenTimeoutSeconds).toBe(600);
    expect(preview.warnings.join(' ')).toContain('config.xml');
  }
});
