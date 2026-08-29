type CronField = { allowed: boolean[]; startsWithStar: boolean };

function parseField(text: string, min: number, max: number, sunday = false): CronField | undefined {
  if (!text || text.includes('?')) return;
  const allowed = Array<boolean>(max + 1).fill(false);
  for (const segment of text.split(',')) {
    const stepParts = segment.split('/');
    if (!segment || stepParts.length > 2) return;
    const step = stepParts.length === 2 ? Number(stepParts[1]) : 1;
    if (!Number.isInteger(step) || step <= 0) return;
    const base = stepParts[0];
    let start: number, end: number;
    if (base === '*') { start=min; end=max; }
    else if (base.split('-').length === 2) { [start,end]=base.split('-').map(Number); }
    else { start=Number(base); end=stepParts.length === 2 ? max : start; }
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) return;
    for (let value=start; value<=end; value+=step) allowed[sunday && value === 7 ? 0 : value]=true;
  }
  if (!allowed.some(Boolean)) return;
  return { allowed, startsWithStar:text.startsWith('*') };
}

export class CronSchedule {
  private constructor(private fields: CronField[]) {}
  static parse(expression: string): CronSchedule | undefined {
    const parts=expression.trim().split(/\s+/);
    if(parts.length!==5)return;
    const fields=[parseField(parts[0],0,59),parseField(parts[1],0,23),parseField(parts[2],1,31),parseField(parts[3],1,12),parseField(parts[4],0,7,true)];
    return fields.every(Boolean)?new CronSchedule(fields as CronField[]):undefined;
  }
  nextTimeAfter(epochMs: number): number | undefined {
    const threshold=new Date(epochMs); threshold.setSeconds(0,0); threshold.setMinutes(threshold.getMinutes()+1);
    const candidate=new Date(threshold);
    const limit=8*366*24*60;
    for(let count=0;count<limit;count++,candidate.setMinutes(candidate.getMinutes()+1)){
      const [minute,hour,dom,month,dow]=this.fields;
      const domMatch=dom.allowed[candidate.getDate()],dowMatch=dow.allowed[candidate.getDay()];
      const dayMatch=dom.startsWithStar||dow.startsWithStar?domMatch&&dowMatch:domMatch||dowMatch;
      if(minute.allowed[candidate.getMinutes()]&&hour.allowed[candidate.getHours()]&&month.allowed[candidate.getMonth()+1]&&dayMatch)return candidate.getTime();
    }
  }
}
