export class SourceRuleError extends Error{constructor(message:string,public readonly sourceName?:string){super(message);this.name='SourceRuleError'}}
export class UnsupportedRuleError extends SourceRuleError{constructor(capability:string,sourceName?:string){super(`暂不支持的书源规则: ${capability}`,sourceName);this.name='UnsupportedRuleError'}}
