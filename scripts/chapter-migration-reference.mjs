import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile),
  root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2),
  argument = name => args.indexOf(name) < 0 ? undefined : args[args.indexOf(name) + 1];
if (!args.includes('--commons-jar'))
  throw new Error(
    'Supply the read-only source dependency: --commons-jar /path/to/commons-text-1.13.1.jar',
  );
const jar = path.resolve(argument('--commons-jar')),
  java = process.env.LEGADO_JAVA_BIN ?? 'java',
  helpPath = path.join(
    root,
    '../app/src/main/java/io/legado/app/help/book/BookHelp.kt',
  ),
  numbersPath = path.join(
    root,
    '../app/src/main/java/io/legado/app/utils/StringUtils.kt',
  ),
  help = await fs.readFile(helpPath, 'utf8');
const pattern = name => {
  const start = help.indexOf(`private val ${name} `);
  if (start < 0) throw new Error(`Source pattern missing: ${name}`);
  const literal = help.slice(start).match(/^\s*("(?:\\.|[^"\\])*")/m)?.[1];
  if (!literal) throw new Error(`Source pattern unreadable: ${name}`);
  return Buffer.from(JSON.parse(literal)).toString('base64');
};
const titles = count =>
    Array.from({ length: count }, (_, i) => `第${i + 1}章 其他${i}`),
  changed = (count, replacements) => Object.assign(titles(count), replacements),
  scenarios = [
    [0, '第八章 重逢', changed(12, { 7: '第八章 重逢' }), 12],
    [1, '第二章 远行', changed(6, { 4: '第五章 远行' }), 3],
    [
      3,
      '第4章 凶鹿（三）',
      changed(45, {
        1: '第2章 凶鹿（一）',
        2: '第3章 凶鹿（二）',
        3: '第4章 凶鹿（三）',
        4: '第5章 凶鹿（四）',
        5: '第6章 凶鹿（五）',
        6: '第7章 凶鹿（六）',
        7: '第8章 凶鹿（七）',
      }),
      45,
    ],
    [
      7,
      '第8章 凶鹿（七）',
      changed(45, {
        1: '第2章 凶鹿（一）',
        2: '第3章 凶鹿（二）',
        3: '第4章 凶鹿（三）',
        4: '第5章 凶鹿（四）',
        5: '第6章 凶鹿（五）',
        6: '第7章 凶鹿（六）',
        7: '第8章 凶鹿（七）',
      }),
      45,
    ],
    [
      10,
      '旧标题 重逢',
      changed(40, { 3: '新标题 重逢', 5: '旧标题 重逢' }),
      100,
    ],
    [6, '第七章 开始行动', changed(12, { 2: '第三章 行动开始' }), 12],
    [
      4,
      '第十二章 旧标题',
      changed(20, { 3: '第12章 新标题', 8: '第12话 又一标题' }),
      20,
    ],
    [
      144,
      '第144章 原标题',
      changed(200, { 144: '第114章 错误', 174: '第144章 新标题' }),
      200,
      true,
    ],
    [
      144,
      '第144章 原标题',
      changed(200, { 144: '第114章 错误', 174: '第144章 新标题' }),
      200,
      false,
    ],
    [10, '未能匹配', titles(7), 100],
    [4, '', titles(10), 0],
    [3, '标题', [], 10],
    [2147483647, '旧标题', ['新标题'], 0],
    [2147483647, '旧标题', ['新标题', '另一标题', '旧标题'], 1],
    [1, '第１２章：全角（终）', ['卷首', '第12章 全角', '尾声'], 3],
    [2, '第一百二章 中文数字', ['第1章 新', '第120章 同号', '尾声'], 3],
    [2, '第两百零三章 旧', ['第1章 新', '第203章 同号', '尾声'], 3],
    [2, '1、2、3. 标题', ['第2章 新', '第3章 标题', '尾声'], 3],
    [2, '第2147483648章 超范围', ['第1章 新', '第2章 新', '尾声'], 3],
    [2, '第壹仟贰佰叁拾肆章 正文', ['第1章 新', '第1234章 正文', '尾声'], 3],
    [2, '第12章 保留NBSP', ['第1章 新', '第12章保留NBSP', '尾声'], 3],
    [2, '第12章 𠀀😀αÅA', ['第1章 新', '第12章 𠀀😀αÅA', '尾声'], 3],
    [2, '【第十二章 完整括号】', ['第1章 新', '第12章 完整括号', '尾声'], 3],
    [2, '第十二章 【前缀】正文[VIP]', ['第1章 新', '第12章 正文', '尾声'], 3],
  ].map(
    ([oldIndex, oldTitle, newTitles, oldCount, searchAllNumbers = false]) => ({
      oldIndex,
      oldTitle,
      newTitles,
      oldCount,
      searchAllNumbers,
    }),
  );
