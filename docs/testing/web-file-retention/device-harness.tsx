import React, { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { exists, readFile } from '@dr.pogodin/react-native-fs';
import { prepareWebFile } from '../../../src/core/webFileImport';
import { importSupportedBook } from '../../../src/core/localBookImport';
import type { BookSource, SearchBook } from '../../../src/types';

const base = 'http://127.0.0.1:18216';
const source: BookSource = {
  bookSourceUrl: base,
  bookSourceName: '本地文件验证',
  bookSourceType: 3,
  customOrder: 0,
  enabled: true,
  enabledExplore: false,
  header: '{"X-Legado-Fixture":"allowed"}',
};
const input: SearchBook = {
  bookUrl: `${base}/detail`,
  origin: base,
  originName: source.bookSourceName,
  name: '文件保留验证',
  author: '测试作者',
};
export default function DeviceHarness() {
  const [status, setStatus] = useState('STARTING');
  useEffect(() => {
    void (async () => {
      const lines: string[] = [];
      try {
        for (const ext of ['epub', 'mobi']) {
          const prepared = await prepareWebFile(
            source,
            input,
            `${base}/native.${ext}`,
          );
          const book = await prepared.importFile(prepared.files[0], []);
          await prepared.dispose();
          const uri = book.localUri || book.bookUrl;
          if (!uri || !book.content.includes('模拟器文件保留验证'))
            throw new Error(`${ext}: missing content or URI`);
          const path = decodeURIComponent(uri.replace(/^file:\/\//, ''));
          if (!(await exists(path)))
            throw new Error(`${ext}: retained file missing after import`);
          const original = await readFile(path, 'base64');
          const reopened = await importSupportedBook(uri, `native.${ext}`, []);
          if (
            !reopened.content.includes('模拟器文件保留验证') ||
            !(await exists(path)) ||
            (await readFile(path, 'base64')) !== original
          )
            throw new Error(`${ext}: failed to reopen retained file`);
          lines.push(`${ext.toUpperCase()} PASS 下载 导入 保留 重开`);
          setStatus(lines.join('\n'));
        }
        setStatus(`${lines.join('\n')}\nALL PASS`);
      } catch (error) {
        setStatus(
          `${lines.join('\n')}\nFAIL ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    })();
  }, []);
  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: 90, paddingHorizontal: 20 }}
    >
      <Text accessibilityLabel="文件源原生验证" style={{ fontSize: 22 }}>
        文件源原生验证
      </Text>
      <Text accessibilityLabel={status} style={{ fontSize: 19, marginTop: 24 }}>
        {status}
      </Text>
    </ScrollView>
  );
}
