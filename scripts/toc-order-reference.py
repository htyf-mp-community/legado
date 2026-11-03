"""Execute the original Kotlin chapter ordering/equality block on a finite corpus."""
import argparse
import hashlib
import itertools
import json
import pathlib
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root', required=True, type=pathlib.Path)
    parser.add_argument('--kotlin-lib', required=True, type=pathlib.Path)
    parser.add_argument('--output', required=True, type=pathlib.Path)
    args = parser.parse_args()
    root = args.source_root / 'app/src/main/java/io/legado/app'
    toc = (root / 'model/webBook/BookChapterList.kt').read_text()
    chapter = (root / 'data/entities/BookChapter.kt').read_text()
    start = toc.index('        if (!reverse) {\n            chapterList.reverse()')
    end = toc.index('        Debug.log(book.origin, "◇目录总数:', start)
    block = toc[start:end].replace('        currentCoroutineContext().ensureActive()\n', '')
    equality = chapter[chapter.index('    override fun hashCode() = url.hashCode()'):chapter.index('    fun primaryStr()')]
    cases = [{'urls': list(values), 'reverse': reverse, 'reverseToc': reverse_toc}
             for length in range(1, 6)
             for values in itertools.product('ABC', repeat=length)
             for reverse in (False, True) for reverse_toc in (False, True)]
    runner = '''class Book(private val reverseToc: Boolean) { fun getReverseToc() = reverseToc }
class BookChapter(val url: String, val title: String) {
%s
}
fun main(args: Array<String>) {
  java.io.File(args[0]).forEachLine { row ->
    val fields = row.split("\\t")
    val reverse = fields[0] == "1"
    val book = Book(fields[1] == "1")
    val chapterList = ArrayList(fields[2].mapIndexed { index, url -> BookChapter(url.toString(), index.toString()) })
%s
    println(list.joinToString(",") { it.title })
  }
}
''' % (equality, block)
    kotlin_lib = args.kotlin_lib.resolve()
    stdlib = next(kotlin_lib.glob('kotlin-stdlib-*.jar'))
    with tempfile.TemporaryDirectory(prefix='legado-toc-order-') as temporary:
        temp = pathlib.Path(temporary)
        (temp / 'Runner.kt').write_text(runner)
        (temp / 'input.txt').write_text(''.join(f"{int(c['reverse'])}\t{int(c['reverseToc'])}\t{''.join(c['urls'])}\n" for c in cases))
        subprocess.run(['java', '-cp', f'{kotlin_lib}/*', 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler',
                        '-no-stdlib', '-no-reflect', '-classpath', str(stdlib), '-d', str(temp / 'runner.jar'),
                        str(temp / 'Runner.kt')], check=True, capture_output=True, text=True)
        result = subprocess.run(['java', '-cp', f'{temp / "runner.jar"}:{stdlib}', 'RunnerKt', str(temp / 'input.txt')],
                                check=True, capture_output=True, text=True).stdout.splitlines()
    if len(result) != len(cases):
        raise RuntimeError('Unexpected Kotlin output count')
    for case, line in zip(cases, result):
        case['expected'] = [int(value) for value in line.split(',') if value]
    args.output.write_text(json.dumps({'sourceSha256': hashlib.sha256(toc.encode()).hexdigest(),
                                       'chapterSha256': hashlib.sha256(chapter.encode()).hexdigest(),
                                       'cases': cases}, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'{len(cases)} native Kotlin cases written to {args.output}')


if __name__ == '__main__':
    main()
