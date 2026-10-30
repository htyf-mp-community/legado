"""Execute unchanged native AnalyzeByJSoup/RuleAnalyzer on text/attribute cases.

Supply local Kotlin compiler libraries, Jsoup 1.16.2, and JsoupXpath 2.5.3.
Only the Android Keep annotation is stubbed; its retention has no parser effect.
No Android build or target dependency change is performed.
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
    for argument in ["source-root", "kotlin-lib", "jsoup-jar", "xpath-jar", "output"]:
        parser.add_argument("--" + argument, type=pathlib.Path, required=True)
    parser.add_argument('--serialization', action='store_true')
    parser.add_argument('--html-file', type=pathlib.Path)
    parser.add_argument('--rule', default='.calibre@html')
    args = parser.parse_args()
    source_root = args.source_root / "app/src/main/java/io/legado/app/model/analyzeRule"
    samples = [
        '<div id="x"> 第一段 <b>跳过注释</b> 第二段\n  续行 <script>不要混入</script> 第三段 </div>',
        '<div id="x"><p>甲</p><p>乙<br>丙</p>尾<script>bad()</script><style>.ad{}</style>末</div>',
        '<p id="x">A <b>skip</b>  B\n C <i>skip</i>\n D</p>',
        '<div id="x">\u2003A\u200bB\u00adC\u200dD\u2003</div>',
        '<pre id="x">\n A \n B </pre>',
        '<textarea id="x"> A \n B </textarea>',
        '<div id="x">A<span>B</span>C</div>',
        '<div id="x">A<div>B</div>C<span>D</span></div>',
        '<div id="x">A<p>B</p><!-- gap -->C</div>',
        '<div id="x">A<p>B</p><custom>C</custom>D</div>',
        '<div id="x">A<wbr>B<br>C<hr>D</div>',
        '<div id="x">A<script>secret</script>B<style>secret</style>C</div>',
        '<div id="x"><script>secret</script><style>secret</style></div>',
        '<table id="x"><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>',
        '<div id="x">A\t \n\r\f&nbsp; B</div>',
        '<div id="x">\x0bA\x0bB\x0b</div>',
        '<div id="x">&#x1680;A&#x202f;B&#xfeff;C&#x3000;</div>',
        '<div id="x"><span>A</span><span>B</span><p>C</p><p>D</p></div>',
        '<div id="x"></div>',
        '<div id="x"> \t\n &nbsp; </div>',
        '<div id="x"><br> A <br> B <br></div>',
    ]
    for depth in range(8):
        samples.append('<pre id="x">' + '<span>' * depth + ' A \n B ' + '</span>' * depth + '</pre>')
    cases = []
    for html in samples:
        for mode in ['text', 'ownText', 'textNodes']:
            cases.append({'html': html, 'rule': '#x@' + mode})
    attributes = '<main><a href="/a" data-custom="X">same</a><a href="/a" data-custom="X">same</a><a href=" \t" data-custom="\u2003">same</a><a href="/b" data-custom="\ufeff">same</a><a href="\u2003" data-custom="Y">same</a></main>'
    for rule in ['a@href', 'a@HREF', 'a@text', 'a@data-custom', 'tag.main@tag.a@data-custom', '@CSS:a@href']:
        cases.append({'html': attributes, 'rule': rule})
    cases.extend([
        {'html': '<p>A</p><p>B</p><a>X</a><a>Y</a><a>Z</a>', 'rule': 'p@text&&a@text'},
        {'html': '<p>A</p><p>B</p><a>X</a><a>Y</a><a>Z</a>', 'rule': 'p@text%%a@text'},
        {'html': '<p>A</p><p>B</p><a>X</a>', 'rule': 'a@text%%p@text'},
        {'html': '<p>A</p><a>X</a>', 'rule': 'p@text||a@text'},
        {'html': '<p>A</p><a>X</a>', 'rule': '.missing@text||a@text'},
        {'html': '<p>A</p><a>X</a>', 'rule': 'p@href||a@text'},
        {'html': '<p>A</p><a>X</a>', 'rule': '@CSS:p@text&&a@text'},
        {'html': '<script>secret</script>', 'rule': 'script@text'},
        {'html': '<style>secret</style>', 'rule': 'style@text'},
        {'html': '<p>same</p><p>same</p><p> </p>', 'rule': 'p@text'},
    ])
    if args.serialization:
        cases = []
        samples.extend([
            '<main><div class="item"><b>A</b></div><div class="item"><b>B</b></div></main>',
            '<div id="x">Hello<br>World<p>A</p><p>B</p></div>',
            '<div id="x"><!--first--><p>A</p><!--later-->B</div>',
            '<p id="x" data-value="a&amp;&quot;&lt;" hidden="hidden">A&nbsp;&amp;&lt;&gt;😀</p>',
            '<div id="x"><input checked disabled="" value="a&b"><img src="/x"><br><custom /></div>',
            '<div id="x"><custom />tail<p>Next</p></div>',
            '<div id="x"><dialog />tail<p>Next</p></div>',
            '<div id="x"><x:item />tail<x:item>Next</x:item></div>',
            '<div id="x" custom empty="" checked="checked" disabled="false">A</div>',
            '<?xml version="1.0"?><root id="x"><![CDATA[A < B & C]]></root>',
            '<?xml version="1.0"?><script id="x"> A &amp; B </script>',
            '<?xml version="1.0"?><style id="x"> A &amp; B </style>',
            '<div id="x"> <span>A</span> <span>B</span> </div>',
            '<template id="x"><p>A</p><p>B</p></template>',
            '<div id="x"><table><tr><td>A</td><td>B</td></tr></table></div>',
            '<div id="x"><p>A<p>B</div>',
            '<script id="x">secret()</script>',
            '<style id="x">.x{}</style>',
            '<?xml version="1.0"?><root id="x"><child a="&lt;">A &amp; B</child><empty /></root>',
            '<div id="x">' + '<div>' * 34 + 'A' + '</div>' * 34 + '</div>',
        ])
        for html in samples:
            for mode in ['html', 'all']:
                cases.append({'html': html, 'rule': '#x@' + mode})
        for rule in ['.item@html', '.item@all', 'div@html', 'div@all', '@CSS:div@html', '@CSS:.missing@all', '.missing@all', 'div@all&&p@all', 'div@html&&div@all', 'div@html%%div@all', '@CSS:.missing@all||div@all']:
            cases.append({'html': '<main><div class="item"><script>secret</script><p>A</p></div><div class="item"><style>.x{}</style><p>B</p></div></main>', 'rule': rule})
    if args.html_file:
        cases = [{'html': args.html_file.read_text(), 'rule': args.rule}]
    runner = r'''package io.legado.app.model.analyzeRule
import java.util.Base64
fun main(args: Array<String>) {
 val decoder = Base64.getDecoder()
 val encoder = Base64.getEncoder()
 java.io.File(args[0]).forEachLine { line ->
  val fields = line.split("\t")
  val html = String(decoder.decode(fields[1]), Charsets.UTF_8)
  val rule = String(decoder.decode(fields[2]), Charsets.UTF_8)
  try {
   val values = AnalyzeByJSoup(html).getStringList(rule)
   println(fields[0]+"\tOK\t"+values.size+values.joinToString("") { "\t"+encoder.encodeToString(it.toByteArray(Charsets.UTF_8)) })
  } catch (e: Exception) { println(fields[0]+"\tERROR\t"+e.javaClass.simpleName) }
 }
}
'''
    stdlib = next(args.kotlin_lib.glob('kotlin-stdlib-[0-9]*.jar'))
    classpath = f'{stdlib}:{args.jsoup_jar.resolve()}:{args.xpath_jar.resolve()}'
    encode = lambda value: base64.b64encode(value.encode()).decode()
    with tempfile.TemporaryDirectory(prefix='legado-html-text-') as folder:
        folder = pathlib.Path(folder)
        sources = []
        for filename in ['AnalyzeByJSoup.kt', 'RuleAnalyzer.kt']:
            target = folder / filename
            target.write_bytes((source_root / filename).read_bytes())
            sources.append(str(target))
        (folder / 'Keep.kt').write_text('package androidx.annotation\nannotation class Keep\n')
        (folder / 'Runner.kt').write_text(runner)
        inputs = folder / 'cases.tsv'
        inputs.write_text(''.join(f'{index}\t{encode(row["html"])}\t{encode(row["rule"])}\n' for index, row in enumerate(cases)))
        jar = folder / 'reference.jar'
        subprocess.run(['java', '-cp', f'{args.kotlin_lib.resolve()}/*', 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler', '-no-stdlib', '-no-reflect', '-classpath', classpath, '-d', str(jar), *sources, str(folder / 'Keep.kt'), str(folder / 'Runner.kt')], check=True, capture_output=True, text=True)
        result = subprocess.run(['java', '-cp', f'{jar}:{classpath}', 'io.legado.app.model.analyzeRule.RunnerKt', str(inputs)], check=True, capture_output=True, text=True)
    for line in result.stdout.splitlines():
        fields = line.split('\t')
        row = cases[int(fields[0])]
        if fields[1] == 'ERROR':
            row['error'] = fields[2]
        else:
            row['values'] = [base64.b64decode(value).decode() for value in fields[3:]]
            assert len(row['values']) == int(fields[2])
    digest = lambda value: hashlib.sha256(value).hexdigest()
    fixture = {
        'sources': {name: digest((source_root / name).read_bytes()) for name in ['AnalyzeByJSoup.kt', 'RuleAnalyzer.kt']},
        'jsoupVersion': '1.16.2', 'xpathVersion': '2.5.3',
        'jsoupJarSha256': digest(args.jsoup_jar.read_bytes()),
        'xpathJarSha256': digest(args.xpath_jar.read_bytes()),
        'caseCount': len(cases), 'cases': cases,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(fixture, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'cases': len(cases), 'nativeErrors': sum('error' in row for row in cases)}))


if __name__ == '__main__':
    main()
