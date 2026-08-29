import { unlink } from '@dr.pogodin/react-native-fs';
import { loadBackupPreferences } from '../data/backupPreferences';
import { loadWebDavConfig } from '../data/remoteBackup';
import { loadTxtTocRules } from '../data/txtTocRules';
import type { Book } from '../types';
import { importSupportedBook } from './localBookImport';
import { downloadRemoteBook, listRemoteBooks } from './remoteBooks';

export function localBookNeedsRemoteRestore(book:Book){return book.origin==='local'&&!book.content&&!(book.chapters??[]).some(chapter=>Boolean(chapter.content))}
export async function restoreRemoteLocalBook(book:Book){if(!loadBackupPreferences().webDavBookAutoRestore||!localBookNeedsRemoteRestore(book))return null;const fileName=book.originName?.trim();if(!fileName)return null;const config=loadWebDavConfig(),entry=(await listRemoteBooks(config)).find(item=>!item.isDirectory&&item.name.normalize('NFC')===fileName.normalize('NFC'));if(!entry)return null;const downloaded=await downloadRemoteBook(config,entry);try{const restored=await importSupportedBook(downloaded.uri,entry.name,loadTxtTocRules(),book.charset);return{...restored,id:book.id,name:book.name||restored.name,author:book.author||restored.author,intro:book.intro||restored.intro,coverUrl:book.coverUrl,groupIds:book.groupIds,currentChapterIndex:Math.min(book.currentChapterIndex??0,Math.max(0,(restored.chapters?.length??1)-1)),progress:book.progress,updatedAt:Date.now()}}finally{try{await unlink(downloaded.path)}catch{}}}
