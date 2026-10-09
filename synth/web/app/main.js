// The synth app, chain first (chain campaign, design "Synth chain-first UX"): every part
// is a lane (instrument → effects → +) that runs into its channel strip; return buses
// and the master close the mixer. Selecting any block opens its editor below the
// lanes (a sheet on phones). Sessions are mnx-sound/2 setups plus the piece they play;
// the Piece picker changes only the music, Session → Examples loads a piece with its own
// setup, and the Inspect panel shows diagnostics, note labels and checks. Rigs (3.0.0)
// carry no music.
import {h,knob,ControlContext} from './controls.js';
import {PARAMS_V2,HARDNESS_V2,STRING_V2} from '../model/instrument-v2.js';
import {validateFixture,validateEventLog,ContractError,BLOCK_TYPES,EFFECT_TYPES,MASTER_PARAMS} from '../host/index.js';
import {STORE,LAYOUTS,KINDS,PART_CHOICES,factoryDesigns,newPart,partIds,defaultSession,loadSession,exportRig,importRig,partRig,ROOM_BUS,exampleSession,hearingLog,
 addBlock,duplicateBlock,removeBlock,moveBlock,applyPreset,resetBlock,resetStrip,History,Store,storedCollection,saveOwnDesign,copy} from './state.js';
import {arrange,DEFAULT_PIECE} from './pieces.js';
import {Player} from './player.js';

const storage=(()=>{try{return localStorage;}catch{return null;}})();
const root=document.getElementById('app'),store=new Store(storage),player=new Player(),ctx=new ControlContext({extended:()=>true}),history=new History();
const NOTE_NAMES=['C','C♯','D','E♭','E','F','F♯','G','G♯','A','B♭','B'],noteName=m=>NOTE_NAMES[((Math.round(m)%12)+12)%12]+(Math.floor(Math.round(m)/12)-1);
const HUES={plucked:'#dbac72',keys:'#9fb8f0',kit:'#e39b7b',strip:'#c9d3d3',master:'#eef1ee'};
const STATE_LABEL={on:'On',off:'Off'};
const html=document.documentElement,narrow=matchMedia('(max-width: 760px)');
let factory,pieces,app;
// Contract test fixtures (web/contract/fixtures/), for developers: reachable from Inspect.
export const TEST_FIXTURES=['chord-gestures','keys-pedal','kit-chokes','multi-part-mix','plucked-techniques','ukulele-layout'];
const GROUPS=['Band','Guitar','Ukulele','Keys','Kit'];

// --- Session, persistence, undo --------------------------------------------------
const setup=()=>app.session.setup,parts=()=>setup().parts,part=id=>parts().find(p=>p.id===id);
const snapshot=()=>JSON.stringify(app.session);
// The piece being played: a library piece by id, or one opened from a file.
const currentPiece=()=>typeof app.session.piece==='string'?pieces.byId.get(app.session.piece)??pieces.byId.get(DEFAULT_PIECE):app.session.piece;
const arranged=()=>arrange(currentPiece(),setup());
// An example (or opened file) is unedited while its setup and piece are as loaded: then its checks apply.
const exampleKey=()=>JSON.stringify([app.session.piece,setup()]);
const unedited=()=>!!app.example&&app.example===exampleKey();
function save(){if(!store.set(STORE.session,app.session))toast('Could not save on this device. Export the session to keep your edits.',true);}
// Every edit: save, reconfigure the host (ramped), redraw. Discrete edits (add, move,
// remove, state, mute) are one undo step each; a continuous knob drag is one step.
function changed({structural=false,material=false}={}){
 clearTimeout(changed.settle);
 if(structural){history.record(app.committed);app.burst=false;app.committed=snapshot();}
 else{if(!app.burst){history.record(app.committed);app.burst=true;}changed.settle=setTimeout(()=>{app.burst=false;app.committed=snapshot();},500);}
 if(app.compare==='A')app.compare='B';
 save();if(structural)render();else{ctx.refresh();refreshChrome();}
 clearTimeout(changed.timer);
 changed.timer=setTimeout(async()=>{try{if(material&&player.playing)await play();else await player.configure(setup());}catch(e){toast(e.message,true);}},30);
}
function restore(json){app.session=JSON.parse(json);app.committed=json;app.burst=false;keepSelection();save();render();player.configure(setup()).catch(e=>toast(e.message,true));}
function undo(){if(app.burst){app.burst=false;app.committed=snapshot();}const prev=history.undo(app.committed);if(prev)restore(prev);}
function redo(){const next=history.redo(app.committed);if(next)restore(next);}
function keepSelection(){const s=app.sel;if(s.part&&!part(s.part))app.sel={kind:'instrument',part:parts()[0].id};else if(s.kind==='block'&&!part(s.part).chain.some(b=>b.id===s.block))app.sel={kind:'instrument',part:s.part};}
function toast(text,error=false){const t=h('div',{class:'toast'+(error?' error':''),role:error?'alert':'status'},text);document.body.append(t);setTimeout(()=>t.remove(),error?6000:3000);}

// --- Specs -----------------------------------------------------------------------
const spec=(key,label,{min,max,get,set,material=false,...rest})=>({key,label,min,max,get,set:v=>{set(v);changed({material});},commit:()=>{},...rest});
// Editing a factory design makes an own copy first; the factory list never changes.
// The copy remembers its source design, which Reset restores.
function design(p){const d=p.instrument.design;if(!d.source)p.instrument.design={...copy(d),factory:false,source:d.id,id:`own-${Date.now().toString(36)}`,name:`${d.name.replace(/ · edited$/,'')} · edited`};return p.instrument.design;}
const paramSpec=(p,k)=>{const s=PARAMS_V2[k];return spec(`${p.id}.d.${k}`,s.name,{min:s.min,max:s.max,log:s.log,unit:s.unit,scale:s.scale,normal:s.normal,help:s.help,color:HUES.plucked,
 get:()=>p.instrument.design.instrument.parameters[k],set:v=>{design(p).instrument.parameters[k]=v;}});};
const excitationSpecs=p=>[
 spec(`${p.id}.x.position`,'Pluck point',{min:.01,max:.49,normal:[.04,.46],help:'Distance from the bridge, as a fraction of the string',color:HUES.plucked,get:()=>p.instrument.design.instrument.excitation.position,set:v=>{design(p).instrument.excitation.position=v;}}),
 spec(`${p.id}.x.hardness`,'Hardness',{...HARDNESS_V2,help:'Pick or finger hardness',color:HUES.plucked,get:()=>p.instrument.design.instrument.excitation.hardness,set:v=>{design(p).instrument.excitation.hardness=v;}})];
const GUITAR_SECTIONS=[
 ['Tone & decay',p=>['decay','treble_decay','brightness','dispersion','release'].map(k=>paramSpec(p,k))],
 ['Strike & pickups',p=>[...['pluck_body','pick_texture','contact_width','pluck_release_time','texture_colour','velocity_tone'].map(k=>paramSpec(p,k)),...excitationSpecs(p),...['electric','pickup','pickup2','pickup_width','pickup_blend'].map(k=>paramSpec(p,k))]],
 // Attack: the soak of a hard pluck's extra energy (core-synth-performance step 1) and the
 // pitch glide of the stretched string (the setup's tension law).
 ['Attack',p=>[...['thwack_soak','thwack_time','thwack_body','thwack_treble'].map(k=>paramSpec(p,k)),
  spec(`${p.id}.s.tensionCents`,'Glide',{min:0,max:30,unit:'cents',help:'How sharp a full-strength pluck starts; it scales with strength squared and settles to pitch',color:HUES.plucked,get:()=>p.instrument.design.instrument.setup.tensionCents,set:v=>{design(p).instrument.setup.tensionCents=v;}}),
  spec(`${p.id}.s.tensionSeconds`,'Glide time',{min:.005,max:.25,unit:'s',log:true,help:'How quickly the glide settles',color:HUES.plucked,get:()=>p.instrument.design.instrument.setup.tensionSeconds,set:v=>{design(p).instrument.setup.tensionSeconds=v;}})]],
 ['Motion & bridge',p=>['beating_cents','motion_exchange','motion_loss_ratio','initial_damping','initial_damping_time','bridge_transfer','bridge_rolloff','sympathetic_response'].map(k=>paramSpec(p,k))],
 ['Body & output',p=>['body_mix','body_size','body_low_weight','body_damping','body_breadth'].map(k=>paramSpec(p,k))],
 ['Strings & setup',null],['Layout',null]];
