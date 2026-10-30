"""Replay unchanged source read-record authors/index/duration and DAO SQL on the JVM/SQLite.

Android annotations/rule adapters are uninvoked boundary stubs. ICU4J 77.1 is an
explicit comparison profile, not proof of every Android/system ICU version.
No Android application is built; the original project stays read-only.
"""
import argparse, collections, functools, hashlib, json, pathlib, random, re, sqlite3, subprocess, tempfile


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    for name in ['source-root', 'kotlin-lib', 'gson-jar', 'icu-jar', 'output']:
        ap.add_argument('--'+name, type=pathlib.Path, required=True)
    a = ap.parse_args(); source=a.source_root/'app/src/main/java/io/legado/app'; prefix='\u001eauthors:'
    authors=['',' ','\t','\u00a0','\u2003','\ufeff','作者甲','作者乙',' A ','A','a','😀','甲\u001f乙']
    values=[[],['甲'],['乙','甲','甲',' '],['\t','\u00a0'],[1,True,False,1.25,{'a':1},['甲','乙']],None,{},['甲',None]]
    authors += [prefix+json.dumps(v,ensure_ascii=False) for v in values]
    authors += [prefix+s for s in ['not-json','["甲",]','["甲"] trailing',"['甲']",'[甲]','[TRUE,FALSE,NULL]','[TRUE,FALSE]','[1e30,-0,1.00,9007199254740993]','["a\nb"]','\ufeff["甲"]','["\\u2028"]','[{"a":1,"a":2}]']]
    calls=[{'op':'authors','value':v} for v in authors]
    calls += [{'op':'display','value':x+'\u001f'+y} for x in authors for y in authors]
    calls += [{'op':'merge','a':x,'b':y} for x in authors for y in authors]
    for rows in [[],[{'bookName':'同名','author':v} for v in authors[:5]],*[ [{'bookName':'同名','author':v}] for v in authors]]:
        for name in ['同名','同名 ','另一名']:
            for author in ['', ' ', '\u00a0', '\ufeff', '作者甲','作者乙','甲','乙','A','a']:
                calls.append({'op':'index','rows':rows,'name':name,'author':author})
    durations=[0,1,999,1000,59000,60000,3600000,86400000,90123000,-1,-1000,-60000,-3601000,2**53-1,2**63-1,-2**63]
    calls += [{'op':'duration','value':str(x)} for x in durations]
    calls += [{'op':'date','value':str(x),'zone':zone} for x in durations+[1793293200000,1710063000000,1730622600000,2**63-1-86400000,2**63-1-90*86400000,2**63-1-180*86400000] for zone in ['UTC','Asia/Shanghai','America/Los_Angeles','Europe/London','Europe/Dublin','Africa/Casablanca','Australia/Sydney','Australia/Lord_Howe','Pacific/Auckland','America/Santiago']]
    names=['同名','另一册','剑来','雪中悍刀行','重生','重庆','长安','长沙','阿Q','啊','A','a','Á','a\u0301','10','2','_','%',' ', '书 名','😀','𠮷','ß','SS','Ω','ω']
    calls += [{'op':'compare','a':x,'b':y} for x in names for y in names]
    for i in range(180):
        current=[{'deviceId':d,'bookName':'同名','author':authors[(i+j)%len(authors)],'readTime':100+j,'lastRead':10+j} for j,d in enumerate(['','own-device','other'])]
        incoming=[{'deviceId':d,'bookName':'同名','author':authors[(i+j+3)%len(authors)],'readTime':i,'lastRead':30+j} for j,d in enumerate(['','own-device','other'])]
        calls.append({'op':'restore','current':current,'incoming':incoming,'ownDeviceId':'own-device'})
    runner='''package io.legado.app.data.entities
import com.google.gson.Gson
import com.google.gson.JsonParser
import io.legado.app.help.book.ReadRecordIndex
import io.legado.app.ui.about.formatDuring
import io.legado.app.utils.cnCompare
import io.legado.app.data.dao.ReadRecordDao
class MemoryDao(current:List<ReadRecord>):ReadRecordDao {
 private val rows=linkedMapOf<Pair<String,String>,ReadRecord>()
 init { current.forEach { rows[it.deviceId to it.bookName]=it.copy() } }
 override val all get()=rows.values.toList()
 override val allShow:List<ReadRecordShow> get()=error("Unused SQL adapter")
 override val allTime:Long get()=error("Unused SQL adapter")
 override fun flowBooks():kotlinx.coroutines.flow.Flow<List<ReadRecordBook>> = error("Unused flow")
 override fun search(searchKey:String):List<ReadRecordShow> = error("Unused SQL adapter")
 override fun getReadTime(deviceId:String,bookName:String)=rows[deviceId to bookName]?.readTime
 override fun getRecord(deviceId:String,bookName:String)=rows[deviceId to bookName]?.copy()
 override fun getAuthor(deviceId:String,bookName:String)=rows[deviceId to bookName]?.author
 override fun insertRaw(vararg readRecord:ReadRecord) { readRecord.forEach { rows[it.deviceId to it.bookName]=it.copy() } }
 override fun update(vararg record:ReadRecord)=error("Unused update")
 override fun delete(vararg record:ReadRecord)=error("Unused delete")
 override fun clear() {rows.clear()}
 override fun deleteByName(bookName:String) {rows.entries.removeAll {it.value.bookName==bookName}}
}
class MemoryDb(val readRecordDao:MemoryDao)
fun nativeRestore(current:List<ReadRecord>, incoming:List<ReadRecord>, androidId:String):List<ReadRecord> {
 val appDb=MemoryDb(MemoryDao(current))
 val it=incoming
 NATIVE_RESTORE_BLOCK
 return appDb.readRecordDao.all
}
fun main(args:Array<String>) {
 val wire=Gson()
 java.io.File(args[0]).forEachLine { line ->
  val row=JsonParser.parseString(line).asJsonObject
  fun str(k:String)=row[k].asString
  val out:Any=when(str("op")) {
   "authors", "display" -> mapOf("decoded" to ReadRecordAuthors.decode(str("value")).toList(), "display" to ReadRecordAuthors.display(str("value")))
   "merge" -> ReadRecordAuthors.merge(str("a"),str("b"))
   "index" -> {val records=row["rows"].asJsonArray.map { val r=it.asJsonObject;ReadRecordBook(r["bookName"].asString,r["author"].asString) };ReadRecordIndex.of(records).contains(str("name"),str("author"))}
   "restore" -> {
     fun rows(k:String)=row[k].asJsonArray.map { io.legado.app.utils.GSON.fromJson(it,ReadRecord::class.java) }
     nativeRestore(rows("current"),rows("incoming"),str("ownDeviceId"))
   }
   "duration" -> formatDuring(str("value").toLong())
   "date" -> {val value=str("value").toLong();val zone=java.util.TimeZone.getTimeZone(str("zone"));mapOf("value" to (if(value<=0) "" else java.text.SimpleDateFormat("yyyy-MM-dd",java.util.Locale.CHINA).apply {timeZone=zone}.format(java.util.Date(value))), "offsetMinutes" to zone.getOffset(value)/60000.0, "rawOffsetMinutes" to zone.rawOffset/60000.0)}
   "compare" -> mapOf("chinese" to str("a").cnCompare(str("b")).compareTo(0),"localized" to com.ibm.icu.text.Collator.getInstance(java.util.Locale.US).compare(str("a"),str("b")).compareTo(0))
   else -> error("unknown operation")
  }
  println(wire.toJson(out))
 }
}'''
    restore_source=(source/'help/storage/Restore.kt').read_text(); start=restore_source.index('it.forEach { readRecord ->'); body_start=restore_source.index('{',start); depth=0; end=body_start
    for pos in range(body_start,len(restore_source)):
        if restore_source[pos]=='{':depth+=1
        elif restore_source[pos]=='}':
            depth-=1
            if depth==0:end=pos+1;break
    runner=runner.replace('NATIVE_RESTORE_BLOCK',restore_source[start:end])
    paths=['data/entities/ReadRecord.kt','data/entities/ReadRecordShow.kt','data/entities/ReadRecordBook.kt','help/book/ReadRecordIndex.kt','utils/GsonExtensions.kt','data/dao/ReadRecordDao.kt','ui/about/ReadRecordActivity.kt','utils/StringExtensions.kt']
    with tempfile.TemporaryDirectory(prefix='legado-read-records-') as folder:
        f=pathlib.Path(folder)
        for i,p in enumerate(paths[:5]+['data/dao/ReadRecordDao.kt']):(f/f'Source{i}.kt').write_text((source/p).read_text())
        activity=(source/paths[6]).read_text(); duration=activity[activity.index('internal fun formatDuring('):activity.index('class ReadRecordActivity')]
        (f/'Duration.kt').write_text('package io.legado.app.ui.about\n'+duration)
        ext=(source/paths[7]).read_text(); start=ext.index('fun String.cnCompare(');end=ext.index('\n}',start)+2
        (f/'Compare.kt').write_text('package io.legado.app.utils\nimport android.icu.text.Collator\nimport android.icu.util.ULocale\nimport java.util.Locale\n'+ext[start:end])
        (f/'Room.kt').write_text('package androidx.room\nannotation class Entity(val tableName:String,val primaryKeys:Array<String>)\nannotation class ColumnInfo(val defaultValue:String)\nannotation class Dao\nannotation class Query(val value:String)\nannotation class Transaction\nannotation class Insert(val onConflict:Int)\nannotation class Update\nannotation class Delete\nobject OnConflictStrategy {const val REPLACE=1}')
        (f/'Flow.kt').write_text('package kotlinx.coroutines.flow\ninterface Flow<T>')
        (f/'Android.kt').write_text('package android.os\nobject Build {object VERSION {const val SDK_INT=34}; object VERSION_CODES {const val N=24}}')
        (f/'Collator.kt').write_text('package android.icu.text\ntypealias Collator = com.ibm.icu.text.Collator')
        (f/'Locale.kt').write_text('package android.icu.util\ntypealias ULocale = com.ibm.icu.util.ULocale')
        (f/'Rules.kt').write_text('package io.legado.app.data.entities.rule\nimport com.google.gson.JsonDeserializer\n'+'\n'.join('class '+c+' {companion object {val jsonDeserializer=JsonDeserializer<'+c+'> {_,_,_->error("Uninvoked rule adapter boundary")}}}' for c in ['ExploreRule','SearchRule','BookInfoRule','TocRule','ContentRule','ReviewRule']))
        (f/'Runner.kt').write_text(runner);(f/'in.jsonl').write_text(''.join(json.dumps(c,ensure_ascii=False)+'\n' for c in calls))
        stdlib=next(a.kotlin_lib.glob('kotlin-stdlib-[0-9]*.jar'));cp=':'.join(map(str,[stdlib,a.gson_jar,a.icu_jar]));jar=f/'reference.jar'
        p=subprocess.run(['java','-cp',str(a.kotlin_lib/'*'),'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler','-no-stdlib','-no-reflect','-classpath',cp,'-d',str(jar),*[str(p) for p in f.glob('*.kt')]],capture_output=True,text=True)
        if p.returncode:raise RuntimeError(p.stderr)
        out=subprocess.run(['java','-cp',str(jar)+':'+cp,'io.legado.app.data.entities.RunnerKt',str(f/'in.jsonl')],capture_output=True,text=True,check=True)
        results=[json.loads(s) for s in out.stdout.splitlines()];assert len(results)==len(calls)
    data={'authors':[],'display':[],'restore':[],'merge':[],'index':[],'duration':[],'date':[],'compare':[]}
    for c,result in zip(calls,results):data[c['op']].append({**{k:v for k,v in c.items() if k!='op'},'expected':result})
    comparison={(r['a'],r['b']):r['expected'] for r in data['compare']}
    db=sqlite3.connect(':memory:');db.create_collation('localized',lambda x,y:comparison[x,y]['localized'])
    db.execute('create table readRecord(deviceId text not null,bookName text not null,author text not null,readTime integer not null,lastRead integer not null,primary key(deviceId,bookName))')
    dao=(source/'data/dao/ReadRecordDao.kt').read_text();query_block=dao[:dao.index('fun search')];query_block=query_block[query_block.rfind('@Query('):];q=re.search(r'"""(.*?)"""',query_block,re.S).group(1);delete=re.search(r'@Query\("(delete from readRecord where bookName[^\"]+)"\)',dao).group(1)
    rng=random.Random(440);databases=[]
    for i in range(360):
        db.execute('delete from readRecord');rows=[]
        for j in range(rng.randint(1,12)):
            r={'deviceId':str(j%4),'bookName':rng.choice(names),'author':rng.choice(authors),'readTime':rng.randint(0,10000000),'lastRead':rng.randint(0,100000000)}
            db.execute('insert or replace into readRecord values(:deviceId,:bookName,:author,:readTime,:lastRead)',r)
        rows=[dict(zip(['deviceId','bookName','author','readTime','lastRead'],r)) for r in db.execute('select * from readRecord')]
        key=rng.choice(['','%','_','甲','乙','authors','A','a','Á','\u001f',' ','\\','同名','😀','\0','%名%']);mode=i%3
        records=[dict(zip(['bookName','readTime','lastRead','author'],r)) for r in db.execute(q,{'searchKey':key})]
        if mode==1:records.sort(key=lambda r:-r['readTime'])
        elif mode==2:records.sort(key=lambda r:-r['lastRead'])
        else:records.sort(key=functools.cmp_to_key(lambda x,y:comparison[x['bookName'],y['bookName']]['chinese']))
        name=rng.choice(names);db.execute(delete,{'bookName':name});remaining=[dict(zip(['deviceId','bookName','author','readTime','lastRead'],r)) for r in db.execute('select * from readRecord')]
        databases.append({'rows':rows,'query':key,'sort':['name','duration','recent'][mode],'expected':records,'deleteName':name,'remaining':remaining})
    edges=[]
    for times in [[2**63-1],[2**63-1,1],[-2**63,-1],[2**53+1,1]]:
        db.execute('delete from readRecord')
        rows=[{'deviceId':str(i),'bookName':'同名','author':'甲','readTime':str(t),'lastRead':0} for i,t in enumerate(times)]
        for row in rows:db.execute('insert into readRecord values(:deviceId,:bookName,:author,:readTime,:lastRead)',row)
        try:
            result=[dict(zip(['bookName','readTime','lastRead','author'],r)) for r in db.execute(q,{'searchKey':''})]
            edges.append({'rows':rows,'expected':result})
        except sqlite3.OperationalError as error:edges.append({'rows':rows,'error':str(error)})
    data['sqlEdges']=edges
    data['database']=databases;data['metadata']={'sourceRoot':str(a.source_root),'sources':[{'path':'app/src/main/java/io/legado/app/'+p,'sha256':hashlib.sha256((source/p).read_bytes()).hexdigest()} for p in paths+['help/storage/Restore.kt']],'gsonVersion':'2.14.0','gsonSha256':hashlib.sha256(a.gson_jar.read_bytes()).hexdigest(),'icuProfile':'ICU4J 77.1 / cnCompare modern branch, localized en_US','icuSha256':hashlib.sha256(a.icu_jar.read_bytes()).hexdigest(),'sqliteVersion':sqlite3.sqlite_version,'sql':q,'deleteSql':delete,'boundary':'JVM/SQLite and frozen ICU comparison profile; no Android runtime tested; GROUP_CONCAT order is query-plan dependent'}
    def exact_longs(value):
        if isinstance(value,list):return [exact_longs(item) for item in value]
        if isinstance(value,dict):return {key:str(item) if key in ['readTime','lastRead'] and isinstance(item,int) and abs(item)>2**53-1 else exact_longs(item) for key,item in value.items()}
        return value
    data=exact_longs(data)
    a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n');print({k:len(v) for k,v in data.items() if isinstance(v,list)})

if __name__=='__main__':main()
