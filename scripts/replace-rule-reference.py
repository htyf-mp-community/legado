"""Reference replacement scopes with the actual DAO SQL and strings with JVM Matcher.

Only small source expressions are lifted into a temporary JVM harness. Android
Room/Rhino/coroutines are not emulated; scripts, deadlines and full Java Pattern
syntax remain separate acceptance work.
"""
import argparse
import base64
import hashlib
import json
import pathlib
import random
import re
import sqlite3
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ['source-root', 'kotlin-lib', 'output']:
        parser.add_argument('--' + key, type=pathlib.Path, required=True)
    args = parser.parse_args()
    root = args.source_root / 'app/src/main/java/io/legado/app'
    paths = {key: root / path for key, path in {
        'dao': 'data/dao/ReplaceRuleDao.kt', 'entity': 'data/entities/ReplaceRule.kt',
        'content': 'help/book/ContentProcessor.kt', 'regex': 'utils/RegexExtensions.kt',
        'title': 'data/entities/BookChapter.kt', 'readBook': 'model/ReadBook.kt',
    }.items()}
    texts = {key: path.read_text() for key, path in paths.items()}
    queries = {}
    for target in ['Content', 'Title', 'Source']:
        found = re.search(r'@Query\(\s*"""(SELECT \* FROM replace_rules WHERE isEnabled = 1 and scope' + target + r'.*?)"""\s*\)\s*fun findEnabledBy' + target + 'Scope', texts['dao'], re.S)
        assert found, target
        queries[target.lower()] = found[1]
    trim = 'mContent.lines().joinToString("\\n") { it.trim() }'
    assert trim in texts['content']
    assert 'matcher.appendReplacement(stringBuffer, replacement1)' in texts['regex']
    db = sqlite3.connect(':memory:')
    db.execute('create table replace_rules(id integer, isEnabled integer, scopeTitle integer, scopeContent integer, scopeSource integer, scope text, excludeScope text, sortOrder integer)')
    rng = random.Random(38029)
    scopes = [None, '', ' ', '目标书', '前目标书后', 'HTTPS://example.COM/path', 'prefix IOS😀abc suffix', 'a_b', '%', '_', '\\', 'æ', 'Æ', 'A\0tail', '\0', '😀', 'ABC']
    contexts = [
        {'name': '目标书', 'origin': 'https://example.com/path'},
        {'name': 'iOS_a%', 'origin': 'other'},
        {'name': '', 'origin': ''}, {'name': '%', 'origin': '_'},
        {'name': 'a\0tail', 'origin': 'XYZ'}, {'name': 'æ', 'origin': 'nonmatch'},
        {'name': '😀', 'origin': 'loc_book'}, {'name': 'a_b', 'origin': '\\'},
    ]
    scope_cases = []
    for i in range(1440):
        target = ['content', 'title', 'source'][i % 3]
        scope, exclude = rng.choice(scopes), rng.choice(scopes)
        context = rng.choice(contexts)
        enabled = i % 13 != 0
        flags = {name: rng.choice([True, True, False]) for name in ['content', 'title', 'source']}
        db.execute('delete from replace_rules')
        db.execute('insert into replace_rules values(7,?,?,?,?,?,?,0)', (enabled, flags['title'], flags['content'], flags['source'], scope, exclude))
        ids = [row[0] for row in db.execute(queries[target], context)]
        scope_cases.append({'scope': scope, 'excludeScope': exclude, 'context': context, 'target': target,
                            'isEnabled': enabled, 'scopeTitle': flags['title'], 'scopeContent': flags['content'], 'scopeSource': flags['source'], 'expectedIds': ids})
    # Independent default-LIKE fuzz, including code points that JS /i folds differently.
    alphabet = list('aAB%_\\') + ['甲', '😀', 'æ', 'Æ', '\0', '\n', 'K', 'k']
    like_cases = []
    for _ in range(1600):
        value = ''.join(rng.choice(alphabet) for _ in range(rng.randrange(0, 13)))
        pattern = ''.join(rng.choice(alphabet) for _ in range(rng.randrange(0, 9)))
        like_cases.append({'value': value, 'pattern': pattern, 'expected': bool(db.execute('select ? like ?', (value, pattern)).fetchone()[0])})
    patterns = [
        ('(甲)', '前甲后甲'), ('(甲)', '甲'), ('(a)(b)?', 'a ab'), ('(?<word>甲)(?<opt>乙)?', '甲 甲乙'),
        ('(a)(b)(c)(d)(e)(f)(g)(h)(i)(j)(k)(l)', 'abcdefghijkl'),
        ('x', 'no match'), ('(?i)(abc)', 'ABC abc'), ('(?m)^(a)$', 'a\na\nb'),
        ('(甲)$', '甲\r\n'), ('(甲)$', '甲\u0085'), ('(?s)(a.*b)', 'a\nb'),
        ('(😀)+', '😀😀x😀'), ('(?=a)', 'aa'), ('a*', 'aba'),
        ('(a|(b))', 'ab'), ('(?<word>甲)(?<opt>乙)?', 'no match'),
    ]
    replacements = ['', 'literal', '$0', '$00', '$01', '$1', '$10', '$12', '$123', '$2', '$9', '$99',
        '$00012', '${word}', '${opt}', '${missing}', '${}', '${0}', '${word', '${a_b}', '${word-}',
        '$', '$&', '$`', "$'", '$$', '\\', '\\$', '\\$1', '\\$0', '\\\\', '\\n', '\\甲',
        '<$0/$10>', '[$1][$2]', '${word}${opt}', '😀$0', '\n$0\r', '$1$0$1',
        '\t', '\u00a0', '\u3000', '\ufeff', '\x00', '\x85', '\x1c', '\u2028']
    replacement_cases = []
    for pattern, value in patterns:
        for replacement in replacements:
            for title in [False, True]:
                replacement_cases.append({'input': value, 'pattern': pattern, 'replacement': replacement, 'title': title})
    for _ in range(400):
        pattern, value = rng.choice(patterns)
        replacement = ''.join(rng.choice(list('012ab$\\{}') + ['甲', '😀']) for _ in range(rng.randrange(0, 16)))
        replacement_cases.append({'input': value, 'pattern': pattern, 'replacement': replacement, 'title': rng.choice([False, True])})
    # Kotlin trim differs from JS trim for BOM, NBSP, controls and separator chars.
    trim_cases = [{'input': chr(cp) + '甲' + chr(cp) + '\r\n\t乙\r 丙\n'} for cp in list(range(256)) + list(range(0x2000, 0x2070)) + [0x3000, 0xFEFF, 0x1F600]]
    runner = r'''import java.util.Base64
import java.util.regex.Pattern
fun main(args: Array<String>) {
 val dec = Base64.getDecoder(); val enc = Base64.getEncoder()
 java.io.File(args[0]).forEachLine { line ->
  val f = line.split("\t"); val input = String(dec.decode(f[2]), Charsets.UTF_8)
  try {
   val output = if(f[1] == "T") input.lines().joinToString("\n") { it.trim() } else {
    val pattern = String(dec.decode(f[3]), Charsets.UTF_8)
    val replacement = String(dec.decode(f[4]), Charsets.UTF_8)
    val matcher = Pattern.compile(pattern).matcher(input); val buffer = StringBuffer()
    while(matcher.find()) matcher.appendReplacement(buffer, replacement)
    matcher.appendTail(buffer)
    val value = buffer.toString()
    if(f[5] == "1" && value.isBlank()) input else value
   }
   println(f[0]+"\tOK\t"+enc.encodeToString(output.toByteArray(Charsets.UTF_8)))
  } catch(e: Exception) { println(f[0]+"\tERROR\t"+e.javaClass.simpleName) }
 }
}'''
    encode = lambda value: base64.b64encode(value.encode()).decode()
    all_cases = replacement_cases + trim_cases
    stdlib = next(args.kotlin_lib.glob('kotlin-stdlib-[0-9]*.jar'))
    with tempfile.TemporaryDirectory(prefix='legado-replace-reference-') as temp:
        temp = pathlib.Path(temp)
        (temp / 'Runner.kt').write_text(runner)
        rows = [f'{i}\tR\t{encode(row["input"])}\t{encode(row["pattern"])}\t{encode(row["replacement"])}\t{int(row["title"])}\n' for i, row in enumerate(replacement_cases)]
        rows += [f'{len(replacement_cases)+i}\tT\t{encode(row["input"])}\n' for i, row in enumerate(trim_cases)]
        (temp / 'cases.tsv').write_text(''.join(rows))
        jar = temp / 'reference.jar'
        subprocess.run(['java', '-cp', f'{args.kotlin_lib.resolve()}/*', 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler', '-no-stdlib', '-no-reflect', '-classpath', str(stdlib), '-d', str(jar), str(temp/'Runner.kt')], check=True, capture_output=True, text=True)
        output = subprocess.run(['java', '-cp', f'{jar}:{stdlib}', 'RunnerKt', str(temp/'cases.tsv')], check=True, capture_output=True, text=True).stdout
    for line in output.splitlines():
        index, status, value = line.split('\t')
        all_cases[int(index)]['expected'] = {'value': base64.b64decode(value).decode()} if status == 'OK' else {'error': value}
    result = {'reference': 'Actual DAO queries in SQLite; JVM Matcher appendReplacement/appendTail and Kotlin lines/trim/isBlank',
        'sqliteVersion': sqlite3.sqlite_version, 'javaVersion': subprocess.run(['java', '-version'], capture_output=True, text=True).stderr.splitlines()[0],
        'sources': {key: {'path': str(path.relative_to(args.source_root)), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()} for key, path in paths.items()},
        'queries': queries, 'scopeCases': scope_cases, 'likeCases': like_cases, 'replacementCases': replacement_cases, 'trimCases': trim_cases}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'scopes': len(scope_cases), 'like': len(like_cases), 'replacements': len(replacement_cases), 'trims': len(trim_cases), 'nativeReplacementErrors': sum('error' in row['expected'] for row in replacement_cases)}))


if __name__ == '__main__':
    main()
