"""Run unchanged native search methods and getContent in the existing JVM boundary harness."""
import argparse
import base64
import hashlib
import json
import pathlib
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ['source-root', 'kotlin-lib', 'jar', 'output']:
        parser.add_argument('--' + key, type=pathlib.Path, required=True)
    args = parser.parse_args()
    root = args.source_root / 'app/src/main/java/io/legado/app'
    sources = {name: root / path for name, path in {
        'search': 'ui/book/searchContent/SearchContentViewModel.kt',
        'result': 'ui/book/searchContent/SearchResult.kt',
        'processor': 'help/book/ContentProcessor.kt', 'chapter': 'data/entities/BookChapter.kt',
        'patterns': 'constant/AppPattern.kt', 'strings': 'utils/StringExtensions.kt',
        'contentHelp': 'help/book/ContentHelp.kt', 'converter': 'utils/ChineseUtils.kt',
    }.items()}
    text = {name: path.read_text() for name, path in sources.items()}
    method = text['processor'][text['processor'].index('    fun getContent('):text['processor'].rfind('\n}')]
    matcher = text['processor'][text['processor'].index('internal fun sameTitleLineMatcher('):text['processor'].index('\nclass ContentProcessor')]
    search = text['search'][text['search'].index('    suspend fun searchChapter('):text['search'].rfind('\n}')]
    display_title = text['chapter'][text['chapter'].index('    fun getDisplayTitle('):text['chapter'].index('    fun getAbsoluteURL(')]
    # Reuse the documented getContent boundary stubs; reject drift in each replaced seam.
    harness = pathlib.Path(__file__).with_name('reader-native-content-reference.py').read_text()
    runner = harness.split("runner = r'''", 1)[1].split("'''.replace('__USEHTML__'", 1)[0].split('fun main(args: Array<String>)', 1)[0]
    def replace(old, new):
        nonlocal runner
        assert runner.count(old) == 1, old
        runner = runner.replace(old, new)
    replace('val segment: Boolean = false)', 'val segment: Boolean = false, val enabled: Boolean = true)')
    replace('fun getUseReplaceRule() = true', 'fun getUseReplaceRule() = enabled')
    replace('class BookChapter(val title: String = "第一章") {', 'typealias ReplaceBook = Book\nclass BookChapter(var title: String = "第一章", val index: Int = 0) {')
    replace(' fun getDisplayTitle(rules: List<ReplaceRule>?, useReplace: Boolean = true, chineseConvert: Boolean = true, replaceBook: Book? = null) = title', display_title)
    replace('data class BookContent(val sameTitleRemoved: Boolean, val textList: List<String>, val effectiveReplaceRules: ArrayList<ReplaceRule>?)', 'data class BookContent(val sameTitleRemoved: Boolean, val textList: List<String>, val effectiveReplaceRules: ArrayList<ReplaceRule>?) { override fun toString() = textList.joinToString("\\n") }')
    pattern_lines = [next(line.strip().split(' //')[0] for line in text['patterns'].splitlines() if f'val {name} =' in line) for name in ['useHtmlRegex', 'rnRegex', 'regexCharRegex']]
    replace('object AppPattern { __USEHTML__; val spaceRegex = Regex("\\\\s+") }', 'object AppPattern { ' + '; '.join(pattern_lines) + '; val spaceRegex = Regex("\\\\s+") }')
    replace('fun String.escapeRegex() = Pattern.quote(this)', 'fun String.escapeRegex() = replace(AppPattern.regexCharRegex, "\\\\$0")')
    replace('chapter: BookChapter, book: Book): String', 'chapter: BookChapter, book: Book?): String')
    replace('class Processor(val contentReplaceRules: List<ReplaceRule>) {', 'class Processor(val contentReplaceRules: List<ReplaceRule>, val titleReplaceRules: List<ReplaceRule>, keep: Boolean) {')
    replace(' val titleReplaceRules = emptyList<ReplaceRule>()\n val removeSameTitleCache = hashSetOf("nr")', ' val removeSameTitleCache = if(keep) hashSetOf("nr") else hashSetOf<String>()')
    runner = runner.replace('__MATCHER__', matcher).replace('__METHOD__', method)
    runner += r'''
class Context { fun ensureActive() {} }
fun currentCoroutineContext() = Context()
object BookHelp { var content: String? = null; fun getContent(book: Book, chapter: BookChapter) = content }
data class SearchResult(val resultCountWithinChapter: Int, val resultText: String, val chapterTitle: String, val query: String, val chapterIndex: Int, val queryIndexInResult: Int, val queryIndexInChapter: Int, val isRegex: Boolean)
class SearchVM(val book: Book?, val contentProcessor: Processor?) {
 companion object { var replaceEnabled = false; var regexReplace = false }
 var searchResultCounts = 0
__SEARCH__
}
fun main(args: Array<String>) {
 val dec = Base64.getDecoder(); val enc = Base64.getEncoder()
 fun read(s: String) = String(dec.decode(s), Charsets.UTF_16LE)
 fun encoded(s: String) = enc.encodeToString(s.toByteArray(Charsets.UTF_16LE))
 java.io.File(args[0]).forEachLine { line ->
  val f = line.split("\t")
  AppConfig.chineseConverterType=f[4].toInt();AppConfig.adaptSpecialStyle=f[5]=="1";ReadBookConfig.paragraphIndent=read(f[11])
  BookHelp.content=read(f[1]).takeIf{it.isNotEmpty()};SearchVM.replaceEnabled=f[7]=="1";SearchVM.regexReplace=f[8]=="1"
  val rules=if(f[10].isEmpty())emptyList()else f[10].split(";").map { r -> val v=r.split(":");ReplaceRule(v[0].toInt(),read(v[2]),read(v[3]),v[1]=="1") }
  val titleRules=if(f[12].isEmpty())emptyList()else f[12].split(";").map { r -> val v=r.split(":");ReplaceRule(v[0].toInt(),read(v[2]),read(v[3]),v[1]=="1") }
  val book=Book(name=read(f[13]),segment=f[6]=="1",enabled=f[9]=="1")
  val chapter=BookChapter(title=read(f[2]))
  val vm=SearchVM(book,Processor(rules,titleRules,f[14]=="1"))
  try {
   var output: List<SearchResult> = emptyList(); var failure: Throwable? = null
   val task: suspend () -> Unit = { output=vm.searchChapter(read(f[3]),chapter) }
   task.startCoroutine(object:kotlin.coroutines.Continuation<Unit>{override val context=kotlin.coroutines.EmptyCoroutineContext;override fun resumeWith(result:Result<Unit>){failure=result.exceptionOrNull()}})
   failure?.let { throw it }
   println(f[0]+"\tOK\t"+output.joinToString(";"){r -> listOf(r.resultCountWithinChapter.toString(),r.queryIndexInChapter.toString(),r.queryIndexInResult.toString(),encoded(r.resultText),encoded(r.chapterTitle)).joinToString(":")})
  }catch(e:Throwable){println(f[0]+"\tERROR\t"+e.javaClass.simpleName)}
 }
}'''.replace('__SEARCH__', search)
    runner = runner.replace('import java.util.Base64', 'import java.util.Base64\nimport kotlin.coroutines.startCoroutine')
    plans = [[], [
        {'id': 1, 'pattern': '头发', 'replacement': '净化', 'isRegex': False, 'scopeContent': True},
        {'id': 2, 'pattern': '(?m)^甲乙$', 'replacement': '$0尾', 'isRegex': True, 'scopeContent': True},
        {'id': 3, 'pattern': '第一章', 'replacement': '题章', 'isRegex': False, 'scopeContent': False, 'scopeTitle': True},
    ]]
    samples = [('第一章 頭髮', '第一章 頭髮\n頭髮與發展。甲乙\n甲乙\n末尾。'),
        ('第一章', '第一章\n甲甲甲 ABC abc Abc\n😀甲乙\n'+'前'*30+'甲'+'后'*30),
        ('题\r\n章', '<usehtml><b>頭髮</b>\n甲乙</usehtml>\n<甲乙>\n广告'),
        ('', '\u00a0甲乙\u00a0\r\n第一章\n头发'), ('第一章', 'null'), ('第一章', ''),
        ('第一章', '他说：“甲。”她说：“乙。”\n头发。'), ('第一章', '甲'*125)]
    queries = ['甲', '头发', '頭髮', '第一章', '题章', 'abc', 'ABC', '(?i)abc', '甲+', '^', '(?m)^甲', '甲|乙', '(?=甲)', '$', '(', '😀', '\\s+', '甲乙']
    cases = []
    for i, (title, content) in enumerate(samples):
        for mode in [0, 1, 2]:
            for enabled in [False, True]:
                for regex in [False, True]:
                    for query in queries:
                        cases.append({'title':title,'content':content,'query':query,'mode':mode,'adapt':i%2==0,'resegment':i==6,'replace':enabled,'regex':regex,'bookEnabled':i!=4,'plan':i%2,'indent':'　　','bookName':'参考书','keepTitle':i==2})
    for query in [r'\s+', r'\S+', r'[\s]', r'[^\s]', r'[\S]', r'[^\S]', r'[甲\s]', r'[甲\S]', r'\\s', r'\s|\S']:
        cases.append({'title':'题','content':'A\u00a0B\tC 😀\u3000甲\\s\r\n尾','query':query,'mode':0,'adapt':False,'resegment':False,'replace':False,'regex':True,'bookEnabled':True,'plan':0,'indent':'　　','bookName':'参考书','keepTitle':False})
    enc = lambda s: base64.b64encode(s.encode('utf-16-le',errors='surrogatepass')).decode()
    encode_rules = lambda rules: ';'.join(f'{r["id"]}:{int(r["isRegex"])}:{enc(r["pattern"])}:{enc(r["replacement"])}' for r in rules)
    stdlib = next(args.kotlin_lib.glob('kotlin-stdlib-[0-9]*.jar'))
    with tempfile.TemporaryDirectory(prefix='legado-search-native-') as directory:
        temp = pathlib.Path(directory); (temp/'Runner.kt').write_text(runner)
        (temp/'ContentHelp.kt').write_text(text['contentHelp'].replace('Math.random()', '0.5'));(temp/'ChineseUtils.kt').write_text(text['converter'])
        rows=[]
        for i,c in enumerate(cases):
            rules=plans[c['plan']]; body=[r for r in rules if r.get('scopeContent',True)];titles=[r for r in rules if r.get('scopeTitle',False)]
            rows.append('\t'.join([str(i),enc(c['content']),enc(c['title']),enc(c['query']),str(c['mode']),str(int(c['adapt'])),str(int(c['resegment'])),str(int(c['replace'])),str(int(c['regex'])),str(int(c['bookEnabled'])),encode_rules(body),enc(c['indent']),encode_rules(titles),enc(c['bookName']),str(int(c['keepTitle']))])+'\n')
        (temp/'cases.tsv').write_text(''.join(rows));jar=temp/'reference.jar';classpath=f'{stdlib}:{args.jar.resolve()}'
        result=subprocess.run(['java','-cp',f'{args.kotlin_lib.resolve()}/*','org.jetbrains.kotlin.cli.jvm.K2JVMCompiler','-no-stdlib','-no-reflect','-classpath',classpath,'-d',str(jar),*(str(p)for p in temp.glob('*.kt'))],capture_output=True,text=True)
        if result.returncode:raise RuntimeError(result.stderr)
        result=subprocess.run(['java','-cp',f'{jar}:{classpath}','io.legado.app.help.book.RunnerKt',str(temp/'cases.tsv')],check=True,capture_output=True,text=True)
    decode=lambda s:base64.b64decode(s).decode('utf-16-le',errors='surrogatepass')
    for line in result.stdout.splitlines():
        f=line.split('\t');case=cases[int(f[0])]
        if f[1]=='ERROR':case['expected']={'error':f[2]};continue
        items=[]
        for item in f[2].split(';') if f[2] else []:
            v=item.split(':');items.append({'ordinal':int(v[0]),'start':int(v[1]),'queryIndexInResult':int(v[2]),'excerpt':decode(v[3]),'chapterTitle':decode(v[4])})
        case['expected']={'results':items}
    data={'reference':'Unchanged SearchContentViewModel searchChapter/searchPosition/getResultAndQueryIndex, getContent and BookChapter.getDisplayTitle methods','sources':{k:{'path':str(v.relative_to(args.source_root)),'sha256':hashlib.sha256(v.read_bytes()).hexdigest()}for k,v in sources.items()},'getContentSha256':hashlib.sha256(method.encode()).hexdigest(),'searchMethodsSha256':hashlib.sha256(search.encode()).hexdigest(),'displayTitleMethodSha256':hashlib.sha256(display_title.encode()).hexdigest(),'platformAdaptations':['Existing reader-native boundary stubs, same synchronous JVM Matcher replacement loop','nr lookup represented by supplied keepTitle flag; keys covered separately','DB/cache supplies the given raw content, empty cache returns null','Coroutine context stub executes synchronously without cancellation','Temporary Math.random fixed to 0.5'],'plans':plans,'cases':cases}
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(data,ensure_ascii=True,indent=2)+'\n');print(json.dumps({'cases':len(cases),'errors':sum('error'in c['expected'] for c in cases),'results':sum(len(c['expected'].get('results',[]))for c in cases)}))


if __name__=='__main__':main()
