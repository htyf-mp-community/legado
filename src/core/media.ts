export type MediaRequest={uri:string;headers:Record<string,string>};

const MEDIA=/https?:\/\/[^\s"'<>]+|(?:file|content):\/\/[^\s"'<>]+/gi;
const EXT=/\.(?:m3u8|mpd|mp4|m4v|mov|webm|mkv|avi|ts)(?:[?#]|$)/i;

export function parseMediaRequest(value:string,base?:string):MediaRequest{
  const raw=value.trim();
  if(!raw)throw new Error('播放地址为空');
  let address=raw,headers:Record<string,string>={};
  const optionAt=raw.indexOf(',{');
  if(optionAt>0){address=raw.slice(0,optionAt).trim();try{const options=JSON.parse(raw.slice(optionAt+1)) as {headers?:unknown};if(options.headers&&typeof options.headers==='object')headers=Object.fromEntries(Object.entries(options.headers).map(([key,item])=>[key,String(item)]))}catch{throw new Error('媒体请求参数 JSON 无效')}}
  try{return{uri:new URL(address,base).toString(),headers}}catch{throw new Error(`无效播放地址: ${address}`)}
}

export function findMediaUrl(value:string,base?:string){
  const decoded=value.replace(/&amp;/g,'&').replace(/\\\//g,'/');
  const candidates=decoded.match(MEDIA)??[];
  const match=candidates.find(item=>EXT.test(item))??candidates[0];
  if(!match)return undefined;
  try{return new URL(match.replace(/[),.;]+$/,''),base).toString()}catch{return undefined}
}

export const mediaFileName=(uri:string,title='media')=>{
  let extension='mp4';
  try{const match=new URL(uri).pathname.match(/\.([a-z0-9]{2,5})$/i);if(match)extension=match[1].toLowerCase()}catch{}
  const safe=title.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').replace(/\s+/g,' ').slice(0,80)||'media';
  return `${safe}.${extension}`;
};
