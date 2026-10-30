import {
  sourceRuleText,
  sourceRuleTexts,
  sourceRuleValues,
} from '../src/core/sourceRule';

const html = `
  <main>
    <article class="book featured">
      <a class="name" href="/book/1">第一本</a>
      <span class="author">作者甲</span>
    </article>
    <article class="book">
      <a class="name" href="/book/2">第二本</a>
      <span class="author">作者乙</span>
    </article>
  </main>`;

test('selects HTML nodes and reads text and attributes', () => {
  const books = sourceRuleValues(html, 'article.book');
  expect(books).toHaveLength(2);
  expect(sourceRuleText(books[0], 'a.name@text')).toBe('第一本');
  expect(sourceRuleText(books[0], 'a.name@href')).toBe('/book/1');
});

test('supports Legado selector aliases and replacement suffixes', () => {
  expect(sourceRuleText(html, 'class.author@text##作者##')).toBe('甲\n乙');
  expect(sourceRuleText(html, 'tag.a@href', true)).toBe('/book/1');
});

test('combines legacy ampersand rules before applying cleanup', () => {
  expect(
    sourceRuleText(html, 'class.author.0@text&&class.author.1@text##作者##'),
  ).toBe('甲\n乙');
});

test('supports legacy chained selectors and per-level indexes used by imported source collections', () => {
  const legacy =
    '<div class="bookbox"><h4><a href="/book/1">First</a></h4><p>skip</p><p class="author">Author</p></div>';
  expect(sourceRuleText(legacy, 'class.bookbox.0@tag.h4.0@tag.a.0@text')).toBe(
    'First',
  );
  expect(sourceRuleText(legacy, 'class.bookbox.0@tag.h4.0@tag.a.0@href')).toBe(
    '/book/1',
  );
  expect(sourceRuleText(legacy, 'class.bookbox.0@tag.p.-1@text')).toBe(
    'Author',
  );
  expect(sourceRuleValues(legacy, 'class.bookbox.0@tag.p.!0')).toHaveLength(1);
  const link = sourceRuleValues(legacy, 'tag.a.0')[0];
  expect(sourceRuleText(link, 'href')).toBe('/book/1');
  expect(sourceRuleText(link, 'text')).toBe('First');
});

test('supports JSON candidate list paths and bare init paths used by imported sources', () => {
  const payload = {
    data: [{ book_id: 'detail' }, { book_id: 'search' }],
    nested: { book_data: [{ book_id: 'numeric' }] },
  };
  expect(
    sourceRuleValues(payload, '$..book_data[0]&&$.data[*]').map(item =>
      sourceRuleText(item, '$.book_id'),
    ),
  ).toEqual(['numeric', 'detail', 'search']);
  const initialized = sourceRuleValues(payload, 'data[0]')[0];
  expect(sourceRuleText(initialized, '$.book_id')).toBe('detail');
});

test('runs bounded result replace chains used by imported source collections', () => {
  expect(
    sourceRuleText(
      { __legadoCaptures: ['all', '1'] },
      "$1@js:result.replace(/1.*/,'false').replace(/0.*/,'true');",
    ),
  ).toBe('false');
  expect(
    sourceRuleText(
      { status: '30' },
      '$.status@js:result.replace(/30/,"连载").replace(/50/,"完结")',
    ),
  ).toBe('连载');
});

test('supports legacy text selectors, bracket slices and direct own text', () => {
  const page =
    '<div><p><b>Prefix</b>Direct</p><span>A</span><span>B</span><a href="/next">下一页</a></div>';
  expect(sourceRuleText(page, 'text.下一页.0@href')).toBe('/next');
  expect(sourceRuleText(page, 'tag.span[0:1]@text')).toBe('A\nB');
  expect(
    sourceRuleValues(page, 'tag.span[-1:0]').map(item =>
      sourceRuleText(item, 'text'),
    ),
  ).toEqual(['B', 'A']);
  expect(sourceRuleText(page, 'tag.p.0@ownText')).toBe('Direct');
});

