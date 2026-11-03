const { spawnSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const audit = join(__dirname, '../scripts/audit-host-dependencies.mjs');

test('reports dependencies absent from the HTYF host and fails the audit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'host-deps-'));
  try {
    const app = join(dir, 'app.json'), host = join(dir, 'host.json');
    writeFileSync(app, JSON.stringify({dependencies:{'@htyf-mp/cli':'0.5.8','react-native-quick-crypto':'1.1.6','js-interpreter':'6.0.2'}}));
    writeFileSync(host, JSON.stringify({dependencies:{'react-native-quick-crypto':'1.1.7'}}));
    const result = spawnSync(process.execPath, [audit, app, host], {encoding:'utf8'});
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toEqual({missing:['js-interpreter']});
  } finally { rmSync(dir, {recursive:true, force:true}); }
});

test('passes when every runtime dependency is present in the host', () => {
  const dir = mkdtempSync(join(tmpdir(), 'host-deps-'));
  try {
    const app = join(dir, 'app.json'), host = join(dir, 'host.json');
    writeFileSync(app, JSON.stringify({dependencies:{'@htyf-mp/cli':'0.5.8','cheerio':'1.2.0'}}));
    writeFileSync(host, JSON.stringify({dependencies:{'cheerio':'1.2.0'}}));
    const result = spawnSync(process.execPath, [audit, app, host], {encoding:'utf8'});
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({missing:[]});
  } finally { rmSync(dir, {recursive:true, force:true}); }
});

test('also catches direct imports of undeclared transitive packages', () => {
  const { mkdirSync } = require('node:fs');
  const dir = mkdtempSync(join(tmpdir(), 'host-deps-'));
  try {
    const app = join(dir, 'app.json'), host = join(dir, 'host.json'), src = join(dir, 'src');
    mkdirSync(src);
    writeFileSync(app, JSON.stringify({dependencies:{}}));
    writeFileSync(host, JSON.stringify({dependencies:{}}));
    writeFileSync(join(src, 'source.ts'), `import { Node } from 'domhandler';\nimport type { Thing } from 'types-only';`);
    const result = spawnSync(process.execPath, [audit, app, host, src], {encoding:'utf8'});
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).missing).toEqual(['domhandler']);
  } finally { rmSync(dir, {recursive:true, force:true}); }
});

test('source code does not directly require the undeclared domhandler package', () => {
  const dir = mkdtempSync(join(tmpdir(), 'host-deps-'));
  try {
    const host = join(dir, 'host.json');
    const appPath = join(__dirname, '../package.json');
    const sourcePath = join(__dirname, '../src');
    const app = require('../package.json');
    writeFileSync(host, JSON.stringify({dependencies:app.dependencies}));
    const result = spawnSync(process.execPath, [audit, appPath, host, sourcePath], {encoding:'utf8'});
    expect(JSON.parse(result.stdout).missing).not.toContain('domhandler');
  } finally { rmSync(dir, {recursive:true, force:true}); }
});

test('book rule code does not directly depend on css-select', () => {
  const dir = mkdtempSync(join(tmpdir(), 'host-deps-'));
  try {
    const host = join(dir, 'host.json');
    const appPath = join(__dirname, '../package.json');
    const app = require('../package.json');
    const dependencies = {...app.dependencies, cheerio:'1.2.0'};
    delete dependencies['css-select'];
    writeFileSync(host, JSON.stringify({dependencies}));
    const result = spawnSync(process.execPath, [audit, appPath, host, join(__dirname, '../src')], {encoding:'utf8'});
    expect(JSON.parse(result.stdout).missing).not.toContain('css-select');
  } finally { rmSync(dir, {recursive:true, force:true}); }
});

test('book rule code does not directly depend on htmlparser2', () => {
  const dir = mkdtempSync(join(tmpdir(), 'host-deps-'));
  try {
    const host = join(dir, 'host.json');
    const appPath = join(__dirname, '../package.json');
    const app = require('../package.json');
    const dependencies = {...app.dependencies};
    delete dependencies.htmlparser2;
    writeFileSync(host, JSON.stringify({dependencies}));
    const result = spawnSync(process.execPath, [audit, appPath, host, join(__dirname, '../src')], {encoding:'utf8'});
    expect(JSON.parse(result.stdout).missing).not.toContain('htmlparser2');
  } finally { rmSync(dir, {recursive:true, force:true}); }
});

test('book rule code does not directly depend on parse5 tree adapter', () => {
  const dir = mkdtempSync(join(tmpdir(), 'host-deps-'));
  try {
    const host = join(dir, 'host.json');
    const appPath = join(__dirname, '../package.json');
    const app = require('../package.json');
    const dependencies = {...app.dependencies};
    delete dependencies['parse5-htmlparser2-tree-adapter'];
    writeFileSync(host, JSON.stringify({dependencies}));
    const result = spawnSync(process.execPath, [audit, appPath, host, join(__dirname, '../src')], {encoding:'utf8'});
    expect(JSON.parse(result.stdout).missing).not.toContain('parse5-htmlparser2-tree-adapter');
  } finally { rmSync(dir, {recursive:true, force:true}); }
});

test('book rule code does not directly depend on parse5', () => {
  const dir = mkdtempSync(join(tmpdir(), 'host-deps-'));
  try {
    const host = join(dir, 'host.json');
    const appPath = join(__dirname, '../package.json');
    const dependencies = {...require('../package.json').dependencies};
    delete dependencies.parse5;
    writeFileSync(host, JSON.stringify({dependencies}));
    const result = spawnSync(process.execPath, [audit, appPath, host, join(__dirname, '../src')], {encoding:'utf8'});
    expect(JSON.parse(result.stdout).missing).not.toContain('parse5');
  } finally { rmSync(dir, {recursive:true, force:true}); }
});

test('runtime code no longer directly depends on iconv-lite', () => {
  const dir = mkdtempSync(join(tmpdir(), 'host-deps-'));
  try {
    const host = join(dir, 'host.json');
    const appPath = join(__dirname, '../package.json');
    const dependencies = {...require('../package.json').dependencies};
    delete dependencies['iconv-lite'];
    writeFileSync(host, JSON.stringify({dependencies}));
    const result = spawnSync(process.execPath, [audit, appPath, host, join(__dirname, '../src')], {encoding:'utf8'});
    expect(JSON.parse(result.stdout).missing).not.toContain('iconv-lite');
  } finally { rmSync(dir, {recursive:true, force:true}); }
});
