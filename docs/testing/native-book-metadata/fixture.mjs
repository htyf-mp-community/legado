import http from 'node:http';
const origin='http://127.0.0.1:18200';
const rows=[];
http.createServer((req,res)=>{
 const url=new URL(req.url,origin);
 rows.push({method:req.method,path:url.pathname});
 let payload;
 if(url.pathname==='/__state') payload={requests:rows};
 else if(req.headers['x-batch-source']!=='fixture-only'){res.writeHead(403);return res.end();}
 else if(url.pathname==='/normal/search') payload=[{name:'模拟书 作者：测试作者',author:'作者：测试作者 著',url:origin+'/normal/book/fixture'}];
 else if(url.pathname==='/normal/book/fixture') payload={name:'模拟书 作者：测试作者',author:'作者：测试作者 著',intro:'本地测试简介',kind:'测试分类',wordCount:'12500',toc:origin+'/normal/toc/fixture'};
 else if(url.pathname==='/normal/toc/fixture') payload=[{title:'第一章 测试',url:origin+'/normal/chapter/fixture/1'}];
 else if(url.pathname==='/normal/chapter/fixture/1') payload={content:'独立模拟器元数据测试正文。'};
 else {res.writeHead(404);return res.end();}
 res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(payload));
}).listen(18200,'127.0.0.1',()=>console.log('Metadata fixture ready on 127.0.0.1:18200'));
