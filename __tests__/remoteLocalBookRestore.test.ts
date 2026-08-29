jest.mock('@dr.pogodin/react-native-fs',()=>({unlink:jest.fn()}));
jest.mock('../src/data/backupPreferences',()=>({loadBackupPreferences:()=>({webDavBookAutoRestore:false})}));
jest.mock('../src/data/remoteBackup',()=>({loadWebDavConfig:jest.fn()}));
jest.mock('../src/data/txtTocRules',()=>({loadTxtTocRules:()=>[]}));
jest.mock('../src/core/localBookImport',()=>({importSupportedBook:jest.fn()}));
jest.mock('../src/core/remoteBooks',()=>({downloadRemoteBook:jest.fn(),listRemoteBooks:jest.fn()}));
import { localBookNeedsRemoteRestore, restoreRemoteLocalBook } from '../src/core/remoteLocalBookRestore';
const book={id:'local',name:'Book',author:'',intro:'',chapterTitle:'',content:'',chapters:[],progress:0,updatedAt:1,origin:'local',originName:'Book.txt'};
test('remote local-book restore is limited to missing-content local books',async()=>{expect(localBookNeedsRemoteRestore(book)).toBe(true);expect(localBookNeedsRemoteRestore({...book,content:'ready'})).toBe(false);expect(localBookNeedsRemoteRestore({...book,origin:'https://source'})).toBe(false);await expect(restoreRemoteLocalBook(book)).resolves.toBeNull()});
