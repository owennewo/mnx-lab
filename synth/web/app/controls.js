// Shared pedalboard controls. Every control reads and writes through a spec,
// so the same value can appear as a knob, a fine row, a graph handle or a
// table cell and stay in sync through one refresh pass.
import {sliderMapping,visibleRange} from '../model/ranges.js';
import {clamp} from '../model/presets.js';
const SVG='http://www.w3.org/2000/svg';
function apply(el,attrs){
 for(const [k,v] of Object.entries(attrs||{})){
  if(v===undefined||v===null||v===false)continue;
  if(k==='class')el.setAttribute('class',v);
  else if(k==='text')el.textContent=v;
  else if(k==='style'&&typeof v==='object')Object.assign(el.style,v);
  else if(k.startsWith('on')&&typeof v==='function')el.addEventListener(k.slice(2).toLowerCase(),v);
  else el.setAttribute(k,v===true?'':String(v));
 }
 return el;
}
const append=(el,kids)=>{for(const k of kids.flat(Infinity))if(k!==null&&k!==undefined&&k!==false)el.append(k instanceof Node?k:document.createTextNode(String(k)));return el;};
export const h=(tag,attrs,...kids)=>append(apply(document.createElement(tag),attrs),kids);
export const s=(tag,attrs,...kids)=>append(apply(document.createElementNS(SVG,tag),attrs),kids);

// Display helpers. A spec stores physical values; `scale` and `unit` describe
// how they are shown and typed (e.g. 0.25 → 25%).
export function formatValue(spec,v){
 if(spec.format)return spec.format(v);
 const shown=v*(spec.scale??1),digits=spec.digits??(Math.abs(shown)>=100?0:Math.abs(shown)>=10?1:2);
 return `${Number(shown.toFixed(digits))}${spec.unit?(spec.unit==='%'?'%':' '+spec.unit):''}`;
}
export function parseValue(spec,text){
 const n=Number(String(text).replace(/[^0-9.+\-eE−]/g,'').replace('−','-'));
 if(!Number.isFinite(n))return null;
 return clamp(n/(spec.scale??1),spec.min,spec.max);
}
export const pct={unit:'%',scale:100};

// Context shared by every control: exact/extended modes, bindings and search.
export class ControlContext{
 constructor({exact=()=>false,extended=()=>true}={}){this.exact=exact;this.extended=extended;this.bindings=new Set();this.index=new Map();}
 bind(update){this.bindings.add(update);update();return update;}
 refresh(){for(const b of [...this.bindings]){if(b.el&&!b.el.isConnected){this.bindings.delete(b);continue;}b();}}
 reset(){this.bindings.clear();}
 // Search entries persist across re-renders: navigation re-creates the target.
 register(spec){if(spec.key&&spec.nav)this.index.set(spec.key,{key:spec.key,label:spec.label,where:spec.where||'',nav:spec.nav,keywords:spec.keywords||''});}
 range(spec){
  if(spec.mapping)return {mapping:spec.mapping,lo:spec.min,hi:spec.max};
  const [lo,hi]=visibleRange(spec,spec.get(),this.extended());
  return {mapping:sliderMapping(lo,hi,spec.log),lo,hi};
 }
}

function exactInput(spec,ctx,onDone){
 const input=h('input',{class:'exact',inputmode:'decimal','aria-label':`${spec.label} value`,value:formatValue(spec,spec.get())});
 const commit=()=>{const v=parseValue(spec,input.value);if(v!==null){spec.set(v);spec.commit?.();}input.value=formatValue(spec,spec.get());onDone?.();};
 input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commit();input.blur();}if(e.key==='Escape'){input.value=formatValue(spec,spec.get());input.blur();}});
 input.addEventListener('change',commit);
 return input;
}

