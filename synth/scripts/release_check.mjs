// Full automated gate. Browser prerequisites are checked BEFORE expensive tests:
// required browser tests cannot disappear behind a skip or an absent dependency.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {hash} from './build_output.mjs';
import {verifyCandidate,unpackBundle} from './release_artifacts.mjs';
import {sourceSnapshot} from './release_sources.mjs';
const ROOT=fileURLToPath(new URL('..',import.meta.url));process.chdir(ROOT);
assert.ok(process.env.PLAYWRIGHT_MODULE&&fs.existsSync(process.env.PLAYWRIGHT_MODULE),'Release blocked: set PLAYWRIGHT_MODULE to an installed Playwright entry point. Required browser checks cannot be skipped.');
assert.ok(process.argv[2],'Usage: npm run release:check -- dist/releases/CANDIDATE');
const candidateDir=path.resolve(process.argv[2]),candidate=verifyCandidate(candidateDir),before=sourceSnapshot();
assert.equal(candidate.sourceSha256,hash(JSON.stringify(before)),'Candidate is stale');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'synth-release-gate-')),servers=[],checks=[];
const reportRoot=path.resolve('build/release-checks');fs.mkdirSync(reportRoot,{recursive:true});
const reportDir=fs.mkdtempSync(path.join(reportRoot,'check-'));let status='failed';
const run=async(name,args,env={})=>{
 const started=new Date().toISOString();let output='';
 const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd:ROOT,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
  for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{output+=b.toString();process.stdout.write(b);});child.on('error',reject);child.on('close',resolve);});
 fs.writeFileSync(path.join(reportDir,name+'.log'),output);const skipped=/# skipped [1-9]\d*/.test(output);
 checks.push({name,started,exitCode:code,skipped,log:name+'.log',sha256:hash(output)});assert.equal(code,0,`${name} failed`);assert.ok(!skipped,`${name} skipped a required test`);
};
async function serve(root){
 const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.wasm':'application/wasm','.css':'text/css'};
 const server=http.createServer((req,res)=>{try{
  const requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+requested,requested.endsWith('/')?'index.html':'');
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
 }catch{res.writeHead(400);res.end();}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});servers.push(server);return `http://127.0.0.1:${server.address().port}`;
}
try{
 const app=path.join(tmp,'app'),lib=path.join(tmp,'lib');
 unpackBundle(fs.readFileSync(path.join(candidateDir,candidate.archives.app)),app,'app-manifest.json',`synth-app-${candidate.version}`);
 unpackBundle(fs.readFileSync(path.join(candidateDir,candidate.archives.lib)),lib,'lib-manifest.json','package');
 const builtUrl=await serve(app),sourceUrl=await serve(path.resolve('web'));
 await run('candidate',['scripts/release_verify.mjs',candidateDir]);
 // npm is run as a node CLI so no shell interpolation is involved.
 const npm=process.env.npm_execpath;assert.ok(npm,'Run this gate via npm run release:check');
 await run('unit',[npm,'test'],{LIB_TEST_PACKAGE_DIR:lib});
 await run('release-regressions',[npm,'run','test:release']);
 await run('pieces',['tests/pieces.test.mjs']);
 await run('host-browser',['tests/host-browser.mjs'],{STUDIO_URL:sourceUrl});
 await run('built-app-browser',['tests/app-browser.mjs'],{STUDIO_URL:builtUrl,APP_TEST_OUTPUT:path.join(reportDir,'screenshots')});
 assert.equal(hash(JSON.stringify(sourceSnapshot())),candidate.sourceSha256,'Sources changed during the gate');status='passed';
}finally{
 for(const server of servers)await new Promise(r=>server.close(r));fs.rmSync(tmp,{recursive:true,force:true});
 fs.writeFileSync(path.join(reportDir,'report.json'),JSON.stringify({schema:'synth-release-check/1',status,candidateSha256:hash(fs.readFileSync(path.join(candidateDir,'candidate.json'))),sourceSha256:candidate.sourceSha256,checks,
  pending:['manual-built-app-review','user-listening','distribution-notice-review','promotion-approval']},null,2)+'\n');
 console.log(`Automated gate ${status}: ${reportDir}. This does not promote or publish the candidate.`);
}
