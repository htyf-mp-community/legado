export class SourceRuleError extends Error{constructor(message:string,public readonly sourceName?:string){super(message);this.name='SourceRuleError'}}
export class SourceHttpError extends SourceRuleError{constructor(public readonly status:number){super(`HTTP ${status}`)}}
export class SourceVerificationCancelledError extends SourceRuleError{constructor(){super('浏览器验证已取消');this.name='SourceVerificationCancelledError'}}
export class UnsupportedRuleError extends SourceRuleError{constructor(capability:string,sourceName?:string){super(`暂不支持的书源规则: ${capability}`,sourceName);this.name='UnsupportedRuleError'}}
export class EmptyTocError extends SourceRuleError{constructor(sourceName?:string){super('目录为空',sourceName);this.name='EmptyTocError'}}
