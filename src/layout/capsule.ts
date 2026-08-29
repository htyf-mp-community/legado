export type Rect={left:number;top:number;right:number;bottom:number};
const valid=(r:Rect)=>[r.left,r.top,r.right,r.bottom].every(Number.isFinite)&&r.right>r.left&&r.bottom>r.top;
export function normalizeCapsule(raw:Partial<Rect>|null|undefined,window:{width:number;height:number},ratio:number):Rect|null{
 if(!raw||!Number.isFinite(window.width)||!Number.isFinite(window.height)||ratio<=0)return null;const r=raw as Rect;if(!valid(r))return null;
 const plausible=(x:Rect)=>x.left>=0&&x.top>=0&&x.left<window.width&&x.top<window.height&&x.right<=window.width*1.1&&x.bottom<=window.height*1.1;
 const x=plausible(r)?r:{left:r.left/ratio,top:r.top/ratio,right:r.right/ratio,bottom:r.bottom/ratio};if(!plausible(x))return null;
 return{left:Math.max(0,Math.min(window.width,x.left)),top:Math.max(0,Math.min(window.height,x.top)),right:Math.max(0,Math.min(window.width,x.right)),bottom:Math.max(0,Math.min(window.height,x.bottom))};
}
export function rightBoundaryForElement(el:Pick<Rect,'top'|'bottom'>,cap:Rect|null,right:number,gap=10){return cap&&el.top<cap.bottom&&el.bottom>cap.top?Math.min(right,cap.left-gap):right}
export function headerGeometry(safeTop:number,cap:Rect|null,width:number){return{top:cap?Math.min(safeTop,cap.top):safeTop,bottom:cap?Math.max(cap.bottom+8,safeTop+52):safeTop+52,fullWidth:width}}
