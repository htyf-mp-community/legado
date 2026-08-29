import{DocumentDirectoryPath,downloadFile,mkdir,stopDownload,unlink}from'@dr.pogodin/react-native-fs';
import{mediaFileName}from'./media';
import type{DownloadRecord}from'../data/downloads';
const jobs=new Map<string,number>();
export function createDownload(url:string,title:string,headers:Record<string,string>={}):DownloadRecord{const createdAt=Date.now(),id=`${createdAt}-${Math.random().toString(36).slice(2,8)}`;return{id,url,title,path:`${DocumentDirectoryPath}/downloads/${id}-${mediaFileName(url,title)}`,headers,state:'queued',progress:0,bytesWritten:0,contentLength:0,createdAt}}
// TODO(htyf-native): Switch to a pinned background runtime before promising process-death or boot recovery.
export async function runDownload(item:DownloadRecord,update:(patch:Partial<DownloadRecord>)=>void){await mkdir(`${DocumentDirectoryPath}/downloads`);update({state:'downloading',error:undefined});const task=downloadFile({fromUrl:item.url,toFile:item.path,headers:item.headers,background:false,progressDivider:1,begin:value=>update({contentLength:value.contentLength}),progress:value=>update({bytesWritten:value.bytesWritten,contentLength:value.contentLength,progress:value.contentLength?value.bytesWritten/value.contentLength:0})});jobs.set(item.id,task.jobId);try{const result=await task.promise;if(result.statusCode<200||result.statusCode>=300)throw new Error(`HTTP ${result.statusCode}`);update({state:'completed',progress:1})}catch(error){update({state:'failed',error:error instanceof Error?error.message:String(error)});throw error}finally{jobs.delete(item.id)}}
export function cancelDownload(id:string){const job=jobs.get(id);if(job!==undefined)stopDownload(job)}
export async function removeDownload(item:DownloadRecord){try{await unlink(item.path)}catch{}}
