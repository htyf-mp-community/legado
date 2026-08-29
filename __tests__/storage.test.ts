jest.mock('react-native-mmkv',()=>({createMMKV:()=>({getString:jest.fn(),set:jest.fn()})}));

import{APP_STORAGE_ID,appStorage}from'../src/data/storage';

test('creates one dedicated Legado HTYF storage namespace',()=>{
  expect(APP_STORAGE_ID).toBe('io.legado.htyf.application-storage');
  expect(appStorage).toBeDefined();
});
