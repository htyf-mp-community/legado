const mockValues=new Map<string,string>();jest.mock('react-native-mmkv',()=>({createMMKV:()=>({getString:(key:string)=>mockValues.get(key),set:(key:string,value:string)=>mockValues.set(key,value),remove:(key:string)=>mockValues.delete(key)})}));
import { addAppLog, clearAppLogs, exportAppLogs, loadAppLogs } from '../src/data/appLog';
beforeEach(()=>mockValues.clear());
test('stores, exports and clears application logs',()=>{addAppLog('started');addAppLog('failed',new Error('boom'));expect(loadAppLogs()).toHaveLength(2);expect(exportAppLogs()).toContain('boom');clearAppLogs();expect(loadAppLogs()).toEqual([])});
test('bounds retained logs',()=>{for(let index=0;index<205;index++)addAppLog(String(index));expect(loadAppLogs()).toHaveLength(200);expect(loadAppLogs()[0].message).toBe('5')});
