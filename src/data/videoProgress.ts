import{appStorage}from'./storage';
const PREFIX='video.progress.v1.';
const key=(uri:string)=>PREFIX+encodeURIComponent(uri);
export function loadVideoProgress(uri:string,now=Date.now()){const raw=appStorage.getString(key(uri));if(!raw)return 0;try{const value=JSON.parse(raw) as {position:number;updatedAt:number};if(now-value.updatedAt>20*24*60*60*1000){appStorage.remove(key(uri));return 0}return Number.isFinite(value.position)?Math.max(0,value.position):0}catch{return 0}}
export function saveVideoProgress(uri:string,position:number,updatedAt=Date.now()){appStorage.set(key(uri),JSON.stringify({position:Math.max(0,position),updatedAt}))}
