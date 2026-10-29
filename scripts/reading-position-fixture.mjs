import http from 'node:http';
const port=18203,origin=`http://127.0.0.1:${port}`,requests=[];
const titles=['卷一','第一章 起始','第二章 避免错位','第三章 原位置','第四章 结束'];
const paragraphs=Array.from({length:60},(_,i)=>`续读标记${String(i+1).padStart(3,'0')}。这是核对字符位置的第${i+1}段😀。${'甲乙丙丁戊己庚辛壬癸'.repeat(12)}本段结尾。`);
const content=paragraphs.join('\n\n');
const position=titles[3].length+1+paragraphs.slice(0,19).reduce((sum,line)=>sum+2+line.length+1,0)+2;
const source={bookSourceUrl:origin,bookSourceName:'iOS 旧版续读验收源',customOrder:-120,enabled:true,enabledExplore:false,bookSourceType:0,ruleBookInfo:{name:'$.name',author:'$.author',intro:'$.intro',tocUrl:'$.toc'},ruleToc:{chapterList:'$[*]',chapterName:'$.title',chapterUrl:'$.url',isVolume:'$.isVolume'},ruleContent:{content:'$.content'}};
const nativeBook={bookUrl:`${origin}/book`,origin,originName:source.bookSourceName,name:'iOS旧版续读验收',author:'续读验收作者',intro:'原版备份简介',customIntro:'续读私人简介',customTag:'resume-private',durChapterIndex:2,durChapterTitle:titles[3],durChapterUrl:`${origin}/chapter/3`,durChapterPos:position,totalChapterNum:4,latestChapterTitle:titles[4],canUpdate:false,type:0,durChapterTime:1700000000011};
http.createServer((req,res)=>{
 const path=new URL(req.url,origin).pathname;requests.push({time:new Date().toISOString(),method:req.method,path});console.log(JSON.stringify(requests.at(-1)));
 const send=value=>{res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 if(path==='/fixture.json')return send({source,nativeBook,expected:{loadedChapterIndex:3,position,needle:'续读标记020',paragraphs:paragraphs.length}});
 if(path==='/__state')return send({requests});
 if(path==='/book')return send({name:nativeBook.name,author:nativeBook.author,intro:nativeBook.intro,toc:`${origin}/toc`});
 if(path==='/toc')return send(titles.map((title,index)=>({title,url:`${origin}/chapter/${index}`,isVolume:index===0})));
 const match=path.match(/^\/chapter\/(\d+)$/);if(match)return send({content:Number(match[1])===3?content:`${titles[Number(match[1])]??'错误章节'}。这是其它章节，不是恢复位置。`});
 res.writeHead(404);res.end();
}).listen(port,'127.0.0.1',()=>console.log(`Reading-position fixture ready: ${origin}`));
