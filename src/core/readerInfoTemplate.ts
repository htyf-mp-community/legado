export type ReaderInfoValues={bookName:string;chapterTitle:string;time:string;page:number;totalPages:number;readProgress:string;chapter:number;totalChapters:number};
const legacy:Record<number,string>={0:'',1:'{章节}',2:'{时间}',3:'{电量图标}',10:'{电量}',4:'{页码}/{总页数}',5:'{阅读进度}',6:'{页码}/{总页数}  {阅读进度}',7:'{书名}',8:'{时间}  {电量图标}',9:'{时间} {电量}',11:'{章节序号}/{章节总数}'};
export const legacyReaderInfoTemplate=(value:unknown)=>legacy[Number(value)]??'';
export function renderReaderInfoTemplate(template:string,values:ReaderInfoValues){
  const replacements:Record<string,string>={'{书名}':values.bookName,'{章节}':values.chapterTitle,'{时间}':values.time,'{页码}':String(values.page),'{总页数}':String(values.totalPages),'{阅读进度}':values.readProgress,'{章节序号}':String(values.chapter),'{章节总数}':String(values.totalChapters)};
  // TODO(htyf-native): Replace degraded battery placeholders only after a version-pinned battery provider is approved.
  replacements['{电量}']='--%';replacements['{电量图标}']='▱';
  return template.replace(/\{[^{}]+\}/g,token=>replacements[token]??token);
}
