import { addAppLog } from '../data/appLog';
import { createBackup } from '../data/backup';
import { loadBackupPreferences, saveBackupPreferences } from '../data/backupPreferences';
import { listWebDavBackups, loadWebDavConfig, uploadWebDavBackup, type RemoteBackupEntry } from '../data/remoteBackup';
const DAY=24*60*60*1000;
let running:Promise<'uploaded'|'disabled'|'not-due'|'unconfigured'>|undefined;
export function automaticBackupDue(lastBackup:number,now=Date.now()){return lastBackup+DAY<now}
const stamp=(now:number)=>new Date(now).toISOString().slice(0,10);
export function automaticBackupFileName(deviceName:string,now=Date.now()){return`backup${stamp(now)}-${deviceName}.json`}
export async function findNewRemoteBackup():Promise<RemoteBackupEntry|null>{const preferences=loadBackupPreferences();if(!preferences.autoCheckNewBackup)return null;const config=loadWebDavConfig();if(!/^https?:\/\//i.test(config.url))return null;const newest=(await listWebDavBackups(config))[0];return newest&&newest.modifiedAt>Math.max(preferences.lastBackup,preferences.lastCheckedRemote)+60_000?newest:null}
export async function runDueAutomaticBackup(now=Date.now()):Promise<'uploaded'|'disabled'|'not-due'|'unconfigured'>{if(running)return running;running=(async()=>{const preferences=loadBackupPreferences();if(!preferences.autoBackup)return'disabled';if(!automaticBackupDue(preferences.lastBackup,now))return'not-due';const config=loadWebDavConfig();if(!/^https?:\/\//i.test(config.url))return'unconfigured';try{await uploadWebDavBackup(config,createBackup(),automaticBackupFileName(preferences.deviceName,now));saveBackupPreferences({...preferences,lastBackup:now});addAppLog('Automatic WebDAV backup completed');return'uploaded'}catch(error){addAppLog('Automatic WebDAV backup failed',error);throw error}})();try{return await running}finally{running=undefined}}
