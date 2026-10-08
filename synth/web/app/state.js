// Synth app state (chain campaign). A session is a named mnx-sound/2 setup (exported
// as rig 3.0.0, which carries no music) plus the piece it plays: a library id, or a
// piece opened from a file. Fresh start (C2): new storage
// keys, nothing older is read or converted.
import {CONTRACT,validateSetup,makeRig,validateRig,migrateDesign,STANDARD_GUITAR,UKULELE,BLOCK_TYPES} from '../host/index.js';
import {DEFAULT_PIECE} from './pieces.js';

export const STORE={session:'synth2.session',designs:'synth2.designs',sessions:'synth2.sessions'};
const copy=x=>JSON.parse(JSON.stringify(x));

export const LAYOUTS={
 'Standard guitar':STANDARD_GUITAR,
 'Drop D':{strings:[64,59,55,50,45,38].map(pitch=>({pitch})),capo:0},
 'DADGAD':{strings:[62,57,55,50,45,38].map(pitch=>({pitch})),capo:0},
 'Open G':{strings:[62,59,55,50,43,38].map(pitch=>({pitch})),capo:0},
 'Ukulele (GCEA)':UKULELE,
 'Baritone ukulele (DGBE)':{strings:[64,59,55,50].map(pitch=>({pitch})),capo:0},
};
export const KINDS={plucked:{label:'Plucked',basic:false},keys:{label:'Keys',basic:true},kit:{label:'Kit',basic:true}};
export const PART_CHOICES=[['Guitar','plucked',LAYOUTS['Standard guitar']],['Ukulele','plucked',LAYOUTS['Ukulele (GCEA)']],['Keys','keys'],['Kit','kit']];

// Factory designs carry their own id as `basis`: copies keep it, and it selects the
// loudness curve that levels every design and layout (chain campaign Phase 4).
export function factoryDesigns(presets){return presets.map(p=>({...migrateDesign(p),basis:p.basis??p.id}));}
export function uniqueId(base,taken){const slug=base.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'x';let id=slug,i=2;while(taken.has(id))id=`${slug}-${i++}`;return id;}
export const partIds=setup=>new Set(setup.parts.map(p=>p.id));

export function newPart(kind,{name,factory,layout,taken=new Set()}){
 const id=uniqueId(name??kind,taken),sends={room:kind==='plucked'?.3:.15};
 if(kind==='plucked')return {id,name:name??'Guitar',instrument:{kind,design:copy(factory[0]),layout:copy(layout??STANDARD_GUITAR)},chain:[],strip:{levelDb:0,pan:0,mute:false,solo:false,sends}};
 if(kind==='keys')return {id,name:name??'Keys',instrument:{kind,design:{id:'basic-piano'}},chain:[],strip:{levelDb:0,pan:0,mute:false,solo:false,sends}};
 return {id,name:name??'Kit',instrument:{kind,design:{id:'basic-kit'}},chain:[],strip:{levelDb:0,pan:0,mute:false,solo:false,sends}};
}
export const ROOM_BUS=()=>({id:'room',type:'room',state:'on',preset:'Studio',basePreset:'Studio',params:copy(BLOCK_TYPES.room.presets.Studio)});
export function defaultSession(factory){
 return {name:'Untitled session',piece:DEFAULT_PIECE,
  setup:{contract:CONTRACT,session:{buses:[ROOM_BUS()],master:{volumeDb:0,ceilingDb:-1}},parts:[newPart('plucked',{name:'Guitar',factory})]}};
}
// Every stored, opened or imported session passes through here.
export function loadSession(raw){
 if(!raw||typeof raw.name!=='string'||!raw.setup)throw Error('Not a synth session');
 const piece=typeof raw.piece==='string'||(raw.piece&&typeof raw.piece==='object'&&raw.piece.setup&&Array.isArray(raw.piece.notes??raw.piece.batches))?copy(raw.piece):DEFAULT_PIECE;
 const s={name:raw.name.slice(0,120)||'Untitled session',piece,setup:copy(raw.setup)};
 for(const p of s.setup.parts){if(!KINDS[p.instrument?.kind])throw Error(`Part ${p.id}: instrument kind ${p.instrument?.kind} is not available in this app`);
  p.name??=p.id;p.chain??=[];p.strip??={};if(p.instrument.kind==='plucked'){p.instrument.design=migrateDesign(p.instrument.design);p.instrument.layout??=copy(p.instrument.design.defaultLayout??STANDARD_GUITAR);}}
 validateSetup(s.setup);return s;
}
export const exportRig=(session,name=session.name)=>makeRig(name,session.setup);
// A rig is what plays; the current piece keeps playing.
export function importRig(data,piece=DEFAULT_PIECE){const rig=validateRig(data);return loadSession({name:rig.name,piece,setup:rig.setup});}
// A piece with its own setup (an example, or a fixture or event log opened from a file):
// design ids become copies of the factory designs.
export function exampleSession(piece,factory,ref=piece.fixture?.id){
 const setup=copy(piece.setup);
 for(const p of setup.parts)if(p.instrument.kind==='plucked'&&typeof p.instrument.design==='string'){const d=factory.find(x=>x.id===p.instrument.design);if(!d)throw Error(`Unknown design ${p.instrument.design}`);p.instrument.design=copy(d);}
 return loadSession({name:piece.fixture?.name??piece.fixture?.id??'Event log',piece:ref??copy(piece),setup});
}
// What you are hearing, as one event log: the setup plus the arranged piece.
export const hearingLog=(session,arranged,name=session.name)=>({contract:CONTRACT,fixture:{id:name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'session',name,description:'Exported from the synth: a session and the piece it played'},
 setup:copy(session.setup),notes:arranged.notes,controls:arranged.controls,render:{rate:48000,seconds:arranged.length}});
