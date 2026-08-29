import{legacyReaderInfoTemplate,renderReaderInfoTemplate}from'../src/core/readerInfoTemplate';
const values={bookName:'书',chapterTitle:'第二章',time:'09:08',page:3,totalPages:12,readProgress:'25%',chapter:2,totalChapters:8};
test('renders compatible reader information placeholders',()=>expect(renderReaderInfoTemplate('{书名} · {章节} · {页码}/{总页数} · {阅读进度} · {时间}',values)).toBe('书 · 第二章 · 3/12 · 25% · 09:08'));
test('maps legacy slot values and degrades battery visibly',()=>{expect(legacyReaderInfoTemplate(6)).toBe('{页码}/{总页数}  {阅读进度}');expect(renderReaderInfoTemplate('{电量图标} {电量}',values)).toBe('▱ --%')});
test('preserves unknown placeholders',()=>expect(renderReaderInfoTemplate('{未知}',values)).toBe('{未知}'));
