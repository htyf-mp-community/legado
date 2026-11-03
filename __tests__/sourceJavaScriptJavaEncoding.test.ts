jest.mock('../src/data/storage', () => ({ appStorage: { getString: jest.fn(), set: jest.fn(), remove: jest.fn() } }));
jest.mock('react-native-quick-crypto', () => require('node:crypto'));

import { runSourceJavaScript, runSourceJavaScriptAsync } from '../src/core/sourceJavaScript';
import { buildSourceRequest } from '../src/core/sourceRequest';

const bridge = { baseUrl: 'https://example.org', key: '西游记 A+B', page: 2, ajax: async () => '', removeCookie: () => {} };

test('supports Java-compatible URL form encoding in expressions and search scripts', async () => {
  expect(runSourceJavaScript('java.encodeURI(result)', '西游记 A+B/~!*()')).toBe('%E8%A5%BF%E6%B8%B8%E8%AE%B0+A%2BB%2F%7E%21*%28%29');
  expect(runSourceJavaScript('java.encodeURI(result, "GBK")', '西游记')).toBe('%CE%F7%D3%CE%BC%C7');
  expect(runSourceJavaScript('java.encodeURI("%20")', '')).toBe('%2520');
  expect(await runSourceJavaScriptAsync('baseUrl + "/search?q=" + java.encodeURI(key)', bridge)).toBe('https://example.org/search?q=%E8%A5%BF%E6%B8%B8%E8%AE%B0+A%2BB');
});

test('supports 32- and 16-character MD5 signatures in both script contexts', async () => {
  expect(runSourceJavaScript('java.md5Encode(result)', '西游记')).toBe('9db64a7a1f63a775102be1d7713f57f1');
  expect(runSourceJavaScript('java.md5Encode16(result)', 'abc')).toBe('3cd24fb0d6963f7d');
  expect(await runSourceJavaScriptAsync('java.md5Encode(key)', {...bridge, key:'abc'})).toBe('900150983cd24fb0d6963f7d28e17f72');
});

test('evaluates a real book source URL template using Java charset encoding', () => {
  const source = { bookSourceUrl:'https://example.org', bookSourceName:'test' } as any;
  const request = buildSourceRequest(source, '/modules/article/search.php?searchkey={{java.encodeURI(key, \'gbk\')}}&page={{page}},{"method":"GET"}', '西游记', 2);
  expect(request.url).toBe('https://example.org/modules/article/search.php?searchkey=%CE%F7%D3%CE%BC%C7&page=2');
});

test('bounds repeated native encoding work and handles unknown Java charset', () => {
  expect(runSourceJavaScript('java.encodeURI("x", "no-such-charset")', '')).toBe('');
  expect(() => runSourceJavaScript('var s="x";for(var i=0;i<14;i++)s+=s;for(var j=0;j<100;j++)java.md5Encode(s);', '')).toThrow(/限制/);
});

test('generates the signed search URL from the original 1321 book source', async () => {
  const date = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
  try {
    const result = await runSourceJavaScriptAsync("\ntime=Date.now();\nt=\"appid=qmbook&brand=XIAOMI&channel=Tencent&ctype=1&device_id=17af4cb0a45440e5b5bcba1798d760c6&keywords=\"+key+\"&model=10X&optype=3&ostype=0&osversion=7.1.2&package_name=com.martian.qmbook&page=\"+(page-1)+\"&pageSize=10&searchType=1&sourceName=tf&t=\"+time+\"&token=489fecb8-532b-4ad9-b89f-4213768599bf&uid=74514329&version_code=410&version_name=1.5.9&key=tfbook_free\";\nsign=java.md5Encode(t).toUpperCase();\n\nr=String(t).replace(/key=tfbook_free/,'sign=')+sign;\n\n\"http://qmbook.taoyuewenhua.net/authopt/ty/search_books?\"+r;", {...bridge, key:'西游记', page:2});
    const params = new URL(String(result)).searchParams;
    const original = 'appid=qmbook&brand=XIAOMI&channel=Tencent&ctype=1&device_id=17af4cb0a45440e5b5bcba1798d760c6&keywords=西游记&model=10X&optype=3&ostype=0&osversion=7.1.2&package_name=com.martian.qmbook&page=1&pageSize=10&searchType=1&sourceName=tf&t=1700000000000&token=489fecb8-532b-4ad9-b89f-4213768599bf&uid=74514329&version_code=410&version_name=1.5.9&key=tfbook_free';
    expect(params.get('keywords')).toBe('西游记');
    expect(params.get('page')).toBe('1');
    expect(params.get('sign')).toBe(require('node:crypto').createHash('md5').update(original).digest('hex').toUpperCase());
  } finally { date.mockRestore(); }
});