test('interpolates declarative Legado rule templates without executing JavaScript', () => {
  const detail =
    '<div class="channel">Fantasy</div><div class="leader">Hero</div>';
  expect(
    sourceRuleText(
      detail,
      'Type: {{@@class.channel.0@text}}{{"\\n"+"Lead: "}}{{@@class.leader.0@text}}',
    ),
  ).toBe('Type: Fantasy\nLead: Hero');
  expect(
    sourceRuleText(
      { book_id: '21041885901615104', chapter_id: '8' },
      '/novels/api/book/{{$.book_id}}/chapters/{{$.chapter_id}}',
    ),
  ).toBe('/novels/api/book/21041885901615104/chapters/8');
});

test('returns direct children and direct text nodes for legacy extraction modes', () => {
  const tree =
    '<dl id="list">head<dt>Volume</dt>between<dd><a href="/1">Chapter</a></dd></dl>';
  const children = sourceRuleValues(tree, 'id.list.0@children');
  expect(children).toHaveLength(2);
  expect(sourceRuleText(children[0], 'text')).toBe('Volume');
  expect(sourceRuleText(tree, 'id.list.0@textNodes')).toBe('head\nbetween');
});

test('supports common XPath element, text and attribute forms', () => {
  expect(sourceRuleValues(html, "//article[@class='book']")).toHaveLength(1);
  expect(
    sourceRuleText(html, "//article[contains(@class,'featured')]/a/text()"),
  ).toBe('第一本');
  expect(sourceRuleText(html, '//article/a/@href')).toBe('/book/1\n/book/2');
});

test('supports common XPath predicates without JavaScript', () => {
  expect(sourceRuleText(html, "//article[contains(@class,'feat')]/a")).toBe(
    '第一本',
  );
  expect(
    sourceRuleValues(html, "//a[starts-with(@href,'/book/')]"),
  ).toHaveLength(2);
  expect(sourceRuleText(html, '//article[position()=2]/a/text()')).toBe(
    '第二本',
  );
  expect(sourceRuleText(html, "//span[contains(text(),'乙')]/text()")).toBe(
    '作者乙',
  );
  expect(sourceRuleValues(html, '//a[@href]')).toHaveLength(2);
  expect(sourceRuleText(html, '//article[last()]/a/text()')).toBe('第二本');
  expect(sourceRuleText(html, "//span[text()='作者甲']/text()")).toBe('作者甲');
  expect(
    sourceRuleText(html, "//span[normalize-space(text())='作者乙']/text()"),
  ).toBe('作者乙');
  expect(sourceRuleText(html, "//a[ends-with(@href,'/2')]/text()")).toBe(
    '第二本',
  );
});

test('supports XPath unions and common relationship axes', () => {
  expect(sourceRuleValues(html, '//a[@href] | //span[@class]')).toHaveLength(4);
  expect(
    sourceRuleText(html, '//article[1]/following-sibling::article/a/text()'),
  ).toBe('第二本');
  expect(sourceRuleText(html, '//main/child::article[2]/child::a/text()')).toBe(
    '第二本',
  );
  expect(sourceRuleValues(html, '//article[not(@hidden)]')).toHaveLength(2);
});

test('supports XPath parent, ancestor and preceding sibling axes', () => {
  expect(
    sourceRuleText(html, "//a[@href='/book/1']/parent::article/span/text()"),
  ).toBe('作者甲');
  expect(
    sourceRuleValues(html, "//span[contains(text(),'乙')]/ancestor::main[1]"),
  ).toHaveLength(1);
  expect(
    sourceRuleText(html, '//article[2]/preceding-sibling::article[1]/a/text()'),
  ).toBe('第一本');
});

test('supports common XPath position arithmetic and comparisons', () => {
  expect(sourceRuleText(html, '//article[last()-1]/a/text()')).toBe('第一本');
  expect(sourceRuleValues(html, '//article[position()<=1]')).toHaveLength(1);
  expect(sourceRuleText(html, '//article[position()>1]/a/text()')).toBe(
    '第二本',
  );
  expect(sourceRuleText(html, '//article[position() mod 2 = 0]/a/text()')).toBe(
    '第二本',
  );
});

