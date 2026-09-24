// Observations, NOT rendering verdicts. Original files enter the real workbench
// file input; screenshots tile the scroll host without changing score layout.
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { devtoolsPort, connect, client, waitFor } from './browserHarness.mjs';
import { startLocalLibrary } from './localLibrary.mjs';
import { serveStatic } from './staticServer.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.resolve(process.env.MUSICXML_CAPTURE_DIR ?? '/tmp/mnx-musicxml-editor-captures');
const shell = process.env.MUSICXML_CAPTURE_SHELL ?? 'workbench';
if (!['workbench', 'studio'].includes(shell)) throw new Error('Unknown shell');
const library = shell === 'studio' ? await startLocalLibrary() : null;
const origin = library?.origin;
const session = library?.session ?? null;
const filter = process.env.MUSICXML_CAPTURE_FILTER;
const showMeters = process.env.MUSICXML_CAPTURE_TIME_SIGNATURES === 'show';
const showAllLyrics = process.env.MUSICXML_CAPTURE_LYRICS === 'all';
const manifest = JSON.parse(await fs.readFile(path.join(root, 'converters/fixtures/musicxml-suite/manifest.json')));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
await fs.mkdir(output, { recursive: true });
const site = shell === 'workbench' ? await serveStatic(path.join(root, 'dist/client')) : null;
const profile = await fs.mkdtemp(`${os.tmpdir()}/mnx-musicxml-browser-`);
const chrome = spawn(process.env.CHROME_BIN ?? 'google-chrome', ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let ws;
const report = { kind: 'browser observations; not feature correctness or human verification', captureScriptSha256: hash(await fs.readFile(fileURLToPath(import.meta.url))), shell, applicationCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), corpusRevision: manifest.revision, viewport: { width: 1440, height: 1000, deviceScaleFactor: 1 }, fixtures: [] };
try {
  ws = new WebSocket(await connect(await devtoolsPort(profile))); await once(ws, 'open');
  const c = client(ws);
  await c.send('Runtime.enable'); await c.send('Page.enable'); await c.send('DOM.enable');
  report.browser = (await c.send('Browser.getVersion')).result;
  await c.send('Emulation.setDeviceMetricsOverride', { ...report.viewport, mobile: false });
  await c.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  const app = "document.querySelector('mnx-workbench')";
  const page = shell === 'workbench' ? `${app}?.shadowRoot?.querySelector('mnx-scenario-page')` : "document.querySelector('mnx-studio')?.shadowRoot?.querySelector('mnx-studio-piece')";
  if(session) { await c.send('Network.enable'); await c.send('Network.setCookie',{name:'CF_Authorization',value:session.browser,url:origin,httpOnly:true,sameSite:'Lax'}); }
  const finder = `(() => { const roots = [document]; while (roots.length) { const r = roots.shift(); const v = r.querySelector('mnx-document-viewer'); if (v) return v; for (const e of r.querySelectorAll('*')) if(e.shadowRoot) roots.push(e.shadowRoot); } return null; })()`;
  const outerScroller = shell === 'studio' ? `${page}.shadowRoot.querySelector('mnx-score-frame').shadowRoot.querySelector('.score')` : finder;
  // Studio can constrain a tall viewer inside its own scrolling score frame.
  // Scroll the viewer when it overflows; scrolling only the frame misses lower staves.
  const scroller = `(()=>{const v=${finder};return v.scrollHeight>v.clientHeight+1 || v.scrollWidth>v.clientWidth+1 ? v : (${outerScroller});})()`;
  const settle = async () => {
    await c.evaluate('(async()=>{await document.fonts.ready; await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()');
    let previous = null, stable = 0;
    for(let i=0;i<100;i++) {
      const signature = await c.evaluate(`(()=>{const v=${finder};return JSON.stringify([v?.shadowRoot?.querySelector('#projection-container')?.innerHTML,v?.renderErrors,v?.scrollWidth,v?.scrollHeight]);})()`);
      stable = signature === previous ? stable+1 : 0; previous=signature;
      if(stable>=3)return;
      await new Promise(r=>setTimeout(r,100));
    }
    throw new Error('Viewer did not settle');
  };
  for (const fixture of manifest.fixtures.filter(f => !filter || new RegExp(filter).test(f.id))) {
    const dir = path.join(output, fixture.id); await fs.mkdir(dir, { recursive: true });
    const row = { id: fixture.id, sourceSha256: fixture.sha256, testClass: fixture.testClass, description: fixture.description, views: [] };
    report.fixtures.push(row); const logStart = c.logs.length;
    try {
      await c.send('Page.navigate', { url: 'about:blank' });
      let document;
      if(shell === 'workbench') {
        await c.send('Page.navigate', { url: `http://127.0.0.1:${site.port}/workbench/` });
        await waitFor(c, `!!${app}?.shadowRoot?.querySelector('#local-file')`, 'file input');
        const input = await c.send('Runtime.evaluate', { expression: `${app}.shadowRoot.querySelector('#local-file')` });
        await c.send('DOM.setFileInputFiles', { files: [path.join(root, 'converters/fixtures/musicxml-suite', fixture.path)], objectId: input.result.result.objectId });
        await waitFor(c, `!!${app}.localFileError || (!${app}.openingLocalFile && ${app}.localDocument?.fileName === ${JSON.stringify(path.basename(fixture.path))})`, fixture.id + ' import', 30000);
        row.importError = await c.evaluate(`${app}.localFileError || null`);
        if (row.importError) continue;
        row.warnings = await c.evaluate(`${app}.localDocument.warnings`);
        document = await c.evaluate(`${app}.localDocument.document`);
      } else {
        const id = 'MusicXmlAssessment-' + fixture.sha256.slice(0,16);
        const headers = {Authorization:`Bearer ${library.writeToken}`,'Cf-Access-Jwt-Assertion':session.machine};
        const before = await fetch(origin+'/api/library/ingest/'+encodeURIComponent(id),{headers});
        if(!before.ok)throw new Error('Local ingest lookup HTTP '+before.status);
        const {snapshot}=await before.json();
        const bytes=await fs.readFile(path.join(root,'converters/fixtures/musicxml-suite',fixture.path));
        const filename=path.basename(fixture.path);
        const manifest={expected_revision:snapshot?.piece.revision??null,source:{kind:'soundslice',id},renditions:[{id:id+'-xml',format:'musicxml',role:'original',producer:'local-assessment',producer_version:null,producer_options:null,filename,sha256:hash(bytes),file:'score'}],recordings:[],tags:[],canonical:{mode:'initialize',rendition_id:id+'-xml'},derived_tags:[{dimension:'title',value:fixture.id,source_ref:'test'}]};
        // Ingest requires a GP canonical, but the product exposes other original
        // renditions through Versions → View → Make current. Never transcode XML.
        const gp=await fs.readFile(path.join(root,'converters/fixtures/Triplets-and-graces.gp'));
        manifest.renditions.push({id:id+'-gp',format:'gp',role:'export',producer:'local-assessment',producer_version:null,producer_options:null,filename:'Triplets-and-graces.gp',sha256:hash(gp),file:'seed'});
        manifest.canonical.rendition_id=id+'-gp';
        const form=new FormData();form.set('manifest',JSON.stringify(manifest));form.set('score',new Blob([bytes]),filename);form.set('seed',new Blob([gp]),'Triplets-and-graces.gp');
        const stored=await fetch(origin+'/api/library/ingest',{method:'POST',headers,body:form});
        if(!stored.ok)throw new Error('Local ingest HTTP '+stored.status+': '+await stored.text());
        const pieceId=(await stored.json()).snapshot.piece.id;
        await c.send('Page.navigate',{url:origin+'/studio/#/piece/'+pieceId});
        await waitFor(c, `!!${page}?.error || !!(${finder})?.mnxDoc`, fixture.id+' studio import',30000);
        await waitFor(c,`!!${page}?.editor`, 'Studio editable GP seed');
        await c.evaluate(`${page}.shadowRoot.querySelector('button.save').click()`);
        const sheet=`${page}.shadowRoot.querySelector('mnx-studio-save').shadowRoot`;
        await waitFor(c,`!!${sheet}?.querySelector('[data-version="${id}-xml"] button')`,'XML version control');
        await c.evaluate(`${sheet}.querySelector('[data-version="${id}-xml"] button').click()`);
        await waitFor(c,`!!${page}.error || ${page}.viewing?.id === '${id}-xml'`,'view original MusicXML');
        if(!await c.evaluate(`${page}.error`)) {
          await c.evaluate(`[...${sheet}.querySelectorAll('[data-version="${id}-xml"] button')].find(b=>b.textContent.trim()==='Make current').click()`);
          const titleForm = `${page}.shadowRoot.querySelector('.version-title')`;
          await waitFor(c,`!!${titleForm} || !!${page}.error || (${page}.snapshot?.piece.canonical_rendition_id === '${id}-xml' && !${page}.viewing)`, 'Make XML current or supply title');
          if (await c.evaluate(`!!${titleForm}`)) {
            row.suppliedLibraryTitle = await c.evaluate(`${titleForm}.querySelector('input').value`);
            await c.evaluate(`${titleForm}.requestSubmit()`);
            await waitFor(c,`!!${page}.error || (${page}.snapshot?.piece.canonical_rendition_id === '${id}-xml' && !${page}.viewing)`, 'Make untitled XML current');
          }
          row.makeCurrentError=await c.evaluate(`${page}.error || null`);
          await waitFor(c,`!!${page}.editor`, 'Studio editor binding');
          await c.evaluate(`${page}.shadowRoot.querySelector('button.save').click()`);
        }
        row.entryPath='Local operator ingest: GP seed + unmodified XML original; Save → Versions → View XML → Make current';
        row.importError=await c.evaluate(`${page}?.viewing?.id === '${id}-xml' ? null : (${page}?.error || null)`);
        row.viewingOriginal=await c.evaluate(`!!${page}.viewing`);
        row.editingSuspended=await c.evaluate(`!!${page}.viewing || ${page}.readOnly`);
        if(row.importError)continue;
        row.warnings=await c.evaluate(`${page}.conversionNotes`);
        document=await c.evaluate(`(${finder}).mnxDoc.mnxJson`);
      }
      await fs.writeFile(path.join(dir, 'document.mnx.json'), JSON.stringify(document, null, 2) + '\n');
      row.importedDocumentSha256 = hash(JSON.stringify(document));
      await waitFor(c, `!!(${finder})?.mnxDoc`, fixture.id + ' viewer');
      await settle();
      if(showMeters) {
        const frame=`${page}.shadowRoot.querySelector('mnx-score-frame').shadowRoot`;
        await c.evaluate(`[...${frame}.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Settings').click()`);
        const pad=`${frame}.querySelector('mnx-settings-pad').shadowRoot`;
        await waitFor(c,`!!${pad}?.querySelector('[data-row="timeSignatures"]')`,'Time signatures setting');
        await c.evaluate(`(()=>{const b=${pad}.querySelector('[data-row="timeSignatures"]');if(b.textContent.trim()==='Hide')b.click();})()`);
        await waitFor(c,`${pad}.querySelector('[data-row="timeSignatures"]').textContent.trim()==='Show'`,'Show time signatures');
        await c.evaluate(`[...${frame}.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Settings').click()`);
        await settle();
      }
      if(showAllLyrics) {
        const frame=`${page}.shadowRoot.querySelector('mnx-score-frame').shadowRoot`;
        await c.evaluate(`[...${frame}.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Settings').click()`);
        const pad=`${frame}.querySelector('mnx-settings-pad').shadowRoot`;
        await waitFor(c,`!!${pad}?.querySelector('[data-row="lyrics"]')`,'Lyrics setting');
        await c.evaluate(`${pad}.querySelector('[data-row="lyrics"]').click()`);
        await waitFor(c,`!!${pad}.querySelector('[role="menu"]')`,'Lyrics menu');
        await c.evaluate(`[...${pad}.querySelectorAll('[role="menuitemradio"]')].find(b=>b.textContent.trim()==='All verses').click()`);
        await waitFor(c,`${pad}.querySelector('[data-row="lyrics"]').textContent.trim()==='All verses'`,'All verses setting');
        await c.evaluate(`[...${frame}.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Settings').click()`);
        await settle();
      }
      row.displayOptions=await c.evaluate(`(${finder}).effectiveDisplay()`);
      row.editorBound = await c.evaluate(`!!${page}?.editor`);
      row.availableViews = await c.evaluate(`(${finder}).availableViews()`);
      for (const view of row.availableViews) {
        if(shell === 'studio') {
          const frame=`${page}.shadowRoot.querySelector('mnx-score-frame').shadowRoot`;
          await c.evaluate(`[...${frame}.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Settings').click()`);
          const pad=`${frame}.querySelector('mnx-settings-pad').shadowRoot`;
          await waitFor(c,`!!${pad}?.querySelector('[data-row="view"]')`,'Staff setting');
          await c.evaluate(`${pad}.querySelector('[data-row="view"]').click()`);
          await waitFor(c,`!!${pad}.querySelector('[role="menu"]')`,'Staff menu');
          const switched=await c.evaluate(`(()=>{const b=[...${pad}.querySelectorAll('[role="menuitemradio"]')].find(b=>b.textContent.trim().toLowerCase()===${JSON.stringify(view)});if(!b)return false;b.click();return true;})()`);
          if(!switched)throw new Error('No reachable '+view+' staff menu item');
          await c.evaluate(`[...${frame}.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Settings').click()`);
        } else {
          const switched = await c.evaluate(`(() => { const p = ${page}; const f=p.shadowRoot.querySelector('mnx-score-frame'); const b=[...f.shadowRoot.querySelectorAll('[aria-label="Staff view"] button')].find(b=>b.textContent.trim().toLowerCase()===${JSON.stringify(view)}); if(!b||b.disabled)return false; b.click();return true; })()`);
          if (!switched) throw new Error('No reachable ' + view + ' staff-view button');
        }
        await waitFor(c, `(${finder}).resolvedView() === ${JSON.stringify(view)}`, view);
        await settle();
        await c.evaluate(`(()=>{const v=${finder};if((${scroller})===v)v.scrollIntoView({block:'start',inline:'nearest'});})()`);
        await settle();
        const observed = await c.evaluate(`(() => { const v=${finder};const scroller=${scroller};const r=scroller.getBoundingClientRect();const outer=(${outerScroller}).getBoundingClientRect();return {scrollTarget:scroller===v?'viewer':'frame',visibleWidth:Math.max(1,Math.min(r.right,outer.right,innerWidth)-Math.max(r.left,outer.left,0)),visibleHeight:Math.max(1,Math.min(r.bottom,outer.bottom,innerHeight)-Math.max(r.top,outer.top,0)),view:v.resolvedView(), staffScale:v.zoom,densityH:v.densityH,renderErrors:v.renderErrors,systemRows:v.systemRows(),svgCount:v.shadowRoot.querySelectorAll('#projection-container svg').length,diagnosticTitles:[...v.shadowRoot.querySelectorAll('.diagnostic-marker title')].map(e=>e.textContent),scrollWidth:scroller.scrollWidth,scrollHeight:scroller.scrollHeight,clientWidth:scroller.clientWidth,clientHeight:scroller.clientHeight};})()`);
        observed.screenshots = []; row.views.push(observed);
        const svgs = await c.evaluate(`[...(${finder}).shadowRoot.querySelectorAll('#projection-container svg')].map(s=>s.outerHTML)`);
        for (let i=0;i<svgs.length;i++) await fs.writeFile(path.join(dir, `${view}-${i}.svg`), svgs[i]);
        // Tiles overlap. Keep viewport geometry fixed; never shrink a score to fit.
        const stepX = Math.max(1, Math.min(observed.clientWidth, observed.visibleWidth) - 80), stepY = Math.max(1, Math.min(observed.clientHeight, observed.visibleHeight) - 100);
        const xs = [], ys = [];
        for(let x=0;;x+=stepX){xs.push(Math.min(x,Math.max(0,observed.scrollWidth-observed.clientWidth)));if(x>=observed.scrollWidth-observed.clientWidth)break;}
        for(let y=0;;y+=stepY){ys.push(Math.min(y,Math.max(0,observed.scrollHeight-observed.clientHeight)));if(y>=observed.scrollHeight-observed.clientHeight)break;}
        for(const y of ys)for(const x of xs){
          await c.evaluate(`(${scroller}).scrollTo(${x},${y})`); await settle();
          const shot = await c.send('Page.captureScreenshot', { format:'png' });
          const name = `${view}-${x}-${y}.png`; await fs.writeFile(path.join(dir,name),Buffer.from(shot.result.data,'base64'));
          observed.screenshots.push(name);
        }
      }
    } catch(error) { row.captureError = error.message;
      if(shell === 'studio')row.shellError=await c.evaluate(`${page}?.error || null`).catch(()=>null); }
    finally {
      row.consoleErrors = c.logs.slice(logStart);
      await fs.writeFile(path.join(dir,'observation.json'),JSON.stringify(row,null,2)+'\n');
      await fs.writeFile(path.join(output,'index.json'),JSON.stringify(report,null,2)+'\n');
      console.log(`${row.id}: ${row.importError ?? row.captureError ?? row.views.map(v=>`${v.view} ${v.svgCount} SVG / ${v.screenshots.length} tiles`).join(', ')}`);
    }
  }
} finally {
  ws?.close(); chrome.kill(); site?.server.close(); await library?.close();
  // Chrome may still flush the profile; cleanup must not mask a capture error.
  try { await fs.rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100}); } catch {}
}

if(report.fixtures.some(row=>row.captureError)) process.exitCode=1;
