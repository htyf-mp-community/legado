"""Run the unchanged Kotlin HtmlFormatter with the source-pinned HTML4 decoder.

Only the formatter's URL/logging dependencies are isolated from Android; the
URL method and URL predicates are extracted verbatim from the current source.
No Android build, application dependency change, or source edit is performed.
"""
import argparse
import base64
import hashlib
from html.entities import name2codepoint
import json
import pathlib
import re
import subprocess
import tempfile


def method(source, signature):
    start = source.index(signature)
    opening = source.index('{', start)
    depth = 1
    cursor = opening + 1
    while depth:
        depth += (source[cursor] == '{') - (source[cursor] == '}')
        cursor += 1
    return source[start:cursor]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['source-root', 'kotlin-lib', 'commons-text-jar', 'commons-lang-jar', 'output']:
        parser.add_argument('--' + name, type=pathlib.Path, required=True)
    parser.add_argument('--html-file', type=pathlib.Path)
    parser.add_argument('--replacement-rule-file', type=pathlib.Path)
    parser.add_argument('--mode', default='web', choices=['format', 'intro', 'keepImg', 'web', 'webSpecial', 'paragraphs'])
    args = parser.parse_args()
    java = args.source_root / 'app/src/main/java/io/legado/app'
    formatter = java / 'utils/HtmlFormatter.kt'
    network = (java / 'utils/NetworkUtils.kt').read_text()
    extensions = (java / 'utils/StringExtensions.kt').read_text()
    patterns = (java / 'constant/AppPattern.kt').read_text()
    analyze = (java / 'model/analyzeRule/AnalyzeUrl.kt').read_text()
    absolute = method(network, 'fun getAbsoluteURL(baseURL: URL?, relativePath: String)')
    predicates = extensions[extensions.index('fun String?.isAbsUrl()'):extensions.index('fun String?.isJson()')]
    data_regex = next(line.strip() for line in patterns.splitlines() if 'val dataUriRegex =' in line)
    param_pattern = next(line.strip() for line in analyze.splitlines() if 'val paramPattern:' in line)
    samples = [
        None, '', 'A', ' A ', '\nA\n', 'A\r\nB', 'A\rB', 'A\n\n B',
        '<div>A</div><div>B</div>', 'A<p>B</p>C', '<div><p>A</p><p>B</p></div>',
        '<div>\n A\n <br>\n B\n</div>', '<p> A </p>\n\n<p> B </p>',
        'A<br>B<hr>C<article>D</article><dd>E</dd><dl>F</dl>',
        'A<h1>B</h1>C<h9>D</h9>E', 'A<BR>B<DIV>C</DIV>D',
        'A<li>B</li><section>C</section><table><tr><td>D</td></tr></table>E',
        '<divine>A</divine><pre>B</pre><panda>C</panda>',
        '<!--normal-->A<!-- odd > comment -->B', '<script>bad()</script>A<style>.ad{}</style>B',
        '&lt;b&gt;literal&lt;/b&gt; &amp;lt;b&amp;gt; &amp;amp;',
        '&nbsp;&nbsp;A&ensp;B&emsp;C&thinsp;D&zwnj;E&zwj;F',
        'A\u2009B\u200cC\u200dD\u200bE\ufeffF',
        '\u3000A\u00a0\n\u3000B\u00a0', 'A\t \x0b\f\n \t B',
        '<h2>Title</h2><ruby>漢<rt>kan</rt></ruby>正文',
        'A<img src="/a.jpg">B', '<img data-original="/a.jpg" src="/thumb.jpg">',
        '<img srcset="/one.jpg 1x, /two.jpg 2x" data-srcset="/three.jpg">',
        '<img src=unquoted.jpg><img alt="missing"><IMG SRC="UPPER.JPG">',
        '<img data-any="/generic.jpg"><img src=\'/single.jpg\'>',
        '<img src="/image.jpg, {\'headers\':{\'referer\':\'https://ref.test\'}}">',
        '<img src="/image.jpg, {&quot;headers&quot;:{&quot;referer&quot;:&quot;https://ref.test&quot;}}">',
        '<img src="data:image/png;base64,AAAA"><img src="javascript:bad()">',
        '<img src="//cdn.test/image.jpg"><img src="../image.jpg"><img src="?image=1">',
        '<usehtml><p>raw\nbody</p><img src="a.jpg"></usehtml>',
        'A&amp;nbsp;B &apos; &NotEqualTilde; &#128; &#x1F600;',
        '&#0; &#xD7FF; &#xE000; &#x10FFFF; &#9999999999999999;',
        '第一段\n第二段 续行\n第三段', '第一段\n第二段\n第三段',
        '<div class="con">第一页</div>', '<div class="con">第二页</div>', '<p>正文</p>',
    ]
    cases = []
    for html in samples:
        for mode in ['format', 'intro', 'keepImg', 'web', 'webSpecial', 'paragraphs']:
            cases.append({'html': html, 'mode': mode, 'baseUrl': 'https://books.example/dir/chapter.html'})
    for name in sorted(name2codepoint):
        cases.append({'html': '&' + name + ';', 'mode': 'web', 'baseUrl': ''})
    for base in ['https://Books.Example:443', 'https://Books.Example:443/dir/chapter.html?old=1#old', '']:
        for image in ['a b.jpg', './a.jpg', '../a.jpg', '../../a.jpg', '?q=1', '#frag', '', '/a/../b', '//CDN.Example:443/a', 'https://CDN.Example:443/中 文.jpg', 'javascript:bad()', 'JavaScript:bad()', 'data:image/svg+xml,AAA', 'data:image/png;base64,AAAA', '\u3000a.jpg\u3000', '\ufeffa.jpg\ufeff', '..', 'a//b', '/../b']:
            cases.append({'html': '<img src="' + image + '">', 'mode': 'keepImg', 'baseUrl': base})
    for text in ['A', 'A\n', 'A\r\n', 'A\r', 'A\u0085', 'A\u2028', 'A\u2029', 'A\nB', 'A\n\n', 'A$', '$A', 'A\n\nA']:
        for pattern in ['A$', '(A)$', '[A$]', r'A\$', '(?m)A$', '^A$']:
            cases.append({'html': text, 'mode': 'replace', 'pattern': pattern, 'replacement': 'B', 'baseUrl': ''})
    if args.html_file:
        cases = [{'html': args.html_file.read_text(), 'mode': args.mode, 'baseUrl': 'https://www.vikbook.com/?id=642932592530&display=fulltext&p=3'}]
        if args.replacement_rule_file:
            rule = args.replacement_rule_file.read_text().split('##')
            if rule[0] != '' or len(rule) > 3:
                raise ValueError('This isolated reference accepts a leading ##pattern##replacement rule only')
            cases[0].update(mode='webReplace', pattern=rule[1], replacement=rule[2] if len(rule) > 2 else '')
    stdlib = next(args.kotlin_lib.glob('kotlin-stdlib-[0-9]*.jar'))
    classpath = ':'.join(str(p.resolve()) for p in [stdlib, args.commons_text_jar, args.commons_lang_jar])
    encode = lambda value: base64.b64encode(value.encode()).decode()
    runner = r'''package io.legado.app.utils
import java.net.URL
import java.util.Base64
import org.apache.commons.text.StringEscapeUtils
fun main(args: Array<String>) {
 val dec = Base64.getDecoder()
 val enc = Base64.getEncoder()
 java.io.File(args[0]).forEachLine { line ->
  val f = line.split("\t")
  val html = if (f[2] == "NULL") null else String(dec.decode(f[2]), Charsets.UTF_8)
  val base = String(dec.decode(f[3]), Charsets.UTF_8)
  try {
   val rich = mutableMapOf<String, String>()
   val input = if (f[1] == "webSpecial") Regex("<usehtml>.*?</usehtml>", RegexOption.DOT_MATCHES_ALL).replace(html ?: "") {
    val placeholder = "{usehtml_${rich.size}}"
    rich[placeholder] = it.value
    placeholder
   } else html
   var value = when(f[1]) {
    "format" -> HtmlFormatter.format(html)
    "intro" -> HtmlFormatter.formatIntro(html)
    "paragraphs" -> (html ?: "").lineSequence().map { it.trim { c -> c.code <= 0x20 || c == '　' } }.filter { it.isNotEmpty() }.joinToString("\n") { "　　$it" }
    "replace" -> (html ?: "").replace(String(dec.decode(f[4]), Charsets.UTF_8).toRegex(), String(dec.decode(f[5]), Charsets.UTF_8))
    else -> HtmlFormatter.formatKeepImg(input, if (base.isEmpty()) null else URL(base))
   }
   if (f[1] == "web" || f[1] == "webSpecial" || f[1] == "webReplace") value = StringEscapeUtils.unescapeHtml4(value)
   rich.forEach { (placeholder, original) -> value = value.replace(placeholder, original) }
   if (f[1] == "webReplace") {
    value = value.lines().joinToString("\n") { it.trim() }
    value = StringEscapeUtils.unescapeHtml4(value.replace(String(dec.decode(f[4]), Charsets.UTF_8).toRegex(), String(dec.decode(f[5]), Charsets.UTF_8)))
   }
   println(f[0]+"\tOK\t"+enc.encodeToString(value.toByteArray(Charsets.UTF_8)))
  } catch(e: Exception) { println(f[0]+"\tERROR\t"+e.javaClass.simpleName) }
 }
}'''
    with tempfile.TemporaryDirectory(prefix='legado-content-format-') as folder:
        folder = pathlib.Path(folder)
        (folder / 'HtmlFormatter.kt').write_bytes(formatter.read_bytes())
        (folder / 'Network.kt').write_text('package io.legado.app.utils\nimport java.net.URL\n' + data_regex + '\n' + predicates + '\nobject NetworkUtils {\n' + absolute + '\n}\nobject AppLog { fun put(message: String, e: Exception) {} }\n')
        (folder / 'AnalyzeUrl.kt').write_text('package io.legado.app.model.analyzeRule\nimport java.util.regex.Pattern\nobject AnalyzeUrl {\n' + param_pattern + '\n}\n')
        (folder / 'Runner.kt').write_text(runner)
        inputs = folder / 'cases.tsv'
        inputs.write_text(''.join(f'{i}\t{r["mode"]}\t' + ('NULL' if r['html'] is None else encode(r['html'])) + f'\t{encode(r["baseUrl"])}\t{encode(r.get("pattern", ""))}\t{encode(r.get("replacement", ""))}\n' for i, r in enumerate(cases)))
        jar = folder / 'reference.jar'
        compile_result = subprocess.run(['java', '-cp', f'{args.kotlin_lib.resolve()}/*', 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler', '-no-stdlib', '-no-reflect', '-classpath', classpath, '-d', str(jar), *(str(p) for p in folder.glob('*.kt'))], capture_output=True, text=True)
        if compile_result.returncode:
            raise RuntimeError(compile_result.stderr)
        result = subprocess.run(['java', '-cp', f'{jar}:{classpath}', 'io.legado.app.utils.RunnerKt', str(inputs)], check=True, capture_output=True, text=True)
    for line in result.stdout.splitlines():
        fields = line.split('\t')
        row = cases[int(fields[0])]
        if fields[1] == 'ERROR':
            row['error'] = fields[2]
        else:
            row['value'] = base64.b64decode(fields[2]).decode()
    digest = lambda value: hashlib.sha256(value).hexdigest()
    paths = ['utils/HtmlFormatter.kt', 'utils/NetworkUtils.kt', 'utils/StringExtensions.kt', 'constant/AppPattern.kt', 'model/analyzeRule/AnalyzeUrl.kt', 'model/webBook/BookContent.kt', 'help/book/ContentProcessor.kt']
    fixture = {'sources': {name: digest((java / name).read_bytes()) for name in paths}, 'commonsTextVersion': '1.13.1', 'commonsTextJarSha256': digest(args.commons_text_jar.read_bytes()), 'commonsLangJarSha256': digest(args.commons_lang_jar.read_bytes()), 'caseCount': len(cases), 'cases': cases}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(fixture, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'cases': len(cases), 'nativeErrors': sum('error' in row for row in cases)}))


if __name__ == '__main__':
    main()