test('supports XPath text functions, inequality and namespace names', () => {
  const feed =
    '<feed><media:content media:url="cover.jpg">  Cover title  </media:content><item kind="skip">Tail value</item></feed>';
  expect(
    sourceRuleText(
      feed,
      "//*[local-name()='content'][starts-with(normalize-space(text()),'Cover')]/@media:url",
    ),
  ).toBe('cover.jpg');
  expect(
    sourceRuleText(
      feed,
      "//item[@kind!='keep'][ends-with(text(),'value')]/text()",
    ),
  ).toBe('Tail value');
  expect(sourceRuleText(feed, '//media:content/@media:url')).toBe('cover.jpg');
});

test('supports XPath 1.0 string, numeric and boolean functions', () => {
  const values =
    '<root><item score="2.8" code="ABC-10"><price>1.2</price><price>2.8</price></item><item score="10" code="xyz"><price>5</price></item><empty/></root>';
  expect(sourceRuleText(values, '//item[string-length(@code)=6]/@code')).toBe(
    'ABC-10',
  );
  expect(
    sourceRuleText(values, "//item[substring-before(@code,'-')='ABC']/@code"),
  ).toBe('ABC-10');
  expect(
    sourceRuleText(values, "//item[substring-after(@code,'-')='10']/@code"),
  ).toBe('ABC-10');
  expect(
    sourceRuleText(values, "//item[substring(@code,1,3)='ABC']/@code"),
  ).toBe('ABC-10');
  expect(
    sourceRuleText(
      values,
      "//item[translate(substring(@code,1,3),'ABCXYZ','abcxyz')='abc']/@code",
    ),
  ).toBe('ABC-10');
  expect(
    sourceRuleText(
      values,
      "//item[concat(@score,'-',count(child::price))='2.8-2']/@code",
    ),
  ).toBe('ABC-10');
  expect(sourceRuleText(values, '//item[floor(number(@score))=2]/@code')).toBe(
    'ABC-10',
  );
  expect(
    sourceRuleText(values, '//item[ceiling(number(@score))=3]/@code'),
  ).toBe('ABC-10');
  expect(
    sourceRuleText(values, '//item[round(sum(child::price))=4]/@code'),
  ).toBe('ABC-10');
  expect(
    sourceRuleValues(values, '//item[boolean(@code) and not(false())]'),
  ).toHaveLength(2);
  expect(
    sourceRuleValues(values, '//empty[not(boolean(@missing))]'),
  ).toHaveLength(1);
  expect(sourceRuleValues(values, "//*[name()='item']")).toHaveLength(2);
  expect(
    sourceRuleValues(values, '//item[@code and @score and not(@missing)]'),
  ).toHaveLength(2);
});

test('supports XPath node-set comparisons, arithmetic, id and language predicates', () => {
  const values =
    '<root xml:lang="zh-CN"><group id="featured"><item score="4"><tag>a</tag><tag>b</tag></item></group><group><item score="2"><tag>c</tag></item></group></root>';
  expect(sourceRuleValues(values, "//item[tag='b']")).toHaveLength(1);
  expect(
    sourceRuleValues(values, '//item[(number(@score) + 2) div 2 = 3]'),
  ).toHaveLength(1);
  expect(sourceRuleValues(values, "//item[lang('zh')]")).toHaveLength(2);
  expect(
    sourceRuleValues(values, "//group[boolean(id('featured'))]"),
  ).toHaveLength(2);
  const namespaced = '<feed xmlns:media="urn:media"><media:item/></feed>';
  expect(
    sourceRuleValues(namespaced, "//*[namespace-uri()='urn:media']"),
  ).toHaveLength(1);
});