// Rotary knob: vertical drag (Shift for fine), arrow keys, Home/End, PageUp/Down,
// double-click to type a value. The gold arc marks the usual range.
export function knob(spec,ctx,{size=66}={}){
 ctx.register(spec);
 const usual=s('circle',{cx:40,cy:40,r:37,fill:'none',stroke:'#dbac72','stroke-opacity':.55,'stroke-width':2,pathLength:100,transform:'rotate(135 40 40)'});
 const value=s('circle',{cx:40,cy:40,r:31,fill:'none',stroke:spec.color||'#8fd8c4','stroke-width':6,pathLength:100,'stroke-linecap':'round',transform:'rotate(135 40 40)'});
 const pointer=s('line',{x1:40,y1:40,x2:40,y2:23,stroke:'#eef1ee','stroke-width':3,'stroke-linecap':'round'});
 const svg=s('svg',{width:size,height:size,viewBox:'0 0 80 80','aria-hidden':'true'},usual,
  s('circle',{cx:40,cy:40,r:31,fill:'none',stroke:'#263239','stroke-width':6,pathLength:100,'stroke-dasharray':'75 100','stroke-linecap':'round',transform:'rotate(135 40 40)'}),
  value,s('circle',{cx:40,cy:40,r:21,fill:'#1d262b',stroke:'#33424a'}),pointer);
 const dial=h('div',{class:'knob-dial',role:'slider',tabindex:0,'aria-label':spec.label,'aria-valuemin':0,'aria-valuemax':100,title:spec.help},svg);
 const out=h('span',{class:'knob-value'});
 const root=h('div',{class:'knob','data-key':spec.key},dial,h('span',{class:'knob-name'},spec.label),out);
 let typing=null;
 const update=()=>{
  const v=spec.get(),{mapping,lo,hi}=ctx.range(spec),u=clamp(mapping.toUnit(clamp(v,lo,hi)),0,1);
  value.setAttribute('stroke-dasharray',`${(75*u).toFixed(2)} 100`);pointer.setAttribute('transform',`rotate(${(-135+270*u).toFixed(1)} 40 40)`);
  const normal=spec.normal;
  if(normal&&!spec.mapping){const a=clamp(mapping.toUnit(Math.max(normal[0],lo)),0,1),b=clamp(mapping.toUnit(Math.min(normal[1],hi)),0,1);usual.setAttribute('stroke-dasharray',`${(75*(b-a)).toFixed(2)} 100`);usual.setAttribute('stroke-dashoffset',(-75*a).toFixed(2));usual.style.display='';}
  else usual.style.display='none';
  const text=formatValue(spec,v),beyond=normal&&(v<normal[0]||v>normal[1]);
  dial.setAttribute('aria-valuenow',(u*100).toFixed(1));dial.setAttribute('aria-valuetext',spec.words?`${spec.words(v,u)} · ${text}`:text);
  if(ctx.exact()){if(!typing||!out.contains(typing)){typing=exactInput(spec,ctx);out.replaceChildren(typing);}else if(document.activeElement!==typing)typing.value=text;out.className='knob-value';}
  else{typing=null;out.textContent=spec.words?`${spec.words(v,u)}${beyond?' · beyond usual':''}`:text+(beyond?' · beyond usual':'');out.className='knob-value'+(beyond?' beyond':'');}
 };
 update.el=root;ctx.bind(update);
 const setUnit=u=>{const {mapping}=ctx.range(spec);spec.set(mapping.fromUnit(clamp(u,0,1)));};
 const unit=()=>{const {mapping,lo,hi}=ctx.range(spec);return clamp(mapping.toUnit(clamp(spec.get(),lo,hi)),0,1);};
 let drag=null;
 dial.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();dial.focus();dial.setPointerCapture(e.pointerId);drag={y:e.clientY,u:unit()};});
 dial.addEventListener('pointermove',e=>{if(!drag)return;setUnit(drag.u+(drag.y-e.clientY)/(e.shiftKey?1200:180));});
 const end=()=>{if(drag){drag=null;spec.commit?.();}};
 dial.addEventListener('pointerup',end);dial.addEventListener('pointercancel',end);
 dial.addEventListener('keydown',e=>{
  const steps={ArrowUp:.01,ArrowRight:.01,ArrowDown:-.01,ArrowLeft:-.01,PageUp:.1,PageDown:-.1};
  if(e.key in steps){e.preventDefault();setUnit(unit()+steps[e.key]*(e.shiftKey?10:1));spec.commit?.();}
  else if(e.key==='Home'||e.key==='End'){e.preventDefault();setUnit(e.key==='End'?1:0);spec.commit?.();}
  else if(e.key==='Enter'){e.preventDefault();typeValue();}
 });
 const typeValue=()=>{if(ctx.exact())return typing?.focus();const input=exactInput(spec,ctx,()=>update());out.replaceChildren(input);input.focus();input.select();input.addEventListener('blur',()=>setTimeout(update,0),{once:true});};
 dial.addEventListener('dblclick',typeValue);
 return root;
}

