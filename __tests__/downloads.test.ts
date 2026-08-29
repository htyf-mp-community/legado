jest.mock('react-native-mmkv',()=>({createMMKV:()=>({getString:jest.fn(),set:jest.fn(),remove:jest.fn()})}));
import{normalizeDownload}from'../src/data/downloads';
test('normalizes persisted download progress and state',()=>expect(normalizeDownload({progress:2,state:'unknown' as never,title:'x'})).toMatchObject({progress:1,state:'queued',title:'x'}));
