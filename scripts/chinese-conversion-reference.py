"""Extract pinned dictionaries and replay the unchanged Legado Kotlin wrapper/JAR.

No Android build or source mutation. Full dictionary-key blocks use NUL separators
that do not occur in any dictionary key; expected outputs are stored as hashes.
"""
import argparse
import base64
import hashlib
import json
import pathlib
import random
import re
import subprocess
import tempfile
import zipfile


def sha(value):
    return hashlib.sha256(value).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ['source-root', 'kotlin-lib', 'jar', 'asset-output', 'fixture-output']:
        parser.add_argument('--' + key, type=pathlib.Path, required=True)
    parser.add_argument('--cases-file', type=pathlib.Path)
    args = parser.parse_args()
    wrapper = args.source_root / 'app/src/main/java/io/legado/app/utils/ChineseUtils.kt'
    original = wrapper.read_text()
    content_help = args.source_root / 'app/src/main/java/io/legado/app/help/book/ContentHelp.kt'
    excludes = re.findall(r'"([^"\n]*)"', original[original.index('val excludeList = listOf('):original.index('ChineseUtils.loadExcludeDict')])
    tables = {}
    dictionary_hashes = {}
    with zipfile.ZipFile(args.jar) as jar:
        for name in ['s2t', 't2s']:
            raw = jar.read('tc/' + name + '.txt')
            dictionary_hashes[name] = sha(raw)
            chars, phrases, max_len = {}, {}, 2
            for line in re.split(r'\r\n|\r|\n', raw.decode()):
                if not line or line.startswith('#') or '=' not in line:
                    continue
                key, value = line.split('=', 1)
                size = len(key.encode('utf-16-le')) // 2
                value_size = len(value.encode('utf-16-le')) // 2
                if size == value_size == 1:
                    chars[key] = value
                else:
                    max_len = max(max_len, size)
                    if key:
                        phrases[key] = value
            tables[name] = {'chars': list(chars.items()), 'phrases': list(phrases.items()), 'maxLen': max_len}
    asset = {**tables, 't2sExclusions': excludes}
    asset_bytes = (json.dumps(asset, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    args.asset_output.parent.mkdir(parents=True, exist_ok=True)
    args.asset_output.write_bytes(asset_bytes)
    samples = ['', '中华人民共和国目前还处于发展国家行列', '乾坤乾隆乾燥头发发展后面皇后面条里面', '槃划槳列根雪梨鳳梨機車介面規則純文字檔案', '這是繁體標題\r\n第一章', '发型头发理发发展发表发现', '教廷棋聖碁聖快取晶片映像離線鳳梨载入', '😀𠀀㓆㑮\u00a0\nABC_123 https://example.test/台湾?字=发&音=樂', '特殊格式的占位不应该被看见0。', 'null']
    samples.extend(excludes)
    samples.extend(['前' + word + '後' for word in excludes])
    rng = random.Random(107)
    all_keys = {name: [key for key, _ in table['chars'] + table['phrases']] for name, table in tables.items()}
    for name in tables:
        keys = all_keys[name]
        for _ in range(120):
            samples.append(''.join(rng.choice(keys) for _ in range(rng.randrange(2, 10))))
    cases = [{'content': text, 'mode': mode} for text in samples for mode in [0, 1, 2]]
    pipeline_cases = []
    for content in ['', 'null', '他說。她說。', '「頭髮」\n發展。\n“你好！”“歡迎。”', '第一章\n這是沒有結束\n的正文。', '鳳梨機車介面規則純文字檔案。\n😀甲\u00a0乙。']:
        for mode in [0, 1, 2]:
            for segment in [False, True]:
                pipeline_cases.append({'content':content,'mode':mode,'reSegment':segment,'title':'第一章','pipelineIndex':len(pipeline_cases)})
    cases.extend(pipeline_cases)
    blocks = []
    for name, mode in [('t2s', 1), ('s2t', 2)]:
        keys = all_keys[name]
        for start in range(0, len(keys), 128):
            text = '\0'.join(keys[start:start + 128])
            blocks.append({'table': name, 'mode': mode, 'start': start, 'count': min(128, len(keys) - start), 'inputSha256': sha(text.encode())})
            cases.append({'content': text, 'mode': mode, 'blockIndex': len(blocks) - 1})
    if args.cases_file:
        cases = json.loads(args.cases_file.read_text())
        blocks = []
        pipeline_cases = []
    runner = r'''package reference
import java.util.Base64
import io.legado.app.utils.ChineseUtils
import io.legado.app.help.book.ContentHelp
fun main(args: Array<String>) {
 val dec = Base64.getDecoder(); val enc = Base64.getEncoder()
 java.io.File(args[0]).forEachLine { line ->
  val fields = line.split("\t")
  var input = String(dec.decode(fields[2]), Charsets.UTF_8)
  val isNull = input == "null"
  if (!isNull && fields[3] == "1") input = ContentHelp.reSegment(input, "第一章")
  val output = if(isNull) input else when(fields[1]) { "1" -> ChineseUtils.t2s(input); "2" -> ChineseUtils.s2t(input); else -> input }
  println(fields[0]+"\t"+enc.encodeToString(output.toByteArray(Charsets.UTF_8)))
 }
}'''
    stdlib = next(args.kotlin_lib.glob('kotlin-stdlib-[0-9]*.jar'))
    with tempfile.TemporaryDirectory(prefix='legado-chinese-reference-') as temp:
        temp = pathlib.Path(temp)
        (temp / 'ChineseUtils.kt').write_text(original)
        (temp / 'ContentHelp.kt').write_text(content_help.read_text().replace('Math.random()', '0.5'))
        (temp / 'Runner.kt').write_text(runner)
        (temp / 'cases.tsv').write_text(''.join(f'{i}\t{row["mode"]}\t{base64.b64encode(row["content"].encode()).decode()}\t{int(row.get("reSegment",False))}\n' for i, row in enumerate(cases)))
        output_jar = temp / 'reference.jar'
        classpath = f'{stdlib}:{args.jar.resolve()}'
        result = subprocess.run(['java','-cp',f'{args.kotlin_lib.resolve()}/*','org.jetbrains.kotlin.cli.jvm.K2JVMCompiler','-no-stdlib','-no-reflect','-classpath',classpath,'-d',str(output_jar),str(temp/'ChineseUtils.kt'),str(temp/'ContentHelp.kt'),str(temp/'Runner.kt')],capture_output=True,text=True)
        if result.returncode:
            raise RuntimeError(result.stderr)
        result = subprocess.run(['java','-cp',f'{output_jar}:{classpath}','reference.RunnerKt',str(temp/'cases.tsv')],check=True,capture_output=True,text=True)
    explicit = []
    for line in result.stdout.splitlines():
        index, encoded = line.split('\t')
        row = cases[int(index)]
        content = base64.b64decode(encoded).decode()
        if 'blockIndex' in row:
            blocks[row['blockIndex']].update({'expectedSha256':sha(content.encode()),'outputUtf16Units':len(content.encode('utf-16-le'))//2})
        elif 'pipelineIndex' in row:
            pipeline_cases[row['pipelineIndex']]['expected'] = content
        else:
            explicit.append({**row, 'expected': content})
    for row in pipeline_cases:
        del row['pipelineIndex']
    fixture = {'library':'com.github.liuyueyi.quick-chinese-transfer:quick-transfer-core:0.2.17','tagCommit':'810e881ce722e7919ad00f283551e897bf7aad77','jarSha256':sha(args.jar.read_bytes()),'wrapperSha256':sha(wrapper.read_bytes()),'contentHelpSha256':sha(content_help.read_bytes()),'pipelineRandom':0.5,'dictionarySha256':dictionary_hashes,'assetSha256':sha(asset_bytes),'counts':{name:{'chars':len(table['chars']),'phrases':len(table['phrases']),'maxLen':table['maxLen']} for name,table in tables.items()},'exclusionCount':len(excludes),'explicitCases':explicit,'dictionaryBlocks':blocks,'pipelineCases':pipeline_cases}
    args.fixture_output.parent.mkdir(parents=True, exist_ok=True)
    args.fixture_output.write_text(json.dumps(fixture,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'explicitCases':len(explicit),'dictionaryBlocks':len(blocks),'dictionaryKeys':sum(len(keys) for keys in all_keys.values()),'exclusions':len(excludes),'assetBytes':len(asset_bytes)}))


if __name__ == '__main__':
    main()
