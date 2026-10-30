#!/usr/bin/env python3
"""Replay unchanged native sensitive-backup parsers and BackupAES on the JVM."""
import argparse, hashlib, json, pathlib, subprocess, tempfile


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    for name in ['source-root', 'kotlin-lib', 'gson-jar', 'hutool-core', 'hutool-crypto', 'output']:
        ap.add_argument('--' + name, type=pathlib.Path, required=True)
    a = ap.parse_args()
    source = a.source_root / 'app/src/main/java/io/legado/app'
    cases = []
    def add(kind, raw):
        cases.append({'kind': kind, 'raw': raw})
    malformed = ['', ' ', 'null', '{}', 'true', '1', '"x"', '[null]', '[1]', '[[]]', '[true]', '["x"]', '[{}]', '[{},null]', '[{},]', '[,]', '[;]', '[] trailing', '/*c*/[]', '//c\n[]', "[{'key':'v_x'}]", '[{key:"v_x"}]', '\ufeff[]', '\u00a0[]', '[]\u0000']
    for kind in ['cookies', 'runtime']:
        for raw in malformed:
            add(kind, raw)
    values = ['null', '""', '" "', '"\u00a0"', '"\ufeff"', '"甲"', 'true', 'false', '0', '-0', '1', '-1', '1.0', '1e3', '1.25', '9223372036854775807', '9223372036854775808', '9007199254740993', '1e300', 'NaN', '"1"', '{}', '[]']
    for field in ['url', 'cookie']:
        for value in values:
            base = {'url': 'fixture.invalid', 'cookie': 'sid=fixture'}
            raw = '{' + ','.join(json.dumps(k) + ':' + (value if k == field else json.dumps(v)) for k, v in base.items()) + '}'
            add('cookies', '[' + raw + ']')
            add('cookies', '[{"url":"first.invalid","cookie":"first=fixture"},' + raw + ',{"url":"later.invalid","cookie":"last=fixture"}]')
    for field in ['key', 'value', 'deadline']:
        for value in values:
            base = {'key': 'v_fixture', 'value': 'fixture', 'deadline': 0}
            raw = '{' + ','.join(json.dumps(k) + ':' + (value if k == field else json.dumps(v)) for k, v in base.items()) + '}'
            add('runtime', '[' + raw + ']')
            add('runtime', '[{"key":"v_first","value":"first","deadline":0},' + raw + ',{"key":"v_later","value":"later","deadline":0}]')
    for key in ['v_', 'userInfo_', 'loginHeader_', 'sourceVariable_', 'infoMap_', 'v_x', 'userInfo_x', 'loginHeader_x', 'sourceVariable_x', 'infoMap_x', 'v_ ', 'V_x', 'ordinary', '__proto__', 'v_\u0000']:
        add('runtime', json.dumps([{'key': key, 'value': None, 'deadline': 0}]))
    for raw in [
        '[]',
        '[{"key":"v_a","value":"old","deadline":0},{"key":"v_b","value":null,"deadline":1},{"key":"v_a","value":"new","deadline":2}]',
        '[{"key":"ordinary","key":"v_a","value":null,"deadline":0}]',
        '[{"key":"v_a","key":"ordinary","value":null,"deadline":0}]',
        '[{"key":"v_a","value":null,"deadline":1.0,"deadline":2}]',
        '[{"key":"v_a","value":null,"deadline":2,"deadline":1.0}]',
        '[{"key":"v_a","value":null,"deadline":-0}]',
        '[{"key":"v_a","value":null,"deadline":0,"extra":1e300}]',
    ]:
        add('runtime', raw)
    for raw in [
        '[]', '[{"url":"fixture.invalid","cookie":""}]',
        '[{"url":"fixture.invalid","cookie":"sid=one"},{"url":"fixture.invalid","cookie":"sid=two"}]',
        '[{"url":null,"url":"fixture.invalid","cookie":"sid=fixture"}]',
        '[{"url":"fixture.invalid","url":null,"cookie":"sid=fixture"}]',
        '[{"url":"fixture.invalid","cookie":"sid=fixture","extra":1e300}]',
        '\ufeff[{"url":"fixture.invalid","cookie":"sid=fixture"}]',
    ]:
        add('cookies', raw)
    # Strict grammar/string boundaries. Values are fixtures, never user cookies/passwords.
    for char in ['\u0000', '\u0001', '\t', '\n', '\r', '\u001f', '\u007f', '\u0085', '\u2028', '\u2029', '\ufeff', '\u00a0']:
        add('cookies', '[{"url":"fixture.invalid","cookie":"a' + char + 'b"}]')
        add('cookies', json.dumps([{'url': char, 'cookie': 'fixture'}]))
    for mode in ['cookies', 'runtime']:
        valid = '[{"url":"fixture.invalid","cookie":"fixture"}]' if mode == 'cookies' else '[{"key":"v_fixture","value":null,"deadline":0}]'
        for variant in [valid + '\n', valid + '/*c*/', '\ufeff' + valid, ")]}'\n" + valid, valid.replace(':', '='), valid.replace(',', ';'), valid.replace('"', "'"), valid.replace('}]', '},]')]:
            add(mode, variant)
    cases = list({json.dumps(row, ensure_ascii=False): row for row in cases}.values())
    runner = r'''package reference
import com.google.gson.GsonBuilder
import com.google.gson.JsonParser
import io.legado.app.help.storage.*
fun main(args:Array<String>) {
 val wire=GsonBuilder().serializeNulls().disableHtmlEscaping().create()
 java.io.File(args[0]).forEachLine { line ->
  val input=JsonParser.parseString(line).asJsonObject
  val kind=input["kind"].asString
  val raw=input["raw"].asString
  val result=runCatching {
   if(kind=="cookies") parseCookieBackup(raw).map { mapOf("url" to it.url,"cookie" to it.cookie) }
   else parseRuntimeSourceCacheBackup(raw).map { mapOf("key" to it.key,"value" to it.value,"deadline" to it.deadline.toString()) }
  }
  println(wire.toJson(result.fold(onSuccess={mapOf("rows" to it)},onFailure={mapOf("error" to it.javaClass.simpleName)})))
 }
 val passwords=listOf("", " ", "\u00a0", "fixture-password", " 密码 ", "fixture😀")
 val plains=listOf("[]", "[{\"url\":\"fixture.invalid\",\"cookie\":\"sid=fixture\"}]", "[{\"key\":\"v_fixture\",\"value\":null,\"deadline\":0}]", "甲😀\u0000\ufeff")
 val envelopes=arrayListOf<Map<String,Any?>>()
 for(password in passwords) for(plain in plains) {
  val aes=BackupAES(password); val base64=aes.encryptBase64(plain); val hex=aes.encryptHex(plain)
  val variants=listOf(base64,hex,hex.uppercase(),base64.trimEnd('='),base64.replace('+','-').replace('/','_'),base64.chunked(5).joinToString("\n"),base64.chunked(3).joinToString("!")," "+hex+" ",base64+"!",base64+"=",base64+"AAAA",base64.take(base64.length-2),"{}", " ")
  for(encoded in variants) {
   val result=runCatching { aes.decryptStr(encoded) }
   envelopes.add(mapOf("password" to password,"encoded" to encoded,"plaintext" to result.getOrNull(),"accepted" to result.isSuccess))
  }
 }
 java.io.File(args[1]).writeText(wire.toJson(envelopes))
}'''
    paths = ['help/storage/Restore.kt', 'help/storage/BackupAES.kt', 'utils/MD5Utils.kt', 'utils/GsonExtensions.kt', 'data/entities/Cookie.kt', 'data/entities/Cache.kt']
    with tempfile.TemporaryDirectory(prefix='legado-preflight-') as folder:
        f = pathlib.Path(folder)
        restore = (source / paths[0]).read_text()
        parsers = restore[restore.index('internal fun parseCookieBackup'):restore.index('/**\n * 恢复')]
        (f / 'Parsers.kt').write_text('package io.legado.app.help.storage\nimport com.google.gson.JsonElement\nimport io.legado.app.utils.*\nimport io.legado.app.data.entities.*\n' + parsers)
        for i, path in enumerate(paths[1:]):
            (f / f'Source{i}.kt').write_text((source / path).read_text())
        (f / 'Room.kt').write_text('package androidx.room\nannotation class Entity(val tableName:String,val indices:Array<Index>)\nannotation class Index(val value:Array<String>,val unique:Boolean)\nannotation class PrimaryKey')
        (f / 'Rules.kt').write_text('package io.legado.app.data.entities.rule\nimport com.google.gson.JsonDeserializer\n' + '\n'.join('class '+c+' {companion object {val jsonDeserializer=JsonDeserializer<'+c+'> {_,_,_->error("Uninvoked rule adapter")}}}' for c in ['ExploreRule','SearchRule','BookInfoRule','TocRule','ContentRule','ReviewRule']))
        (f / 'Runner.kt').write_text(runner)
        (f / 'in.jsonl').write_text(''.join(json.dumps(row, ensure_ascii=False) + '\n' for row in cases))
        stdlib = next(a.kotlin_lib.glob('kotlin-stdlib-[0-9]*.jar'))
        cp = ':'.join(map(str, [stdlib, a.gson_jar, a.hutool_core, a.hutool_crypto]))
        jar = f / 'reference.jar'
        compiled = subprocess.run(['java', '-cp', str(a.kotlin_lib / '*'), 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler', '-no-stdlib', '-no-reflect', '-classpath', cp, '-d', str(jar), *map(str, f.glob('*.kt'))], capture_output=True, text=True)
        if compiled.returncode:
            raise RuntimeError(compiled.stderr)
        out = subprocess.run(['java', '-cp', str(jar) + ':' + cp, 'reference.RunnerKt', str(f / 'in.jsonl'), str(f / 'envelopes.json')], capture_output=True, text=True, check=True)
        results = [json.loads(line) for line in out.stdout.split('\n') if line]
        envelopes = json.loads((f / 'envelopes.json').read_text())
    assert len(results) == len(cases)
    metadata = {
        'sources': [{'path': 'app/src/main/java/io/legado/app/' + path, 'sha256': hashlib.sha256((source / path).read_bytes()).hexdigest()} for path in paths],
        'jars': [{'name': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()} for path in [a.gson_jar, a.hutool_core, a.hutool_crypto]],
        'boundary': 'Unchanged strict parser functions extracted from Restore.kt; unchanged Gson extensions, Cookie/Cache entities, BackupAES and MD5Utils with pinned Gson/Hutool. Room annotations only are stubbed. No Android/Room execution.',
        'passwords': 'Only public agent-created fixture values; not user credentials.',
    }
    a.output.parent.mkdir(parents=True, exist_ok=True)
    a.output.write_text(json.dumps({'metadata': metadata, 'cases': [{**row, **result} for row, result in zip(cases, results)], 'envelopes': envelopes}, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'cases': len(cases), 'accepted': sum('rows' in row for row in results), 'rejected': sum('error' in row for row in results), 'envelopes': len(envelopes), 'decryptAccepted': sum(row['accepted'] for row in envelopes)}))


if __name__ == '__main__':
    main()
