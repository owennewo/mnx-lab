import { describe,it,expect } from 'vitest';
import { exportMusicXML,importMusicXML } from '../src/index.js';
import { parseXML, type Element } from '../src/common/xml.js';
import type { MnxStructure } from '../src/common/types.js';
const childNames=(el:Element)=>el.childNodes.filter(n=>n.nodeType===1).map(n=>(n as Element).tagName);
function document():MnxStructure {
  return {mnx:{version:1},global:{measures:[{time:{count:4,unit:4}}]},parts:[{
    id:'P1',name:'Test',measures:[{sequences:[{content:[{duration:{base:'whole'},notes:[{pitch:{step:'F',alter:1,octave:4}}]}]}]}]
  }]};
}
describe('MusicXML XSD content ordering',()=>{
  it('places note alteration between step and octave without changing pitch',()=>{
    const xml=exportMusicXML(document());
    expect(childNames(parseXML(xml).getElementsByTagName('pitch')[0])).toEqual(['step','alter','octave']);
    expect(importMusicXML(xml).parts[0].measures[0].sequences[0].content[0]).toMatchObject({notes:[{pitch:{step:'F',alter:1,octave:4}}]});
  });
  it('places tuning alteration between tuning step and octave',()=>{
    const doc=document();
    doc.parts[0]._x={mnxLab:{strings:[{string:1,pitch:{step:'F',alter:1,octave:4}}],tab:{staffKind:'tab'}}};
    const xml=exportMusicXML(doc);
    expect(childNames(parseXML(xml).getElementsByTagName('staff-tuning')[0])).toEqual(['tuning-step','tuning-alter','tuning-octave']);
    expect(importMusicXML(xml).parts[0]._x?.mnxLab?.strings?.[0].pitch).toEqual({step:'F',alter:1,octave:4});
  });
  it('gives rehearsal and section separate typed directions',()=>{
    const doc=document();doc.global.measures[0].rehearsal={label:'A'};doc.global.measures[0].section={label:'Verse'};
    const xml=exportMusicXML(doc);
    const types=parseXML(xml).getElementsByTagName('direction-type');
    expect(types.map(childNames)).toEqual([['rehearsal'],['words']]);
    const returned=importMusicXML(xml).global.measures[0];
    expect(returned.rehearsal).toEqual({label:'A'});expect(returned.section).toEqual({label:'Verse'});
  });
});