const blockSpec=(b,k,d,hue)=>spec(`${b.id}.${k}`,d.label,{min:d.min,max:d.max,unit:d.unit==='%'?'%':d.unit,scale:d.scale,log:d.log,color:hue,
 get:()=>b.params[k]??d.default,set:v=>{b.params[k]=v;b.preset=undefined;}});
const busOf=id=>(setup().session.buses??[]).find(b=>b.id===id);
const levelSpec=p=>spec(`${p.id}.design.level`,'Level',{min:-30,max:12,unit:'dB',color:HUES[p.instrument.kind],get:()=>p.instrument.design.levelDb??0,set:v=>{p.instrument.design={...p.instrument.design,levelDb:Math.round(v*10)/10};}});

// --- Header and transport ----------------------------------------------------------
const icon=(d,label)=>{const b=h('span',{'aria-hidden':'true',class:'icon'});b.innerHTML=`<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">${d}</svg>`;return b;};
function header(){
 const compare=h('div',{class:'seg',role:'group','aria-label':'Compare'},
  h('button',{type:'button',id:'compare-a','aria-pressed':String(app.compare==='A'),disabled:!app.saved,title:app.saved?'Hear the saved version; your edits are kept':'Save the session to compare with it',onclick:()=>setCompare('A')},'A · Saved'),
  h('button',{type:'button',id:'compare-b','aria-pressed':String(app.compare==='B'),onclick:()=>setCompare('B')},'B · Edited'));
 return h('header',{class:'app-header'},
  h('a',{class:'brand',href:'./'},logo(),'SYNTH'),
  h('button',{type:'button',class:'btn session-btn','aria-haspopup':'menu','aria-label':'Session menu',onclick:openMenu},h('span',{class:'muted'},'Session'),h('b',{},app.session.name),icon('<path d="M5 8l5 5 5-5"/>')),
  h('span',{class:'spacer'}),
  h('button',{type:'button',class:'btn icon-btn',id:'undo','aria-label':'Undo',disabled:!history.canUndo&&!app.burst,onclick:undo},icon('<path d="M7 5L3 9l4 4M3 9h9a5 5 0 010 10h-2"/>')),
  h('button',{type:'button',class:'btn icon-btn',id:'redo','aria-label':'Redo',disabled:!history.canRedo,onclick:redo},icon('<path d="M13 5l4 4-4 4M17 9H8a5 5 0 000 10h2"/>')),
  compare,h('button',{type:'button',class:'btn primary',onclick:saveSession},'Save session'));
}
const logo=()=>{const d=h('span',{class:'logo','aria-hidden':'true'});d.innerHTML='<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#dbac72" stroke-width="2" stroke-linecap="round"><path d="M6 3v16M11 3v16M16 3v16"/></svg>';return d;};
function refreshChrome(){
 const u=document.getElementById('undo'),r=document.getElementById('redo');if(u)u.disabled=!history.canUndo&&!app.burst;if(r)r.disabled=!history.canRedo;
 for(const f of document.querySelectorAll('[data-face]'))updateFace(f);
}
async function setCompare(which){
 if(which==='A'&&!app.saved)return;app.compare=which;render();
 try{await player.configure(which==='A'?app.saved.setup:setup());}catch(e){toast(e.message,true);}
}
function transport(){
 const playBtn=h('button',{type:'button',class:'play-btn','aria-label':'Play',onclick:()=>play()});
 const update=()=>{playBtn.setAttribute('aria-label',player.playing?'Restart':'Play');playBtn.classList.toggle('playing',player.playing);playBtn.innerHTML=player.playing
  ?'<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10a6 6 0 1 0 2-4.5M4 3v4h4" fill="none" stroke="#0e2a24" stroke-width="2" stroke-linecap="round"/></svg>'
  :'<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M6 3.5l11 6.5-11 6.5z" fill="#0e2a24"/></svg>';};
 update.el=playBtn;ctx.bind(update);
 const loop=h('button',{type:'button',class:'btn','aria-pressed':String(app.loop),onclick:e=>{app.loop=!app.loop;player.setLoop(app.loop);e.currentTarget.setAttribute('aria-pressed',String(app.loop));}},'Loop');
 const own=typeof app.session.piece!=='string';
 const material=h('label',{class:'material'},h('span',{class:'muted'},'Piece'),
  h('select',{'aria-label':'Piece',title:'What is played. Your instruments, chains and mix stay as they are',onchange:e=>{app.session.piece=e.target.value;changed({structural:true,material:true});}},
   own?h('option',{value:'',selected:true,disabled:true},`${currentPiece().fixture?.name??currentPiece().fixture?.id??'Event log'} (file)`):'',
   ...GROUPS.map(g=>h('optgroup',{label:g},...pieces.index.filter(x=>x.group===g).map(x=>h('option',{value:x.id,selected:x.id===app.session.piece},x.name))))));
 return h('footer',{class:'transport','aria-label':'Transport'},playBtn,
  h('button',{type:'button',class:'stop-btn','aria-label':'Stop',onclick:()=>stop()},h('span',{class:'stop-square'})),loop,material,
  h('div',{class:'progress','aria-hidden':'true'},h('span',{id:'progress'})),h('span',{class:'time mono',id:'time'},'0:00'),
  h('div',{class:'out-meter'},h('span',{class:'muted'},'OUT'),h('div',{class:'meter','aria-hidden':'true'},h('span',{id:'meter'}))));
}

