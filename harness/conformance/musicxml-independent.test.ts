import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { describe,expect,it } from 'vitest';
import { ORACLE_ROOT,oracleCases } from '../helpers/musicxmlOracleCases.ts';
import { canonicalTable,mnxSemanticTable,tableDelta,type SemanticTable } from '../helpers/musicxmlSemantics.ts';
const hash=(text:string|Buffer)=>createHash('sha256').update(text).digest('hex');
const captureFile=path.join(ORACLE_ROOT,'harness/fixtures/musicxml-independent.json');
const reportFile=path.join(ORACLE_ROOT,'harness/reports/musicxml-independent.json');
const CAPTURE=process.env.CAPTURE_MUSICXML_ORACLE==='1';
const CHECK_LIVE=process.env.CHECK_MUSICXML_ORACLE==='1';
const UPDATE=process.env.UPDATE_MUSICXML_INDEPENDENT==='1';
const cases=await oracleCases();
const adapter=path.join(ORACLE_ROOT,'harness/musicxml-oracle/capture.py');
const schemaRoot=path.join(ORACLE_ROOT,'harness/fixtures/musicxml-4.0');
const fingerprints=Object.fromEntries([
  'harness/musicxml-oracle/capture.py','harness/musicxml-oracle/uv.lock',
  ...['musicxml.xsd','xml.xsd','xlink.xsd'].map(n=>`harness/fixtures/musicxml-4.0/${n}`),
].map(n=>[n,hash(fs.readFileSync(path.join(ORACLE_ROOT,n)))]));
if(CAPTURE||CHECK_LIVE) {
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mnx-musicxml-oracle-'));
  try {
    const request=path.join(tmp,'request.json'),output=path.join(tmp,'output.json');
    fs.writeFileSync(request,JSON.stringify(cases.map(({id,source,exported})=>({id,source,exported}))));
    execFileSync('uv',['run','--project',path.join(ORACLE_ROOT,'harness/musicxml-oracle'),'--locked','python',adapter,request,output],{stdio:'inherit',timeout:300000});
    const fresh={...JSON.parse(fs.readFileSync(output,'utf8')),fingerprints};
    if(CHECK_LIVE) expect(fresh).toEqual(JSON.parse(fs.readFileSync(captureFile,'utf8')));
    if(CAPTURE) fs.writeFileSync(captureFile,JSON.stringify(fresh,null,2)+'\n');
  } finally { fs.rmSync(tmp,{recursive:true,force:true}); }
}
interface Judgment {sha256:string;semantic:{status:string;table?:SemanticTable;reason?:string;error?:string};xsd?:{valid:boolean;errors:unknown[]} }
const capture=JSON.parse(fs.readFileSync(captureFile,'utf8')) as {
  fingerprints:Record<string,string>;tools:unknown;cases:{id:string;source?:Judgment;exported?:Judgment}[];
};
const byId=new Map(capture.cases.map(c=>[c.id,c]));
function compare(oracle:Judgment|undefined,document:unknown) {
  if(!oracle)return {status:'unavailable'};
  if(oracle.semantic.status!=='ok')return {status:'oracle-limited',reason:oracle.semantic.reason??oracle.semantic.error};
  try {
    const actual=mnxSemanticTable(document);
    const parts=(document as {parts?:{_x?:{mnxLab?:{tab?:{staffKind?:string}}}}[]}).parts??[];
    if(oracle.semantic.table!.parts>actual.parts && parts.some(p=>p._x?.mnxLab?.tab?.staffKind==='both')) {
      return {status:'adapter-limited',reason:'Default notation/TAB display duplication requires part correspondence; not a semantic loss verdict'};
    }
    const delta=tableDelta(canonicalTable(oracle.semantic.table!),actual);
    return {status:delta.match?'match':'different',...delta};
  } catch(e) {return {status:'adapter-limited',reason:(e as Error).message};}
}
const rows=cases.map(c=>{
  const reference=byId.get(c.id);
  return {id:c.id,group:c.group,...(c.error?{error:c.error}:{}),
    ...(c.source?{import: c.document?compare(reference?.source,c.document):{status:'failed'}}:{}),
    export: c.exported?compare(reference?.exported,c.document):{status:'failed'},
    xsd:reference?.exported?.xsd??{valid:false,errors:[c.error??'No export captured']},
  };
});
const summary=Object.fromEntries([...new Set(rows.map(r=>r.group))].sort().map(group=>{
  const subset=rows.filter(r=>r.group===group);
  const tally=(field:'import'|'export')=>subset.reduce<Record<string,number>>((a,r)=>{
    const s=r[field]?.status;if(s)a[s]=(a[s]??0)+1;return a;
  },{});
  return [group,{cases:subset.length,import:tally('import'),export:tally('export'),xsdValid:subset.filter(r=>r.xsd.valid).length}];
}));
const report={note:'Independent music21 note-table and MusicXML 4.0 XSD checks. Match certifies only the declared table scope. '
  +'Oracle/adapter limitations are not passes. Root tests verify committed captures against exact XML and tool/schema fingerprints; '
  +'npm run check:musicxml-oracle-live reruns the external tools. Existing discrepancies form an explicit reviewed baseline, not an accuracy target.',
  tools:capture.tools,summary,rows};
