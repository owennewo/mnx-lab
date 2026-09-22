// Independent MNX note-table adapter. Deliberately does not use converter
// duration, cursor or pitch helpers: sharing them would hide symmetric bugs.
export interface SemanticRow {
  part: number; staff: number; voice: string; measure: number;
  onset: string; duration: string; pitch: string; grace: number;
  writtenGrace: string | null; tie: string;
  lyrics: [string, string, string][];
}
export interface SemanticTable { parts: number; measures: number[]; rows: SemanticRow[] }
type Q = [bigint, bigint];
const gcd = (a: bigint, b: bigint): bigint => b ? gcd(b, a % b) : a < 0n ? -a : a;
const q = (n: bigint | number, d: bigint | number = 1): Q => {
  let a = BigInt(n), b = BigInt(d);
  if (!b) throw Error('Zero denominator');
  if (b < 0n) { a = -a; b = -b; }
  const g = gcd(a, b); return [a / g, b / g];
};
const add = (a: Q, b: Q) => q(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const mul = (a: Q, b: Q) => q(a[0] * b[0], a[1] * b[1]);
const div = (a: Q, b: Q) => mul(a, q(b[1], b[0]));
const str = (a: Q) => `${a[0]}/${a[1]}`;
const decimal = (n: number): Q => {
  if (!Number.isFinite(n)) throw Error('Nonfinite value');
  const s = n.toString();
  if (s.includes('e')) throw Error('Scientific-notation pitch outside adapter');
  const places = s.split('.')[1]?.length ?? 0;
  return q(BigInt(s.replace('.', '')), 10n ** BigInt(places));
};
const BASE: Record<string, Q> = Object.fromEntries([
  ['duplexMaxima',64], ['maxima',32], ['longa',16], ['long',16], ['breve',8], ['whole',4],
  ['half',2], ['quarter',1], ['eighth',0],
].map(([name, n]) => [name, n ? q(Number(n)) : q(1, 2)]));
for (const n of [16,32,64,128,256,512,1024,2048,4096]) BASE[`${n}${n === 32 ? 'nd' : 'th'}`] = q(4,n);
// Data is intentionally walked as JSON, including proposed/unsupported objects.
// A case we cannot interpret throws an adapter limitation rather than guessing.
type Obj = Record<string, any>;
function value(v: Obj): Q {
  if (!v || !BASE[v.base]) throw Error(`Unsupported duration ${JSON.stringify(v)}`);
  const dots = v.dots ?? 0;
  if (!Number.isInteger(dots) || dots < 0 || dots > 8) throw Error('Unsupported dots');
  return mul(BASE[v.base], q(2n ** BigInt(dots + 1) - 1n, 2n ** BigInt(dots)));
}

export function canonicalTable(table: SemanticTable): SemanticTable {
  // Voice spellings may change; the full partition must not. Assign labels by
  // each voice's complete content per part/staff, not by an arbitrary JSON order.
  const voices = new Map<string, SemanticRow[]>();
  for (const row of table.rows) {
    const key = JSON.stringify([row.part,row.staff,row.voice]);
    voices.set(key, [...(voices.get(key) ?? []), row]);
  }
  const signature = (rows: SemanticRow[]) => JSON.stringify(rows.map(({ voice: _, ...r }) => r)
    .map(r => JSON.stringify(r)).sort());
  const groups = new Map<string, { key: string; signature: string }[]>();
  for (const [key, rows] of voices) {
    const k = `${rows[0].part}:${rows[0].staff}`;
    groups.set(k, [...(groups.get(k) ?? []), { key, signature: signature(rows) }]);
  }
  const names = new Map<string,string>();
  for (const group of groups.values()) group.sort((a,b) => a.signature < b.signature ? -1 : a.signature > b.signature ? 1 : 0)
    .forEach((v,i) => names.set(v.key, `${i + 1}`));
  const rows = table.rows.map(r => ({ ...r, voice: names.get(JSON.stringify([r.part,r.staff,r.voice]))! }));
  rows.sort((a,b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0);
  return { parts: table.parts, measures: table.measures, rows };
}

export function mnxSemanticTable(document: unknown): SemanticTable {
  const doc = document as Obj;
  const rows: SemanticRow[] = [];
  const incoming = new Set<string>();
  function scan(v: any): void {
    if (Array.isArray(v)) { v.forEach(scan); return; }
    if (!v || typeof v !== 'object') return;
    for (const tie of v.ties ?? []) if (tie.target) incoming.add(tie.target);
    Object.values(v).forEach(scan);
  }
  scan(doc);
  for (const [partIndex, part] of (doc.parts ?? []).entries()) {
    let time = { count: 4, unit: 4 };
    for (const [measureIndex, measure] of (part.measures ?? []).entries()) {
      const global = doc.global?.measures?.[measureIndex] ?? {};
      time = global.time ?? time;
      for (const sequence of measure.sequences ?? []) {
        let cursor = q(0), graceSlot = 0;
        const staff = sequence.staff ?? 1, voice = String(sequence.voice ?? '1');
        function row(event: Obj, duration: Q, grace: boolean): void {
          if (event.kitNotes) throw Error('Kit-note semantics not yet mapped');
          const lyrics = Object.entries(event.lyrics?.lines ?? {}).map(([id, lyric]) => {
            const l = lyric as Obj;
            return [id, l.text ?? '', ({ start: 'begin', whole: 'single' } as Record<string,string>)[l.type] ?? l.type ?? 'single'] as [string,string,string];
          }).sort((a,b) => a[0].localeCompare(b[0]));
          if (!event.rest && !event.notes?.length) throw Error('Event has no pitched notes or rest');
          for (const note of event.rest ? [null] : event.notes) {
            let pitch = 'rest';
            if (note) {
              const p = note.pitch;
              if (!p || !Object.hasOwn({ C:0,D:2,E:4,F:5,G:7,A:9,B:11 },p.step)) throw Error('Unsupported pitch');
              pitch = str(add(q((p.octave + 1) * 12 + ({ C:0,D:2,E:4,F:5,G:7,A:9,B:11 } as Record<string,number>)[p.step]), decimal(p.alter ?? 0)));
            }
            const start = !!note?.ties?.length, stop = !!note?.id && incoming.has(note.id);
            rows.push({ part: partIndex, staff: event.staff ?? staff, voice, measure: measureIndex,
              onset: str(cursor), duration: grace ? '0/1' : str(duration), pitch,
              grace: grace ? graceSlot : 0, writtenGrace: grace ? str(value(event.duration)) : null,
              tie: start && stop ? 'continue' : start ? 'start' : stop ? 'stop' : '', lyrics });
          }
        }
        function walk(content: Obj[], scale: Q, grace = false): void {
          for (const item of content) {
            if (item.type === 'tuplet') {
              const side = (s: Obj) => mul(value(s.duration), q(s.multiple));
              walk(item.content, mul(scale, div(side(item.outer), side(item.inner))), grace);
            } else if (item.type === 'grace') walk(item.content, scale, true);
            else if (item.type === 'space') cursor = add(cursor, mul(q(item.duration[0],item.duration[1]),q(4)));
            else if (item.type && item.type !== 'event') throw Error(`Unsupported sequence item ${item.type}`);
            else {
              const duration = mul(value(item.duration),scale);
              if (grace) graceSlot++;
              row(item,duration,grace);
              if (!grace) { cursor = add(cursor,duration); graceSlot = 0; }
            }
          }
        }
        if (sequence.fullMeasure) row({ rest: {} },q(time.count * 4,time.unit),false);
        walk(sequence.content ?? [],q(1));
      }
    }
  }
  return canonicalTable({ parts: doc.parts?.length ?? 0, measures: (doc.parts ?? []).map((p: Obj) => p.measures?.length ?? 0), rows });
}

export function tableDelta(expected: SemanticTable, actual: SemanticTable) {
  const counts = new Map<string,number>();
  for (const row of expected.rows) { const k=JSON.stringify(row); counts.set(k,(counts.get(k) ?? 0)+1); }
  const extra: SemanticRow[]=[];
  for (const row of actual.rows) { const k=JSON.stringify(row), n=counts.get(k) ?? 0; if(n) counts.set(k,n-1); else extra.push(row); }
  const missing = [...counts].flatMap(([k,n]) => Array.from({length:n},()=>JSON.parse(k) as SemanticRow));
  return { match: !missing.length && !extra.length && expected.parts===actual.parts && JSON.stringify(expected.measures)===JSON.stringify(actual.measures),
    expectedParts: expected.parts, actualParts: actual.parts,
    expectedMeasures: expected.measures, actualMeasures: actual.measures,
    missingCount: missing.length, extraCount: extra.length, missing: missing.slice(0,3), extra: extra.slice(0,3) };
}