test('supports remaining XPath relationship axes and node tests', () => {
  const tree =
    '<root><section id="one"><title>A</title><p>first</p></section><section id="two"><title>B</title><p>second</p></section></root>';
  expect(
    sourceRuleText(tree, "//section[@id='one']/following::title[1]/text()"),
  ).toBe('B');
  expect(
    sourceRuleText(tree, "//section[@id='two']/preceding::title[1]/text()"),
  ).toBe('A');
  expect(
    sourceRuleText(
      tree,
      "//section[@id='one']/following-sibling::section[1]/@id",
    ),
  ).toBe('two');
  expect(sourceRuleText(tree, '//title/ancestor-or-self::section[1]/@id')).toBe(
    'one\ntwo',
  );
  expect(
    sourceRuleValues(tree, "//section[@id='one']/descendant::node()"),
  ).not.toHaveLength(0);
  expect(
    sourceRuleText(
      tree,
      "//section[@id='one']/descendant-or-self::section[1]/@id",
    ),
  ).toBe('one');
  expect(sourceRuleText(tree, "//section[@id='one']/self::section/@id")).toBe(
    'one',
  );
  expect(sourceRuleText(tree, "//section[@id='one']/attribute::id")).toBe(
    'one',
  );
  const nodes =
    '<?xml version="1.0"?><root xmlns:x="urn:x"><!--note--><?reader ok?><x:item/></root>';
  expect(sourceRuleValues(nodes, '//root/descendant::comment()')).toHaveLength(
    1,
  );
  expect(
    sourceRuleValues(nodes, '//root/descendant::processing-instruction()'),
  ).toHaveLength(1);
  expect(sourceRuleText(nodes, '//x:item/namespace::x')).toBe('urn:x');
});

test('supports regex list rules and rejects JavaScript', () => {
  expect(sourceRuleValues('第1章\n第2章', ':(第\\d章)')).toEqual([
    '第1章',
    '第2章',
  ]);
  expect(() => sourceRuleText(html, 'a@js:result')).toThrow('JavaScript');
});

test('safely unwraps challenge pass-through and URL extraction rules from imported collections', () => {
  const challenge = `<js>if(result.match(/^<!DOCTYPE html><html lang="en-US"><head><title>Just a moment.../)){java.longToast('verify');result=java.startBrowserAwait(baseUrl,'verify').body();};result;</js>`;
  const page =
    '<div id="catalog"><ul><li>skip</li><li><a href="/1">第一章</a></li></ul></div>';
  expect(sourceRuleText(page, `${challenge}id.catalog.0@tag.a.0@text`)).toBe(
    '第一章',
  );
  expect(sourceRuleValues(page, challenge)).toEqual([page]);
  const link = `<button onclick="open('/book/8', '', '')">打开</button>`,
    button = sourceRuleValues(link, 'button')[0];
  expect(
    sourceRuleText(
      button,
      `@onclick@js:result.match(/\\('(.*?)', '', ''\\)/)[1]`,
    ),
  ).toBe('/book/8');
  expect(
    sourceRuleText(button, '@onclick@js:result=book.origin+result;result;'),
  ).toBe("open('/book/8', '', '')");
  const paging =
      '<div class="read_btn"><a href="/book/8.html">上一章</a><a href="/book/8_2.html">下一页</a></div>',
    nextRule = `class.read_btn.0@tag.a.-1@href@js:if(/\\/\\d+_\\d{1,}\\.html$/.test(result[0])){result=result[0]+",{'webView':true}";}else{result=[];};`;
  expect(sourceRuleText(paging, nextRule)).toBe(
    `/book/8_2.html,{'webView':true}`,
  );
  expect(
    sourceRuleText(
      '<div class="read_btn"><a href="/book/9.html">下一章</a></div>',
      nextRule,
    ),
  ).toBe('');
});

test('selects chained CSS nodes used by the real vikbook source instead of treating the final selector as an attribute', () => {
  const response =
    '<div id="page"><div itemscope itemtype="http://schema.org/Book"><a href="/?id=642932592530">西游记-吴承恩</a></div></div>';
  const books = sourceRuleValues(response, '#page@div[itemscope]');
  expect(books).toHaveLength(1);
  expect(sourceRuleText(books[0], 'a.0@text')).toBe('西游记-吴承恩');
  expect(sourceRuleText(books[0], 'a.0@href')).toBe('/?id=642932592530');
  expect(sourceRuleValues(response, '@CSS:#page@div[itemscope]')).toHaveLength(
    1,
  );
  const toc =
    '<div id="content"><div class="page"><a href="/read/1">第一回</a></div><div class="page"><a href="/read/2">第二回</a></div></div>';
  expect(
    sourceRuleValues(toc, '#content@.page').map(node =>
      sourceRuleText(node, 'a@href'),
    ),
  ).toEqual(['/read/1', '/read/2']);
  expect(
    sourceRuleText('<a data-custom="kept">Text</a>', 'a@data-custom'),
  ).toBe('kept');
});

