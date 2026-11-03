import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
const root='/Users/dgz/code/github/legado/htyf';
const base='http://127.0.0.1:18218';
const config=JSON.parse(await readFile(`${root}/dist/app.json`,'utf8'));
config.appUrlConfig=`${base}/app.json`;
config.zipUrl=`${base}/dist.dgz`;
const requests=[];
http.createServer(async(req,res)=>{
  const path=new URL(req.url,base).pathname;
  requests.push({method:req.method,path});
  await writeFile('/private/tmp/legado-real-host-requests.json',JSON.stringify(requests,null,2));
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  if(path==='/app.json'){const body=Buffer.from(JSON.stringify(config));res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','Content-Length':body.length});res.end(req.method==='HEAD'?undefined:body);return;}
  if(path==='/source.json'){const body=await readFile(`${root}/docs/testing/real-source-1321/vikbook.json`);res.writeHead(200,{'Content-Type':'application/json','Content-Length':body.length,'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:body);return;}
  if(path==='/dist.dgz'){const body=await readFile(`${root}/dist/dist.dgz`);res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':body.length,'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:body);return;}
  res.writeHead(404);res.end();
}).listen(18218,'127.0.0.1',()=>console.log('local app config 127.0.0.1:18218'));
