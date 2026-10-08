// Loudness matching (chain campaign Phase 4, C11): the model is current, designs land
// together on any layout, and keys and kit sit next to a guitar at a 0 dB strip.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {CONTRACT,STANDARD_GUITAR,UKULELE,migrateDesign} from '../web/host/index.js';
import {render} from '../web/host/node.js';
import {LOUDNESS_GRID,gatedLoudness} from '../web/host/instruments/plucked-loudness.js';
import {arrange} from '../web/app/pieces.js';
const model=JSON.parse(fs.readFileSync('web/data/instrument-v2/loudness.json')),presets=JSON.parse(fs.readFileSync('web/data/instrument-v2/presets.json'));
const piece=id=>JSON.parse(fs.readFileSync(`web/data/pieces/${id}.json`));
// Each kind plays its piece from the library, measured 12 dB down so the master limiter stays out of the comparison, then restored.
const PIECE={plucked:'guitar-recorded',ukulele:'ukulele-strum',keys:'keys-pedal',kit:'kit-groove'};
const loud=(part,id=PIECE[part.instrument.kind])=>{const setup={contract:CONTRACT,session:{master:{volumeDb:-12,ceilingDb:0}},parts:[part]},m=arrange(piece(id),setup);
 return 12+gatedLoudness(render({setup,notes:m.notes,controls:m.controls,seconds:m.length}).audio,48000);};
test('the loudness model covers every factory design on the current presets, and re-measures exactly',async()=>{
 assert.equal(model.presetsSha256,crypto.createHash('sha256').update(fs.readFileSync('web/data/instrument-v2/presets.json')).digest('hex'),'presets changed: run node scripts/measure_loudness.mjs');
 assert.deepEqual(model.grid,[...LOUDNESS_GRID]);assert.deepEqual(Object.keys(model.designs).sort(),presets.map(p=>p.id).sort());
 const {measure}=await import('../scripts/measure_loudness.mjs?spot');
 for(const [id,i] of [['rounded-steel',2],['soft-nylon',7],['bridge-electric',5]])assert.equal(measure(id,LOUDNESS_GRID[i]),model.designs[id][i],`${id} at ${LOUDNESS_GRID[i]}`);
});
test('designs play at one loudness as heard (A-weighted) on the guitar and on the ukulele; keys and kit sit beside them',()=>{
 const designs=['rounded-steel','nail-nylon','bright-metallic','soft-nylon','muted-jazz'],layouts={guitar:STANDARD_GUITAR,ukulele:UKULELE},means={};
 for(const [name,layout] of Object.entries(layouts)){
  const v=designs.map(d=>loud({id:'g',instrument:{kind:'plucked',design:d,layout}},name==='ukulele'?PIECE.ukulele:PIECE.plucked));means[name]=v.reduce((a,b)=>a+b)/v.length;
  assert.ok(Math.max(...v)-Math.min(...v)<=3,`${name}: ${v.map(x=>x.toFixed(1)).join(', ')} dB(A)`);
 }
 assert.ok(means.guitar>-26.5&&means.guitar<-22,`guitar ${means.guitar.toFixed(1)} dB(A) near −24`);
 assert.ok(Math.abs(means.ukulele-means.guitar)<=4,`ukulele ${means.ukulele.toFixed(1)} beside guitar ${means.guitar.toFixed(1)}`);
 for(const kind of ['keys','kit']){const l=loud({id:'p',instrument:{kind,design:kind==='keys'?'basic-piano':'basic-kit'}});assert.ok(Math.abs(l-means.guitar)<=3.5,`${kind} ${l.toFixed(1)} dB(A) beside guitar ${means.guitar.toFixed(1)}`);}
});
test('copies of a design are compensated like it, and a design with no known source gets the mean curve, never none',()=>{
 const factory=migrateDesign(presets.find(p=>p.id==='rounded-steel')),one=design=>loud({id:'g',instrument:{kind:'plucked',design,layout:STANDARD_GUITAR}});
 const base=one('rounded-steel');
 for(const [label,d] of [['copy with basis',{...factory,basis:'rounded-steel',id:'own-a',factory:false}],['copy with source',{...factory,source:'rounded-steel',id:'own-b',factory:false}],['no known source',{...factory,id:'from-elsewhere',factory:false}]])
  assert.ok(Math.abs(one(d)-base)<=3,`${label}: ${one(d).toFixed(1)} vs ${base.toFixed(1)} dB(A)`);
});

