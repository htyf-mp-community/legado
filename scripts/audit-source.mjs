import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 审计快照不代表迁移通过；只有逐项验收后才能建立 source-state.json 基线。
const target = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.dirname(target);
const state = path.join(target, '.htyf-migration');
const git = (...args) => execFileSync('git', args, { cwd: source, encoding: 'utf8' }).trim();
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const eligible = name => !/^(?:htyf|node_modules|build|\.git)(?:\/|$)/i.test(name)
  && !/(?:^|\/)(?:node_modules|build|\.gradle|\.godot)(?:\/|$)/.test(name);
const names = [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: source, encoding: 'utf8' })
  .split('\0').filter(name => name && eligible(name)))].sort();
const files = names.filter(name => fs.existsSync(path.join(source, name)))
  .map(name => ({ path: name, sha256: digest(fs.readFileSync(path.join(source, name))) }));
const snapshot = {
  schema: 1, purpose: 'unverified-source-audit', verified: false,
  sourcePath: source, targetPath: target, sourceCommit: git('rev-parse', 'HEAD'),
  sourceBranch: git('branch', '--show-current'), sourceRemote: git('remote', 'get-url', 'origin'),
  sourceWorkingTree: git('status', '--short'),
  projectType: 'Android Kotlin application', template: 'app',
  targetReuse: 'Existing independent HTYF repository; HTYF and htyf resolve to the same inode on this filesystem.',
  templateRevision: 'unknown: existing target has no recorded initialization provenance',
  targetCommitAtAudit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: target, encoding: 'utf8' }).trim(),
  manifestSha256: digest(JSON.stringify(files)), files,
};
fs.mkdirSync(state, { recursive: true });
const baselinePath = path.join(state, 'source-audit.json');
if (process.argv.includes('--verify')) {
  const previous = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const old = new Map(previous.files.map(file => [file.path, file.sha256]));
  const next = new Map(files.map(file => [file.path, file.sha256]));
  const changed = [...new Set([...old.keys(), ...next.keys()])].filter(name => old.get(name) !== next.get(name));
  if (snapshot.sourceCommit !== previous.sourceCommit || changed.length) {
    console.error(JSON.stringify({ sourcePreserved: false, changed, commitChanged: snapshot.sourceCommit !== previous.sourceCommit }, null, 2));
    process.exitCode = 1;
  } else console.log(`Source preserved: ${files.length} files, ${snapshot.manifestSha256}`);
} else {
  if (fs.existsSync(baselinePath)) throw new Error('Source audit already exists; use --verify. Do not replace an unverified baseline.');
  fs.writeFileSync(baselinePath, `${JSON.stringify(snapshot, null, 2)}\n`);
  const manifest = fs.readFileSync(path.join(source, 'app/src/main/AndroidManifest.xml'), 'utf8');
  const activities = [...manifest.matchAll(/<activity\b[^>]*android:name="([^"]+)"/g)].map(match => match[1]);
  const services = [...manifest.matchAll(/<(?:service|receiver|provider)\b[^>]*android:name="([^"]+)"/g)].map(match => match[1]);
  const section = (title, items) => `## ${title}\n\n${items.map(name => `- [ ] \`${name}\``).join('\n')}\n\n`;
  const resources = files.filter(file => /app\/src\/main\/(?:assets|res)\//.test(file.path));
  fs.writeFileSync(path.join(state, 'source-entrypoints.md'), `# Source entry points / 源入口\n\nGenerated from source ${snapshot.sourceCommit}. An unchecked item has not passed target-host parity acceptance.\n\n`
    + section('Activities', activities) + section('Services, receivers and providers', services)
    + section('Dialogs, sheets and popups', files.filter(file => /app\/src\/main\/java\/.*(?:Dialog|Sheet|Popup)\.kt$/.test(file.path)).map(file => file.path))
    + section('Preference definitions', files.filter(file => /app\/src\/main\/res\/xml\/.*\.xml$/.test(file.path)).map(file => file.path))
    + section('Data entities', files.filter(file => /app\/src\/main\/java\/io\/legado\/app\/data\/entities\/.*\.kt$/.test(file.path)).map(file => file.path))
    + `## Assets and layouts\n\n${resources.length} files are hashed individually in source-audit.json. No visual state has been accepted based on file presence.\n`);
  fs.writeFileSync(path.join(state, 'target-before.patch'), execFileSync('git', ['diff', '--binary'], { cwd: target }));
  console.log(`Audited ${files.length} source files, ${activities.length} activities, ${services.length} platform entry points, ${resources.length} assets/resources.`);
}
