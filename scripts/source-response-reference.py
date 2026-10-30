#!/usr/bin/env python3
"""Compile unchanged source ICU/Kotlin detection, with Android-only boundary stubs."""
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


def compile_icu(root, program, output):
    source = pathlib.Path(__file__).parent / 'test-support' / (program + '.cpp')
    subprocess.run(['clang++', '-O2', '-std=c++17', str(source), '-I' + str(root / 'include'), '-L' + str(root / 'lib'), '-licuuc', '-o', str(output)], check=True, capture_output=True, text=True)


def escape_tables(path):
    source = re.sub(r'/\*.*?\*/|//[^\n]*', '', path.read_text(), flags=re.S)
    numbers = lambda name: [int(n) for n in re.findall(r'\b\d+\b', block(source, name))]
    normal = numbers('normalize_esq_chars_2022[256]')
    keys = numbers('escSeqStateTable_Key_2022[MAX_STATES_2022]')
    states = re.findall(r'VALID_\w+_2022', block(source, 'escSeqStateTable_Value_2022[MAX_STATES_2022]'))
    jp = re.findall(r'\b[A-Z][A-Z_0-9]+\b', block(source, 'nextStateToUnicodeJP[MAX_STATES_2022]'))
    cn = re.findall(r'\b[A-Z][A-Z_0-9]+\b', block(source, 'nextStateToUnicodeCN[MAX_STATES_2022]'))
    assert len(normal) == 256 and len(keys) == len(states) == len(jp) == len(cn) == 74
    inverse = {n: i for i, n in enumerate(normal) if n}
    result = []
    for i, key in enumerate(keys):
        sequence = []
        while key:
            sequence.insert(0, inverse[key & 31]); key >>= 5
        result.append({'bytes': sequence, 'terminal': states[i] != 'VALID_NON_TERMINAL_2022', 'jp': jp[i], 'cn': cn[i], 'kr': i == 0x30})
    return result


def block(source, marker):
    start = source.index(marker)
    opening = source.index('{', start)
    level = 1
    end = opening + 1
    while level:
        level += (source[end] == '{') - (source[end] == '}')
        end += 1
    return source[opening + 1:end - 1]


def tables(icu):
    """Export literal native statistical tables, without translating/retraining data."""
    clean = lambda text: re.sub(r'//[^\n]*|/\*.*?\*/', '', text, flags=re.S)
    mbcs = clean((icu / 'CharsetRecog_mbcs.java').read_text())
    sbcs = clean((icu / 'CharsetRecog_sbcs.java').read_text())
    iso = clean((icu / 'CharsetRecog_2022.java').read_text())
    numbers = lambda value: [int(n, 0) & 0xffffffff for n in re.findall(r'0[xX][\da-fA-F]+|\b\d+\b', value)]
    array = lambda text, field: numbers(block(text, field + ' ='))
    result = {'mbcs': {}, 'sbcs': [], 'iso2022': {}}
    for key in ['sjis', 'big5', 'euc_jp', 'euc_kr', 'gb_18030']:
        result['mbcs'][key] = array(block(mbcs, 'class CharsetRecog_' + key), 'commonChars')
    specs = [
        ('8859_1', None, 'ISO-8859-1', 'windows-1252', None),
        ('8859_2', None, 'ISO-8859-2', 'windows-1250', None),
        ('8859_5_ru', '8859_5', 'ISO-8859-5', None, 'ru'),
        ('8859_6_ar', '8859_6', 'ISO-8859-6', None, 'ar'),
        ('8859_7_el', '8859_7', 'ISO-8859-7', 'windows-1253', 'el'),
        ('8859_8_I_he', '8859_8', 'ISO-8859-8-I', 'windows-1255', 'he'),
        ('8859_8_he', '8859_8', 'ISO-8859-8', 'windows-1255', 'he'),
        ('windows_1251', None, 'windows-1251', None, 'ru'),
        ('windows_1256', None, 'windows-1256', None, 'ar'),
        ('KOI8_R', None, 'KOI8-R', None, 'ru'),
        ('8859_9_tr', '8859_9', 'ISO-8859-9', 'windows-1254', 'tr'),
    ]
    for key, parent, name, c1, lang in specs:
        body = block(sbcs, 'class CharsetRecog_' + key)
        byte_map = array(block(sbcs, 'class CharsetRecog_' + (parent or key)), 'byteMap')
        grams = [{'lang': lang, 'values': numbers(values)} for lang, values in re.findall(
            r'new NGramsPlusLang\(\s*"(\w+)"\s*,\s*new int\[\]\s*\{([^}]*)\}', body)]
        if not grams:
            grams = [{'lang': lang, 'values': array(body, 'ngrams')}]
        assert len(byte_map) == 256 and all(len(g['values']) == 64 for g in grams)
        result['sbcs'].append({'name': name, 'c1': c1, 'byteMap': [b & 255 for b in byte_map], 'grams': grams})
    for key in ['JP', 'CN', 'KR']:
        body = block(iso, 'class CharsetRecog_2022' + key)
        result['iso2022'][key] = [numbers(row) for row in re.findall(r'\{([^{}]*)\}', block(body, 'escapeSequences ='))]
    return result


