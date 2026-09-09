// Public element APIs on a plain host, shared by the two embed-format smokes.
export async function checkPlayer(cdp, base, format) {
  const result = await cdp.evaluate(`(async()=>{
    const api=${format === 'iife' ? 'window.MnxLab' : `await import(${JSON.stringify(base + '/mnx-lab.esm.js')})`};
    const check=(v,m)=>{if(!v)throw new Error(m);};
    const delay=ms=>new Promise(r=>setTimeout(r,ms));
    check(!!customElements.get('mnx-player'),'Player was not registered');
    const original=document.getElementById('viewer');
    const doc=structuredClone(original.mnxDoc);doc.id='player-smoke';
    doc.mnxJson.global.measures[0].repeatStart={};doc.mnxJson.global.measures.at(-1).repeatEnd={};
    const host=document.createElement('section'),viewer=document.createElement('mnx-document-viewer'),player=document.createElement('mnx-player');
    viewer.style.height='300px';host.append(player,viewer);document.body.append(host);
    const binding=api.bindPlayback(host,viewer,player);binding.setDocument(doc);await player.updateComplete;await viewer.updateComplete;await delay(150);
    check(player.performance.measures.some(m=>m.iteration===2),'Repeated fixture did not compile');
    const note=player.performance.written[0], key=note.noteKey;
    viewer.style.setProperty('--mnx-playback','#123456');
    viewer.selection={activePartId:null,activeMeasureIndex:0,activeVoiceIndex:0,activeEventIndex:0,selectedNoteIds:[key]};
    const iterations=[...new Set(player.performance.written.filter(w=>w.noteKey===key).map(w=>w.ordinal))];
    viewer.dispatchEvent(new CustomEvent('note-selected',{detail:{noteId:key},bubbles:true,composed:true}));
    viewer.dispatchEvent(new CustomEvent('note-selected',{detail:{noteId:key},bubbles:true,composed:true}));
    check(binding.state.ordinal===iterations[1],'Repeated click did not cycle visits');
    player.seek(0);binding.inspect(2);await player.play();await delay(150);
    check(player.snapshot.state==='playing','Player did not start');
    check(viewer.playbackState.playbackIteration===1 && viewer.playbackState.inspectionIteration===2 && !viewer.playbackState.followPlayback,'Live playback overwrote inspection');
    check(viewer.playbackState.highlight.length>0,'Sibling viewer missed playback context');
    check(!!viewer.shadowRoot.querySelector('.playback-ink'),'Playback ink was not painted');
    check(getComputedStyle(viewer.shadowRoot.querySelector('.playback-ink')).fill==='rgb(18, 52, 86)','Selection recolored playback ink');
    const svg=viewer.shadowRoot.querySelector('svg');await delay(60);check(viewer.shadowRoot.querySelector('svg')===svg,'Clock ticks replaced the score SVG');
    for(const view of ['notation','tab','both']){viewer.view=view;await viewer.updateComplete;check(!!viewer.shadowRoot.querySelector('.playback-ink'),'Highlight missing in '+view);}
    binding.follow();check(viewer.playbackState.inspectionIteration===2 && viewer.playbackState.followPlayback,'Follow erased inspection');
    check(viewer.revealOccurrence({noteKey:key,ordinal:0}),'Public reveal missed known ink');
    player.pause();const frozen=player.position;await delay(60);check(player.position.num===frozen.num && player.position.den===frozen.den,'Pause did not freeze');
    const rate=player.shadowRoot.querySelector('select');rate.value='1.5';rate.dispatchEvent(new Event('change'));await player.updateComplete;check(player.snapshot.rate===1.5,'Rate control did not reach transport');
    const volume=player.shadowRoot.querySelector('input');volume.value='0';volume.dispatchEvent(new Event('input'));await player.play();
    const replaced=structuredClone(doc);replaced.id='replacement';binding.setDocument(replaced);await player.updateComplete;await delay(80);
    check(player.documentId==='replacement' && !viewer.playbackState.highlight.length && player.snapshot?.state!=='playing','Document replacement retained playback');
    await player.play();await delay(40);player.remove();await delay(40);
    check(!viewer.playbackState.highlight.length && !player.snapshot,'Disconnect retained live state');
    binding.dispose();host.remove();
    return {format:${JSON.stringify(format)},registered:true,context:true,repeatSeek:true,views:3,replacement:true,disposal:true};
  })()`);
  console.log('player embed OK', JSON.stringify(result));
}