// A single part as its own rig, with only the buses it sends to.
export function partRig(session,part){
 const used=new Set(Object.keys(part.strip?.sends??{})),setup={...copy(session.setup),parts:[copy(part)]};
 setup.session.buses=(setup.session.buses??[]).filter(b=>used.has(b.id));return makeRig(part.name??part.id,setup);
}

// --- Chain edits ------------------------------------------------------------------
const presetParams=(type,name)=>({...Object.fromEntries(Object.entries(BLOCK_TYPES[type].params).map(([k,d])=>[k,d.default])),...(BLOCK_TYPES[type].presets[name]??{})});
export function newBlock(type,taken){const preset=Object.keys(BLOCK_TYPES[type].presets)[0];return {id:uniqueId(type,taken),type,state:'on',preset,basePreset:preset,params:presetParams(type,preset)};}
export const blockIds=setup=>new Set(setup.parts.flatMap(p=>p.chain.map(b=>b.id)));
export function addBlock(setup,part,type,at=part.chain.length){const b=newBlock(type,blockIds(setup));part.chain.splice(at,0,b);return b;}
export function duplicateBlock(setup,part,index){const b={...copy(part.chain[index]),id:uniqueId(part.chain[index].type,blockIds(setup))};part.chain.splice(index+1,0,b);return b;}
export function removeBlock(part,index){return part.chain.splice(index,1)[0];}
// Moves a block within or across lanes; `to` is the index in the target lane before removal.
export function moveBlock(from,fromIndex,to,toIndex){
 const [b]=from.chain.splice(fromIndex,1);if(from===to&&toIndex>fromIndex)toIndex--;
 to.chain.splice(Math.max(0,Math.min(to.chain.length,toIndex)),0,b);return b;
}
export function applyPreset(block,name){block.preset=name;block.basePreset=name;block.params=presetParams(block.type,name);}
// Reset: back to the last preset chosen for the block (its first preset if none).
export function resetBlock(block){applyPreset(block,block.basePreset??Object.keys(BLOCK_TYPES[block.type].presets)[0]);}
export const partDefaults=kind=>({levelDb:0,pan:0,mute:false,solo:false,sends:{room:kind==='plucked'?.3:.15}});
export function resetStrip(part,busIds){const d=partDefaults(part.instrument.kind);d.sends=Object.fromEntries(Object.entries(d.sends).filter(([id])=>busIds.has(id)));part.strip=d;}

// --- Undo -------------------------------------------------------------------------
// Snapshots are whole sessions as JSON; a burst of edits (a knob drag) is one step.
export class History{
 constructor(limit=100){this.limit=limit;this.past=[];this.future=[];}
 record(snapshot){if(this.past.at(-1)===snapshot)return;this.past.push(snapshot);if(this.past.length>this.limit)this.past.shift();this.future=[];}
 undo(current){if(!this.past.length)return null;this.future.push(current);return this.past.pop();}
 redo(current){if(!this.future.length)return null;this.past.push(current);return this.future.pop();}
 get canUndo(){return this.past.length>0;}
 get canRedo(){return this.future.length>0;}
}

// --- Storage ----------------------------------------------------------------------
export class Store{
 constructor(storage){this.storage=storage;this.recover=new Map();}
 get(key,fallback){
  let raw;try{raw=this.storage.getItem(key);return raw?JSON.parse(raw):fallback;}
  catch{if(typeof raw==='string')this.recover.set(key,raw);return fallback;}
 }
 // A syntactically valid value can still fail a schema check.
 protect(key){try{const raw=this.storage.getItem(key);if(raw!==null)this.recover.set(key,raw);}catch{}}
 set(key,value){
  try{
   const encoded=JSON.stringify(value);
   if(this.recover.has(key)){
    let backup=key+'.before-recovery',i=1;while(this.storage.getItem(backup)!==null)backup=key+'.before-recovery-'+i++;
    this.storage.setItem(backup,this.recover.get(key));this.recover.delete(key);
   }
   this.storage.setItem(key,encoded);return true;
  }catch{return false;}
 }
}
// Salvage readable entries without rewriting a damaged library. Before any later
// save, Store keeps the entire original byte sequence as a recovery copy.
export function storedCollection(store,key,convert,fallback=[]){
 const raw=store.get(key,fallback);
 if(!Array.isArray(raw)){store.protect(key);return [];}
 const valid=[];for(const item of raw){try{valid.push(convert(copy(item)));}catch{store.protect(key);}}
 return valid;
}
// Persist the CURRENT edited design; commit in memory only after the write succeeds.
export function saveOwnDesign(store,designs,part,name,id){
 const {source,...design}=copy(part.instrument.design),own={...design,factory:false,id,name:name.slice(0,80)};
 const next=[...designs.filter(x=>x.name!==own.name),own];
 if(!store.set(STORE.designs,next))throw Error('Could not save the design on this device. Export the session to keep your edits.');
 part.instrument.design=copy(own);return next;
}
export {CONTRACT,copy};
