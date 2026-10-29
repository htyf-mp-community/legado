import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

// 采用当前宿主 /share?data= 协议，仅序列化公开启动配置，不携带任何本地存储内容。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { htyf } = JSON.parse(
  await fs.readFile(path.join(root, 'app.json'), 'utf8'),
);
const publicConfig = Object.fromEntries(
  [
    'type',
    'entry',
    'version',
    'name',
    'appid',
    'rotate',
    'appUrlConfig',
    'zipUrl',
    'projectname',
    'icon',
    'engines',
  ]
    .filter(key => htyf[key] !== undefined)
    .map(key => [key, htyf[key]]),
);
// 官方 CLI build.mjs 为当前宿主协议固定补充 engines: '2.0.0'。
publicConfig.engines = '2.0.0';
const shareUrl = `https://mp.dagouzhi.com/share?data=${encodeURIComponent(JSON.stringify(publicConfig))}`;
const assets = path.join(root, 'docs/assets');
await fs.mkdir(assets, { recursive: true });
await QRCode.toFile(path.join(assets, 'htyf-share-qr.png'), shareUrl, {
  scale: 6,
  margin: 4,
});
await fs.writeFile(path.join(assets, 'htyf-share-url.txt'), `${shareUrl}\n`);
const readmePath = path.join(root, 'README.md');
const readme = await fs.readFile(readmePath, 'utf8');
await fs.writeFile(
  readmePath,
  readme.replace(
    /(\*\*\[配置分享入口 \/ Configured share entry\]\()[^)]*(\)\*\*)/,
    `$1${shareUrl}$2`,
  ),
);
console.log(shareUrl);
