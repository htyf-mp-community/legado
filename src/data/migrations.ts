import type { MMKV } from 'react-native-mmkv';
import { appStorage } from './storage';
export const CURRENT_STORAGE_SCHEMA=1;
const VERSION='storage.schema.version';
type Store=Pick<MMKV,'getAllKeys'|'getString'|'getNumber'|'getBoolean'|'set'|'remove'>;
type Value=string|number|boolean;
function snapshot(store:Store){const values=new Map<string,Value>();for(const key of store.getAllKeys()){const string=store.getString(key);if(string!==undefined){values.set(key,string);continue}const number=store.getNumber(key);if(number!==undefined){values.set(key,number);continue}const boolean=store.getBoolean(key);if(boolean!==undefined)values.set(key,boolean)}return values}
function restore(store:Store,values:Map<string,Value>){for(const key of store.getAllKeys())store.remove(key);values.forEach((value,key)=>store.set(key,value))}
export function runStorageMigrations(store:Store=appStorage){const from=Math.max(0,store.getNumber(VERSION)??0);if(from>=CURRENT_STORAGE_SCHEMA)return from;const before=snapshot(store);try{let version=from;if(version<1){const legacy=store.getString('autoTaskRules');if(legacy&&!store.getString('auto.tasks.v1'))store.set('auto.tasks.v1',legacy);store.remove('autoTaskRules');version=1}store.set(VERSION,version);return version}catch(error){restore(store,before);throw error}}
