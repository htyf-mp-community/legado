// Differential probe for the Java translation of the original chapter helpers.
const fs = require('fs');
const os = require('os');
const path = require('path');
const {execFileSync} = require('child_process');
const root = path.resolve(__dirname, '../../../..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'legado-chapter-reference-'));
try {
  execFileSync('javac', ['-d', work, path.join(__dirname, 'Reference.java')]);
  execFileSync(path.join(root, 'node_modules/.bin/tsc'), ['--ignoreConfig', path.join(root, 'src/core/sourceChapterNumber.ts'), '--outDir', work, '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck']);
  const {sourceChapterNumber} = require(path.join(work, 'sourceChapterNumber.js'));
  const cases = [];
  for (let c = 0; c < 65536; c++) if (c < 0xd800 || c > 0xdfff) cases.push('前第' + String.fromCharCode(c) + '章后');
  let seed = 4567;
  const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0);
  const chars = '零一二三四五六七八九十〇壹贰叁肆伍陆柒捌玖拾两百佰千仟万亿０１２３４５６７８９0123456789-+ 章第\n\u0085\u2028';
  for (let j = 0; j < 25000; j++) {
    const n = random() % 18;
    let input = '前第';
    for (let i = 0; i < n; i++) input += chars[random() % chars.length];
    cases.push(input + '章尾');
  }
  const input = cases.map(value => Buffer.from(value).toString('base64')).join('\n') + '\n';
  const output = execFileSync('java', ['-cp', work, 'Reference'], {input, maxBuffer: 30000000, encoding: 'utf8'}).trimEnd().split('\n');
  const mismatches = [];
  for (let i = 0; i < cases.length; i++) {
    const expected = Buffer.from(output[i], 'base64').toString();
    const actual = sourceChapterNumber(cases[i]);
    if (actual !== expected && mismatches.length < 12) mismatches.push({input: cases[i], expected, actual});
  }
  console.log(JSON.stringify({cases: cases.length, mismatches}, null, 2));
  if (mismatches.length) process.exitCode = 1;
} finally {
  fs.rmSync(work, {recursive: true, force: true});
}