// --- Lanes -------------------------------------------------------------------------
const selected=(kind,partId,blockId)=>app.sel.kind===kind&&app.sel.part===partId&&(blockId===undefined||app.sel.block===blockId);
function select(sel){app.sel=sel;app.sheet=true;render();}
function laneView(p,index){
 const diag=[...app.diagnostics.values()].filter(d=>d.part===p.id&&d.severity!=='info').length;
 const inst=h('div',{class:'block instrument'+(selected('instrument',p.id)?' selected':'')+(diag?' warn':''),style:{'--hue':HUES[p.instrument.kind]}},
  h('button',{type:'button',class:'face','aria-pressed':String(selected('instrument',p.id)),'data-nav':`${index}:0`,'aria-label':`${p.name} instrument: ${p.instrument.design.name??p.instrument.design.id}. Open its settings`,onclick:()=>select({kind:'instrument',part:p.id})},
   h('span',{class:'kind'},KINDS[p.instrument.kind].basic?'INSTRUMENT · BASIC':'INSTRUMENT'),h('span',{class:'name'},p.instrument.design.name??({keys:'Basic piano',kit:'Basic kit'})[p.instrument.kind]),
   h('span',{class:'sub'},p.instrument.kind==='plucked'?layoutName(p.instrument.layout):p.instrument.kind==='keys'?'16 voices':'11 pieces')),
  diag?h('span',{class:'badge',title:`${diag} diagnostic(s)`},String(diag)):null);
 const blocks=p.chain.map((b,i)=>blockView(p,b,i,index));
 const add=h('button',{type:'button',class:'add-slot','aria-label':`Add an effect to ${p.name}`,'aria-haspopup':'menu',onclick:e=>openAddMenu(e.currentTarget,p)},'+');
 const lane=h('div',{class:'lane','data-part':p.id,ondragover:e=>dragOver(e,p),ondragleave:e=>{if(!e.currentTarget.contains(e.relatedTarget))clearDrop();},ondrop:e=>drop(e,p)},
  h('button',{type:'button',class:'lane-name','aria-label':`${p.name} channel strip`,onclick:()=>select({kind:'strip',part:p.id})},h('span',{class:'part-name'},p.name),h('span',{class:'sub'},KINDS[p.instrument.kind].basic?'Basic':p.instrument.kind==='plucked'?`${p.instrument.layout.strings.length} strings`:''),
   app.arranged?.silent.includes(p.id)?h('span',{class:'sub no-line'},'No line in this piece'):null),
  inst,...blocks,add,h('span',{class:'lane-end','aria-hidden':'true'}));
 return h('div',{class:'lane-row'+(p.strip?.mute||(anySolo()&&!p.strip?.solo)?' dimmed':'')},lane,stripView(p));
}
const anySolo=()=>parts().some(p=>p.strip?.solo);
const KIND_NAME={plucked:'guitar',keys:'keys',kit:'kit'};
// A line of the piece that no part plays: shown, never silently dropped.
function ghostLane(line){
 const ukulele=line.kind==='plucked'&&line.layout?.strings.length===4,label=ukulele?'ukulele':KIND_NAME[line.kind];
 return h('div',{class:'ghost-lane',role:'note'},h('span',{class:'ghost-name'},line.name),
  h('span',{class:'muted'},`This piece has a ${label} line that no part plays.`),
  h('button',{type:'button',class:'btn small',onclick:()=>{const p=newPart(line.kind,{name:line.name,factory,layout:line.layout,taken:partIds(setup())});if(!busOf('room'))delete p.strip.sends.room;parts().push(p);app.sel={kind:'instrument',part:p.id};changed({structural:true,material:true});}},`Add a ${label} part`));
}
const layoutName=l=>Object.entries(LAYOUTS).find(([,x])=>JSON.stringify(x)===JSON.stringify(l))?.[0]??`${l.strings.length} strings, custom`;
function blockView(p,b,i,lane){
 const def=BLOCK_TYPES[b.type],state=b.state??'on',sel=selected('block',p.id,b.id);
 const face=h('button',{type:'button',class:'face','data-face':`${p.id}/${b.id}`,'data-nav':`${lane}:${i+1}`,'aria-pressed':String(sel),onclick:()=>select({kind:'block',part:p.id,block:b.id})});
 const pill=h('button',{type:'button',class:'pill','aria-label':`${def?.name??b.type} is ${state}. Change state`,onclick:e=>{e.stopPropagation();b.state=(b.state??'on')==='on'?'off':'on';changed({structural:true});}},h('span',{class:'led'}),STATE_LABEL[state]);
 const el=h('div',{class:`block effect state-${state}`+(sel?' selected':''),style:{'--hue':def?.hue??'#5b6a70'},draggable:'true','data-block':b.id,
  ondragstart:e=>{app.drag={part:p.id,index:i};e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',b.id);document.body.classList.add('dragging');},
  ondragend:()=>{app.drag=null;document.body.classList.remove('dragging');clearDrop();}},face,pill);
 updateFace(face);return el;
}
function updateFace(face){
 const [pid,bid]=face.dataset.face.split('/'),p=part(pid),b=p?.chain.find(x=>x.id===bid);if(!b)return;
 const def=BLOCK_TYPES[b.type],state=b.state??'on';
 face.setAttribute('aria-label',`${def?.name??b.type}, ${state}. Open its settings`);
 face.replaceChildren(h('span',{class:'kind'},'EFFECT'),h('span',{class:'name'},def?.name??b.type),h('span',{class:'sub'},state==='off'?'Off':b.preset??'Custom'));
}
function stripView(p){
 const st=p.strip??={},sel=selected('strip',p.id),send=st.sends?.room??0;
 const fader=Math.max(0,Math.min(1,((st.levelDb??0)+30)/42));
 return h('div',{class:'strip'+(sel?' selected':'')},
  h('button',{type:'button',class:'strip-face','aria-pressed':String(sel),'aria-label':`${p.name} channel strip: level ${fmtDb(st.levelDb??0)}, pan ${fmtPan(st.pan??0)}, room send ${Math.round(send*100)}%`,onclick:()=>select({kind:'strip',part:p.id})},
   h('span',{class:'strip-values'},h('span',{},'Level ',h('b',{},fmtDb(st.levelDb??0))),h('span',{},'Pan ',h('b',{},fmtPan(st.pan??0))),busOf('room')?h('span',{},'Room ',h('b',{},`${Math.round(send*100)}%`)):null),
   h('span',{class:'strip-bar'},h('span',{class:'strip-meter','data-meter':p.id}),h('span',{class:'strip-fader',style:{left:`calc(${fader*100}% - 3px)`}}))),
  h('button',{type:'button',class:'ms mute','aria-pressed':String(!!st.mute),'aria-label':`Mute ${p.name}`,onclick:()=>{st.mute=!st.mute;changed({structural:true});}},'M'),
  h('button',{type:'button',class:'ms solo','aria-pressed':String(!!st.solo),'aria-label':`Solo ${p.name}`,onclick:()=>{st.solo=!st.solo;changed({structural:true});}},'S'));
}
const fmtDb=v=>`${v>0?'+':v<0?'−':''}${Math.abs(Math.round(v*10)/10)} dB`;
const fmtPan=v=>Math.abs(v)<.005?'C':`${v<0?'L':'R'} ${Math.round(Math.abs(v)*100)}`;
function mixerRow(){
 const room=busOf('room'),m=setup().session.master??{};
 return h('div',{class:'mixer-row'},
  h('button',{type:'button',class:'btn dashed','aria-haspopup':'menu',onclick:e=>openPartMenu(e.currentTarget)},'+ Add part'),
  h('span',{class:'muted small'},'Guitar · Ukulele · Keys · Kit'),h('span',{class:'spacer'}),
  h('div',{class:'mixer-tail'},
   room?h('button',{type:'button',class:'bus-block'+(app.sel.kind==='bus'?' selected':'')+((room.state??'on')==='off'?' state-off':''),'aria-pressed':String(app.sel.kind==='bus'),onclick:()=>select({kind:'bus',bus:'room'})},
    h('span',{class:'kind'},'RETURN BUS'),h('span',{class:'name'},`Room · ${room.preset??'Custom'}`),h('span',{class:'sub'},(room.state??'on')==='off'?'Off':`${room.params?.decay??1} s · ${Math.round((room.params?.level??.2)*100)}% wet`))
    :h('button',{type:'button',class:'btn dashed',onclick:()=>{setup().session.buses=[...(setup().session.buses??[]),ROOM_BUS()];changed({structural:true});}},'+ Room bus'),
   h('button',{type:'button',class:'bus-block master'+(app.sel.kind==='master'?' selected':''),'aria-pressed':String(app.sel.kind==='master'),onclick:()=>select({kind:'master'})},
    h('span',{class:'kind'},'MASTER'),h('span',{class:'name'},fmtDb(m.volumeDb??0)),h('span',{class:'sub limiter'},h('span',{class:'led',id:'limiter-led'}),h('span',{id:'limiter-text'},'Limiter idle')))));
}

// --- Add, move and remove blocks -------------------------------------------------
function popover(anchor,items,label){
 document.querySelector('.menu')?.remove();
 const close=()=>{menu.remove();document.removeEventListener('pointerdown',outside,true);anchor.focus();};
 const outside=e=>{if(!menu.contains(e.target)&&e.target!==anchor)close();};
 const menu=h('div',{class:'menu',role:'menu','aria-label':label,onkeydown:e=>{if(e.key==='Escape')close();}},...items.map(([text,sub,hue,fn,disabled])=>h('button',{type:'button',role:'menuitem',class:'menu-item',disabled,onclick:()=>{close();fn();}},
  hue?h('span',{class:'swatch',style:{background:hue}}):null,h('span',{class:'menu-text'},h('span',{},text),sub?h('span',{class:'sub'},sub):null))));
 const r=anchor.getBoundingClientRect();document.body.append(menu);
 menu.style.left=`${Math.max(8,Math.min(innerWidth-menu.offsetWidth-8,r.left))}px`;menu.style.top=`${Math.min(innerHeight-menu.offsetHeight-8,r.bottom+6)+scrollY}px`;
 setTimeout(()=>document.addEventListener('pointerdown',outside,true));menu.querySelector('button:not([disabled])')?.focus();
}
function openAddMenu(anchor,p,at){
 popover(anchor,[...EFFECT_TYPES.map(t=>[BLOCK_TYPES[t].name,BLOCK_TYPES[t].summary,BLOCK_TYPES[t].hue,()=>{const b=addBlock(setup(),p,t,at);app.sel={kind:'block',part:p.id,block:b.id};changed({structural:true});}]),
  ['EQ','Later','#5b6a70',()=>{},true],['Compressor','Later','#5b6a70',()=>{},true]],'Add effect');
}
function openPartMenu(anchor){
 popover(anchor,PART_CHOICES.map(([name,kind,layout])=>[name,KINDS[kind].basic?'Basic':'Plucked model','',()=>{
  if(parts().length>=16)return toast('A session holds at most 16 parts.',true);
  const p=newPart(kind,{name,factory,layout,taken:partIds(setup())});if(!busOf('room'))delete p.strip.sends.room;
  parts().push(p);app.sel={kind:'instrument',part:p.id};changed({structural:true,material:true});}]),'Add part');
}
function dropIndex(e,p){
 const blocks=[...e.currentTarget.querySelectorAll('.block.effect')];let at=p.chain.length;
 for(let i=0;i<blocks.length;i++){const r=blocks[i].getBoundingClientRect(),mid=narrow.matches?r.top+r.height/2:r.left+r.width/2;if((narrow.matches?e.clientY:e.clientX)<mid){at=i;break;}}
 return at;
}
function clearDrop(){for(const x of document.querySelectorAll('.drop-before,.drop-after,.lane.drop'))x.classList.remove('drop-before','drop-after','drop');}
function dragOver(e,p){
 if(!app.drag)return;e.preventDefault();e.dataTransfer.dropEffect='move';clearDrop();
 const at=dropIndex(e,p),blocks=e.currentTarget.querySelectorAll('.block.effect');e.currentTarget.classList.add('drop');
 if(blocks[at])blocks[at].classList.add('drop-before');else blocks[blocks.length-1]?.classList.add('drop-after');
}
function drop(e,p){
 if(!app.drag)return;e.preventDefault();const from=part(app.drag.part),at=dropIndex(e,p);clearDrop();
 const b=moveBlock(from,app.drag.index,p,at);app.sel={kind:'block',part:p.id,block:b.id};app.drag=null;changed({structural:true});
}
function removeSelected(){
 const s=app.sel;if(s.kind!=='block')return;const p=part(s.part),i=p.chain.findIndex(b=>b.id===s.block);if(i<0)return;
 const b=removeBlock(p,i);app.sel=p.chain[i]?{kind:'block',part:p.id,block:p.chain[i].id}:p.chain[i-1]?{kind:'block',part:p.id,block:p.chain[i-1].id}:{kind:'instrument',part:p.id};
 changed({structural:true});toast(`Removed ${BLOCK_TYPES[b.type]?.name??b.type} from ${p.name}. Undo brings it back.`);
}
function trashZone(){
 return h('div',{class:'trash','aria-hidden':'true',ondragover:e=>{if(app.drag){e.preventDefault();e.currentTarget.classList.add('over');}},ondragleave:e=>e.currentTarget.classList.remove('over'),
  ondrop:e=>{e.preventDefault();if(!app.drag)return;const p=part(app.drag.part);app.sel={kind:'block',part:p.id,block:p.chain[app.drag.index].id};app.drag=null;removeSelected();}},'Drop here to remove');
}

// --- Detail editors ---------------------------------------------------------------
// Listening switch (core-synth-performance step 1): Off plays every guitar without the
// attack soak, its body tone and the glide; the designs keep their values.
const ATTACK_OFF={thwack_soak:0,thwack_body:0};
player.prepare=s=>!app.thwackOff?s:{...s,parts:s.parts.map(p=>p.instrument.kind!=='plucked'||typeof p.instrument.design!=='object'?p
 :{...p,instrument:{...p.instrument,design:{...p.instrument.design,instrument:{...p.instrument.design.instrument,
   parameters:{...p.instrument.design.instrument.parameters,...ATTACK_OFF},setup:{...p.instrument.design.instrument.setup,tensionCents:0}}}}})};
const attackSwitch=()=>h('button',{type:'button',class:'btn small','aria-pressed':String(!app.thwackOff),title:'Hear every guitar with or without the attack soak, its body tone and the glide; the designs keep their values',
 onclick:()=>{app.thwackOff=!app.thwackOff;render();player.configure(setup()).catch(e=>toast(e.message,true));}},`Thwack: ${app.thwackOff?'Off':'On'}`);
const knobs=specs=>h('div',{class:'knobs'},...specs.map(s=>knob(s,ctx,{size:72})));
function detail(){
 const s=app.sel,body=s.kind==='block'?effectEditor(part(s.part),part(s.part).chain.find(b=>b.id===s.block)):s.kind==='instrument'?instrumentEditor(part(s.part))
  :s.kind==='strip'?stripEditor(part(s.part)):s.kind==='bus'?busEditor(busOf(s.bus)):masterEditor();
 return h('section',{class:'detail'+(app.sheet?' open':''),'aria-label':'Selected block',style:{'--hue':body.hue}},
  h('button',{type:'button',class:'sheet-close btn icon-btn','aria-label':'Close',onclick:()=>{app.sheet=false;render();}},icon('<path d="M5 5l10 10M15 5L5 15"/>')),
  h('div',{class:'detail-head'},h('span',{class:'hue-dot'}),h('span',{class:'title'},h('span',{class:'kind'},body.where),h('span',{class:'name'},body.title)),...body.head),
  ...body.content);
}
function stateSeg(states,get,set,label='Block state'){
 return h('div',{class:'seg',role:'group','aria-label':label},...states.map(st=>h('button',{type:'button','aria-pressed':String(get()===st),onclick:()=>{set(st);changed({structural:true});}},STATE_LABEL[st])));
}
// Bound: a knob edit refreshes, never redraws, so the button re-checks on every refresh.
function resetButton(label,fn,atDefault=()=>false){
 const b=h('button',{type:'button',class:'btn small',title:label,onclick:()=>{fn();changed({structural:true});}},'Reset');
 const update=()=>{b.disabled=atDefault();};update.el=b;ctx.bind(update);return b;
}
function effectEditor(p,b){
 const def=BLOCK_TYPES[b.type],i=p.chain.indexOf(b),state=b.state??'on';
 if(!def)return {hue:'#5b6a70',where:`${p.name.toUpperCase()} · EFFECT`,title:b.type,head:[h('span',{class:'muted small'},'Not available in this version; the signal passes through.')],content:[]};
 const preset=h('select',{'aria-label':'Preset',onchange:e=>{if(e.target.value){applyPreset(b,e.target.value);changed({structural:true});}}},
  h('option',{value:'',selected:!b.preset},'Custom'),...Object.keys(def.presets).map(n=>h('option',{value:n,selected:b.preset===n},n)));
 const numeric=Object.entries(def.params).filter(([,d])=>d.type!=='boolean'&&!d.choices);
 const content=[knobs(numeric.map(([k,d])=>blockSpec(b,k,d,def.hue)))];
 if(b.type==='echo'){
  const beats=def.params.beats,label=x=>({.25:'1/16',.5:'1/8',.75:'Dotted 1/8',1:'1/4',1.5:'Dotted 1/4',2:'1/2'})[x];
  content[0].append(h('div',{class:'echo-extra'},h('span',{class:'field-label'},'Time ',h('span',{class:'muted small'},'in beats, follows the music’s tempo')),
   h('div',{class:'chips',role:'group','aria-label':'Echo time'},...beats.choices.map(x=>h('button',{type:'button',class:'chip','aria-pressed':String((b.params.beats??beats.default)===x),onclick:()=>{b.params.beats=x;b.preset=undefined;changed({structural:true});}},label(x)))),
   h('label',{class:'check'},h('input',{type:'checkbox',checked:b.params.pingPong??true,onchange:e=>{b.params.pingPong=e.target.checked;b.preset=undefined;changed();}}),'Ping-pong between speakers')));
 }
 return {hue:def.hue,where:`${p.name.toUpperCase()} · EFFECT ${i+1} OF ${p.chain.length}`,title:def.name,
  head:[h('label',{class:'field'},h('span',{class:'muted'},'Preset'),preset),stateSeg(['on','off'],()=>b.state??'on',v=>{b.state=v;}),
   h('span',{class:'spacer'}),h('span',{class:'muted small note'},state==='off'?'Off: the signal passes unchanged; its tail rings out, then it costs nothing':'Changes are live'),
   resetButton(`Reset to ${b.basePreset??'its preset'}`,()=>resetBlock(b),()=>!!b.preset&&b.preset===b.basePreset),
   h('button',{type:'button',class:'btn small','aria-label':'Move left',disabled:i===0,onclick:()=>{moveBlock(p,i,p,i-1);changed({structural:true});}},'←'),
   h('button',{type:'button',class:'btn small','aria-label':'Move right',disabled:i===p.chain.length-1,onclick:()=>{moveBlock(p,i,p,i+2);changed({structural:true});}},'→'),
   h('button',{type:'button',class:'btn small',onclick:()=>{const c=duplicateBlock(setup(),p,i);app.sel={kind:'block',part:p.id,block:c.id};changed({structural:true});}},'Duplicate'),
   h('button',{type:'button',class:'btn small',onclick:removeSelected},'Remove')],content};
}
const allDesigns=()=>[...factory,...app.designs];
function instrumentEditor(p){
 if(p.instrument.kind!=='plucked')return basicEditor(p);
 const d=p.instrument.design,options=allDesigns();
 const select=h('select',{'aria-label':'Design',onchange:e=>{p.instrument.design=copy(options.find(o=>o.id===e.target.value));changed({structural:true});}},
  !options.some(o=>o.id===d.id)?h('option',{value:d.id,selected:true},d.name):'',h('optgroup',{label:'Factory'},...factory.map(o=>h('option',{value:o.id,selected:o.id===d.id},o.name))),
  app.designs.length?h('optgroup',{label:'Yours'},...app.designs.map(o=>h('option',{value:o.id,selected:o.id===d.id},o.name))):'');
 const saveDesign=()=>{const name=prompt('Name this design',p.instrument.design.name.replace(/ · edited$/,''));if(!name)return;
  try{app.designs=saveOwnDesign(store,app.designs,p,name,`own-${Date.now().toString(36)}`);changed({structural:true});toast('Design saved.');}catch(e){toast(e.message,true);}};
 const tab=app.guitarTab??0,[,specs]=GUITAR_SECTIONS[tab];
 const tabs=h('div',{class:'tabs',role:'tablist','aria-label':'Guitar sections'},...GUITAR_SECTIONS.map(([name],k)=>h('button',{type:'button',role:'tab','aria-selected':String(k===tab),onclick:()=>{app.guitarTab=k;render();}},name)));
 const level=spec(`${p.id}.trim`,'Level',{min:-24,max:24,unit:'dB',color:HUES.plucked,help:'Every design and layout plays at one loudness; Level trims this part around it',
  get:()=>p.instrument.design.trimDb??0,set:v=>{design(p).trimDb=Math.round(v*10)/10;}});
 const content=[h('div',{class:'design-level'},knob(level,ctx,{size:56}),h('p',{class:'hint'},'Designs and layouts are matched in loudness as heard (A-weighted), so you can compare them as they are. Level trims this one; the strip level and the master do the rest.')),
  tabs,...(GUITAR_SECTIONS[tab][0]==='Attack'?[h('div',{class:'attack-switch',style:{padding:'16px 26px 0'}},attackSwitch())]:[]),specs?knobs(specs(p)):GUITAR_SECTIONS[tab][0]==='Layout'?layoutEditor(p):registerTable(p)];
 // Bound, not static: the first edit makes an editable copy mid-drag, without a redraw.
 const sourceOf=()=>{const x=p.instrument.design;return x.source&&(allDesigns().find(o=>o.id===x.source)??factory.find(o=>o.id===x.basis));};
 const edited=h('span',{class:'edited'},'● edited'),reset=h('button',{type:'button',class:'btn small',onclick:()=>{const src=sourceOf();if(!src)return;const layout=p.instrument.layout;p.instrument.design=copy(src);p.instrument.layout=layout;changed({structural:true});}},'Reset');
 const update=()=>{const src=sourceOf();edited.hidden=!src;reset.disabled=!src;reset.title=src?`Reset to ${src.name}`:'Nothing to reset';};update.el=reset;ctx.bind(update);
 return {hue:HUES.plucked,where:`${p.name.toUpperCase()} · INSTRUMENT`,title:d.name,
  head:[edited,h('label',{class:'field'},h('span',{class:'muted'},'Design'),select),h('span',{class:'spacer'}),reset,
   h('button',{type:'button',class:'btn small',onclick:()=>preview(p)},'Hear a note'),h('button',{type:'button',class:'btn small soft',onclick:saveDesign},'Save design…')],content};
}
function registerTable(p){
 const s=p.instrument.design.instrument.strings,setupData=p.instrument.design.instrument.setup;
 const rows=[['detuneCents','Detune (cents)',-25,25],['decayScale','Decay scale',.4,1.6],...Object.entries(STRING_V2).map(([k,d])=>[k,d.name,d.min,d.max]),['fret12Cents','12th-fret intonation',-30,30],['fret24Cents','24th-fret intonation',-50,50]];
 const cell=(k,i,min,max)=>{const setupKey=k==='fret12Cents'||k==='fret24Cents',value=()=>setupKey?setupData[k][i]:s[k][i];
  return h('td',{},h('input',{type:'number',min,max,step:k==='freeRinging'?1:.001,value:value(),'aria-label':`${k} at ${noteName(s.register[i])}`,onchange:e=>{const v=Math.min(max,Math.max(min,Number(e.target.value)));
   if(!Number.isFinite(v))return;const dd=design(p);(setupKey?dd.instrument.setup[k]:dd.instrument.strings[k])[i]=k==='freeRinging'?Math.round(v):v;changed();}}));};
 return h('div',{class:'table-wrap'},h('table',{class:'register'},h('thead',{},h('tr',{},h('th',{},'Open pitch'),...s.register.map(m=>h('th',{},noteName(m))))),
  h('tbody',{},...rows.map(([k,label,min,max])=>h('tr',{},h('th',{scope:'row'},label),...s.register.map((_,i)=>cell(k,i,min,max)))))),
  h('p',{class:'hint'},'Values are anchored at these open pitches; strings tuned between them interpolate, so the design fits any layout.'));
}
function layoutEditor(p){
 const l=p.instrument.layout,set=next=>{p.instrument.layout=next;changed({structural:true,material:true});};
 const pitchSelect=(s,i)=>h('select',{'aria-label':`String ${i+1} pitch`,onchange:e=>{const next=copy(l);next.strings[i].pitch=Number(e.target.value);set(next);}},
  ...Array.from({length:41},(_,k)=>36+k).map(m=>h('option',{value:m,selected:m===s.pitch},noteName(m))));
 return h('div',{class:'layout-editor'},
  h('div',{class:'chips',role:'group','aria-label':'Tuning'},...Object.entries(LAYOUTS).map(([name,layout])=>h('button',{type:'button',class:'chip','aria-pressed':String(JSON.stringify(layout)===JSON.stringify(l)),onclick:()=>set(copy(layout))},name))),
  h('ol',{class:'strings'},...l.strings.map((s,i)=>h('li',{},h('span',{class:'string-no'},`String ${i+1}`),pitchSelect(s,i),
   l.strings.length>1?h('button',{type:'button',class:'btn small','aria-label':`Remove string ${i+1}`,onclick:()=>{const next=copy(l);next.strings.splice(i,1);set(next);}},'×'):null,
   h('button',{type:'button',class:'btn small',onclick:()=>preview(p,s.pitch+(l.capo??0),i+1)},'Pluck')))),
  h('div',{class:'row-actions'},l.strings.length<6?h('button',{type:'button',class:'btn small',onclick:()=>{const next=copy(l);next.strings.push({pitch:Math.max(36,Math.min(...l.strings.map(x=>x.pitch))-5)});set(next);}},'+ String'):null,
   h('label',{class:'field'},h('span',{class:'muted'},'Capo'),h('select',{'aria-label':'Capo',onchange:e=>set({...copy(l),capo:Number(e.target.value)})},...Array.from({length:13},(_,k)=>h('option',{value:k,selected:k===(l.capo??0)},k?`Fret ${k}`:'None'))))),
  h('p',{class:'hint'},'String 1 is the first tab line. Up to six strings. A guitar line written for other strings is moved into this layout’s range.'));
}
function basicEditor(p){
 const keys=p.instrument.kind==='keys';
 const play=keys?h('div',{class:'keyboard',role:'group','aria-label':'Keyboard'},...Array.from({length:25},(_,i)=>48+i).map(m=>h('button',{type:'button',class:'key'+([1,3,6,8,10].includes(m%12)?' black':''),'aria-label':noteName(m),onpointerdown:()=>preview(p,m)},'')))
  :h('div',{class:'pads',role:'group','aria-label':'Pads'},...['kick','snare','side-stick','tom-high','tom-mid','tom-low','hihat-closed','hihat-pedal','hihat-open','crash','ride'].map(piece=>h('button',{type:'button',class:'pad',onpointerdown:()=>preview(p,null,null,piece)},piece.replace('hihat','hi-hat').replace(/-(?!hat)/g,' '))));
 return {hue:HUES[p.instrument.kind],where:`${p.name.toUpperCase()} · INSTRUMENT · BASIC`,title:keys?'Basic piano':'Basic kit',
  head:[h('span',{class:'basic'},'basic'),h('span',{class:'spacer'}),h('span',{class:'muted small note'},'Basic instrument: correct behaviour and bounded levels only'),
   resetButton('Reset the level',()=>{p.instrument.design={...p.instrument.design,levelDb:0};},()=>!p.instrument.design.levelDb)],
  content:[h('div',{class:'knobs'},knob(levelSpec(p),ctx,{size:72}),play)]};
}
function stripEditor(p){
 const st=p.strip??={},buses=setup().session.buses??[];
 const name=h('input',{class:'part-title','aria-label':'Part name',value:p.name,onchange:e=>{p.name=e.target.value.trim().slice(0,120)||p.name;changed({structural:true});}});
 const specs=[spec(`${p.id}.level`,'Level',{min:-30,max:12,unit:'dB',color:HUES.strip,get:()=>st.levelDb??0,set:v=>{st.levelDb=Math.round(v*10)/10;}}),
  spec(`${p.id}.pan`,'Pan',{min:-1,max:1,color:HUES.strip,format:fmtPan,get:()=>st.pan??0,set:v=>{st.pan=Math.round(v*100)/100;}}),
  ...buses.map(b=>spec(`${p.id}.send.${b.id}`,`${BLOCK_TYPES[b.type]?.name??b.id} send`,{min:0,max:1,unit:'%',scale:100,color:HUES.strip,get:()=>st.sends?.[b.id]??0,set:v=>{(st.sends??={})[b.id]=Math.round(v*100)/100;}}))];
 return {hue:HUES.strip,where:'MIXER · CHANNEL STRIP',title:`${p.name} channel`,
  head:[h('label',{class:'field'},h('span',{class:'muted'},'Name'),name),
   h('button',{type:'button',class:'btn small','aria-pressed':String(!!st.mute),onclick:()=>{st.mute=!st.mute;changed({structural:true});}},'Mute'),
   h('button',{type:'button',class:'btn small','aria-pressed':String(!!st.solo),onclick:()=>{st.solo=!st.solo;changed({structural:true});}},'Solo'),h('span',{class:'spacer'}),
   resetButton('Reset level, pan, sends, mute and solo',()=>resetStrip(p,new Set(buses.map(b=>b.id)))),
   h('button',{type:'button',class:'btn small',onclick:()=>download(`${slug(p.name)}.rig.json`,partRig(app.session,p))},'Export part'),
   h('button',{type:'button',class:'btn small',disabled:parts().length<2,onclick:()=>{if(!confirm(`Remove ${p.name} from the session?`))return;setup().parts=parts().filter(x=>x!==p);keepSelection();changed({structural:true,material:true});}},'Remove part')],
  content:[knobs(specs)]};
}
function busEditor(b){
 const def=BLOCK_TYPES[b.type],preset=h('select',{'aria-label':'Preset',onchange:e=>{if(e.target.value){b.preset=e.target.value;b.basePreset=b.preset;b.params={...def.presets[b.preset]};changed({structural:true});}}},
  h('option',{value:'',selected:!b.preset},'Custom'),...Object.keys(def.presets).map(n=>h('option',{value:n,selected:b.preset===n},n)));
 return {hue:def.hue,where:'MIXER · RETURN BUS',title:def.name,
  head:[h('label',{class:'field'},h('span',{class:'muted'},'Preset'),preset),stateSeg(['on','off'],()=>b.state??'on',v=>{b.state=v;},'Bus state'),h('span',{class:'spacer'}),h('span',{class:'muted small note'},(b.state??'on')==='off'?'Off: no longer fed; its tail rings out, then it costs nothing':'Parts reach it through their sends'),
   resetButton(`Reset to ${b.basePreset??'Studio'}`,()=>{b.preset=b.basePreset??'Studio';b.basePreset=b.preset;b.params={...def.presets[b.preset]};},()=>!!b.preset&&b.preset===b.basePreset)],
  content:[knobs(Object.entries(def.params).map(([k,d])=>blockSpec(b,k,d,def.hue)))]};
}
function masterEditor(){
 const m=setup().session.master??={};
 const specs=Object.entries(MASTER_PARAMS).map(([k,d])=>spec(`master.${k}`,d.label,{min:d.min,max:d.max,unit:d.unit,color:'#c9d3d3',get:()=>m[k]??d.default,set:v=>{m[k]=Math.round(v*10)/10;}}));
 const meters=h('div',{class:'master-meters'},h('span',{class:'field-label'},'Output'),
  h('div',{class:'meter-row'},h('span',{class:'muted small'},'Peak'),h('div',{class:'meter wide'},h('span',{id:'master-peak'})),h('span',{class:'mono small',id:'master-peak-text'},'—')),
  h('div',{class:'meter-row'},h('span',{class:'muted small'},'Limiting'),h('div',{class:'meter wide reduce'},h('span',{id:'master-gr'})),h('span',{class:'mono small',id:'master-gr-text'},'0.0 dB')));
 return {hue:HUES.master,where:'MIXER · MASTER',title:'Master',head:[h('span',{class:'spacer'}),h('span',{class:'muted small note'},'The limiter only acts above the ceiling'),
  resetButton('Reset volume and ceiling',()=>{m.volumeDb=MASTER_PARAMS.volumeDb.default;m.ceilingDb=MASTER_PARAMS.ceilingDb.default;},()=>(m.volumeDb??0)===MASTER_PARAMS.volumeDb.default&&(m.ceilingDb??-1)===MASTER_PARAMS.ceilingDb.default)],content:[h('div',{class:'knobs'},...specs.map(s=>knob(s,ctx,{size:72})),meters)]};
}
// Inspect: live diagnostics; checks (an unedited example as written) or an analysis of
// what you are hearing (diagnostics and note labels, rendered offline in a worker); and
// the contract's test fixtures, for developers.
function inspectPanel(){
 const list=[...app.diagnostics.values()],piece=currentPiece(),checkable=unedited()&&piece.expect?.length>0;
 const section=(title,...kids)=>h('section',{class:'card'},h('h3',{},title),...kids);
 const tests=h('select',{'aria-label':'Test fixture',onchange:e=>e.target.value&&loadTestFixture(e.target.value)},h('option',{value:''},'Open a test fixture…'),...TEST_FIXTURES.map(n=>h('option',{value:n},n)));
 const action=checkable?h('button',{type:'button',class:'btn soft',disabled:app.checking,onclick:()=>runChecks(piece)},app.checking?'Checking…':'Run checks')
  :h('button',{type:'button',class:'btn soft',disabled:app.checking,onclick:()=>runChecks(hearingLog(app.session,arranged()))},app.checking?'Analysing…':'Analyse what I’m hearing');
 const hint=checkable?`Checks the example “${piece.fixture?.name??piece.fixture?.id}” as written.`:piece.expect?.length&&app.example?'Edited: checks apply to the example as written. Load it again from Session → Examples to run them.':'Renders your session and piece offline: every diagnostic and how each note was played.';
 const c=app.checks;
 return h('details',{class:'inspect',open:app.inspectOpen||list.some(d=>d.severity!=='info'),ontoggle:e=>{app.inspectOpen=e.currentTarget.open;}},
  h('summary',{},`Inspect${list.length?` · ${list.length} diagnostic${list.length>1?'s':''}`:''}`),
  section(`Diagnostics (${list.length})`,list.length?h('ul',{class:'diagnostics-list'},...list.slice(0,200).map(d=>h('li',{class:d.severity},h('span',{class:'code'},d.code),' ',d.part??d.bus??'',d.block?` · ${d.block}`:'',d.noteId?` · ${d.noteId.replace(/\.r\d+i\d+$/,'')}`:'',' — ',d.message))):h('p',{class:'hint'},'None so far. Diagnostics appear here while you play.')),
  section('Checks and note labels',h('div',{class:'row-actions'},action,h('span',{class:'muted small'},hint)),
   c?.result?h('p',{class:c.result.pass?'pass':'fail'},c.result.pass?'All checks pass.':'Some checks fail.'):null,
   c?.result?table(['Check','Target','Measured','Result'],c.result.results.map(r=>({class:r.pass?'pass':'fail',cells:[`${r.kind}${r.note?' · '+r.note:''}${r.part?' · '+r.part:''}`,target(r),measured(r),r.pass?'pass':'fail']}))):null,
   c?h('p',{class:'hint'},`${c.diagnostics.length} diagnostic(s) offline · ${c.labels.length} note(s)`):null,
   c?h('details',{class:'labels'},h('summary',{},`Note labels (${c.labels.length}): written onsets; a strummed chord's members play in string order`),table(['Note','Part','Onset','Target','Techniques'],c.labels.slice(0,300).map(l=>({cells:[l.id,l.part,(l.onsetFrame/48000).toFixed(3)+' s',l.pitch!==undefined?noteName(l.pitch):l.piece,l.techniques.map(x=>`${x.type}${x.native?'':' (lowered)'}`).join(', ')]})))):null),
  section('Test fixtures (developers)',h('p',{class:'hint'},'The contract’s conformance cases, including deliberate edge cases. One loads with its own setup, like an example.'),tests));
}

// --- Transport and preview ---------------------------------------------------------
async function play(){
 try{app.diagnostics.clear();if(app.compare==='A')app.compare='B';await player.play(setup(),arranged(),{loop:app.loop});}catch(e){toast('Could not start audio: '+e.message,true);}
}
async function stop(){try{await player.stop();}catch(e){toast('Could not stop audio: '+e.message,true);}}
async function preview(p,pitch,string,piece){
 try{
  if(p.instrument.kind==='kit')return await player.preview({part:p.id,duration:.2,velocity:.8,target:{piece}},setup());
  // Guitars preview a middle string: a low string alone is mostly below what small speakers play.
  const mid=p.instrument.kind==='plucked'?[...p.instrument.layout.strings].sort((a,b)=>a.pitch-b.pitch)[Math.floor(p.instrument.layout.strings.length/2)].pitch+(p.instrument.layout.capo??0):60;
  await player.preview({part:p.id,duration:p.instrument.kind==='keys'?.6:1.5,velocity:.7,target:{pitch:pitch??mid},...(string?{fingering:{string}}:{})},setup());
 }catch(e){toast(e.message,true);}
}
player.addEventListener('state',({detail})=>{html.dataset.audioState=detail.playing?'playing':'stopped';ctx.refresh();});
player.addEventListener('position',({detail})=>{const t=document.getElementById('time');if(t)t.textContent=`${Math.floor(detail/60)}:${String(Math.floor(detail%60)).padStart(2,'0')}`;
 const bar=document.getElementById('progress');if(bar&&player.material)bar.style.width=`${Math.min(100,detail/player.material.length*100)}%`;});
const dbWidth=x=>`${Math.max(0,Math.min(100,(20*Math.log10(Math.max(x,1e-6))+60)/60*100))}%`;
player.addEventListener('meter',({detail})=>{
 html.dataset.peak=String(Math.max(Number(html.dataset.peak||0),detail.peak));
 const set=(id,fn)=>{const el=document.getElementById(id);if(el)fn(el);};
 set('meter',el=>{el.style.width=dbWidth(detail.peak);});
 for(const el of document.querySelectorAll('[data-meter]'))el.style.width=dbWidth(detail.parts?.[el.dataset.meter]??0);
 const gr=-(detail.gainReductionDb??0);
 set('limiter-led',el=>el.classList.toggle('active',gr>.05));set('limiter-text',el=>{el.textContent=gr>.05?`Limiting ${gr.toFixed(1)} dB`:'Limiter idle';});
 set('master-peak',el=>{el.style.width=dbWidth(detail.peak);});set('master-peak-text',el=>{el.textContent=detail.peak>0?`${(20*Math.log10(detail.peak)).toFixed(1)} dB`:'—';});
 set('master-gr',el=>{el.style.width=`${Math.min(100,gr/12*100)}%`;});set('master-gr-text',el=>{el.textContent=`${gr.toFixed(1)} dB`;});
});
player.addEventListener('diagnostic',({detail})=>{const key=`${detail.code}:${detail.part??detail.bus??''}:${detail.block??''}:${(detail.noteId??'').replace(/\.r\d+i\d+$/,'')}`;if(!app.diagnostics.has(key)){app.diagnostics.set(key,detail);clearTimeout(app.diagTimer);app.diagTimer=setTimeout(render,150);}});
player.addEventListener('error',({detail})=>toast(detail.message??String(detail),true));

// --- Session menu and files --------------------------------------------------------
function download(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=h('a',{href:url,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'session';
function replaceSession(next,message,{example=false}={}){history.record(snapshot());app.session=next;app.committed=snapshot();app.saved=copy(next);app.compare='B';app.checks=null;app.example=example?exampleKey():null;app.sel={kind:'instrument',part:next.setup.parts[0].id};save();render();toast(message);
 (player.playing?play():player.configure(setup())).catch(e=>toast(e.message,true));}
function saveSession(){
 const name=prompt('Session name',app.session.name);if(!name)return;
 const next={...copy(app.session),name:name.slice(0,120)},saved=storedCollection(store,STORE.sessions,loadSession);
 if(!store.set(STORE.sessions,[...saved.filter(s=>s.name!==next.name),next])){toast('Could not save the session on this device. Export it to keep your edits.',true);return;}
 app.session=next;app.saved=copy(next);app.committed=snapshot();save();render();toast('Session saved.');
}
function openMenu(e){
 const anchor=e.currentTarget,saved=storedCollection(store,STORE.sessions,loadSession);
 if(store.recover.has(STORE.sessions))toast('Some saved sessions could not be read. Their original bytes are kept before the next save.',true);
 const file=h('input',{type:'file',accept:'.json,application/json',class:'sr-only','aria-label':'Open a rig, event log or fixture',onchange:async ev=>{const x=ev.target.files[0];if(x)openJson(await x.text(),x.name);file.remove();}});
 for(const old of document.querySelectorAll('input.session-file'))old.remove();
 file.classList.add('session-file');document.body.append(file);
 popover(anchor,[
  ['New session','Replaces the current one','',()=>{if(confirm('Start a new session? Export or save the current one first to keep it.'))replaceSession(defaultSession(factory),'New session.');}],
  ['Examples…','A piece with the setup it was written for','',()=>openExamples(anchor)],
  ['Open a file…','Rig 3.0.0, event log or fixture','',()=>file.click()],
  ['Export session','As rig 3.0.0 JSON: what plays, no music','',()=>download(`${slug(app.session.name)}.rig.json`,exportRig(app.session))],
  ['Export what I’m hearing','The session and its piece as one event log','',()=>download(`${slug(app.session.name)}.events.json`,hearingLog(app.session,arranged()))],
  ['Save session in this browser…','','',saveSession],
  ...saved.map(s=>[`Open “${s.name}”`,`${s.setup.parts.length} part(s)`,'',()=>replaceSession(s,`Opened ${s.name}.`)])],'Session');
}
function openExamples(anchor){
 popover(anchor,pieces.index.map(x=>[x.name,x.description,'',()=>loadExample(pieces.byId.get(x.id))]),'Examples');
}
// An example or a file with music: its setup and its piece together, as one undoable step.
function loadExample(piece,ref){
 try{replaceSession(exampleSession(piece,factory,ref),`Loaded ${piece.fixture?.name??piece.fixture?.id??'the event log'} with its setup.`,{example:true});}catch(e){toast(e.message,true);}
}
function openJson(text,name){
 let data;try{data=JSON.parse(text);}catch{toast(`${name} is not JSON.`,true);return;}
 try{
  if(data.fixture&&data.expect){validateFixture(data);loadExample(data,null);}
  else if(data.contract&&data.setup){validateEventLog(data);loadExample(data,null);}
  else replaceSession(importRig(data,app.session.piece),`Loaded ${data.name}. It plays the current piece.`);
 }catch(e){toast(`${name}: ${e instanceof ContractError?e.message:e.message}`,true);}
}

// --- Inspect helpers ----------------------------------------------------------------
const table=(head,rows)=>h('div',{class:'table-wrap'},h('table',{},h('thead',{},h('tr',{},...head.map(x=>h('th',{},x)))),h('tbody',{},...rows.map(r=>h('tr',{class:r.class},...r.cells.map((c,i)=>h('td',{class:i===1||i===2?'mono':undefined},c)))))));
const fmt=v=>typeof v==='number'?(Number.isInteger(v)?String(v):v.toFixed(2)):Array.isArray(v)?v.join(' '):String(v);
const target=r=>Object.entries(r).filter(([k])=>!['kind','note','part','reference','by','control','notes','pass','measured','error','curve'].includes(k)).map(([k,v])=>`${k} ${fmt(v)}`).join(', ');
const measured=r=>r.error??(Object.entries(r.measured??{}).filter(([k])=>!['closest','windows','seconds','referenceSeconds'].includes(k)).map(([k,v])=>`${k} ${Array.isArray(v)&&!v.length?'none':fmt(v)}`).join(', ')||'—');
async function loadTestFixture(name){try{openJson(await fetch(`./contract/fixtures/${name}.json`).then(r=>r.text()),name);}catch(e){toast(e.message,true);}}
const worker=()=>app.worker??=new Worker(new URL('./check-worker.js',import.meta.url),{type:'module'});
function runChecks(fixture){
 app.checking=true;app.inspectOpen=true;render();const id=Date.now();
 worker().onmessage=({data})=>{if(data.id!==id)return;app.checking=false;if(data.error)toast(data.error,true);else app.checks=data;html.dataset.checks=data.result?String(data.result.pass):'analysed';render();};
 worker().postMessage({id,fixture});
}

// --- Keyboard -----------------------------------------------------------------------
document.addEventListener('keydown',e=>{
 if(e.defaultPrevented||!app)return;
 const t=e.target;if(t.closest?.('input,select,textarea,[role=slider],.menu'))return;
 if(e.key===' '&&!t.closest('button')){e.preventDefault();player.playing?stop():play();return;}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
 const s=app.sel;
 if(s.kind==='block'&&(e.key==='Delete'||e.key==='Backspace')){e.preventDefault();removeSelected();return;}
 if(s.kind==='block'&&e.altKey&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){
  e.preventDefault();const p=part(s.part),i=p.chain.findIndex(b=>b.id===s.block),j=e.key==='ArrowLeft'?i-1:i+2;
  if(j<0||j>p.chain.length)return;moveBlock(p,i,p,j);changed({structural:true});focusSelected();return;}
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&t.closest?.('[data-nav]')){
  e.preventDefault();const [lane,pos]=t.closest('[data-nav]').dataset.nav.split(':').map(Number);
  const next=e.key==='ArrowLeft'?[lane,pos-1]:e.key==='ArrowRight'?[lane,pos+1]:e.key==='ArrowUp'?[lane-1,0]:[lane+1,0];
  const el=document.querySelector(`[data-nav="${next[0]}:${next[1]}"]`);if(el){el.focus();el.click();focusSelected();}
 }
});
function focusSelected(){requestAnimationFrame(()=>document.querySelector('.block.selected .face,.lane .face[aria-pressed="true"]')?.focus());}

// --- Render ------------------------------------------------------------------------
function render(){
 ctx.reset();html.dataset.parts=String(parts().length);
 const focusNav=document.activeElement?.dataset?.nav;app.arranged=arranged();
 const ghosts=app.arranged.lines.filter(l=>!l.part);html.dataset.ghosts=String(ghosts.length);
 const view=h('main',{class:'chain'},
  h('div',{class:'section-labels'},h('span',{},'PARTS → CHAINS'),h('span',{class:'spacer'}),h('span',{class:'mixer-label'},'MIXER')),
  h('section',{class:'lanes','aria-label':'Signal chains'},...parts().map(laneView),...ghosts.map(ghostLane),mixerRow()),
  trashZone(),app.compare==='A'?h('p',{class:'compare-banner',role:'status'},'Hearing the saved version. Your edits are kept; choose B to hear them again.'):null,
  detail(),inspectPanel());
 root.replaceChildren(header(),view,transport());
 if(focusNav)document.querySelector(`[data-nav="${focusNav}"]`)?.focus();
}

async function start(){
 const json=p=>fetch(p).then(r=>{if(!r.ok)throw Error(`Missing ${p}`);return r.json();});
 const [presets,index]=await Promise.all([json('./data/instrument-v2/presets.json'),json('./data/pieces/index.json')]);
 factory=factoryDesigns(presets);
 pieces={index:index.pieces,byId:new Map((await Promise.all(index.pieces.map(x=>json(`./data/pieces/${x.id}.json`)))).map(p=>[p.fixture.id,p]))};
 const designs=storedCollection(store,STORE.designs,d=>factoryDesigns([d])[0]);
 let session;try{const raw=store.get(STORE.session,null);session=raw?loadSession(raw):defaultSession(factory);}catch(e){store.protect(STORE.session);session=defaultSession(factory);toast('Your last session could not be read and was not changed on disk: '+e.message,true);}
 app={session,designs,saved:null,compare:'B',sel:{kind:'instrument',part:session.setup.parts[0].id},sheet:false,loop:true,
  diagnostics:new Map(),example:null,checks:null,checking:false,inspectOpen:false,burst:false,committed:''};
 app.committed=snapshot();
 if(store.recover.size)toast('Some saved data could not be read. Its original bytes are kept before new edits are saved; export important sessions as files.',true);
 if(!storage)toast('Browser storage is unavailable. Export your sessions as files to keep your edits.',true);
 await player.configure(setup());render();html.dataset.ready='true';
}
start().catch(e=>{root.replaceChildren(h('p',{class:'fatal'},'The synth could not start: '+e.message));console.error(e);});
