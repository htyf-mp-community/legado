import {SourceRuleError} from './errors';

type Node = {type:string; start:number; end:number; [key:string]:any};
const HOST_NAMES = new Set([
  'result','src','baseUrl','title','chapter','nextChapterUrl','java','cookie','source',
  'key','page','searchKey','searchPage','book','globalThis','undefined','NaN','Infinity',
  'Object','Array','String','Number','Boolean','Date','RegExp','Math','JSON','Error',
  'TypeError','ReferenceError','SyntaxError','RangeError','URIError','EvalError',
  'parseInt','parseFloat','isNaN','isFinite','encodeURI','decodeURI','encodeURIComponent',
  'decodeURIComponent','eval','Function',
]);
const unsupported=():never=>{throw new SourceRuleError('JavaScript let/const 作用域暂不支持');};

/** Lower only lexical declarations whose ES5 bindings can be proven equivalent. */
export function lowerSourceLexicalDeclarations(source:string, parse:(source:string)=>Node, reserved:Iterable<string>=[]):string {
  if (!/\b(?:let|const)\b/.test(source)) return source;
  try {parse(source);return source;} catch (_) { /* The script may use lexical declarations. */ }
  const replacements:Array<{start:number;kind:'let'|'const'}>=[];
  const candidate=source.replace(/\b(let|const)(?=\s+[A-Za-z_$])/g,(word:string,kind:'let'|'const',start:number)=>{
    replacements.push({start,kind});return kind==='let'?'var':'var  ';
  });
  if(!replacements.length)return source;
  let ast:Node;
  try {ast=parse(candidate);} catch (_) {return source;}
  if(ast.type!=='Program'||!Array.isArray(ast.body))return unsupported();
  const positions=new Map(replacements.map(item=>[item.start,item.kind]));
  const bindings=new Map<string,{id:Node;end:number;constant:boolean;loop?:Node}>();
  const forbidden=new Set([...HOST_NAMES,...reserved]);
  const collect=(node:Node,parent?:Node,key?:string):void=>{
    const kind=positions.get(node.start);
    if(kind && node.type==='VariableDeclaration'){
      const top=parent?.type==='Program'&&key==='body';
      const loop=kind==='let'&&parent?.type==='ForStatement'&&key==='init'?parent:undefined;
      if(!top&&!loop)return unsupported();
      positions.delete(node.start);
      for(const declaration of node.declarations as Node[]){
        const id=declaration.id as Node;
        if(id.type!=='Identifier'||typeof id.name!=='string'||forbidden.has(id.name)||id.name in globalThis||bindings.has(id.name))return unsupported();
        if((kind==='const'||loop)&&!declaration.init)return unsupported();
        bindings.set(id.name,{id,end:declaration.end,constant:kind==='const',loop});
      }
    }
    for(const [name,value] of Object.entries(node)){
      if(Array.isArray(value)){for(const item of value)if(item&&typeof item==='object'&&typeof item.type==='string')collect(item,node,name);}
      else if(value&&typeof value==='object'&&typeof value.type==='string')collect(value,node,name);
    }
  };
  collect(ast);
  if(positions.size || !bindings.size)return unsupported();
  const inspect=(node:Node,parent?:Node,key?:string,functions:Node[]=[]):void=>{
    if(node.type==='ThisExpression')return unsupported();
    if(node.type==='Identifier' && bindings.has(node.name)){
      const binding=bindings.get(node.name)!;
      const declaration=(parent?.type==='VariableDeclarator'&&key==='id') ||
        ((parent?.type==='FunctionDeclaration'||parent?.type==='FunctionExpression')&&(key==='id'||key==='params')) ||
        (parent?.type==='CatchClause'&&key==='param');
      if(node!==binding.id && (declaration || node.start<binding.end))return unsupported();
      if(binding.loop && (node.start<binding.loop.start || node.end>binding.loop.end || functions.some(fn=>fn.start>=binding.loop!.start&&fn.end<=binding.loop!.end)))return unsupported();
      if(binding.constant && ((parent?.type==='AssignmentExpression'&&key==='left') ||
        (parent?.type==='UpdateExpression'&&key==='argument') ||
        (parent?.type==='ForInStatement'&&key==='left')))return unsupported();
      if(parent?.type==='UnaryExpression'&&parent.operator==='delete'&&key==='argument')return unsupported();
    }
    const nextFunctions=node.type==='FunctionDeclaration'||node.type==='FunctionExpression'?[...functions,node]:functions;
    for(const [name,value] of Object.entries(node)){
      if(Array.isArray(value)){for(const item of value)if(item&&typeof item==='object'&&typeof item.type==='string')inspect(item,node,name,nextFunctions);}
      else if(value&&typeof value==='object'&&typeof value.type==='string')inspect(value,node,name,nextFunctions);
    }
  };
  inspect(ast);
  return candidate;
}
