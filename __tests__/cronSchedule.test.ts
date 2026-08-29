import { CronSchedule } from '../src/core/cronSchedule';

describe('five-field Cron schedule',()=>{
  test('parses Android-compatible lists, ranges and steps',()=>{const schedule=CronSchedule.parse('*/15 8-10 * * 1,3,5');expect(schedule).toBeDefined();const monday=new Date(2026,7,31,7,59,20).getTime();expect(schedule?.nextTimeAfter(monday)).toBe(new Date(2026,7,31,8,0).getTime())});
  test('maps Sunday 7 to zero',()=>{const schedule=CronSchedule.parse('0 9 * * 7');const saturday=new Date(2026,7,29,12,0).getTime();expect(schedule?.nextTimeAfter(saturday)).toBe(new Date(2026,7,30,9,0).getTime())});
  test('uses cron OR semantics when both day fields are restricted',()=>{const schedule=CronSchedule.parse('0 9 1 * 1');const sunday=new Date(2026,7,30,12,0).getTime();expect(schedule?.nextTimeAfter(sunday)).toBe(new Date(2026,7,31,9,0).getTime())});
  test.each(['* * *','60 * * * *','*/0 * * * *','* * ? * *'])('rejects %s',value=>expect(CronSchedule.parse(value)).toBeUndefined());
});
