#!/usr/bin/env python3
"""Run the unchanged native record restore loop and DAO, retaining state after failure."""
import argparse, hashlib, json, pathlib, subprocess, tempfile


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    for name in ['source-root', 'kotlin-lib', 'gson-jar', 'output']:
        ap.add_argument('--' + name, type=pathlib.Path, required=True)
    a = ap.parse_args()
    root = a.source_root / 'app/src/main/java/io/legado/app'
    source = (root / 'help/storage/Restore.kt').read_text()
    start = source.index('it.forEach { readRecord ->')
    opening = source.index('{', start)
    depth = 0
    for pos in range(opening, len(source)):
        depth += (source[pos] == '{') - (source[pos] == '}')
        if depth == 0:
            block = source[start:pos + 1]
            break
    def record(device, title='Same', time=100, author='甲'):
        return dict(deviceId=device, bookName=title, author=author, readTime=time, lastRead=time + 1)
    cases = []
    current = [record('', time=100), record('own', time=300), record('other', time=200)]
    for field in ['deviceId', 'bookName', 'author']:
        for bad_device in ['own', 'other']:
            for duration in [50, 500]:
                for position in range(6):
                    prefix = [record(['', 'own', 'other'][i % 3], time=50 + i * 200, author=['乙', '', '甲'][i % 3]) for i in range(position)]
                    bad = record(bad_device, time=duration)
                    bad[field] = None
                    cases.append(dict(current=current, incoming=prefix + [bad, record('late', 'MustNotBeInserted')], ownDeviceId='own'))
    for i in range(12):
        cases.append(dict(current=current, incoming=[record(['', 'own', 'other'][j % 3], time=i * 100 + j, author=['甲', '乙', ''][j % 3]) for j in range(i)], ownDeviceId='own'))
    runner = r'''package reference
import io.legado.app.data.entities.*
import io.legado.app.data.dao.ReadRecordDao
import io.legado.app.utils.GSON
import io.legado.app.utils.fromJsonArray
import com.google.gson.GsonBuilder
import com.google.gson.JsonParser
class MemoryDao(current:List<ReadRecord>):ReadRecordDao {
 private val rows=linkedMapOf<Pair<String,String>,ReadRecord>()
 val commits=mutableListOf<ReadRecord>()
 init {current.forEach {rows[it.deviceId to it.bookName]=it.copy()}}
 override val all get()=rows.values.toList()
 override val allShow:List<ReadRecordShow> get()=error("Unused SQL")
 override val allTime:Long get()=error("Unused SQL")
 override fun flowBooks():kotlinx.coroutines.flow.Flow<List<ReadRecordBook>> = error("Unused flow")
 override fun search(searchKey:String):List<ReadRecordShow> = error("Unused SQL")
 override fun getReadTime(deviceId:String,bookName:String)=rows[deviceId to bookName]?.readTime
 override fun getRecord(deviceId:String,bookName:String)=rows[deviceId to bookName]?.copy()
 override fun getAuthor(deviceId:String,bookName:String)=rows[deviceId to bookName]?.author
 override fun insertRaw(vararg readRecord:ReadRecord) { readRecord.forEach {val copy=it.copy();rows[it.deviceId to it.bookName]=copy;commits.add(copy)} }
 override fun update(vararg record:ReadRecord)=error("Unused update")
 override fun delete(vararg record:ReadRecord)=error("Unused delete")
 override fun clear()=error("Unused clear")
 override fun deleteByName(bookName:String)=error("Unused delete")
}
class Db(val readRecordDao:MemoryDao)
fun restore(current:List<ReadRecord>,incoming:List<ReadRecord>,androidId:String):Map<String,Any> {
 val appDb=Db(MemoryDao(current));val it=incoming
 val result=runCatching { NATIVE_BLOCK }
 return mapOf("rows" to appDb.readRecordDao.all,"commits" to appDb.readRecordDao.commits,"failed" to result.isFailure,"errorType" to (result.exceptionOrNull()?.javaClass?.simpleName ?: ""))
}
fun main(args:Array<String>) {
 val wire=GsonBuilder().disableHtmlEscaping().create()
 java.io.File(args[0]).forEachLine { line ->
  val row=JsonParser.parseString(line).asJsonObject
  fun records(key:String)=GSON.fromJsonArray<ReadRecord>(java.io.ByteArrayInputStream(row[key].toString().toByteArray())).getOrThrow()
  println(wire.toJson(restore(records("current"),records("incoming"),row["ownDeviceId"].asString)))
 }
}'''.replace('NATIVE_BLOCK', block)
    paths = ['data/entities/ReadRecord.kt', 'data/entities/ReadRecordBook.kt', 'data/entities/ReadRecordShow.kt', 'data/dao/ReadRecordDao.kt', 'utils/GsonExtensions.kt']
    with tempfile.TemporaryDirectory(prefix='legado-native-restore-failure-') as folder:
        f = pathlib.Path(folder)
        for i, path in enumerate(paths):
            (f / f'Source{i}.kt').write_text((root / path).read_text())
        (f / 'Room.kt').write_text('package androidx.room\nannotation class Entity(val tableName:String,val primaryKeys:Array<String>)\nannotation class ColumnInfo(val defaultValue:String)\nannotation class Dao\nannotation class Query(val value:String)\nannotation class Transaction\nannotation class Insert(val onConflict:Int)\nannotation class Update\nannotation class Delete\nobject OnConflictStrategy {const val REPLACE=1}')
        (f / 'Flow.kt').write_text('package kotlinx.coroutines.flow\ninterface Flow<T>')
        (f / 'Rules.kt').write_text('package io.legado.app.data.entities.rule\nimport com.google.gson.JsonDeserializer\n' + '\n'.join('class '+c+' {companion object {val jsonDeserializer=JsonDeserializer<'+c+'> {_,_,_->error("Unused rule adapter")}}}' for c in ['ExploreRule','SearchRule','BookInfoRule','TocRule','ContentRule','ReviewRule']))
        (f / 'Runner.kt').write_text(runner)
        (f / 'in.jsonl').write_text(''.join(json.dumps(row, ensure_ascii=False) + '\n' for row in cases))
        stdlib = next(a.kotlin_lib.glob('kotlin-stdlib-[0-9]*.jar'))
        cp = ':'.join(map(str, [stdlib, a.gson_jar])); jar = f / 'reference.jar'
        compiled = subprocess.run(['java', '-cp', str(a.kotlin_lib / '*'), 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler', '-no-stdlib', '-no-reflect', '-classpath', cp, '-d', str(jar), *map(str, f.glob('*.kt'))], capture_output=True, text=True)
        if compiled.returncode:
            raise RuntimeError(compiled.stderr)
        result = subprocess.run(['java', '-cp', str(jar) + ':' + cp, 'reference.RunnerKt', str(f / 'in.jsonl')], capture_output=True, text=True, check=True)
        results = [json.loads(line) for line in result.stdout.splitlines()]
    assert len(results) == len(cases)
    metadata = dict(sourceRoot=str(a.source_root), sources=[dict(path='app/src/main/java/io/legado/app/' + path, sha256=hashlib.sha256((root / path).read_bytes()).hexdigest()) for path in paths + ['help/storage/Restore.kt']], gsonSha256=hashlib.sha256(a.gson_jar.read_bytes()).hexdigest(), restoreBlock=block, boundary='Unchanged Kotlin/Gson/DAO/restore loop with in-memory row storage; no Room/Android execution. Null String failures occur before insertRaw. Each source restore iteration invokes its own @Transaction DAO.insert call.')
    metadata['javaVersion'] = subprocess.run(['java', '-version'], capture_output=True, text=True, check=True).stderr.splitlines()[0]
    metadata['kotlinTestJars'] = [{'file': jar.name, 'sha256': hashlib.sha256(jar.read_bytes()).hexdigest()} for jar in sorted(a.kotlin_lib.glob('kotlin-*.jar'))]
    order = [('Book', 'bookshelf.json'), ('Bookmark', 'bookmark.json'), ('BookHighlight', 'highlight.json'), ('HighlightRule', 'highlightRule.json'), ('BookGroup', 'bookGroup.json'), ('BookSource', 'bookSource.json'), ('RssSource', 'rssSources.json'), ('RssStar', 'rssStar.json'), ('ReplaceRule', 'replaceRule.json'), ('RuleSub', 'sourceSub.json'), ('TxtTocRule', 'txtTocRule.json'), ('HttpTTS', 'httpTTS.json'), ('DictRule', 'dictRule.json'), ('KeyboardAssist', 'keyboardAssists.json'), ('ReadRecord', 'readRecord.json')]
    metadata['mutatingOrderEvidence'] = [{'file': name, 'sourceOffset': source.index(f'fileToListT<{kind}>(path, "{name}")')} for kind, name in order]
    metadata['mediaRestoreOffset'] = source.index('val coverRestoreResult =')
    metadata['autoTaskUpsertOffset'] = source.index('appDb.autoTaskRuleDao.upsert(')
    a.output.parent.mkdir(parents=True, exist_ok=True)
    a.output.write_text(json.dumps(dict(metadata=metadata, cases=[dict(**row, expected=expected) for row, expected in zip(cases, results)]), ensure_ascii=False, indent=2) + '\n')
    print(dict(cases=len(cases), failures=sum(row['failed'] for row in results), successfulControls=sum(not row['failed'] for row in results)))


if __name__ == '__main__':
    main()
