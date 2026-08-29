import { appStorage } from './storage';
import { loadDiagnosticPreferences } from './diagnosticPreferences';
const KEY='app.logs.v1',MAX=200;
export type AppLogEntry={id:string;at:number;level:'info'|'error';message:string;detail?:string};
export function loadAppLogs():AppLogEntry[]{const raw=appStorage.getString(KEY);if(!raw)return[];try{const value=JSON.parse(raw);return Array.isArray(value)?value.filter(item=>item&&typeof item.message==='string').slice(-MAX):[]}catch{return[]}}
export function addAppLog(message:string,error?:unknown){if(!loadDiagnosticPreferences().recordLog)return null;const entries=loadAppLogs(),at=Date.now(),detail=error instanceof Error?error.stack??error.message:error===undefined?undefined:String(error),entry:AppLogEntry={id:`${at}-${Math.random().toString(36).slice(2)}`,at,level:error===undefined?'info':'error',message:message.slice(0,1000),detail:detail?.slice(0,4000)};appStorage.set(KEY,JSON.stringify([...entries,entry].slice(-MAX)));return entry}
export function clearAppLogs(){appStorage.remove(KEY)}
export function exportAppLogs(entries=loadAppLogs()){return entries.map(entry=>`[${entry.level.toUpperCase()}] ${new Date(entry.at).toISOString()}\n${entry.message}${entry.detail?`\n${entry.detail}`:''}`).join('\n\n')}
