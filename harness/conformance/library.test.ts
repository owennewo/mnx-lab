// Implementation loop: real D1/R2 semantics are the oracle, never SQL mocks.
import { beforeEach, afterEach, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare'; // The local runtime installed by the locked Wrangler dependency.
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { Library, type PieceWrite, type RenditionInput } from '../../worker/library/index.ts';
import { describeBlob } from '../../worker/library/blobs.ts';
import score from '../../scenarios/lab/00-document/01-minimal-single-note/document.mnx.json';

let mf: Miniflare;
let db: D1Database;
let bucket: R2Bucket;
let library: Library;
const migration = readFileSync(new URL('../../migrations/0001_library.sql', import.meta.url), 'utf8');
const views = readFileSync(new URL('../../migrations/0003_piece_views.sql', import.meta.url), 'utf8');
const bytes = (text: string) => new TextEncoder().encode(text).buffer;
function mnx(id: string, title = 'Title', extras: Partial<RenditionInput> = {}): RenditionInput {
  const doc = structuredClone(score);
  Object.assign(doc, { _x: { mnxLab: { work: { title, artist: 'Artist', creators: [{ role: 'composer', name: 'Composer' }] } } } });
  Object.assign(doc.parts[0], { _x: { mnxLab: { strings: [{ string: 1, pitch: { step: 'E', octave: 4 } }, { string: 2, pitch: { step: 'B', octave: 3 } }], capo: 3 } } });
  return { id, format: 'mnx', role: 'derived', producer: 'guitarpro-mnx', producer_version: '1', producer_options: { encodingDate: false }, content: bytes(JSON.stringify(doc)), ...extras };
}
const create = (id = 'piece'): PieceWrite => ({ id, expected_revision: null, source: { kind: 'soundslice', id } });
function wrappedBucket(overrides: Partial<R2Bucket>): R2Bucket {
  return new Proxy(bucket, { get(target, key) {
    const source = key in overrides ? overrides : target;
    const value = Reflect.get(source, key);
    return typeof value === 'function' ? value.bind(source) : value;
  } });
}
beforeEach(async () => {
  mf = new Miniflare({ modules: true, script: 'export default { fetch() { return new Response("test only") } }', compatibilityDate: '2026-06-01', d1Databases: ['DB'], r2Buckets: ['BUCKET'] });
  db = await mf.getD1Database('DB');
  bucket = await mf.getR2Bucket('BUCKET');
  // Split only between this migration's CREATE statements, preserving the trigger body.
  await db.batch([migration, views].map(m => m.replace(/--[^\n]*/g, '').trim().split(/;\s*(?=CREATE\b)/).map(sql => db.prepare(sql))).flat());
  library = new Library(db, bucket);
}, 15000);
afterEach(async () => { await mf?.dispose(); });

it('keeps the migration equal to the documented five-table schema', async () => {
  const design = readFileSync(new URL('../../docs/studio-storage.md', import.meta.url), 'utf8').split('```sql\n')[1].split('```')[0];
  expect(migration.slice(migration.indexOf('\n') + 1)).toBe(design);
  const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' ORDER BY name").all();
  expect(tables.results.map(r => r.name)).toEqual(['piece_views','pieces','recordings','renditions','tag_aliases','tags']);
  const viewsDesign = readFileSync(new URL('../../docs/studio-storage.md', import.meta.url), 'utf8').split('```sql\n').slice(1).map(b => b.split('```')[0]).find(b => b.includes('piece_views'));
  expect(views.slice(views.indexOf('CREATE'))).toBe(viewsDesign);
});

it('writes blobs and rows, stores the projected tags, and returns a true no-op on replay', async () => {
  let puts = 0;
  const observed = new Library(db, wrappedBucket({ put: async (...args: Parameters<R2Bucket['put']>) => { puts++; return bucket.put(...args); } }));
  const write = { ...create(), renditions: [mnx('mnx')], canonical: { mode: 'initialize' as const, rendition_id: 'mnx' }, tags: [{ dimension: 'unknown', value: 'My list', source_ref: 'list:1' }],
    derived_tags: [{ dimension: 'title', value: 'Title', source_ref: 'sidecar' }, { dimension: 'capo', value: '3', source_ref: 'guitarpro-mnx@1' }] };
  const result = await observed.writePiece('alice', write);
  expect(result.piece.revision).toBe(0);
  expect(result.tags.map(t => `${t.dimension}:${t.value}:${t.origin}`)).toEqual(['capo:3:derived','title:Title:derived','unknown:My list:asserted']);
  expect(result.renditions[0].r2_key).toMatch(/^renditions\/[a-f0-9]{64}$/);
  const again = await observed.writePiece('alice', { ...write, expected_revision: 0 });
  expect(again).toEqual(await observed.getPiece('alice', 'piece'));
  expect(again.piece.revision).toBe(0);
  expect(puts).toBe(1);
  expect((await observed.readCanonical('alice', 'piece'))?.rendition.id).toBe('mnx');
  expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
});

it('never overwrites a rendition, while identical bytes may have distinct producer-history rows', async () => {
  const first = mnx('one');
  await library.writePiece('alice', { ...create(), renditions: [first] });
  await expect(library.writePiece('alice', { id: 'piece', expected_revision: 0, renditions: [mnx('one', 'Changed')] })).rejects.toMatchObject({ code: 'immutable' });
  const next = await library.writePiece('alice', { id: 'piece', expected_revision: 0, renditions: [{ ...first, id: 'two', producer_version: '2' }] });
  expect(next.renditions).toHaveLength(2);
  expect(next.renditions[0].r2_key).toBe(next.renditions[1].r2_key);
  expect((await bucket.list()).objects).toHaveLength(1);
});

it('preserves canonical on import and replaces the projection only when one is supplied', async () => {
  const gp: RenditionInput = { id: 'gp', format: 'gp', role: 'export', producer: 'soundslice-cli', producer_version: null, producer_options: null, content: bytes('GP source') };
  const title = (value: string, source_ref = 'sidecar') => ({ dimension: 'title', value, source_ref });
  await library.writePiece('alice', { ...create(), renditions: [gp, mnx('other', 'Other')], canonical: { mode: 'initialize', rendition_id: 'gp' }, derived_tags: [title('Old')] });
  // No projection supplied: the previous one is retained; initialize never moves a set pointer.
  const kept = await library.writePiece('alice', { id: 'piece', expected_revision: 0, canonical: { mode: 'initialize', rendition_id: 'other' }, tags: [{ dimension: 'genre', value: 'Blues' }] });
  expect(kept.piece.canonical_rendition_id).toBe('gp');
  expect(kept.tags.filter(t => t.dimension === 'title').map(t => t.value)).toEqual(['Old']);
  // A projection supplied replaces the whole derived set, never the asserted tags.
  const replaced = await library.writePiece('alice', { id: 'piece', expected_revision: 1, derived_tags: [title('New'), { dimension: 'capo', value: '2', source_ref: 'guitarpro-mnx@2' }] });
  expect(replaced.tags.map(t => `${t.dimension}:${t.value}`)).toEqual(['capo:2', 'genre:Blues', 'title:New']);
  expect((await library.readCanonical('alice', 'piece'))?.rendition.format).toBe('gp');
  expect(new TextDecoder().decode(await (await library.readCanonical('alice', 'piece'))!.object.arrayBuffer())).toBe('GP source');
  const changed = await library.writePiece('alice', { id: 'piece', expected_revision: 2, canonical: { mode: 'replace', rendition_id: 'other' } });
  expect(changed.piece.canonical_rendition_id).toBe('other');
  await expect(library.readCanonical('alice', 'none')).rejects.toMatchObject({ code: 'not_found' });
});

it('accepts only derived dimensions in a projection, each with a source reference', async () => {
  await library.writePiece('alice', create());
  await expect(library.writePiece('alice', { id: 'piece', expected_revision: 0, derived_tags: [{ dimension: 'genre', value: 'Blues', source_ref: 'sidecar' }] })).rejects.toMatchObject({ code: 'invalid' });
  await expect(library.writePiece('alice', { id: 'piece', expected_revision: 0, derived_tags: [{ dimension: 'title', value: 'x', source_ref: '' }] })).rejects.toMatchObject({ code: 'invalid' });
  expect((await library.getPiece('alice', 'piece'))?.tags).toEqual([]);
});

it('rejects foreign canonical pointers, foreign parents and cycles', async () => {
  await library.writePiece('alice', { ...create('other'), renditions: [mnx('foreign')] });
  await expect(library.writePiece('alice', { ...create(), canonical: { mode: 'replace', rendition_id: 'foreign' } })).rejects.toMatchObject({ code: 'invalid' });
  await expect(library.writePiece('alice', { ...create(), renditions: [mnx('child','x',{ derived_from:'foreign' })] })).rejects.toMatchObject({ code: 'invalid' });
  await expect(library.writePiece('alice', { ...create(), renditions: [mnx('a','x',{ derived_from:'b' }),mnx('b','x',{ derived_from:'a' })] })).rejects.toMatchObject({ code: 'invalid' });
  expect(await library.getPiece('alice','piece')).toBeNull();
});

it('scopes reads and writes to the owner and enforces upstream piece identity', async () => {
  await library.writePiece('alice', { ...create(), renditions: [mnx('private')] });
  expect(await library.getPiece('bob','piece')).toBeNull();
  expect(await library.findPiece('bob','soundslice','piece')).toBeNull();
  expect(await library.listPieces('bob')).toEqual([]);
  await expect(library.readRendition('bob','private')).rejects.toMatchObject({ code: 'not_found' });
  await expect(library.writePiece('bob',{ id:'piece',expected_revision:0 })).rejects.toMatchObject({ code:'conflict' });
  await expect(library.writePiece('alice',{...create('duplicate'),source:{ kind:'soundslice',id:'piece' }})).rejects.toMatchObject({ code:'conflict' });
  expect(await library.listPieces('alice')).toHaveLength(1);
});

it('updates recordings by upstream id without replacing the original blob or losing missing companions', async () => {
  const result = await library.writePiece('alice', { ...create(), recordings: [
    { id:'audio',kind:'audio',source_id:'rec:1',blob:{content:bytes('audio')},mime:'audio/mpeg',syncpoints:[[0,0],[1,3]] },
    { id:'youtube',kind:'youtube',external_id:'video',source_id:'rec:2' }
  ] });
  const next = await library.writePiece('alice',{id:'piece',expected_revision:0,recordings:[{id:'new-local-id',source_id:'rec:1',kind:'audio',name:'Corrected',syncpoints:[[0,0],[1,4]]}]});
  expect(next.recordings).toHaveLength(2);
  expect(next.recordings.find(r=>r.id==='audio')).toMatchObject({ name:'Corrected',syncpoints:'[[0,0],[1,4]]',r2_key:result.recordings.find(r=>r.id==='audio')?.r2_key });
  expect((await bucket.list()).objects).toHaveLength(1);
  await expect(library.writePiece('alice',{id:'piece',expected_revision:1,recordings:[{id:'bad',kind:'youtube',external_id:'x',blob:{content:bytes('bad')}}]})).rejects.toMatchObject({code:'invalid'});
});

it('preserves list renames and rejects asserted derived dimensions; aliases do not rewrite music', async () => {
  await library.writePiece('alice',{...create(),renditions:[mnx('mnx')],canonical:{mode:'initialize',rendition_id:'mnx'},tags:[{dimension:'unknown',value:'Old',source_ref:'list:1'}]});
  const renamed=await library.writePiece('alice',{id:'piece',expected_revision:0,rename_tags:[{dimension:'unknown',value:'Old',to_dimension:'genre',to_value:'Blues'}]});
  const replay=await library.writePiece('alice',{id:'piece',expected_revision:1,tags:[{dimension:'unknown',value:'Old',source_ref:'list:1'}]});
  expect(replay).toEqual(renamed);
  for (const dimension of ['title','tuning','capo','creator.composer']) {
    await expect(library.writePiece('alice',{id:'piece',expected_revision:1,tags:[{dimension,value:'wrong'}]})).rejects.toMatchObject({code:'invalid'});
  }
  await library.setAlias('alice','artist','Artist','Correct Artist');
  expect(await library.listAliases('bob')).toEqual([]);
  expect(await library.listAliases('alice')).toHaveLength(1);
  expect(await library.getPiece('alice','piece')).toEqual(renamed);
});

it('rejects invalid MNX and mismatched hashes before storing blobs or rows', async () => {
  await expect(library.writePiece('alice',{...create(),renditions:[{...mnx('bad'),content:bytes('{}')}]})).rejects.toMatchObject({code:'invalid'});
  await expect(library.writePiece('alice',{...create(),renditions:[{...mnx('bad'),sha256:'0'.repeat(64)}]})).rejects.toMatchObject({code:'blob'});
  expect((await bucket.list()).objects).toEqual([]);
  expect(await library.listPieces('alice')).toEqual([]);
});

it('refuses externally corrupted hash keys instead of overwriting them', async () => {
  const input=mnx('mnx');const blob=await describeBlob('renditions',input);
  await bucket.put(blob.r2_key,new Uint8Array(blob.bytes));
  await expect(library.writePiece('alice',{...create(),renditions:[input]})).rejects.toMatchObject({code:'blob'});
  expect(await library.listPieces('alice')).toEqual([]);
  expect(new Uint8Array(await (await bucket.get(blob.r2_key))!.arrayBuffer())[0]).toBe(0);
});

it('does not commit rows when R2 verification fails', async () => {
  const broken=new Library(db,wrappedBucket({head:async()=>null,put:async()=>null}));
  await expect(broken.writePiece('alice',{...create(),renditions:[mnx('mnx')]})).rejects.toMatchObject({code:'blob'});
  expect(await library.listPieces('alice')).toEqual([]);
});

it('rolls back every row on a late SQL failure, leaving only a harmless orphan blob', async () => {
  const before=await library.writePiece('alice',create());
  await db.prepare("CREATE TRIGGER fail_test BEFORE INSERT ON renditions WHEN NEW.id='fail' BEGIN SELECT RAISE(ABORT,'test_failure'); END").run();
  await expect(library.writePiece('alice',{id:'piece',expected_revision:0,renditions:[mnx('fail')],tags:[{dimension:'genre',value:'Blues'}]})).rejects.toThrow('test_failure');
  expect(await library.getPiece('alice','piece')).toEqual(before);
  expect((await bucket.list()).objects).toHaveLength(1);
});

it('rejects the losing concurrent writer after its blob upload and commits the winner only', async () => {
  await library.writePiece('alice',create());
  let reached!:()=>void;let release!:()=>void;
  const uploaded=new Promise<void>(r=>{reached=r});const continueWrite=new Promise<void>(r=>{release=r});
  const slow=new Library(db,wrappedBucket({put:async(...args:Parameters<R2Bucket['put']>)=>{
    const result=await bucket.put(...args);reached();await continueWrite;return result;
  }}));
  const losing=expect(slow.writePiece('alice',{id:'piece',expected_revision:0,renditions:[mnx('loser')],canonical:{mode:'replace',rendition_id:'loser'},tags:[{dimension:'genre',value:'loser'}]})).rejects.toMatchObject({code:'conflict'});
  await uploaded;
  const winner=await library.writePiece('alice',{id:'piece',expected_revision:0,tags:[{dimension:'genre',value:'winner'}]});
  release();await losing;
  expect(await library.getPiece('alice','piece')).toEqual(winner);
  expect(winner.piece.revision).toBe(1);
  expect((await bucket.list()).objects).toHaveLength(1);
});

it('projects nothing on its own: without derived_tags the service derives no tag from any music', async () => {
  const result=await library.writePiece('alice',{...create(),renditions:[mnx('rich')],canonical:{mode:'initialize',rendition_id:'rich'}});
  expect(result.tags).toEqual([]);
});

it('two pieces uploading the same bytes create the R2 object only once under a race', async () => {
  let arrivals=0;let release!:()=>void;let created=0;let rejected=0;
  const gate=new Promise<void>(r=>{release=r});
  const raced=new Library(db,wrappedBucket({
    head:async key=>{
      if (arrivals<2) { arrivals++;if(arrivals===2)release();await gate;return null; }
      return bucket.head(key);
    },
    put:async(...args:Parameters<R2Bucket['put']>)=>{
      const result=await bucket.put(...args);if(result)created++;else rejected++;return result;
    }
  }));
  const source=mnx('one');
  await Promise.all([
    raced.writePiece('alice',{...create('one'),renditions:[source]}),
    raced.writePiece('alice',{...create('two'),renditions:[{...source,id:'two'}]})
  ]);
  expect(created).toBe(1);expect(rejected).toBe(1);
  expect((await bucket.list()).objects).toHaveLength(1);
  expect(await library.listPieces('alice')).toHaveLength(2);
});

it('rechecks ownership inside the mutation transaction', async () => {
  await library.writePiece('alice',create());
  let reached!:()=>void;let release!:()=>void;
  const uploaded=new Promise<void>(r=>{reached=r});const gate=new Promise<void>(r=>{release=r});
  const slow=new Library(db,wrappedBucket({put:async(...args:Parameters<R2Bucket['put']>)=>{
    const result=await bucket.put(...args);reached();await gate;return result;
  }}));
  const rejected=expect(slow.writePiece('alice',{id:'piece',expected_revision:0,renditions:[mnx('alien')]})).rejects.toMatchObject({code:'conflict'});
  await uploaded;
  // Simulate an administrative ownership change after the caller's read.
  await db.prepare("UPDATE pieces SET owner='bob' WHERE id='piece'").run();
  release();await rejected;
  expect((await library.getPiece('bob','piece'))?.renditions).toEqual([]);
  expect((await library.getPiece('bob','piece'))?.piece.revision).toBe(0);
});

it.each(['root', 'part'])('rejects explicit null %s vendor metadata', async location => {
  const doc=structuredClone(score);
  Object.assign(location==='root' ? doc : doc.parts[0], {_x:{mnxLab:null}});
  await expect(library.writePiece('alice',{...create(),renditions:[{...mnx('invalid'),content:bytes(JSON.stringify(doc))}]})).rejects.toMatchObject({code:'invalid'});
  expect(await library.listPieces('alice')).toEqual([]);
});

it('removes asserted tags idempotently, never derived ones', async () => {
  await library.writePiece('alice', { ...create(), tags: [{ dimension: 'favourite', value: 'yes' }, { dimension: 'genre', value: 'Blues' }], derived_tags: [{ dimension: 'title', value: 'T', source_ref: 'sidecar' }] });
  const once = await library.writePiece('alice', { id: 'piece', expected_revision: 0, remove_tags: [{ dimension: 'favourite', value: 'yes' }] });
  expect(once.tags.map(t => `${t.dimension}:${t.value}`)).toEqual(['genre:Blues', 'title:T']);
  const again = await library.writePiece('alice', { id: 'piece', expected_revision: 1, remove_tags: [{ dimension: 'favourite', value: 'yes' }] });
  expect(again.piece.revision).toBe(1);
  await expect(library.writePiece('alice', { id: 'piece', expected_revision: 1, remove_tags: [{ dimension: 'title', value: 'T' }] })).rejects.toMatchObject({ code: 'invalid' });
});

it('browses by shown values: aliases apply to titles, artists, filters, facets and completion', async () => {
  const titled = (id: string, title: string, artist: string, extra: { dimension: string; value: string }[] = []) => library.writePiece('alice', { ...create(id), tags: extra,
    derived_tags: [{ dimension: 'title', value: title, source_ref: 'sidecar' }, { dimension: 'artist', value: artist, source_ref: 'sidecar' }, { dimension: 'tuning-name', value: 'standard', source_ref: 'gp@1' }] });
  await titled('a', 'These Days', 'Jackson Browne (Ole Kirkeng)', [{ dimension: 'list', value: 'Ole' }]);
  await titled('b', 'Cruel Summer', 'Bananarama');
  await titled('c', 'Take on me', 'A-Ha', [{ dimension: 'favourite', value: 'yes' }]);
  await library.setAlias('alice', 'artist', 'Jackson Browne (Ole Kirkeng)', 'Jackson Browne');
  const byArtist = await library.browsePieces('alice', [], '', 'artist');
  expect(byArtist.pieces.map(p => `${p.artist}|${p.favourite}`)).toEqual(['A-Ha|true', 'Bananarama|false', 'Jackson Browne|false']);
  expect(byArtist.pieces[2].chips).toEqual([{ dimension: 'list', value: 'Ole' }, { dimension: 'tuning-name', value: 'standard' }]);
  expect((await library.browsePieces('alice', ['artist:Jackson Browne'], '')).pieces.map(p => p.id)).toEqual(['a']);
  expect((await library.browsePieces('alice', ['artist:Jackson Browne (Ole Kirkeng)'], '')).pieces).toEqual([]);
  const { total, facets } = await library.facets('alice', ['tuning-name:standard']);
  expect(total).toBe(3);
  expect(facets.filter(f => f.dimension === 'artist').map(f => `${f.value}:${f.pieces}`)).toEqual(['A-Ha:1', 'Bananarama:1', 'Jackson Browne:1']);
  expect(facets.find(f => f.dimension === 'tuning-name')).toEqual({ dimension: 'tuning-name', value: 'standard', pieces: 3 });
  expect(await library.completeTags('alice', 'artist:Ja')).toEqual([{ dimension: 'artist', value: 'Jackson Browne', pieces: 1 }]);
  expect((await library.completeTags('alice', '', 'list')).map(f => f.value)).toEqual(['Ole']);
  expect((await library.listAliases('alice'))[0]).toMatchObject({ raw_value: 'Jackson Browne (Ole Kirkeng)', canonical_value: 'Jackson Browne', pieces: 1 });
  expect(Library.shown((await library.getPiece('alice', 'a'))!.tags, await library.listAliases('alice')).find(t => t.dimension === 'artist')).toMatchObject({ value: 'Jackson Browne (Ole Kirkeng)', shown: 'Jackson Browne' });
  await library.deleteAlias('alice', 'artist', 'Jackson Browne (Ole Kirkeng)');
  expect((await library.browsePieces('alice', [], '', 'artist')).pieces[2].artist).toBe('Jackson Browne (Ole Kirkeng)');
  await expect(library.browsePieces('alice', ['nocolon'], '')).rejects.toMatchObject({ code: 'invalid' });
});

it('sorts by recently opened, most recent first, unopened last, and pages by offset', async () => {
  for (const id of ['a', 'b', 'c']) await library.writePiece('alice', { ...create(id), derived_tags: [{ dimension: 'title', value: id.toUpperCase(), source_ref: 'sidecar' }] });
  await library.recordView('alice', 'b', '2026-09-11T10:00:00Z');
  await library.recordView('alice', 'a', '2026-09-11T11:00:00Z');
  await library.recordView('alice', 'b', '2026-09-11T12:00:00Z');
  expect((await library.browsePieces('alice', [], '')).pieces.map(p => `${p.id}:${p.opened_at ?? '-'}`)).toEqual(['b:2026-09-11T12:00:00Z', 'a:2026-09-11T11:00:00Z', 'c:-']);
  expect((await library.browsePieces('alice', [], '', 'title')).pieces.map(p => p.id)).toEqual(['a', 'b', 'c']);
  await expect(library.recordView('bob', 'a')).rejects.toMatchObject({ code: 'not_found' });
  await expect(library.browsePieces('alice', [], '-1')).rejects.toMatchObject({ code: 'invalid' });
  expect((await library.browsePieces('alice', [], '2')).pieces.map(p => p.id)).toEqual(['c']);
});
