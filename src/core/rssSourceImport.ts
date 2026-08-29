import { keepLocalCopy, pick, types } from '@react-native-documents/picker';
import { readFile, unlink } from '@dr.pogodin/react-native-fs';
import { parseRssSources } from '../data/rss';
import { DEFAULT_RSS_SOURCES } from '../data/defaultRssSources';
const clean=(uri:string)=>uri.startsWith('file://')?decodeURIComponent(uri.slice(7)):uri;
export async function importRssSourcesInput(input:string,fetcher:typeof fetch=fetch){const value=input.trim();if(!value)throw new Error('RSS 源内容为空');if(!/^https?:\/\//i.test(value))return parseRssSources(value);const response=await fetcher(value);if(!response.ok)throw new Error(`RSS 源下载失败：HTTP ${response.status}`);return parseRssSources(await response.text())}
export async function pickRssSourcesInput(){const files=await pick({type:[types.json,types.plainText],allowMultiSelection:false,mode:'import'}),file=files[0],copies=await keepLocalCopy({files:[{uri:file.uri,fileName:file.name??'rss-sources.json'}],destination:'cachesDirectory'}),copy=copies[0];if(copy.status==='error')throw new Error(copy.copyError);const path=clean(copy.localUri);try{return parseRssSources(await readFile(path,'utf8'))}finally{await unlink(path).catch(()=>undefined)}}
export function defaultRssSources(){return DEFAULT_RSS_SOURCES.map(source=>({...source}))}
