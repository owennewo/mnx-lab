import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importMusicXML } from '../../converters/musicxml-mnx/src/import/musicxml.ts';
import { exportMusicXML } from '../../converters/musicxml-mnx/src/export/mnx.ts';
import { readMxl } from '../../converters/musicxml-mnx/src/common/mxl.ts';
export const ORACLE_ROOT = fileURLToPath(new URL('../../',import.meta.url));
export interface OracleCase { id:string; group:string; source?:string; document?:unknown; exported?:string; error?:string }
export async function oracleCases(): Promise<OracleCase[]> {
  const cases: OracleCase[]=[];
  async function source(id:string,group:string,file:string) {
    const bytes=fs.readFileSync(file);
    const xml=file.endsWith('.mxl')?await readMxl(bytes):bytes.toString('utf8');
    const item:OracleCase={id,group,source:xml};
    try { item.document=importMusicXML(xml); } catch(e) { item.error=`import: ${(e as Error).message}`; }
    cases.push(item);
  }
  const suite=path.join(ORACLE_ROOT,'converters/fixtures/musicxml-suite');
  const manifest=JSON.parse(fs.readFileSync(path.join(suite,'manifest.json'),'utf8'));
  for(const f of manifest.fixtures) await source(`suite/${f.id}`,f.testClass,path.join(suite,f.path));
  const pairs=path.join(ORACLE_ROOT,'converters/fixtures/w3c-comparisons');
  for(const f of fs.readdirSync(pairs).filter(f=>f.endsWith('.musicxml')).sort()) await source(`w3c/${f.slice(0,-9)}`,'w3c',path.join(pairs,f));
  const scenarios=path.join(ORACLE_ROOT,'scenarios');
  function walk(dir:string) {
    for(const e of fs.readdirSync(dir,{withFileTypes:true})) {
      const full=path.join(dir,e.name);
      if(e.isDirectory())walk(full);
      else if(e.name==='document.mnx.json')cases.push({id:`scenario/${path.relative(scenarios,dir)}`,group:'scenario',document:JSON.parse(fs.readFileSync(full,'utf8'))});
    }
  }
  walk(scenarios);
  const fixtures=path.join(ORACLE_ROOT,'converters/fixtures');
  for(const f of fs.readdirSync(fixtures).filter(f=>f.endsWith('.mnx.json')).sort())cases.push({id:`reference/${f.slice(0,-9)}`,group:'reference',document:JSON.parse(fs.readFileSync(path.join(fixtures,f),'utf8'))});
  for(const c of cases) if(c.document) {
    try { c.exported=exportMusicXML(c.document as never); } catch(e) { c.error=`export: ${(e as Error).message}`; }
  }
  return cases.sort((a,b)=>a.id.localeCompare(b.id));
}
