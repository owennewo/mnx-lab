import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {beginBuild,verifyBundle,hash} from '../scripts/build_output.mjs';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'synth-build-safety-'));
test.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
const fill=(dir,text)=>{fs.writeFileSync(path.join(dir,'index.html'),text);fs.writeFileSync(path.join(dir,'app-manifest.json'),JSON.stringify({name:'synth-app',version:'0.1.0',files:{'index.html':hash(text)}}));};
test('broad, source, unrelated, symlink and malformed-manifest output paths fail without changing data',()=>{
 const root=fileURLToPath(new URL('..',import.meta.url));for(const out of ['/',os.homedir(),root,path.join(root,'web')])assert.throws(()=>beginBuild(out,'app-manifest.json'));
 const other=path.join(tmp,'user-files');fs.mkdirSync(other);fs.writeFileSync(path.join(other,'valuable.txt'),'keep');assert.throws(()=>beginBuild(other,'app-manifest.json'));assert.equal(fs.readFileSync(path.join(other,'valuable.txt'),'utf8'),'keep');
 const link=path.join(tmp,'link');fs.symlinkSync(other,link);assert.throws(()=>beginBuild(path.join(link,'child'),'app-manifest.json'),/Symlink/);
 const unsafe=path.join(tmp,'unsafe');fs.mkdirSync(unsafe);fs.writeFileSync(path.join(unsafe,'app-manifest.json'),JSON.stringify({name:'synth-app',files:{'../valuable.txt':'0'.repeat(64)}}));assert.throws(()=>beginBuild(unsafe,'app-manifest.json'),/Unsafe manifest/);
});
test('incomplete or invalid staged builds leave the preceding bundle intact',()=>{
 const dest=path.join(tmp,'atomic');fs.mkdirSync(dest);fill(dest,'before');
 const tx=beginBuild(dest,'app-manifest.json');fs.writeFileSync(path.join(tx.out,'index.html'),'incomplete');assert.throws(()=>tx.commit());assert.equal(fs.readFileSync(path.join(dest,'index.html'),'utf8'),'before');
});
test('a verified replacement is atomic and the previous output is recoverable',()=>{
 const dest=path.join(tmp,'replace');fs.mkdirSync(dest);fill(dest,'before');const tx=beginBuild(dest,'app-manifest.json');fill(tx.out,'after');const result=tx.commit();
 verifyBundle(dest,'app-manifest.json');assert.equal(fs.readFileSync(path.join(dest,'index.html'),'utf8'),'after');assert.equal(fs.readFileSync(path.join(result.previous,'index.html'),'utf8'),'before');
});
test('changed or undeclared files in an existing output are preserved and block replacement',()=>{
 const dest=path.join(tmp,'modified');fs.mkdirSync(dest);fill(dest,'before');fs.writeFileSync(path.join(dest,'notes.txt'),'user notes');assert.throws(()=>beginBuild(dest,'app-manifest.json'),/undeclared/);
 fs.unlinkSync(path.join(dest,'notes.txt'));fs.writeFileSync(path.join(dest,'index.html'),'user edit');assert.throws(()=>beginBuild(dest,'app-manifest.json'),/Changed bundle file/);assert.equal(fs.readFileSync(path.join(dest,'index.html'),'utf8'),'user edit');
});
test('nested files and a similarly named manifest use a globally sorted inventory',()=>{
 const tx=beginBuild(path.join(tmp,'nested'),'app-manifest.json');fs.mkdirSync(path.join(tx.out,'app'));fs.writeFileSync(path.join(tx.out,'app','main.js'),'module');
 fs.writeFileSync(path.join(tx.out,'app-manifest.json'),JSON.stringify({name:'synth-app',files:{'app/main.js':hash('module')}}));tx.commit();
});