def main():
    parser = argparse.ArgumentParser()
    for name in ['source-root', 'kotlin-lib', 'jsoup-jar', 'output', 'tables-output', 'decoder-output', 'icu-root', 'icu-2022-source', 'okhttp-sources']:
        parser.add_argument('--' + name, required=True, type=pathlib.Path)
    args = parser.parse_args()
    java = args.source_root / 'app/src/main/java'
    icu = java / 'io/legado/app/lib/icu4j'
    paths = list(sorted(icu.glob('*.java'))) + [java / ('io/legado/app/utils/' + n + '.kt') for n in ['EncodingDetect', 'Utf8BomUtils', 'ByteArrayExtensions']]
    data = tables(icu)
    args.tables_output.parent.mkdir(parents=True, exist_ok=True)
    args.tables_output.write_text(json.dumps(data, separators=(',', ':')) + '\n')
    cases = []
    def add(label, raw, content_type=None):
        cases.append({'label': label, 'base64': base64.b64encode(raw).decode(), 'contentType': content_type})
    samples = {
        'zh': '书名：西游记，作者：吴承恩。第一回，灵根育孕源流出，心性修持大道生。天地之数，有十二万九千六百岁为一元。阅读书屋，小说目录，正文内容。',
        'zt': '書名：西遊記，作者：吳承恩。第一回，靈根育孕源流出，心性修持大道生。天地之數，有十二萬九千六百歲為一元。閱讀書屋，小說目錄，正文內容。',
        'ja': '吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。日本語の小説を読む。これは文字コード検出のテストです。',
        'ko': '한국어 소설을 읽습니다. 이 문장은 문자 인코딩을 확인하기 위한 자료입니다. 책의 제목과 작가 그리고 목차와 내용을 정확하게 표시합니다.',
        'ru': 'Это русский текст для проверки кодировки. Название книги, автор, оглавление и содержание должны отображаться правильно. Читайте интересные книги каждый день.',
        'ar': 'هذا نص عربي لاختبار ترميز الحروف. عنوان الكتاب والمؤلف والفهرس والمحتوى يجب أن تظهر بشكل صحيح. القراءة مفيدة وممتعة للجميع.',
        'he': 'זהו טקסט בעברית לבדיקת קידוד תווים. שם הספר והמחבר ותוכן העניינים צריכים להופיע בצורה נכונה. קריאה היא פעילות חשובה ומעניינת.',
        'el': 'Αυτό είναι ένα ελληνικό κείμενο για τον έλεγχο της κωδικοποίησης. Ο τίτλος και ο συγγραφέας του βιβλίου εμφανίζονται σωστά. Η ανάγνωση είναι ευχάριστη.',
        'tr': 'Türkçe kitap okumak için bir metin. Yazarın adı, içindekiler ve bölüm başlıkları doğru görünmelidir. Güzel günlerde özgürce düşünmek önemlidir.',
        'en': 'This is a story about a reader and the books they read. The name of the author and the contents of the book should be shown correctly. It was a good day for reading.',
        'fr': 'Le titre du livre et le nom de son auteur doivent être affichés correctement. La lecture est une activité très agréable, avec des caractères accentués et une belle histoire.',
        'pl': 'To jest polski tekst do sprawdzania kodowania znaków. Tytuł książki i nazwisko autora powinny być wyświetlane prawidłowo. Czytanie książek jest bardzo przyjemne.',
    }
    encodings = {'zh': ['utf-8', 'gb18030', 'gbk', 'utf-16le', 'utf-16be', 'utf-32le', 'utf-32be'], 'zt': ['big5', 'utf-8'], 'ja': ['shift_jis', 'euc_jp', 'iso2022_jp'], 'ko': ['euc_kr', 'iso2022_kr'], 'ru': ['iso8859_5', 'cp1251', 'koi8_r'], 'ar': ['iso8859_6', 'cp1256'], 'he': ['iso8859_8', 'cp1255'], 'el': ['iso8859_7', 'cp1253'], 'tr': ['iso8859_9', 'cp1254'], 'en': ['ascii', 'utf-8'], 'fr': ['iso8859_1', 'cp1252'], 'pl': ['iso8859_2', 'cp1250']}
    for lang, codecs in encodings.items():
        for codec in codecs:
            for count in [1, 4, 80]:
                raw = (samples[lang] * count).encode(codec, errors='replace')
                add(f'{lang}/{codec}/{count}', raw)
                add(f'{lang}/{codec}/{count}/html', ('<html><head><title>Book</title></head><body><p>' + samples[lang] * count + '</p></body></html>').encode(codec, errors='replace'))
    declarations = [
        '<meta charset="GBK">', '<meta CHARSET=gb18030>', '<meta charset="Big5">',
        '<meta http-equiv="CONTENT-TYPE" content="text/html; charset=GBK">',
        '<meta http-equiv="content-type" content="GBK">', '<meta http-equiv="content-type" content="text/html;GBK">',
        '<meta charset=""><meta charset="GBK">', '<meta charset=" UTF-8 ">', '<meta charset="no-such-charset">',
        '<!-- <meta charset="Big5"> --><meta charset="GBK">', '<script>"<meta charset=Big5>"</script><meta charset=GBK>',
        '<template><meta charset=Big5></template><meta charset=GBK>', '<meta charset="G&#66;K">',
        '<meta charset="GBK" charset="UTF-8">', '<meta charset><meta charset="GBK">',
        '<meta http-equiv="content-type" content="text/html; CHARSET=GBK; extra=x">',
    ]
    for index, declaration in enumerate(declarations):
        for head in [f'<head>{declaration}</head>', f'<HEAD>{declaration}</HEAD>', f'<head lang="zh">{declaration}</head>', declaration]:
            add(f'meta/{index}/{len(cases)}', ('<html>' + head + '<body>' + samples['zh'] + '</body></html>').encode('gbk'))
    for raw in [b'', b'a', b'abc', b'abcd', bytes([0xef,0xbb,0xbf]), bytes([0xff,0xfe]), bytes([0xfe,0xff]), bytes([0,0,0xfe,0xff]), bytes([0xff,0xfe,0,0])]:
        add('boundary/' + raw.hex(), raw)
    add('short-GBK-without-declaration', '三体'.encode('gbk'))
    add('short-GBK-with-header', '三体'.encode('gbk'), 'text/plain; charset=GBK')
    for prefix in [b'', bytes([0xef,0xbb,0xbf]), bytes([0xff,0xfe]), bytes([0xfe,0xff])]:
        for raw in [samples['zh'].encode(), samples['zh'].encode('gbk'), b'<head><meta charset=GBK></head>' + samples['zh'].encode('gbk')]:
            for header in [None, 'text/html', 'text/html; charset=UTF-8', 'text/html; charset=GBK', 'text/html; charset=no-such-charset', 'text/html; charset="UTF-16LE"']:
                add('priority/' + str(len(cases)), prefix + raw, header)
    for charset in ['UTF-8', 'UTF-16LE', 'UTF-16BE', 'UTF-32LE', 'UTF-32BE', 'GBK', 'GB18030', 'Big5', 'Shift_JIS', 'EUC-JP', 'EUC-KR', 'ISO-2022-JP', 'ISO-2022-KR', 'ISO-2022-CN']:
        sequences = [bytes.fromhex(h) for h in ['eda080', 'edbfbf', 'e08080', 'f0808080', 'f4908080', 'c080', 'e2', 'e282', 'd8000061', '00d86100', '0000d8', '00000080', 'feff', 'fffe', '807f', '817f', '813081', '81308130', '1b244221211b2842', '1b2429430e21210f', '1b2429410e21210f', '1b2429470e21210f', '1b242a481b4e2121', '1b242b491b4f2121', '1b', '1b24', '1b2428442121', '1b284a5c7e', '0e21310f']]
        for i, raw in enumerate(sequences):
            add(f'explicit/{charset}/{i}', raw, 'text/plain; charset=' + charset)
    rng = random.Random(1321)
    for i in range(700):
        length = rng.choice([0,1,2,3,4,9,10,29,30,31,64,128,512,7999,8000,8001,8100])
        raw = bytes(rng.randrange(256) for _ in range(length))
        add('random/' + str(i), raw)
    for charset in ['UTF-8', 'UTF-16LE', 'UTF-16BE', 'UTF-32LE', 'UTF-32BE', 'GBK', 'GB18030', 'Big5', 'Shift_JIS', 'EUC-JP', 'EUC-KR', 'ISO-2022-JP', 'ISO-2022-KR', 'ISO-2022-CN']:
        for i in range(100):
            raw = bytes(rng.randrange(256) for _ in range(rng.randrange(1, 90)))
            add(f'bytes/{charset}/{i}', raw, 'text/plain; charset=' + charset)
    for charset in ['ISO-2022-JP', 'ISO-2022-KR', 'ISO-2022-CN']:
        escapes = [bytes(row['bytes']) for row in escape_tables(args.icu_2022_source) if row['terminal']]
        for i in range(180):
            parts = escapes + [b'A', b'\x0e', b'\x0f', b'\r', b'\n', b'!!', b'\xff', b'\x1b', b'\x7f', b'\x80', b'!\x1b']
            raw = b''.join(rng.choice(parts) for _ in range(rng.randrange(1, 14)))
            add(f'iso-state/{charset}/{i}', raw, 'text/plain; charset=' + charset)
    for header in ['text/html;charset=GBK', ' text/html; charset=GBK', 'text/html ; charset=GBK', 'text/html; charset =GBK', 'text/html; charset=GBK; charset=UTF-8', "text/html; charset='GBK'", 'text/html; charset="GBK"x', 'text/html; charset=""; charset=GBK', 'text/html; charset=ISO-8859-8-I', 'broken; charset=GBK', 'text/html; ; charset=GBK', 'text/html; charset=no-such-charset', 'text/html;\u00a0charset=UTF-8', 'text/html;\u2028charset=UTF-8', 'text/html; charset=UTF-8; charset=GBK']:
        add('header/' + str(len(cases)), ('<head><meta charset=GBK></head>' + samples['zh']).encode('gbk'), header)
    add('http/search', json.dumps([{'name': 'iOS 编码验收', 'author': '本机验收', 'url': '/book', 'intro': samples['zh'] * 8 + '𠮷'}], ensure_ascii=False).encode('gb18030'), 'application/json')
    add('http/info', '<html><head><meta http-equiv="content-type" content="text/html; charset=GBK"></head><body><h1>iOS 编码验收</h1><div class="author">本机验收</div><p class="intro">GBK 声明的书籍详情，文字编码正确。</p><a class="toc" href="/toc">目录</a></body></html>'.encode('gbk'), 'text/html')
    add('http/toc', '<html><head><title>目次</title></head><body><ul><li><a href="/chapter/1">第一章 日本語</a></li><li><a href="/chapter/2">第二章 文字</a></li></ul></body></html>'.encode('iso2022_jp'), 'text/html')
    add('http/content', ('<html><head><meta charset=GBK></head><body><div id="content"><p>第一章 日本語</p><p>正文编码验收：𠮷。响应头 UTF-16LE 应覆盖相冲突的 GBK 声明。</p>' + '<p>阅读书屋，西游记，吴承恩。目录和正文的中文、日文都应准确显示。</p>' * 8 + '</div></body></html>').encode('utf-16le'), 'text/html; charset=UTF-16LE')
    runner = r'''package io.legado.app.lib.icu4j;
import io.legado.app.utils.EncodingDetect;
import io.legado.app.utils.Utf8BomUtils;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.nio.file.*;
public class ResponseOracle {
 public static void main(String[] args) throws Exception {
  for(String line: Files.readAllLines(Path.of(args[0]))) {
   String[] f=line.split("\t",-1); byte[] original=Base64.getDecoder().decode(f[0]);
   StringBuilder matches=new StringBuilder();
   for(CharsetMatch m:new CharsetDetector().setText(original).detectAll()) {
    if(matches.length()>0) matches.append(';');
    matches.append(m.getName()).append(',').append(m.getConfidence()).append(',').append(m.getLanguage()==null?"":m.getLanguage());
   }
   String html=EncodingDetect.INSTANCE.getHtmlEncode(original);
   byte[] raw=Utf8BomUtils.INSTANCE.removeUTF8BOM(original);
   String selected;
   String header=new String(Base64.getDecoder().decode(f[1]),StandardCharsets.UTF_8);
   okhttp3.MediaType media=okhttp3.MediaType.parse(header);
   String headerName=media==null?"":media.parameter("charset");if(headerName==null)headerName="";
   Charset charset=media==null?null:media.charset();
   selected=charset!=null?charset.name():EncodingDetect.INSTANCE.getHtmlEncode(raw);
   String result;
   try { result="ok:"+Base64.getEncoder().encodeToString(new String(raw,Charset.forName(selected)).getBytes(StandardCharsets.UTF_16LE)); }
   catch(Exception error) { result="error:"+error.getClass().getSimpleName(); }
   System.out.println(matches+"\t"+Base64.getEncoder().encodeToString(html.getBytes(StandardCharsets.UTF_8))+"\t"+Base64.getEncoder().encodeToString(selected.getBytes(StandardCharsets.UTF_8))+"\t"+result+"\t"+Base64.getEncoder().encodeToString(headerName.getBytes(StandardCharsets.UTF_8))+"\t"+Base64.getEncoder().encodeToString(EncodingDetect.INSTANCE.getHtmlEncode(raw).getBytes(StandardCharsets.UTF_8)));
  }
 }
}
'''
    stubs = {
        'androidx/annotation/NonNull.java': 'package androidx.annotation; public @interface NonNull {}',
        'androidx/annotation/Nullable.java': 'package androidx.annotation; public @interface Nullable {}',
        'android/os/ParcelFileDescriptor.java': 'package android.os; public class ParcelFileDescriptor { public java.io.FileDescriptor getFileDescriptor(){throw new UnsupportedOperationException();} }',
        'android/system/OsConstants.java': 'package android.system; public class OsConstants { public static final int SEEK_SET=0; }',
        'android/system/Os.java': 'package android.system; public class Os { public static long lseek(java.io.FileDescriptor f,long o,int w){throw new UnsupportedOperationException();} public static int read(java.io.FileDescriptor f,byte[] b,int o,int n){throw new UnsupportedOperationException();} }',
        'android/text/TextUtils.java': 'package android.text; public class TextUtils { public static boolean isEmpty(CharSequence s){return s==null || s.length()==0;} }',
    }
    with tempfile.TemporaryDirectory(prefix='legado-encoding-') as temporary:
        folder = pathlib.Path(temporary)
        stub_paths = []
        for path, text in stubs.items():
            dest = folder / path; dest.parent.mkdir(parents=True, exist_ok=True); dest.write_text(text); stub_paths.append(str(dest))
        classes = folder / 'classes'; classes.mkdir()
        subprocess.run(['javac', '-d', str(classes), *stub_paths, *map(str, sorted(icu.glob('*.java')))], check=True, capture_output=True, text=True)
        stdlib = next(args.kotlin_lib.glob('kotlin-stdlib-[0-9]*.jar'))
        classpath = f'{classes}:{stdlib}:{args.jsoup_jar.resolve()}'
        with zipfile.ZipFile(args.okhttp_sources) as archive:
            media_source = archive.read('commonJvmAndroid/okhttp3/MediaType.kt')
        (folder / 'MediaType.kt').write_bytes(media_source)
        subprocess.run(['java', '-cp', f'{args.kotlin_lib.resolve()}/*', 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler', '-no-stdlib', '-no-reflect', '-classpath', classpath, '-d', str(classes), *map(str, paths[-3:]), str(folder / 'MediaType.kt')], check=True, capture_output=True, text=True)
        (folder / 'ResponseOracle.java').write_text(runner)
        subprocess.run(['javac', '-cp', classpath, '-d', str(classes), str(folder / 'ResponseOracle.java')], check=True, capture_output=True, text=True)
        compile_icu(args.icu_root, 'icu-converter-tables', folder / 'icu-tables')
        with (folder / 'mapping.json').open('w') as output:
            subprocess.run([str(folder / 'icu-tables')], stdout=output, check=True)
        converters = json.loads((folder / 'mapping.json').read_text())
        converters['escapes'] = escape_tables(args.icu_2022_source)
        args.decoder_output.write_text(json.dumps(converters, ensure_ascii=False, separators=(',', ':')) + '\n')
        compile_icu(args.icu_root, 'icu-response-reference', folder / 'icu-reference')
        (folder / 'cases.tsv').write_text('\n'.join(c['base64'] + '\t' + base64.b64encode((c['contentType'] or '').encode()).decode() for c in cases) + '\n')
        result = subprocess.run(['java', '-cp', classpath, 'io.legado.app.lib.icu4j.ResponseOracle', str(folder / 'cases.tsv')], check=True, capture_output=True, text=True)
        rows = result.stdout.splitlines(); assert len(rows) == len(cases)
        headers = []
        for case, row in zip(cases, rows):
            matches, html, selected, decoded, header, after_bom = row.split('\t')
            case['matches'] = [{'name': name, 'confidence': int(confidence), 'lang': lang or None} for name, confidence, lang in (m.split(',') for m in matches.split(';'))] if matches else []
            case['htmlCharset'] = base64.b64decode(html).decode()
            case['jdkSelectedCharset'] = base64.b64decode(selected).decode()
            case['jdkDecodedSha256'] = hashlib.sha256(base64.b64decode(decoded[3:])).hexdigest() if decoded.startswith('ok:') else None
            case['jdkError'] = None if decoded.startswith('ok:') else decoded[6:]
            headers.append((base64.b64decode(header).decode(), base64.b64decode(after_bom).decode()))
        names = sorted(set(header for header, _ in headers if re.fullmatch('[A-Za-z0-9][A-Za-z0-9._:+-]*', header)))
        probe = subprocess.run([str(folder / 'icu-reference')], input=''.join(name+'\t\n' for name in names), capture_output=True, text=True, check=True)
        supported = {name for name, value in zip(names, probe.stdout.splitlines()) if not value.startswith('error:')}
        inputs = []
        for case, (header, after_bom) in zip(cases, headers):
            selected = header if header in supported else after_bom
            case['headerCharset'] = header if header in supported else None
            case['selectedCharset'] = selected
            raw = base64.b64decode(case['base64'])
            if len(raw) > 3 and raw.startswith(bytes.fromhex('efbbbf')): raw = raw[3:]
            inputs.append(selected+'\t'+raw.hex())
        decoded = subprocess.run([str(folder / 'icu-reference')], input='\n'.join(inputs)+'\n', capture_output=True, text=True, check=True)
        values = decoded.stdout.splitlines(); assert len(values) == len(cases)
        for case, value in zip(cases, values):
            valid_name = re.fullmatch('[A-Za-z0-9][A-Za-z0-9._:+-]*', case['selectedCharset'])
            case['icuError'] = 'InvalidCharsetName' if not valid_name else value if value.startswith('error:') else None
            text = None if case['icuError'] else bytes.fromhex(value).decode('utf-16be', errors='surrogatepass')
            case['icuDecoded'] = text if text is not None and len(text) <= 1000 else None
            case['icuDecodedSha256'] = None if text is None else hashlib.sha256(text.encode('utf-16le', errors='surrogatepass')).hexdigest()
        icu_version = decoded.stderr.strip()
    digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
    output = {'sources': [{'path': str(p.relative_to(args.source_root)), 'sha256': digest(p)} for p in paths], 'tablesSha256': digest(args.tables_output), 'decoderTablesSha256': digest(args.decoder_output), 'jsoupVersion': '1.16.2', 'jsoupSha256': digest(args.jsoup_jar), 'javaVersion': subprocess.check_output(['java', '-version'], stderr=subprocess.STDOUT, text=True), 'icuVersion': icu_version, 'icuReplacement': 'Java CharsetDecoder U+FFFD callback', 'icuSourceSha256': digest(args.icu_2022_source), 'mediaTypeSourceSha256': hashlib.sha256(media_source).hexdigest(), 'okhttpVersion': '5.4.0', 'adaptations': ['Android file-descriptor APIs are throwing boundary stubs; byte-array methods unchanged', 'Unchanged source-pinned OkHttp MediaType parser; ICU support/decoding provided by the separate ICU 77.1 reference', 'JVM decoding digests are diagnostic only; source Android uses ICU and no Android runtime is tested', 'Frozen ICU 77.1 converter profile; other OS ICU versions remain an acceptance boundary'], 'cases': cases}
    args.output.write_text(json.dumps(output, ensure_ascii=True, indent=2) + '\n')
    print(json.dumps({'cases': len(cases), 'tableBytes': args.tables_output.stat().st_size}))


if __name__ == '__main__':
    main()
