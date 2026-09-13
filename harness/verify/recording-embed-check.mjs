// Real browser audio and public APIs; generated PCM belongs to this fixture.
export async function checkRecordings(cdp, base, format) {
  const result = await cdp.evaluate(`(async()=>{
    const api=${format === 'iife' ? 'window.MnxLab' : `await import(${JSON.stringify(base + '/mnx-lab.esm.js')})`};
    const check=(v,m)=>{if(!v)throw new Error(m);}, delay=ms=>new Promise(r=>setTimeout(r,ms));
    const doc=structuredClone(document.getElementById('viewer').mnxDoc);doc.id='recording-smoke';
    doc.mnxJson.global.measures[0].repeatStart={};doc.mnxJson.global.measures.at(-1).repeatEnd={};
    const host=document.createElement('section'),viewer=document.createElement('mnx-document-viewer'),player=document.createElement('mnx-player');
    viewer.style.height='300px';host.append(player,viewer);document.body.append(host);
    const binding=api.bindPlayback(host,viewer,player);binding.setDocument(doc);await player.updateComplete;await viewer.updateComplete;
    const count=player.performance.measures.length, seconds=count*2+3, hz=8000, pcm=new ArrayBuffer(44+seconds*hz*2), data=new DataView(pcm);
    const ascii=(at,s)=>[...s].forEach((c,i)=>data.setUint8(at+i,c.charCodeAt(0)));
    ascii(0,'RIFF');data.setUint32(4,pcm.byteLength-8,true);ascii(8,'WAVE');ascii(12,'fmt ');data.setUint32(16,16,true);data.setUint16(20,1,true);data.setUint16(22,1,true);data.setUint32(24,hz,true);data.setUint32(28,hz*2,true);data.setUint16(32,2,true);data.setUint16(34,16,true);ascii(36,'data');data.setUint32(40,pcm.byteLength-44,true);
    for(let i=0;i<seconds*hz;i++)data.setInt16(44+i*2,Math.sin(i*2*Math.PI*220/hz)*600,true);
    const blob=new Blob([pcm],{type:'audio/wav'}), sync=Array.from({length:count+1},(_,i)=>[i,1+i*2]);
    let created=0,revoked=0,onsets=0;const create=URL.createObjectURL,revoke=URL.revokeObjectURL;
    URL.createObjectURL=function(b){created++;return create.call(this,b);};URL.revokeObjectURL=function(u){revoked++;return revoke.call(this,u);};
    player.addEventListener('onset',()=>onsets++);
    try {
      player.recordings=[{id:'take-a',kind:'audio',name:'First take',media:blob,syncpoints:sync},{id:'take-b',kind:'audio',name:'Second take',media:blob,syncpoints:sync.map(([bar,time])=>[bar,time+.5])},{id:'raw',kind:'audio',name:'Unmapped',media:blob,syncpoints:[]}];
      await player.updateComplete;check(!!player.shadowRoot.querySelector('select[aria-label="Playback source"]'),'Source selector missing');
      const second=player.performance.measures.find(m=>m.iteration===2).ordinal;
      player.seek(second);check(await player.selectSource('take-a'),'Paused synth/audio handoff failed');
      check(player.playback.state==='paused','Paused handoff started audio');check(Math.abs(player.playback.mediaTime-(1+second*2))<.01,'Wrong repeated visit sought');
      await player.updateComplete;
      const choosePass=async index=>{player.shadowRoot.querySelector('[aria-haspopup="menu"]').click();await player.updateComplete;player.shadowRoot.querySelectorAll('[role="menuitem"]')[index].click();await delay(80);};
      await choosePass(0);check(player.scorePosition.ordinal===0,'Pass menu missed first recording visit');
      await choosePass(1);check(player.scorePosition.ordinal===second,'Pass menu missed second recording visit');
      check(!player.snapshot && player.playback.capabilities.loop==='seek' && !player.playback.capabilities.parts,'Audio faked synth capabilities');
      await player.play();await delay(200);check(player.playback.state==='playing','Real audio did not play');
      check(viewer.playbackState.playbackIteration===2 && viewer.playbackState.highlight.length>0,'Recording did not follow second visit');
      check(onsets===0,'Recording fabricated synth onsets');
      const svg=viewer.shadowRoot.querySelector('svg');await delay(80);check(viewer.shadowRoot.querySelector('svg')===svg,'Media ticks replaced SVG');
      for(const mode of ['written','unrolled']) { viewer.unrolled=mode==='unrolled';await viewer.updateComplete;await delay(50);check(viewer.playbackState.highlight.length>0,'Follow lost in '+mode); }
      const rate=player.shadowRoot.querySelector('input[aria-label="Playback rate"]');rate.value='1.5';rate.dispatchEvent(new Event('input'));check(player.playback.rate===1.5,'Media rate not applied');
      player.pause();const frozen=player.playback.mediaTime;await delay(80);check(player.playback.mediaTime===frozen,'Media pause drifted');
      check(await player.selectSource('take-b'),'Audio/audio handoff failed');check(Math.abs(player.playback.mediaTime-frozen-.5)<.02,'Audio handoff copied seconds');
      check(await player.selectSource('synth'),'Audio/synth handoff failed');check(player.scorePosition.ordinal===second && player.snapshot.state==='paused','Synth return lost position or pause');
      check(await player.selectSource('take-a'),'Return to audio failed');
      const position=ordinal=>({ordinal,metricOffset:{num:0n,den:1n}});
      player.setScoreLoop({start:position(0),end:position(1)});await player.seekScorePosition(position(0));await player.play();await delay(1600);
      check(player.playback.mediaTime>=1 && player.playback.mediaTime<3,'Media loop did not wrap');player.pause();player.setScoreLoop();
      check(!await player.selectSource('raw') && player.playback.needsStart,'Unmapped handoff guessed a position');
      await player.startSource();await delay(100);check(player.playback.state==='playing' && !viewer.playbackState.highlight.length,'Explicit unsynced start failed');
      const replaced=structuredClone(doc);replaced.id='new-recording-document';binding.setDocument(replaced);await player.updateComplete;
      check(player.sourceId==='synth' && player.playback.state==='stopped','Document replacement retained recording');
      await player.selectSource('take-a');player.remove();await delay(50);check(!player.playback && !viewer.playbackState.highlight.length,'Disconnect retained media');
      check(created===revoked,'Blob URLs leaked: '+created+'/'+revoked);
      return {format:${JSON.stringify(format)},realAudio:true,repeatSeek:true,mediaHandoff:true,loop:true,blobUrls:created};
    } finally {binding.dispose();host.remove();URL.createObjectURL=create;URL.revokeObjectURL=revoke;}
  })()`);
  console.log('recording embed OK',JSON.stringify(result));
}
