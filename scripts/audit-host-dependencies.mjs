import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

// Build tooling runs on the developer machine and is not loaded by the mini-app.
const buildOnly = new Set(['@htyf-mp/cli']);
const [appPath, hostPath, sourcePath] = process.argv.slice(2);
if (!appPath || !hostPath) {
  console.error('Usage: node scripts/audit-host-dependencies.mjs <mini-app package.json> <HTYF host package.json> [source directory]');
  process.exitCode = 2;
} else {
  try {
    const app = JSON.parse(await readFile(appPath, 'utf8'));
    const host = JSON.parse(await readFile(hostPath, 'utf8'));
    const provided = new Set(Object.keys(host.dependencies ?? {}));
    const used = new Set(Object.keys(app.dependencies ?? {}));
    // Also report direct imports of undeclared transitive packages. This is a
    // conservative text scan; it is not a substitute for a final bundle audit.
    const scan = async directory => {
      for (const entry of await readdir(directory, {withFileTypes: true})) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await scan(path);
        else if (entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name)) {
          const text = await readFile(path, 'utf8');
          const imports = /^\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/gm;
          const requires = /\b(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
          for (const match of [...text.matchAll(imports), ...text.matchAll(requires)]) {
            const name = match[1];
            if (name.startsWith('.') || name.startsWith('/') || name.startsWith('node:')) continue;
            const parts = name.split('/');
            used.add(name.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]);
          }
        }
      }
    };
    if (sourcePath) await scan(sourcePath);
    const missing = [...used].filter(name => !buildOnly.has(name) && !provided.has(name)).sort();
    console.log(JSON.stringify({missing}, null, 2));
    if (missing.length) process.exitCode = 1;
  } catch (error) {
    console.error(`Dependency audit failed: ${error.message}`);
    process.exitCode = 2;
  }
}
