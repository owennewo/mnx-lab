import { expect, it } from 'vitest';
import { attachmentSync, recordingSyncChoices } from '../../src/model/recordingAttachment.ts';

it('requires explicit stable selection from wrappers and retains raw event timings and crop metadata', () => {
  const raw = { id:'score', recordings:[{id:8,name:'Same',syncpoints:[[0,2],[1,4,240,1]],crop_start:2,crop_end:8},{id:9,name:'Same',syncpoints:[[0,1],[1,5]],cropped_duration:10}] };
  expect(recordingSyncChoices(raw).map(c=>c.id)).toEqual(['8','9']);
  expect(()=>attachmentSync(raw,null)).toThrow('Choose');
  const s=attachmentSync(raw,'8'); expect(s.syncpoints).toEqual(raw.recordings[0].syncpoints); expect(s.provenance.raw).toEqual(raw); expect(s.provenance.crop_start).toBe(2);
  expect(attachmentSync(raw,'9').provenance).toMatchObject({crop_start:null,crop_end:null,cropped_duration:10});
  expect(()=>recordingSyncChoices({recordings:[{id:1},{id:'1'}]})).toThrow('unique');
  expect(()=>attachmentSync([[0,-1]],null)).toThrow();
});