test('preserves digits in HTML tag/id/class names and only parses delimited legacy indexes', () => {
  const page =
    '<h1>Main</h1><h2>Sub</h2><div id="content2" class="book2">Body</div><h1>Second</h1><div class="item">A</div><div class="item">B</div>';
  expect(sourceRuleText(page, 'h1.0@text')).toBe('Main');
  expect(sourceRuleText(page, 'h2@text')).toBe('Sub');
  expect(sourceRuleText(page, '#content2@text')).toBe('Body');
  expect(sourceRuleText(page, 'class.book2@text')).toBe('Body');
  expect(sourceRuleText(page, 'tag.h1.1@text')).toBe('Second');
  expect(sourceRuleText(page, 'class.item!0@text')).toBe('B');
});

test('renders nested metadata templates before separating outer replacement rules', () => {
  const page =
    '<h1>Book</h1><div class="author"><a>Writer</a></div><div id="tags"><span class="tag">A</span><span class="tag">B</span></div><p class="description">Summary</p>';
  const template =
    'Name: {{@@h1@text}}\nAuthor: {{@@.author@a@text}}\nTags: {{@@#tags@.tag@text##\\n## / }}\nIntro: {{@@.description@text}}##^Name:##Title:';
  expect(sourceRuleText(page, template)).toBe(
    'Title: Book\nAuthor: Writer\nTags: A / B\nIntro: Summary',
  );
  expect(
    sourceRuleText({ tags: ['A', 'B'] }, 'Tags={{@Json:$.tags[*]##\\n##,}}'),
  ).toBe('Tags=A,B');
});

test('uses native text-list joining and explicitly selects the first URL result', () => {
  const page = '<a href="/one">First</a><a href="/two">Second</a>';
  expect(sourceRuleText(page, 'a@text')).toBe('First\nSecond');
  expect(sourceRuleText(page, 'a@href', true)).toBe('/one');
});

test('native first-match replacement returns the transformed match rather than the surrounding URL', () => {
  expect(
    sourceRuleText(
      '<a href="https://site.test/?id=123&ref=456">Book</a>',
      'a@href##(\\d+)##https://site.test/contents/$1/cover.jpeg###',
      true,
    ),
  ).toBe('https://site.test/contents/123/cover.jpeg');
  expect(
    sourceRuleText(
      '<a href="/no-id">Book</a>',
      'a@href##(\\d+)##/$1.jpg###',
      true,
    ),
  ).toBe('');
});

test('does not silently truncate unsupported JavaScript expressions inside metadata templates', () => {
  expect(() =>
    sourceRuleText(
      '<h1>Book</h1>',
      'Name={{"prefix" + java.getString("h1@text")}}',
    ),
  ).toThrow('JavaScript');
});

test('decodes static template string escapes without evaluating code', () => {
  expect(sourceRuleText('', '{{"\\u4e2d\\u{1F600}\\x21" + "\\tend"}}')).toBe(
    '中😀!\tend',
  );
  expect(() => sourceRuleText('', '{{"\\u12"}}')).toThrow('JavaScript');
});
test('keeps replacement-only rules and non-HTML URL lists consistent with the native analyzers', () => {
  expect(sourceRuleText('first\nsecond', '##\\n##,')).toBe('first,second');
  expect(
    sourceRuleText(
      '<a href="/1">One</a><a href="/2">Two</a>',
      '//a/@href',
      true,
    ),
  ).toBe('/1\n/2');
  expect(sourceRuleText({ links: ['/1', '/2'] }, '$.links[*]', true)).toBe(
    '/1\n/2',
  );
  expect(sourceRuleTexts('a[b', '##[##-')).toEqual(['a-b']);
});

test('trims native template result boundaries while preserving replacement text inside a placeholder', () => {
  expect(sourceRuleText('', '{{"  Keep  "}}')).toBe('Keep');
  expect(
    sourceRuleText(
      '<p class="tag">A</p><p class="tag">B</p>',
      '{{@@.tag@text##\\n## / }}',
    ),
  ).toBe('A / B');
});