if(UPDATE||CAPTURE)fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');

describe('independent MusicXML evidence',()=>{
  it('uses unchanged external tool/schema inputs and covers every current source/export',()=>{
    expect(capture.fingerprints).toEqual(fingerprints);
    expect(capture.cases.map(c=>c.id)).toEqual(cases.map(c=>c.id));
    const pin=JSON.parse(fs.readFileSync(path.join(schemaRoot,'provenance.json'),'utf8'));
    for(const [file,digest] of Object.entries(pin.files))expect(hash(fs.readFileSync(path.join(schemaRoot,file))),file).toBe(digest);
    for(const c of cases)for(const key of ['source','exported'] as const) {
      const external=byId.get(c.id)?.[key];
      if(c[key]!==undefined)expect(external?.sha256,`${c.id} ${key}: recapture external judgments`).toBe(hash(c[key]!));
      else expect(external,`${c.id} ${key}: stale evidence`).toBeUndefined();
    }
  });
  it('matches the reviewed semantic/XSD baseline',()=>{
    if(UPDATE||CAPTURE)return;
    expect(report).toEqual(JSON.parse(fs.readFileSync(reportFile,'utf8')));
  });
  it('detects pitch, timing, lyric and voice-partition corruption in an independently read score',()=>{
    const c=cases.find(c=>c.id==='w3c/two-bar-c-major-scale')!;
    const table=mnxSemanticTable(c.document);
    const expected=canonicalTable(byId.get(c.id)!.source!.semantic.table!);
    expect(tableDelta(expected,table).match).toBe(true);
    for(const change of [
      (t:SemanticTable)=>{t.rows[0].pitch='99/1';},
      (t:SemanticTable)=>{t.rows[0].onset='1/7';},
      (t:SemanticTable)=>{t.rows[0].lyrics=[['1','wrong','single']];},
      (t:SemanticTable)=>{t.rows[0].voice='extra';},
      (t:SemanticTable)=>{t.rows.push({...t.rows[0]});},
    ]) {const mutated=structuredClone(table);change(mutated);expect(tableDelta(expected,canonicalTable(mutated)).match).toBe(false);}
  });
  it('preserves timing through nested tuplets and grace without consuming metric time',()=>{
    const event={duration:{base:'eighth'},notes:[{pitch:{step:'C',octave:4}}]};
    const t=mnxSemanticTable({global:{measures:[{}]},parts:[{measures:[{sequences:[{content:[
      {type:'tuplet',inner:{duration:{base:'eighth'},multiple:3},outer:{duration:{base:'eighth'},multiple:2},content:[
        {type:'grace',content:[event]},event,event,event,
      ]},event,
    ]}]}]}]});
    expect(t.rows.filter(r=>!r.grace).map(r=>r.onset).sort()).toEqual(['0/1','1/1','1/3','2/3']);
    expect(t.rows.find(r=>r.grace)?.duration).toBe('0/1');
  });
});