// Compact horizontal row for detailed settings.
export function row(spec,ctx){
 if(spec.register!==false)ctx.register(spec);
 const id='c-'+spec.key.replace(/[^a-z0-9]+/gi,'-');
 const range=h('input',{type:'range',id,min:0,max:1,step:.001,title:spec.help});
 const out=h('output',{for:id});
 const dot=h('span',{class:'policy'+(spec.policy==='next'?' next':''),title:spec.policy==='next'?'Applies on the next pluck':'Changes live',role:'img','aria-label':spec.policy==='next'?'Applies on the next pluck':'Changes live'});
 const root=h('div',{class:'row','data-key':spec.register===false?undefined:spec.key},h('label',{for:id,title:spec.help},spec.label),range,out,dot);
 let typing=null;
 const update=()=>{
  const v=spec.get(),{mapping,lo,hi}=ctx.range(spec),u=clamp(mapping.toUnit(clamp(v,lo,hi)),0,1);
  if(document.activeElement!==range)range.value=u;range.setAttribute('aria-valuetext',formatValue(spec,v));
  if(ctx.exact()){if(!typing||!root.contains(typing)){typing=exactInput(spec,ctx);out.replaceWith(typing);}else if(document.activeElement!==typing)typing.value=formatValue(spec,v);}
  else{if(typing){typing.replaceWith(out);typing=null;}out.textContent=formatValue(spec,v);}
 };
 update.el=root;ctx.bind(update);
 range.addEventListener('input',()=>{const {mapping}=ctx.range(spec);spec.set(mapping.fromUnit(Number(range.value)));});
 range.addEventListener('change',()=>spec.commit?.());
 return root;
}

export function toggleSwitch(label,get,set,ctx,{key,where,nav}={}){
 const btn=h('button',{type:'button',class:'switch',role:'switch','data-key':key},h('span',{class:'track','aria-hidden':'true'}),h('span',{},label));
 if(key)ctx.register({key,label,where,nav});
 const update=()=>btn.setAttribute('aria-checked',String(Boolean(get())));update.el=btn;ctx.bind(update);
 btn.addEventListener('click',()=>set(!get()));
 return btn;
}

export function legend(){return h('div',{class:'legend'},h('span',{},h('span',{class:'policy next'}),'next pluck'),h('span',{},h('span',{class:'policy'}),'changes live'));}

// Pointer helper for SVG drags in viewBox units.
export function svgPoint(svg,e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());}
export function dragHandle(el,svg,{move,end,keys}){
 el.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();el.focus?.();el.setPointerCapture(e.pointerId);el._drag=true;move(svgPoint(svg,e),e);});
 el.addEventListener('pointermove',e=>{if(el._drag)move(svgPoint(svg,e),e);});
 const stop=()=>{if(el._drag){el._drag=false;end?.();}};
 el.addEventListener('pointerup',stop);el.addEventListener('pointercancel',stop);
 if(keys)el.addEventListener('keydown',e=>{if(keys(e)){e.preventDefault();end?.();}});
}
