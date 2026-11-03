import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
const root='/private/tmp/legado-webfile-choice-fixture';
const requests=[];
http.createServer(async (req,res) => {
  const path=new URL(req.url,'http://127.0.0.1').pathname;
  requests.push({method:req.method,path,fixtureHeader:req.headers['x-legado-fixture']==='allowed'});
  await writeFile(`${root}/requests.json`,JSON.stringify(requests,null,2));
  if(req.headers['x-legado-fixture']!=='allowed'){res.writeHead(403);res.end();return;}
  if(path==='/detail') {const body=JSON.stringify({files:['/bundle.zip','/download']});res.writeHead(200,{'Content-Type':'application/json'});res.end(body);return;}
  if(path==='/download'&&req.method==='HEAD'){res.writeHead(200,{'Content-Disposition':"attachment; filename*=UTF-8''%E5%8D%95%E6%9C%AC.txt"});res.end();return;}
  if(path==='/bundle.zip'&&req.method==='GET'){const body=await readFile(`${root}/bundle.zip`);res.writeHead(200,{'Content-Type':'application/zip','Content-Length':body.length});res.end(body);return;}
  res.writeHead(404);res.end();
}).listen(18217,'127.0.0.1',()=>console.log('fixture 127.0.0.1:18217'));
