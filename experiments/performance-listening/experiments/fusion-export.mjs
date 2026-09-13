import fs from "node:fs";
import path from "node:path";
import {readJSON,writeJSON} from "../evaluation/io.mjs";
const [run,output] = process.argv.slice(2).map(p=>path.resolve(p));
if(!run || !output) throw Error("Usage: fusion-export.mjs RUN NEW_REFERENCE");
if(fs.existsSync(output)) throw Error("Refusing to overwrite "+output);
for(const file of ["provenance.json","selection.json","decision.json","development-summary.json","heldout-summary.json"])
 writeJSON(path.join(output,file),readJSON(path.join(run,file)));
const selected=readJSON(path.join(run,"selection.json")).id;
for(const split of ["development","heldout"]) {
 const data=readJSON(path.join(run,split+"-results.json"));
 writeJSON(path.join(output,split+"-audio-manifest.json"),data.audioManifest);
 const cases=data.results.filter(r=>r.strategy==="F-000"||r.strategy===selected).map(({metrics,...r})=>({...r,metrics:{...metrics,confidenceCurve:undefined,scoreBins:undefined,polyphony:undefined}}));
 fs.writeFileSync(path.join(output,split+"-cases.jsonl"),cases.map(r=>JSON.stringify(r)).join("\n")+"\n");
}
console.log("Exported "+output);
