"""Run unchanged native URL-resolution and query/form-encoding methods on JVM."""
import argparse
import base64
import hashlib
import json
import pathlib
import random
import subprocess
import tempfile


def method(source, signature):
    start = source.index(signature)
    opening = source.index('{', start)
    depth, cursor = 1, opening + 1
    while depth:
        depth += (source[cursor] == '{') - (source[cursor] == '}')
        cursor += 1
    return source[start:cursor]


def encode(value):
    return base64.b64encode(value.encode('utf-16le', errors='surrogatepass')).decode()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['source-root', 'kotlin-lib', 'hutool-jar', 'output']:
        parser.add_argument('--' + name, type=pathlib.Path, required=True)
    args = parser.parse_args()
    root = args.source_root / 'app/src/main/java/io/legado/app'
    paths = {'network': root/'utils/NetworkUtils.kt', 'strings': root/'utils/StringExtensions.kt',
             'patterns': root/'constant/AppPattern.kt', 'analyze': root/'model/analyzeRule/AnalyzeUrl.kt',
             'encoder': root/'utils/EncoderUtils.kt'}
    source = {key: value.read_text() for key, value in paths.items()}
    signatures = ['private val notNeedEncodingQuery', 'private val notNeedEncodingForm',
                  'fun encodedQuery(', 'fun encodedForm(', 'private fun isDigit16Char(',
                  'fun getAbsoluteURL(baseURL: String?', 'fun getAbsoluteURL(baseURL: URL?', 'fun getBaseUrl(']
    network = '\n'.join(method(source['network'], name) for name in signatures)
    predicates = source['strings'][source['strings'].index('fun String?.isAbsUrl()'):source['strings'].index('fun String?.isJson()')]
    pattern = next(line.strip() for line in source['patterns'].splitlines() if 'val dataUriRegex =' in line)
    params = '\n'.join(method(source['analyze'], name) for name in ['private fun encodeParams(', 'private fun StringBuilder.appendEncoded('])
    codec = source['analyze'][source['analyze'].index('        private val queryEncoder ='):source['analyze'].index('        fun AnalyzeUrl.getMediaItem()')]
    escape = method(source['encoder'], 'fun escape(')
    bases = [None, '', 'http://127.0.0.1:18212', 'http://host', 'http://host?old=1#frag',
             'https://Example.COM:443/dir/index.html?old=1#frag', 'https://host/dir/',
             'http://user:pass@host:80/a//b', 'http://host/a/../b', 'https://[::1]:88/a/b',
             'HTTP://EXAMPLE.COM:80/dir/file', ' http://host/dir/file ', 'http://host/dir/file,{"x":1}',
             'not a URL', 'http://host:bad/a', 'http://host:-1/a', 'http://host:-2/a',
             'http://host:65536/a', 'https:/a/dir', 'https:relative', 'file:///tmp/a.txt', 'ftp://host/dir/file']
    values = ['', ' ', 'child', 'child?x=1#ref', './child', '../book/1', '../../child', '../../../child',
              '/root/../child', '/root/./child', '//cdn.test/a', '//cdn.test:bad/a', '?q=x', '?', '#ref', '#',
              '.','..','./','../','a/./b','a/../b','a//../b','a/../../b','./../a',
              'http://other.test/a b?q=中 文', 'HTTPS://Other.TEST:443/a', ' http://x/a ',
              '\u3000http://x/a\u00a0', '\u3000child\u00a0', '\tchild\n', 'child\npath',
              'javascript:void(0)', 'JavaScript:void(0)', 'javascriptx', 'data:image/png;base64,AA==',
              'data:image/png;base64,A\n', 'data:text/plain,abc', 'file:///a/../b', 'ftp://x/a',
              'mailto:a@b.test', 'unknown:a', 'https:child', 'http:child', 'url:http://other/a',
              '//', '///path', '////path', '\\child', 'a%2F../b', 'a%20b', 'a b/中 文',
              'a?b#c', 'a#b?c', ':x', '1:a', 'x:y', 'a?x=1&y=2', '\x00child\x00']
    cases = [{'kind':kind, 'base':base, 'value':value} for kind in ['absolute','resource'] for base in bases for value in values]
    randomizer = random.Random(1321)
    for _ in range(500):
        relative = '/'.join(randomizer.choice(['a','b','.','..','','a b','中','%20','...']) for _ in range(randomizer.randrange(1,8)))
        relative += randomizer.choice(['','?q=x','#ref','?q=中 文#ref'])
        base = randomizer.choice(bases)
        cases += [{'kind':kind, 'base':base, 'value':relative} for kind in ['absolute','resource']]
    fields = ['', 'q=iOS 搜索验收', 'q=iOS 地址验收', 'q=iOS 表单验收&literal=%20&raw=+', 'q=西游记', 'q=a+b c&x=%20', 'q=a%20中', 'q=%GG',
              "!*'();:@&=+$,/?#[]\\^`{|}~", 'a', '=', '&', '&&', 'a=&=b&tail&', 'q=😀𠮷',
              'q=\ud800', 'q=\udc00', 'q=\ud800X\udc00', 'q=éÿ€', 'q=\n\t\r\x00', 'q=%u4e2d',
              'q=a=b=c', 'q=\u00a0\u3000', 'a%20b=c%2Bd', 'q=100%', 'q=100%20', 'q=a#b?c']
    cases += [{'kind':'params', 'value':value, 'charset':charset, 'isQuery':query}
              for value in fields + ['q='+chr(code) for code in range(128)] for charset in ['', 'UTF-8', 'GBK', 'ISO-8859-1', 'UTF-16LE', 'UTF-16BE', 'UTF-16', 'CP936', 'MS936', 'escape'] for query in [False, True]]
    runner = '''import java.net.URL
import java.nio.charset.Charset
import java.net.URLEncoder
import java.util.BitSet
import java.util.Base64
import java.io.File
import cn.hutool.core.codec.PercentCodec
import cn.hutool.core.net.RFC3986
__PATTERN__
__PREDICATES__
fun Exception.printOnDebug() {}
object AppLog { fun put(message: String, error: Exception) {} }
object NetworkUtils { __NETWORK__ }
object EncoderUtils { __ESCAPE__ }
class QueryOracle {
 __CODEC__
 __PARAMS__
 fun run(value: String, charset: String, query: Boolean) = encodeParams(value, charset, query)
}
fun dec(value: String): String {
 val bytes = Base64.getDecoder().decode(value)
 return String(CharArray(bytes.size/2) { ((bytes[it*2].toInt() and 255) or ((bytes[it*2+1].toInt() and 255) shl 8)).toChar() })
}
fun enc(value: String): String {
 val bytes = ByteArray(value.length*2)
 value.forEachIndexed { i,c -> bytes[i*2]=c.code.toByte(); bytes[i*2+1]=(c.code shr 8).toByte() }
 return Base64.getEncoder().encodeToString(bytes)
}
fun main(args: Array<String>) {
 val oracle=QueryOracle()
 File(args[0]).forEachLine { row ->
  val fields=row.split('\\t')
  val base=if(fields[0]=="params" || fields[1]=="-") null else dec(fields[1])
  val result=when(fields[0]) {
   "absolute" -> NetworkUtils.getAbsoluteURL(base,dec(fields[2]))
   "resource" -> NetworkUtils.getAbsoluteURL(base?.let { runCatching { URL(it) }.getOrNull() },dec(fields[2]))
   else -> oracle.run(dec(fields[1]),dec(fields[2]),fields[3]=="true")
  }
  println(enc(result))
 }
}
'''
    for key, value in [('PATTERN',pattern),('PREDICATES',predicates),('NETWORK',network),('ESCAPE',escape),('CODEC',codec),('PARAMS',params)]:
        runner=runner.replace('__'+key+'__',value)
    with tempfile.TemporaryDirectory(prefix='legado-url-') as temporary:
        folder=pathlib.Path(temporary);(folder/'Runner.kt').write_text(runner)
        rows=[]
        for case in cases:
            rows.append('\t'.join([case['kind'],'-' if case['base'] is None else encode(case['base']),encode(case['value'])]) if case['kind']!='params' else '\t'.join(['params',encode(case['value']),encode(case['charset']),str(case['isQuery']).lower()]))
        (folder/'cases.tsv').write_text('\n'.join(rows)+'\n')
        stdlib=next(args.kotlin_lib.glob('kotlin-stdlib-[0-9]*.jar'))
        classpath=f'{stdlib}:{args.hutool_jar.resolve()}'
        result=subprocess.run(['java','-cp',f'{args.kotlin_lib.resolve()}/*','org.jetbrains.kotlin.cli.jvm.K2JVMCompiler','-no-stdlib','-no-reflect','-classpath',classpath,'-d',str(folder/'reference.jar'),str(folder/'Runner.kt')],capture_output=True,text=True)
        if result.returncode:raise RuntimeError(result.stderr)
        result=subprocess.run(['java','-cp',f'{folder/"reference.jar"}:{classpath}','RunnerKt',str(folder/'cases.tsv')],capture_output=True,text=True,check=True)
        output=result.stdout.splitlines();assert len(output)==len(cases),(len(output),len(cases))
        for case,line in zip(cases,output):case['expected']=base64.b64decode(line).decode('utf-16le',errors='surrogatepass')
    data={'reference':'Unchanged NetworkUtils.getAbsoluteURL overloads, predicates and AnalyzeUrl.encodeParams/appendEncoded with pinned Hutool codec',
          'sources':{key:{'path':str(path.relative_to(args.source_root)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()} for key,path in paths.items()},
          'methodsSha256':hashlib.sha256((network+predicates+params+codec+escape).encode()).hexdigest(),
          'hutool':{'version':'5.8.22','sha256':hashlib.sha256(args.hutool_jar.read_bytes()).hexdigest()},
          'platformAdaptations':['JVM java.net.URL; Android URL-handler differences remain a separate boundary','AppLog and debug-print are no-op; no network request or Android build'], 'cases':cases}
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(data,ensure_ascii=True,indent=2)+'\n')
    print(json.dumps({'cases':len(cases),'absolute':sum(c['kind']=='absolute' for c in cases),'resource':sum(c['kind']=='resource' for c in cases),'params':sum(c['kind']=='params' for c in cases)}))


if __name__=='__main__':main()
