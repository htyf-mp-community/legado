"""Execute the unchanged native getContent method with boundary stubs on the JVM.

Title-file lookup is pre-populated to skip removal (separately covered by the
chapter-title oracle). Platform/DB/toast and timed regex services are stubs;
actual ContentHelp, ChineseUtils/JAR, HTML handling, rule loop and final native
paragraph pass execute. Only Math.random in a temporary copy is fixed to 0.5.
"""
import argparse
import base64
import hashlib
import json
import pathlib
import random
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ['source-root', 'kotlin-lib', 'jar', 'output']:
        parser.add_argument('--' + key, type=pathlib.Path, required=True)
    parser.add_argument('--cases-file', type=pathlib.Path)
    parser.add_argument('--plans-file', type=pathlib.Path)
    args = parser.parse_args()
    root = args.source_root / 'app/src/main/java/io/legado/app'
    files = {name: root / path for name, path in {
        'processor': 'help/book/ContentProcessor.kt', 'contentHelp': 'help/book/ContentHelp.kt',
        'converter': 'utils/ChineseUtils.kt', 'patterns': 'constant/AppPattern.kt',
        'layout': 'ui/book/read/page/provider/TextChapterLayout.kt',
    }.items()}
    original = files['processor'].read_text()
    method = original[original.index('    fun getContent('):original.rfind('\n}')]
    matcher = original[original.index('internal fun sameTitleLineMatcher('):original.index('\nclass ContentProcessor')]
    assert method.endswith('    }\n')
    patterns = files['patterns'].read_text()
    usehtml = next(line.strip().split(' //')[0] for line in patterns.splitlines() if 'val useHtmlRegex =' in line)
    samples = [
        '', 'null', '普通正文。', '第一章\n頭髮與發展。\n鳳梨機車。',
        '前文<usehtml><b>頭髮與發展</b></usehtml>后文',
        '<usehtml>第一行\n<b>第二行</b>\r\n末行</usehtml>',
        '<usehtml>A\rB\u2028C\u2029D</usehtml>',
        '<usehtml>A</usehtml><usehtml>B</usehtml>',
        '特殊格式的占位不应该被看见0。<usehtml>第一块</usehtml>',
        '特殊格式的占位不应该被看见1。<usehtml>第一块</usehtml><usehtml>第二块</usehtml>',
        '<USEHTML><b>大小写</b></USEHTML>', '<usehtml x="1">属性</usehtml>',
        '　\u00a0甲乙\u00a0\r\n\t尾部广告\r 插入点 ',
        '<img src="https://x.test/頭髮.png">正文<img src="https://x.test/头发.png">',
        '<usehtml><img src="/頭髮.png"><b>头发</b></usehtml>',
        '前文\n<usehtml><div class="頭髮">“頭髮。”</div></usehtml>\n后文',
        '<usehtml>外<usehtml>内</usehtml>尾</usehtml>',
        '<usehtml>未闭合<b>内</b>', '实体 &amp; &lt; <b>文字</b> 😀',
        '\ufeff<usehtml>甲</usehtml>\n\u00a0<usehtml>乙</usehtml>\u00a0',
    ]
    plans = [[], [
        {'id': 1, 'pattern': '头发', 'replacement': '净化正文', 'isRegex': False},
        {'id': 2, 'pattern': '特殊格式的占位不应该被看见', 'replacement': '改占位', 'isRegex': False},
        {'id': 3, 'pattern': '/头发.png', 'replacement': '/图片.png', 'isRegex': False},
        {'id': 4, 'pattern': '(?m)^(甲)(乙)$', 'replacement': '$2-$0-$10', 'isRegex': True},
    ], [
        {'id': 11, 'pattern': '特殊格式的占位不应该被看见0。', 'replacement': '特殊格式的占位不应该被看见1。', 'isRegex': False},
        {'id': 12, 'pattern': '广告', 'replacement': '', 'isRegex': False},
        {'id': 13, 'pattern': '(尾部)', 'replacement': '$&', 'isRegex': True},
        {'id': 14, 'pattern': '尾部', 'replacement': '后续', 'isRegex': False},
        {'id': 15, 'pattern': '插入点', 'replacement': '<usehtml><b>插入</b></usehtml>', 'isRegex': False},
    ]]
    cases = []
    for content in samples:
        for mode in [0, 1, 2]:
            for adapt in [False, True]:
                for resegment in [False, True]:
                    for policy in ['automatic', 'disabled', 'manualEmpty']:
                        for plan in range(len(plans)):
                            cases.append({'content': content, 'mode': mode, 'adapt': adapt, 'resegment': resegment, 'policy': policy, 'plan': plan, 'indent': '　　'})
    rng = random.Random(39029)
    tokens = ['甲', '頭髮', '头发', '😀', '\n', '\r', '\u00a0', '<usehtml>', '</usehtml>', '特殊格式的占位不应该被看见0。', '广告', '尾部', '插入点', '。', '“', '”']
    for _ in range(120):
        cases.append({'content': ''.join(rng.choice(tokens) for _ in range(rng.randrange(1, 35))), 'mode': rng.randrange(3), 'adapt': rng.choice([False, True]), 'resegment': rng.choice([False, True]), 'policy': rng.choice(['automatic', 'disabled', 'manualEmpty']), 'plan': rng.randrange(len(plans)), 'indent': rng.choice(['', '　　', '\t'])})
    if args.cases_file:
        cases = json.loads(args.cases_file.read_text())
    if args.plans_file:
        plans = json.loads(args.plans_file.read_text())
    runner = r'''package io.legado.app.help.book
import java.util.Base64
import java.util.regex.Pattern
import java.util.concurrent.CancellationException
import io.legado.app.utils.ChineseUtils
import io.legado.app.help.book.AppPattern.spaceRegex
data class ReplaceRule(val id: Int, val pattern: String, val replacement: String, val isRegex: Boolean, var isEnabled: Boolean = true) {
 val name = "reference-$id"; val regex get() = pattern.toRegex(); fun getValidTimeoutMillisecond() = 3000L
}
data class Book(val name: String = "参考书", val segment: Boolean = false) {
 fun getUseReplaceRule() = true; fun getReSegment() = segment; fun toReplaceBook() = this
}
class BookChapter(val title: String = "第一章") {
 fun getFileName(extension: String) = "nr"
 fun getDisplayTitle(rules: List<ReplaceRule>?, useReplace: Boolean = true, chineseConvert: Boolean = true, replaceBook: Book? = null) = title
}
data class BookContent(val sameTitleRemoved: Boolean, val textList: List<String>, val effectiveReplaceRules: ArrayList<ReplaceRule>?)
object AppConfig { var adaptSpecialStyle = true; var chineseConverterType = 0 }
object ReadBookConfig { var paragraphIndent = "　　" }
object AppPattern { __USEHTML__; val spaceRegex = Regex("\\s+") }
object AppLog { fun put(message: String, e: Exception) {} }
object appCtx { fun toastOnUi(message: String) {} }
object appDb { val replaceRuleDao = Dao(); class Dao { fun update(rule: ReplaceRule) {} } }
class RegexTimeoutException: Exception()
val Throwable.stackTraceStr: String get() = stackTraceToString()
fun String.escapeRegex() = Pattern.quote(this)
fun String.replace(name: String, regex: Regex, replacement: String, timeout: Long, chapter: BookChapter, book: Book): String {
 val matcher = regex.toPattern().matcher(this); val buffer = StringBuffer()
 while(matcher.find()) matcher.appendReplacement(buffer, replacement)
 matcher.appendTail(buffer); return buffer.toString()
}
__MATCHER__
class Processor(val contentReplaceRules: List<ReplaceRule>) {
 private val isAndroid8 = false
 val titleReplaceRules = emptyList<ReplaceRule>()
 val removeSameTitleCache = hashSetOf("nr")
__METHOD__
}
fun main(args: Array<String>) {
 val dec = Base64.getDecoder(); val enc = Base64.getEncoder()
 fun read(s: String) = String(dec.decode(s), Charsets.UTF_8)
 java.io.File(args[0]).forEachLine { line ->
  val f = line.split("\t")
  AppConfig.chineseConverterType=f[2].toInt(); AppConfig.adaptSpecialStyle=f[3]=="1";ReadBookConfig.paragraphIndent=read(f[7])
  val rules = if(f[6].isEmpty()) emptyList() else f[6].split(";").map { encoded -> val r=encoded.split(":");ReplaceRule(r[0].toInt(),read(r[2]),read(r[3]),r[1]=="1") }
  try {
   val result = Processor(rules).getContent(Book(segment=f[4]=="1"),BookChapter(),read(f[1]),includeTitle=false,replaceEnabledOverride=if(f[5]=="disabled")false else null, contentReplaceRulesOverride=if(f[5]=="manualEmpty")emptyList() else null)
   println(f[0]+"\tOK\t"+enc.encodeToString(result.textList.joinToString("\n").toByteArray(Charsets.UTF_8))+"\t"+result.effectiveReplaceRules.orEmpty().joinToString(","){it.id.toString()})
  } catch(e: Exception) {println(f[0]+"\tERROR\t"+e.javaClass.simpleName)}
 }
}'''.replace('__USEHTML__', usehtml).replace('__MATCHER__', matcher).replace('__METHOD__', method)
    encode = lambda value: base64.b64encode(value.encode()).decode()
    stdlib = next(args.kotlin_lib.glob('kotlin-stdlib-[0-9]*.jar'))
    with tempfile.TemporaryDirectory(prefix='legado-reader-native-') as directory:
        temp = pathlib.Path(directory)
        (temp/'Runner.kt').write_text(runner)
        (temp/'ContentHelp.kt').write_text(files['contentHelp'].read_text().replace('Math.random()', '0.5'))
        (temp/'ChineseUtils.kt').write_text(files['converter'].read_text())
        rows = []
        for i, case in enumerate(cases):
            rules = ';'.join(f'{r["id"]}:{int(r["isRegex"])}:{encode(r["pattern"])}:{encode(r["replacement"])}' for r in plans[case['plan']])
            rows.append(f'{i}\t{encode(case["content"])}\t{case["mode"]}\t{int(case["adapt"])}\t{int(case["resegment"])}\t{case["policy"]}\t{rules}\t{encode(case["indent"])}\n')
        (temp/'cases.tsv').write_text(''.join(rows))
        classpath = f'{stdlib}:{args.jar.resolve()}'
        jar = temp/'reference.jar'
        command = ['java','-cp',f'{args.kotlin_lib.resolve()}/*','org.jetbrains.kotlin.cli.jvm.K2JVMCompiler','-no-stdlib','-no-reflect','-classpath',classpath,'-d',str(jar),*(str(p) for p in temp.glob('*.kt'))]
        compiled = subprocess.run(command,capture_output=True,text=True)
        if compiled.returncode: raise RuntimeError(compiled.stderr)
        result = subprocess.run(['java','-cp',f'{jar}:{classpath}','io.legado.app.help.book.RunnerKt',str(temp/'cases.tsv')],check=True,capture_output=True,text=True)
    for line in result.stdout.splitlines():
        f = line.split('\t'); row = cases[int(f[0])]
        row['expected'] = {'value':base64.b64decode(f[2]).decode(), 'hitIds':[int(x) for x in f[3].split(',') if x]} if f[1]=='OK' else {'error':f[2]}
    output = {'sources': {name:{'path':str(path.relative_to(args.source_root)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()} for name,path in files.items()}, 'getContentSha256':hashlib.sha256(method.encode()).hexdigest(),'jarSha256':hashlib.sha256(args.jar.read_bytes()).hexdigest(),'platformAdaptations':['getContent copied unchanged into boundary-stub class','title-file cache prepopulated: duplicate removal skipped','Android8 compatibility false for iOS','timeout regex service replaced by same synchronous Matcher loop; no JS cases','ContentHelp temporary Math.random fixed to 0.5'],'plans':plans,'cases':cases}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'cases':len(cases),'errors':sum('error' in r['expected'] for r in cases),'methodSha256':output['getContentSha256']}))


if __name__ == '__main__':
    main()
