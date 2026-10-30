#!/usr/bin/env python3
"""Replay native Gson/InputStream ReadRecord decoding, without building Android."""
import argparse, hashlib, json, pathlib, subprocess, tempfile


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    for name in ['source-root', 'kotlin-lib', 'gson-jar', 'output']:
        ap.add_argument('--' + name, type=pathlib.Path, required=True)
    a = ap.parse_args()
    source = a.source_root / 'app/src/main/java/io/legado/app'
    cases = ['', ' ', 'null', '[]', '{}', 'true', '1', '"x"', '[null]', '[{},null]', '[{},]', '[,]', '[;]', '[{},1]', '[{},[]]', '[{},true]', '[{},"x"]', '[{}]', '[{},{}]']
    fields = ['deviceId', 'bookName', 'author', 'readTime', 'lastRead']
    values = ['null', '""', '" "', '"甲"', 'true', 'false', '0', '-0', '1', '-1', '1.0', '1e3', '1.25', '1e-3', '9007199254740993', '9223372036854775807', '-9223372036854775808', '9223372036854775808', '-9223372036854775809', '1e20', '1e300', 'NaN', 'Infinity', '-Infinity', '"1"', '" 1 "', '"+1"', '"01"', '"1.0"', '"1e3"', '"1.25"', '"9007199254740993"', '"9223372036854775808"', '"NaN"', '{}', '[]', '{"n":1.00,"z":-0,"x":9007199254740993}', '[1.00,true,null,{"n":1e3}]']
    numeric_strings = [' 9007199254740993 ', '+１', '١٢', '𝟙', '1f', '1D', '.0', '-.0', '0x1p4', '0X1.8p+1', '-0x1p63', '0x1p63', '0x1.0000000000001p63', '0x1p-1075', '0x1.0000000000001p-1075', '0x1p-1074', '0x1p-100000', '0x0p99999999999999999999', '0x1p99999999999999999999', '0x1' + '0' * 400 + 'p-1600', '0x1' + '0' * 400 + 'p-1599', '\u00001\u001f', '\u00a01\u00a0', '+Infinity']
    values += [json.dumps(value, ensure_ascii=False) for value in numeric_strings]
    for field in fields:
        for value in values:
            cases.append('[{"' + field + '":' + value + '}]')
            cases.append('[{"bookName":"before","readTime":7},{"' + field + '":' + value + '},{"bookName":"after","readTime":9}]')
    for field in fields:
        for left in ['null', '"x"', '2', '2.5', 'true', '{}']:
            for right in ['null', '"y"', '3', '3.0']:
                cases.append('[{"' + field + '":' + left + ',"' + field + '":' + right + '}]')
    cases += [
        "/*comment*/[{bookName:'Single';readTime:'2.0';extra:[null,]}]",
        ")]}'\n[{bookName=plain;readTime=>2}]",
        '\ufeff[{"bookName":"BOM"}]',
        '[{"bookName":"first","BOOKNAME":"ignored","bookId":"unknown","extra":{a:1,a:2}}]',
        '[{"bookName":{"2":2,"1":1,"2":3,"a":"\u2028\u2029"}}]',
        '[{"bookName":"string","readTime":2}] trailing',
        '[{"unknown":1.25},{"unknown":null}]',
        '[{"bookName":"\u0000 ","deviceId":" A ","author":" ","readTime":0,"lastRead":0}]',
        '[{"readTime":2,"readTime":null,"lastRead":3,"lastRead":null}]',
        '[{"readTime":2,"readTime":2.5,"readTime":3}]',
    ]
    cases = list(dict.fromkeys(cases))
    runner = r'''package reference
import com.google.gson.GsonBuilder
import com.google.gson.JsonParser
import io.legado.app.utils.GSON
import io.legado.app.utils.fromJsonArray
import io.legado.app.data.entities.ReadRecord
fun main(args:Array<String>) {
 val wire=GsonBuilder().serializeNulls().disableHtmlEscaping().create()
 java.io.File(args[0]).forEachLine { line ->
  val raw=JsonParser.parseString(line).asString
  val before=System.currentTimeMillis()
  val result=runCatching { GSON.fromJsonArray<ReadRecord>(java.io.ByteArrayInputStream(raw.toByteArray(Charsets.UTF_8))).getOrThrow() }
  val after=System.currentTimeMillis()
  val out=result.fold(
    onSuccess={ rows -> mapOf("records" to rows.map { r -> mapOf("deviceId" to r.deviceId,"bookName" to r.bookName,"author" to r.author,"readTime" to r.readTime.toString(),"lastRead" to (if(r.lastRead in before..after) "@now" else r.lastRead.toString())) }) },
    onFailure={ error -> mapOf("error" to error.javaClass.simpleName,"message" to error.message) }
  )
  println(wire.toJson(out))
 }
}'''
    paths = ['data/entities/ReadRecord.kt', 'utils/GsonExtensions.kt', 'help/storage/Restore.kt']
    with tempfile.TemporaryDirectory(prefix='legado-record-import-') as folder:
        f = pathlib.Path(folder)
        for i, path in enumerate(paths[:2]):
            (f / f'Source{i}.kt').write_text((source / path).read_text())
        (f / 'Room.kt').write_text('package androidx.room\nannotation class Entity(val tableName:String,val primaryKeys:Array<String>)\nannotation class ColumnInfo(val defaultValue:String)')
        (f / 'Rules.kt').write_text('package io.legado.app.data.entities.rule\nimport com.google.gson.JsonDeserializer\n' + '\n'.join('class '+c+' {companion object {val jsonDeserializer=JsonDeserializer<'+c+'> {_,_,_->error("Uninvoked rule adapter boundary")}}}' for c in ['ExploreRule','SearchRule','BookInfoRule','TocRule','ContentRule','ReviewRule']))
        (f / 'Runner.kt').write_text(runner)
        (f / 'in.jsonl').write_text(''.join(json.dumps(s, ensure_ascii=False) + '\n' for s in cases))
        stdlib = next(a.kotlin_lib.glob('kotlin-stdlib-[0-9]*.jar'))
        cp = ':'.join(map(str, [stdlib, a.gson_jar]))
        jar = f / 'reference.jar'
        compiled = subprocess.run(['java', '-cp', str(a.kotlin_lib / '*'), 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler', '-no-stdlib', '-no-reflect', '-classpath', cp, '-d', str(jar), *map(str, f.glob('*.kt'))], capture_output=True, text=True)
        if compiled.returncode:
            raise RuntimeError(compiled.stderr)
        out = subprocess.run(['java', '-cp', str(jar) + ':' + cp, 'reference.RunnerKt', str(f / 'in.jsonl')], capture_output=True, text=True, check=True)
        results = [json.loads(line) for line in out.stdout.splitlines()]
    assert len(results) == len(cases)
    metadata = {'sourceRoot': str(a.source_root), 'sources': [{'path': 'app/src/main/java/io/legado/app/' + path, 'sha256': hashlib.sha256((source / path).read_bytes()).hexdigest()} for path in paths], 'gsonVersion': '2.14.0', 'gsonSha256': hashlib.sha256(a.gson_jar.read_bytes()).hexdigest(), 'clock': 'Constructor defaults observed within before/after System.currentTimeMillis and encoded as @now', 'boundary': 'Unchanged Gson.fromJsonArray(InputStream), entities and Gson adapters. No Room/native execution; nullable decoded fields can fail later during native insertion.'}
    a.output.parent.mkdir(parents=True, exist_ok=True)
    a.output.write_text(json.dumps({'metadata': metadata, 'cases': [{'raw': raw, **result} for raw, result in zip(cases, results)]}, ensure_ascii=False, indent=2) + '\n')
    print({'cases': len(cases), 'decoded': sum('records' in r for r in results), 'rejected': sum('error' in r for r in results)})


if __name__ == '__main__':
    main()
