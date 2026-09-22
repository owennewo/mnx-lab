import {describe,it,expect} from 'vitest';
import {exportMusicXML,importMusicXML} from '../src/index.js';
import {parseXML} from '../src/common/xml.js';
import type {MnxStructure} from '../src/common/types.js';
describe('export divisions for short written values',()=>{
  for(const tuplet of [false,true])it(`keeps 128ths exact${tuplet?' inside a triplet':' with a dot'}`,()=>{
    const event={duration:{base:'128th',...(tuplet?{}:{dots:1})},notes:[{pitch:{step:'C' as const,octave:4}}]};
    const content=tuplet?[{type:'tuplet' as const,inner:{duration:{base:'128th'},multiple:3},outer:{duration:{base:'128th'},multiple:2},content:[event,event,event]}]:[event];
    const doc:MnxStructure={mnx:{version:1},global:{measures:[{}]},parts:[{id:'P1',name:'P',measures:[{sequences:[{content}]}]}]};
    const xml=exportMusicXML(doc),parsed=parseXML(xml);
    const divisions=Number(parsed.getElementsByTagName('divisions')[0].textContent);
    const duration=Number(parsed.getElementsByTagName('duration')[0].textContent);
    expect(duration).toBeGreaterThan(0);
    expect(Number.isInteger(duration)).toBe(true);
    expect(duration/divisions).toBe(tuplet?1/48:3/64);
    expect(importMusicXML(xml).parts[0].measures[0].sequences[0].content[0]).toMatchObject(tuplet?{type:'tuplet',content:[event,event,event]}:event);
  });
});
