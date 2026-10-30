"""Replay the unchanged native title-line matcher and its ContentProcessor call.

This JVM-only reference isolates title matching from Room/config/replacement
execution. The fallback display title is supplied explicitly by each fixture.
No Android application is built and no source file is changed.
"""
import argparse
import base64
import hashlib
import json
import pathlib
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ['source-root', 'kotlin-lib', 'output']:
        parser.add_argument('--' + key, type=pathlib.Path, required=True)
    parser.add_argument('--cases-file', type=pathlib.Path)
    args = parser.parse_args()
    java = args.source_root / 'app/src/main/java/io/legado/app'
    processor = (java / 'help/book/ContentProcessor.kt').read_text()
    helper = processor[processor.index('internal fun sameTitleLineMatcher('):processor.index('class ContentProcessor private')]
    extensions = (java / 'utils/StringExtensions.kt').read_text()
    start = extensions.index('fun String.escapeRegex(): String {')
    escape = extensions[start:extensions.index('\n}', start) + 2]
    pattern_source = (java / 'constant/AppPattern.kt').read_text()
    patterns = [line.strip() for line in pattern_source.splitlines() if 'val regexCharRegex =' in line or 'val spaceRegex =' in line]
    cases = []
    def add(content, title='第一章', book='测试书', display=None, skip=False, replace=True):
        cases.append({'content': content, 'title': title, 'bookName': book, 'displayTitle': title if display is None else display, 'skipRemoval': skip, 'replaceEnabled': replace})
    for title in ['第一章', '第 十二 章', 'A+B?', '[甲](乙)', r'\E', 'X.$^|Y', '😀标题', '第\t一\n章', '标题\u00a0末', '']:
        for prefix in ['', '【测试书】', '测试书', '测试书测试书', '(测试书) ', '　　', ' \t\n', '【别的书】', 'ABC', '★', '—', '_']:
            for suffix in ['\n正文', '\r\n  正文', '\r正文', '', ' \n正文', '\u00a0\n正文', '\u3000\n正文', '\n　　正文', '补充标题\n正文']:
                add(prefix + title + suffix, title)
    for content,title in [('十二\n正文','第十二章'), ('章\n正文','第一章'), ('第一章 补充标题\n正文','第一章'), ('第一章\n\n\t正文','第一章'), ('第一章\u0085正文','第一章'), ('第一章\u2028正文','第一章'), ('null','null'), ('null','第一章'), ('第一章\n正文','第一章')]:
        add(content,title)
    for title in ['第一章', 'A+B?', '标题\u3000末', '第 十二 章']:
        for content in [title+'\n正文', '改后 标题\n正文', '改后标题\n正文', '【测试书】改后 标题\r\n正文']:
            for skip in [False, True]:
                for replace in [False, True]:
                    add(content,title,display='改后 标题',skip=skip,replace=replace)
    for book in ['', 'A+B[书]', '含\\E书名', '😀书', '书\n名']:
        add('【'+book+'】第一章\n正文',book=book)
    # Java Pattern's default \s is ASCII, unlike JavaScript's Unicode \s.
    for whitespace in ['', ' ', '\t', '\n', '\v', '\f', '\r', '\r\n', '\u0085', '\u00a0', '\u1680', '\u2000', '\u2003', '\u2028', '\u2029', '\u202f', '\u205f', '\u3000', '\ufeff']:
        add('第'+whitespace+'十二'+whitespace+'章\n正文',title='第 十二 章')
        add('【测试书】第'+whitespace+'十二章\n正文',title='第 十二章')
    for index in [-2147483648, -1, 0, 1, 99999, 100000, 2147483647]:
        add('第一章\n正文')
        cases[-1]['chapterIndex'] = index
    if args.cases_file:cases=json.loads(args.cases_file.read_text())
    for index,row in enumerate(cases):row.setdefault('chapterIndex',index)
    runner = r'''package io.legado.app.help.book
import java.util.Base64
import java.util.regex.Pattern
import io.legado.app.constant.AppPattern.spaceRegex
import io.legado.app.utils.escapeRegex
fun main(args: Array<String>) {
 val dec = Base64.getDecoder()
 val enc = Base64.getEncoder()
 java.io.File(args[0]).forEachLine { line ->
  val f = line.split("\t")
  fun value(i: Int) = String(dec.decode(f[i]), Charsets.UTF_8)
  val original = value(1)
  var content = original
  val name = Pattern.quote(value(2))
  val title = value(3).escapeRegex().replace(spaceRegex, "\\\\s*")
  var removed = false
  if (f[5] == "0" && content != "null") {
   var matcher = sameTitleLineMatcher(content, name, title)
   if (matcher.find()) { content = content.substring(matcher.end()); removed = true }
   else if (f[6] == "1") {
    matcher = sameTitleLineMatcher(content, name, Pattern.quote(value(4)))
    if (matcher.find()) { content = content.substring(matcher.end()); removed = true }
   }
  }
  val md5 = java.security.MessageDigest.getInstance("MD5").digest(value(3).toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it.toInt() and 0xff) }.substring(8,24)
  val key = String.format("%05d-%s.nr", f[7].toInt(), md5)
  println(f[0]+"\t"+removed+"\t"+enc.encodeToString(content.toByteArray(Charsets.UTF_8))+"\t"+key)
 }
}'''
    stdlib = next(args.kotlin_lib.glob('kotlin-stdlib-[0-9]*.jar'))
    encode = lambda s: base64.b64encode(s.encode()).decode()
    with tempfile.TemporaryDirectory(prefix='legado-chapter-title-') as folder:
        folder = pathlib.Path(folder)
        (folder / 'Matcher.kt').write_text('package io.legado.app.help.book\nimport java.util.regex.Pattern\n' + helper)
        (folder / 'Escape.kt').write_text('package io.legado.app.utils\nimport io.legado.app.constant.AppPattern\n' + escape)
        (folder / 'Patterns.kt').write_text('package io.legado.app.constant\nobject AppPattern {\n' + '\n'.join(patterns) + '\n}\n')
        (folder / 'Runner.kt').write_text(runner)
        inputs = folder / 'cases.tsv'
        inputs.write_text(''.join(f'{i}\t{encode(r["content"])}\t{encode(r["bookName"])}\t{encode(r["title"])}\t{encode(r["displayTitle"])}\t{int(r["skipRemoval"])}\t{int(r["replaceEnabled"])}\t{r["chapterIndex"]}\n' for i,r in enumerate(cases)))
        jar = folder / 'reference.jar'
        compiled = subprocess.run(['java','-cp',f'{args.kotlin_lib.resolve()}/*','org.jetbrains.kotlin.cli.jvm.K2JVMCompiler','-no-stdlib','-no-reflect','-classpath',str(stdlib),'-d',str(jar),*(str(p) for p in folder.glob('*.kt'))],capture_output=True,text=True)
        if compiled.returncode:raise RuntimeError(compiled.stderr)
        result = subprocess.run(['java','-cp',f'{jar}:{stdlib}','io.legado.app.help.book.RunnerKt',str(inputs)],check=True,capture_output=True,text=True)
    for line in result.stdout.splitlines():
        f = line.split('\t')
        cases[int(f[0])]['expected'] = {'removed':f[1]=='true','content':base64.b64decode(f[2]).decode(),'key':f[3]}
    paths=['help/book/ContentProcessor.kt','help/book/BookHelp.kt','utils/StringExtensions.kt','constant/AppPattern.kt','data/entities/BookChapter.kt','utils/MD5Utils.kt']
    fixture={'sources':{p:hashlib.sha256((java/p).read_bytes()).hexdigest() for p in paths},'caseCount':len(cases),'cases':cases}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(fixture,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'cases':len(cases),'removed':sum(r['expected']['removed'] for r in cases)}))


if __name__=='__main__':main()
