jest.mock('react-native-mmkv',()=>({createMMKV:()=>({getString:jest.fn(),set:jest.fn()})}));
import { autoTaskLoginConfig, parseAutoTaskHeaders } from '../src/core/autoTaskLogin';
import { normalizeAutoTask } from '../src/data/autoTasks';

test('parses JSON and line-based task login headers',()=>{expect(parseAutoTaskHeaders('{"User-Agent":"Legado","X-Id":2}')).toEqual({'User-Agent':'Legado','X-Id':'2'});expect(parseAutoTaskHeaders('User-Agent: Legado\nX-Id: 2')).toEqual({'User-Agent':'Legado','X-Id':'2'})});
test('builds an isolated task login identity and flags JS checks',()=>{const task=normalizeAutoTask({id:'sign',name:'Sign in',cron:'0 8 * * *',script:'{}',loginUrl:' https://example.test/login ',loginCheckJs:'cookie'});expect(autoTaskLoginConfig(task)).toEqual({id:'auto_task:sign',name:'Sign in',url:'https://example.test/login',headers:{},hasUnsupportedCheck:true})});