const directory = await fs.mkdtemp(
  path.join(os.tmpdir(), 'legado-chapter-reference-'),
);
try {
  const code = `import java.util.*;import java.nio.charset.StandardCharsets;import java.nio.file.*;import java.util.regex.*;import org.apache.commons.text.similarity.JaccardSimilarity;
class ChapterMigrationReference {
static String decode(String s){return new String(Base64.getDecoder().decode(s),StandardCharsets.UTF_8);}
static String encode(String s){return Base64.getEncoder().encodeToString(s.getBytes(StandardCharsets.UTF_8));}
static Pattern a=Pattern.compile(decode("${pattern('regexA')}")),b=Pattern.compile(decode("${pattern('regexB')}")),c=Pattern.compile(decode("${pattern('regexC')}")),other=Pattern.compile(decode("${pattern('regexOther')}")),num1=Pattern.compile(decode("${pattern('chapterNamePattern1')}")),num2=Pattern.compile(decode("${pattern('chapterNamePattern2')}"));
static String half(String s){char[] chars=s.toCharArray();for(int i=0;i<chars.length;i++){if(chars[i]==12288)chars[i]=32;else if(chars[i]>=65281&&chars[i]<=65374)chars[i]-=65248;}return new String(chars);}
static String pure(String s){return other.matcher(c.matcher(b.matcher(a.matcher(half(s)).replaceAll("")).replaceAll("")).replaceAll("")).replaceAll("");}
static Map<Character,Integer> digits=new HashMap<>();static{for(String s:new String[]{"零一二三四五六七八九十","〇壹贰叁肆伍陆柒捌玖拾"})for(int i=0;i<s.length();i++)digits.put(s.charAt(i),i);digits.put('两',2);digits.put('百',100);digits.put('佰',100);digits.put('千',1000);digits.put('仟',1000);digits.put('万',10000);digits.put('亿',100000000);}
static int integer(String s){try{return Integer.parseInt(s);}catch(Exception e){}int result=0,tmp=0,billion=0;try{for(int i=0;i<s.length();i++){int n=digits.get(s.charAt(i));if(n==100000000){result+=tmp;result*=n;billion=billion*100000000+result;result=0;tmp=0;}else if(n==10000){result+=tmp;result*=n;tmp=0;}else if(n>=10){if(tmp==0)tmp=1;result+=n*tmp;tmp=0;}else{tmp=i>=2&&i==s.length()-1&&digits.get(s.charAt(i-1))>10?n*digits.get(s.charAt(i-1))/10:tmp*10+n;}}return result+tmp+billion;}catch(Exception e){return -1;}}
static int number(String s){s=a.matcher(half(s)).replaceAll("");Matcher m=num1.matcher(s);if(m.find())return integer(m.group(1));m=num2.matcher(s);return m.find()?integer(m.group(1)):-1;}
static int index(int old,String title,List<String> list,int oldCount,boolean all){if(old<=0)return 0;if(list.isEmpty())return old;int num=number(title),expected=oldCount==0?old:(int)((long)old*list.size()/oldCount),min=Math.max(0,Math.min(old,expected)-10),max=Math.min(list.size()-1,Math.max(old,expected)+10);String p=pure(title);if(!p.isEmpty()){double best=0;int at=0;JaccardSimilarity similarity=new JaccardSimilarity();for(int i=min;i<=max;i++){double next=similarity.apply(p,pure(list.get(i)));if(next>best||next==best&&Math.abs(i-expected)<Math.abs(at-expected)){best=next;at=i;}}if(best>.96)return at;}if(all&&num>0){Integer at=null;for(int i=0;i<list.size();i++)if(number(list.get(i))==num&&(at==null||Math.abs(i-expected)<Math.abs(at-expected)))at=i;if(at!=null)return at;}if(num>0)for(int i=min;i<=max;i++)if(number(list.get(i))==num)return i;return Math.min(Math.max(0,list.size()-1),old);}
public static void main(String[] args)throws Exception{for(String line:Files.readAllLines(Path.of(args[0]),StandardCharsets.UTF_8)){String[] cols=line.split("\\t",-1);List<String> titles=new ArrayList<>();for(int i=4;i<cols.length;i++)titles.add(decode(cols[i]));String old=decode(cols[3]);StringBuilder output=new StringBuilder(index(Integer.parseInt(cols[0]),old,titles,Integer.parseInt(cols[1]),Boolean.parseBoolean(cols[2]))+"\\t"+encode(pure(old))+"\\t"+number(old));for(String title:titles)output.append("\\t").append(encode(pure(title))).append(":").append(number(title));System.out.println(output);}}
}`;
  const sourceFile = path.join(directory, 'ChapterMigrationReference.java'),
    inputFile = path.join(directory, 'cases.tsv');
  await fs.writeFile(sourceFile, code);
  await fs.writeFile(
    inputFile,
    scenarios
      .map(value =>
        [
          value.oldIndex,
          value.oldCount,
          value.searchAllNumbers,
          Buffer.from(value.oldTitle).toString('base64'),
          ...value.newTitles.map(title =>
            Buffer.from(title).toString('base64'),
          ),
        ].join('\t'),
      )
      .join('\n'),
  );
  const { stdout } = await exec(java, ['-cp', jar, sourceFile, inputFile], {
    maxBuffer: 4 * 1024 * 1024,
  });
  const lines = stdout.trimEnd().split('\n');
  if (lines.length !== scenarios.length)
    throw new Error('Reference output count mismatch');
  const cases = scenarios.map((value, index) => {
    const [result, pure, number, ...titles] = lines[index].split('\t');
    return {
      ...value,
      result: Number(result),
      pure: Buffer.from(pure, 'base64').toString(),
      number: Number(number),
      titles: titles.map(title => {
        const [p, n] = title.split(':');
        return { pure: Buffer.from(p, 'base64').toString(), number: Number(n) };
      }),
    };
  });
  const sha = bytes => createHash('sha256').update(bytes).digest('hex'),
    record = {
      sourceBookHelpSHA256: sha(await fs.readFile(helpPath)),
      sourceStringUtilsSHA256: sha(await fs.readFile(numbersPath)),
      commonsTextVersion: '1.13.1',
      commonsJarSHA256: sha(await fs.readFile(jar)),
      cases,
    },
    output = path.resolve(
      root,
      argument('--output') ??
        '__tests__/fixtures/chapterMigrationReference.json',
    );
  if (args.includes('--verify')) {
    if (
      JSON.stringify(JSON.parse(await fs.readFile(output, 'utf8'))) !==
      JSON.stringify(record)
    )
      throw new Error(
        'JVM reference differs from the recorded fixture; inspect the source change before regenerating',
      );
  } else {
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, JSON.stringify(record, null, 2) + '\n');
  }
  console.log(
    `JVM reference verified: ${cases.length} cases, Commons Text 1.13.1, source unchanged`,
  );
} finally {
  await fs.rm(directory, { recursive: true, force: true });
}
