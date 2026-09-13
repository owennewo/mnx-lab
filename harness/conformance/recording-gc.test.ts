import { expect, it } from 'vitest';
// @ts-expect-error Node-only operator tool has no declaration file.
import { recordingGc } from '../../tools/recording-gc.mjs';
it('only collects old unreferenced recording blobs, with explicit stopped writers for deletion', async () => {
  const now=Date.parse('2026-09-13T12:00:00Z'), key=(c:string)=>'recordings/'+c.repeat(64), removed:string[]=[], queries:string[]=[];
  const query=async(sql:string,params:string[])=>{queries.push(sql);return [{n:params[0]===key('b')||params[0]===key('c')?1:0}];};
  const list=async(cursor?:string)=>({result:cursor?[{key:key('d'),last_modified:'2026-09-01',size:4}]:[
    {key:key('a'),last_modified:'2026-09-01',size:1}, {key:key('b'),last_modified:'2026-09-01',size:2},
    {key:key('c'),last_modified:'2026-09-01',size:3}, {key:key('e'),last_modified:'2026-09-13',size:5},
    {key:'renditions/'+'a'.repeat(64),last_modified:'2026-09-01',size:6}],result_info:cursor?{}:{is_truncated:true,cursor:'next'}});
  const options={query,list,remove:async(k:string)=>{removed.push(k);},now};
  expect((await recordingGc(options)).map((r:{key:string})=>r.key)).toEqual([key('a'),key('d')]);expect(removed).toEqual([]);
  await expect(recordingGc({...options,apply:true})).rejects.toThrow('Stop');
  await recordingGc({...options,apply:true,writersStopped:true});expect(removed).toEqual([key('a'),key('d')]);
  expect(queries.some(q=>q.startsWith('DELETE FROM recording_uploads'))).toBe(true);
});
it('fails closed on incomplete reference reads',async()=>{
  await expect(recordingGc({query:async()=>[],list:async()=>({result:[{key:'recordings/'+'a'.repeat(64),last_modified:'2020-01-01'}]}),remove:async()=>{throw new Error('must not delete');},apply:true,writersStopped:true})).rejects.toThrow('reference count');
});
