import http from 'node:http';
import { PNG } from 'pngjs';
const port = 18202, origin = `http://127.0.0.1:${port}`, requests = [];
const blue = [24,91,190], red = [211,43,55], green = [22,150,70];
function image(width, height, pixel) { const png = new PNG({ width, height }); for(let y=0;y<height;y++)for(let x=0;x<width;x++){const color=pixel(x,y);const at=(y*width+x)*4;png.data.set([...color,255],at);}return PNG.sync.write(png); }
const images = { '/source.png':image(120,160,()=>blue), '/custom.png':image(120,160,()=>red), '/wide.png':image(120,60,x=>x<30?red:x>=90?green:blue), '/tall.png':image(120,320,(_x,y)=>y<60?red:y>=260?green:blue), '/option.png':image(120,160,()=>green) };
const source = { bookSourceUrl: origin, bookSourceName: 'iOS Web 封面验收源', bookSourceType:0, customOrder:-130, enabled:true, enabledExplore:false, header:'{"X-Web-Cover":"fixture-only"}' };
const book = { id:'ios-web-cover-fixture', origin, originName:source.bookSourceName, bookUrl:origin+'/book', name:'iOS Web封面验收', author:'图片验收作者', intro:'仅用于独立 iOS Web 缩略图验收。', content:'封面请求不应修改阅读进度或书架字段。', chapterTitle:'图片接口验收', chapters:[{id:'web-cover-chapter',title:'图片接口验收',content:'封面请求不应修改阅读进度或书架字段。'}],currentChapterIndex:0,progress:.35,groupIds:['1'],updatedAt:1700000000010,durChapterTime:1700000000010,canUpdate:false,coverUrl:origin+'/source.png',customCoverUrl:`http://localhost:${port}/custom.png` };
http.createServer((req,res)=>{
 const path=new URL(req.url,origin).pathname, sourceHeader=req.headers['x-web-cover']==='fixture-only', localToken=Boolean(req.headers['x-legado-token']), optionHeader=req.headers['x-image-option']==='explicit';
 const event={time:new Date().toISOString(),method:req.method,path,sourceHeader,localToken,optionHeader};requests.push(event);console.log(JSON.stringify(event));
 const send=(value,type='application/json',status=200)=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});res.end(type==='application/json'?JSON.stringify(value):value)};
 if(path==='/source.json')return send(source);if(path==='/book.json')return send(book);if(path==='/__state')return send({requests});
 if(localToken)return send('local token leaked','text/plain',403);
 if(path==='/source.png'&&!sourceHeader)return send('source header required','text/plain',403);
 if(path==='/custom.png'&&sourceHeader)return send('source header leaked','text/plain',403);
 if(path==='/option.png'&&!optionHeader)return send('explicit image header required','text/plain',403);
 if(images[path])return send(images[path],'image/png');
 if(path==='/invalid.png')return send('<html>not an image</html>','image/png');
 if(path==='/slow.png'||path==='/too-large.png'){
  let timer;if(path==='/too-large.png'){res.writeHead(200,{'Content-Type':'image/png','Content-Length':25*1024*1024+1});res.write(images['/source.png'].subarray(0,16));timer=setTimeout(()=>res.end(),30000)}else timer=setTimeout(()=>send(images['/source.png'],'image/png'),30000);
  res.on('close',()=>{clearTimeout(timer);console.log(JSON.stringify({time:new Date().toISOString(),path,closed:true,finished:res.writableFinished}))});return;
 }
 send('not found','text/plain',404);
}).listen(port,'127.0.0.1',()=>console.log(`Web cover fixture ready: ${origin}`));
