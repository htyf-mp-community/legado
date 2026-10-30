"""Run the complete native ContentHelp with a reproducible random input tape.

The source checkout is never modified. Only Math.random() in a temporary JVM
copy is replaced by a counter/tape; production target code still uses Math.random.
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
    for key in ['source-root', 'kotlin-lib', 'output']:
        parser.add_argument('--' + key, type=pathlib.Path, required=True)
    parser.add_argument('--cases-file', type=pathlib.Path)
    args = parser.parse_args()
    source = args.source_root / 'app/src/main/java/io/legado/app/help/book/ContentHelp.kt'
    cases = []
    def add(content, title='第一章'):
        for tape in [[0.0], [0.5], [0.999999], [0.1, 0.9, 0.3, 0.7]]:
            cases.append({'content': content, 'title': title, 'randomTape': tape})
    samples = ['', '第一章', '第一章\n正文。', '第一章\n这是一句没有结束\n的正文。\n“你好！”“欢迎。”', '甲\n乙\n丙。\n丁。', '甲”\n乙', '&quot;你好&quot;说。再见。', '他说："甲。"她说："乙。"', '“甲”、“乙”和“丙”。', '“重词”是“重词”的说明。', '“你好！”皇帝说，“欢迎！”', '“甲。”\n“乙。”\n“丙。”旁白。', '“甲。”\n旁白。\n“乙。”', '甲。乙。丙。丁。戊。己。庚。辛。壬。癸。', 'ABC\r\n DEF\n\tGHI', '甲\u3000乙\u00a0丙\ufeff丁', '第\n一\n章\n正文', 'null', '😀“甲”\n😀“乙”。']
    for text in samples:
        add(text)
    for left in ['"', '“', '”', "'", '']:
        for right in ['"', '“', '”', "'", '']:
            for text in [left+'甲。乙。丙。丁。戊。己。'+right+'旁白。', '他说：'+left+'甲'+right+'她说，'+left+'乙'+right, left+'甲'+right+'、'+left+'乙'+right+'和'+left+'丙'+right]:
                add(text)
    for whitespace in [' ', '\t', '\r', '\n', '\r\n', '\v', '\f', '\u00a0', '\u3000', '\u2028', '\ufeff']:
        add('第一章'+whitespace+'\n甲'+whitespace+'乙。\n“丙。”')
    rng = random.Random(410)
    tokens = ['甲', '乙', '丙', '😀', '“', '”', '"', "'", '。', '！', '？', '.', '，', '：', '、', '和', '的', '说', '道', '\n', ' ', '\t', '\u3000', '\u00a0', '&quot;']
    for _ in range(200):
        add(''.join(rng.choice(tokens) for _ in range(rng.randrange(1, 100))))
    if args.cases_file:
        cases = json.loads(args.cases_file.read_text())
    stdlib = next(args.kotlin_lib.glob('kotlin-stdlib-[0-9]*.jar'))
    encode = lambda value: base64.b64encode(value.encode()).decode()
    runner = r'''package io.legado.app.help.book
import java.util.Base64
object ReferenceRandom {
 var tape = doubleArrayOf(0.0)
 var calls = 0
 fun next(): Double = tape[(calls++ % tape.size)]
}
fun main(args: Array<String>) {
 val dec = Base64.getDecoder(); val enc = Base64.getEncoder()
 java.io.File(args[0]).forEachLine { line ->
  val f = line.split("\t")
  fun value(i: Int) = String(dec.decode(f[i]), Charsets.UTF_8)
  ReferenceRandom.tape = f[3].split(",").map { it.toDouble() }.toDoubleArray()
  ReferenceRandom.calls = 0
  try {
   val result = ContentHelp.reSegment(value(1), value(2))
   println(f[0]+"\tOK\t"+ReferenceRandom.calls+"\t"+enc.encodeToString(result.toByteArray(Charsets.UTF_8)))
  } catch (e: Exception) {
   println(f[0]+"\tERROR\t"+ReferenceRandom.calls+"\t"+e.javaClass.simpleName)
  }
 }
}'''
    with tempfile.TemporaryDirectory(prefix='legado-resegment-') as folder:
        folder = pathlib.Path(folder)
        original = source.read_text()
        assert original.count('Math.random()') == 1
        (folder / 'ContentHelp.kt').write_text(original.replace('Math.random()', 'ReferenceRandom.next()'))
        (folder / 'Runner.kt').write_text(runner)
        inputs = folder / 'cases.tsv'
        inputs.write_text(''.join(f'{i}\t{encode(r["content"])}\t{encode(r["title"])}\t{",".join(str(v) for v in r["randomTape"])}\n' for i,r in enumerate(cases)))
        jar = folder / 'reference.jar'
        command = ['java','-cp',f'{args.kotlin_lib.resolve()}/*','org.jetbrains.kotlin.cli.jvm.K2JVMCompiler','-no-stdlib','-no-reflect','-classpath',str(stdlib),'-d',str(jar),*(str(p) for p in folder.glob('*.kt'))]
        compiled = subprocess.run(command,capture_output=True,text=True)
        if compiled.returncode:
            raise RuntimeError(compiled.stderr)
        result = subprocess.run(['java','-cp',f'{jar}:{stdlib}','io.legado.app.help.book.RunnerKt',str(inputs)],check=True,capture_output=True,text=True)
    for line in result.stdout.splitlines():
        fields = line.split('\t')
        cases[int(fields[0])]['expected'] = {'randomCalls':int(fields[2]), **({'content':base64.b64decode(fields[3]).decode()} if fields[1]=='OK' else {'error':fields[3]})}
    output = {'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'caseCount':len(cases), 'randomControl':'Math.random() replaced only in temporary reference copy with cyclic supplied tape', 'cases':cases}
    args.output.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'cases':len(cases),'errors':sum('error' in r['expected'] for r in cases),'randomizedCases':sum(r['expected']['randomCalls']>0 for r in cases)}))


if __name__ == '__main__':
    main()
