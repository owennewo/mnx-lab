// DOM-free storage operations. Callers supply the authenticated owner; no HTTP surface here.
import type { D1Database, D1PreparedStatement, R2Bucket } from '@cloudflare/workers-types';
import { describeBlob, storeBlob, type PreparedBlob } from './blobs.ts';
import { isDerivedDimension, parseMnx } from './tags.ts';
import {
  LibraryError, json, requireText, type Alias, type AliasReport, type Facet, type Json, type Piece, type PieceSort, type PieceWrite,
  type Recording, type Rendition, type Snapshot, type Tag
} from './types.ts';
export * from './types.ts';

/** A piece's id, derived by the SERVICE from its source identity: opaque and
 *  URL-safe (a reader's `#/piece/<id>` never names the source system), yet
 *  deterministic, so a replayed import lands on the same row. The source
 *  itself lives in `source_kind`/`source_id`, unique per owner. */
export async function pieceIdFor(sourceKind: string, sourceId: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${sourceKind}\u0000${sourceId}`));
  return [...new Uint8Array(digest)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

const same = (a: unknown, b: unknown) => json(a as Json) === json(b as Json);
/** Tags as they are SHOWN: an alias on (owner, dimension, stored value) wins. Every
 *  read that a person sees goes through this — browse, filters, facets, completion —
 *  so an alias set once applies everywhere, and the stored tag never changes. */
const EFFECTIVE_TAGS = `SELECT t.owner, t.piece_id, t.dimension, t.value AS raw_value, COALESCE(a.canonical_value, t.value) AS value, t.origin, t.source_ref
  FROM tags t LEFT JOIN tag_aliases a ON a.owner=t.owner AND a.dimension=t.dimension AND a.raw_value=t.value`;
const PAGE = 50;
export function parseFilters(filters: string[]): [string, string][] {
  return filters.map(t => { const colon = t.indexOf(':'); if (colon <= 0) throw new LibraryError('invalid', 'A filter is dimension:value'); return [t.slice(0, colon), t.slice(colon + 1)]; });
}
const tagKey = (t: { dimension: string; value: string }) => JSON.stringify([t.dimension, t.value]);
function asserted(dimension: string, value: string) {
  requireText(dimension, 'dimension'); requireText(value, 'value');
  if (isDerivedDimension(dimension)) throw new LibraryError('invalid', 'Derived dimensions cannot be asserted');
}

export class Library {
  constructor(private readonly db: D1Database, private readonly bucket: R2Bucket) {}

  private statement(sql: string, ...values: unknown[]) { return this.db.prepare(sql).bind(...values); }
  private insert(table: 'pieces' | 'renditions' | 'recordings' | 'tags', row: object) {
    const columns = Object.keys(row);
    return this.statement(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`, ...Object.values(row));
  }

  async getPiece(owner: string, id: string): Promise<Snapshot | null> {
    requireText(owner, 'owner'); requireText(id, 'piece id');
    // One read transaction: rows and revision always describe the same state.
    const [p, r, recordings, tags] = await this.db.batch([
      this.statement('SELECT * FROM pieces WHERE owner=? AND id=?', owner, id),
      this.statement('SELECT r.* FROM renditions r JOIN pieces p ON p.id=r.piece_id WHERE p.owner=? AND p.id=? ORDER BY r.id', owner, id),
      this.statement('SELECT r.* FROM recordings r JOIN pieces p ON p.id=r.piece_id WHERE p.owner=? AND p.id=? ORDER BY r.id', owner, id),
      this.statement('SELECT * FROM tags WHERE owner=? AND piece_id=? ORDER BY dimension,value', owner, id)
    ]);
    if (!p.results.length) return null;
    return { piece: p.results[0] as Piece, renditions: r.results as Rendition[], recordings: recordings.results as Recording[], tags: tags.results as Tag[] };
  }

  async findPiece(owner: string, sourceKind: string, sourceId: string): Promise<Piece | null> {
    requireText(owner, 'owner');
    return this.statement('SELECT * FROM pieces WHERE owner=? AND source_kind=? AND source_id=?', owner, sourceKind, sourceId).first<Piece>();
  }

  async listPieces(owner: string): Promise<Piece[]> {
    requireText(owner, 'owner');
    return (await this.statement('SELECT * FROM pieces WHERE owner=? ORDER BY id', owner).all<Piece>()).results;
  }

  /** The WHERE for "pieces matching every filter", over effective (aliased) values. */
  private filtered(owner: string, filters: string[]) {
    const pairs = parseFilters(filters);
    const clauses = pairs.map(() => `EXISTS (SELECT 1 FROM (${EFFECTIVE_TAGS}) e WHERE e.owner=p.owner AND e.piece_id=p.id AND e.dimension=? AND e.value=?)`);
    return { where: `p.owner=? ${clauses.length ? 'AND ' + clauses.join(' AND ') : ''}`, values: [owner, ...pairs.flat()] };
  }

  /** One page of pieces with their shown title and artist, their favourite flag and
   *  when they were last opened. `after` is the number of rows already seen; the
   *  sort decides the order, so an id cursor would not do. */
  async browsePieces(owner: string, filters: string[], after: string, sort: PieceSort = 'recent') {
    const offset = after === '' ? 0 : Number(after);
    if (!Number.isSafeInteger(offset) || offset < 0) throw new LibraryError('invalid', 'Invalid cursor');
    const { where, values } = this.filtered(owner, filters);
    const shown = (dimension: string) => `(SELECT value FROM (${EFFECTIVE_TAGS}) e WHERE e.owner=p.owner AND e.piece_id=p.id AND e.dimension='${dimension}' ORDER BY value LIMIT 1)`;
    const order = sort === 'title' ? 'title IS NULL, title COLLATE NOCASE, p.id' : sort === 'artist' ? 'artist IS NULL, artist COLLATE NOCASE, title COLLATE NOCASE, p.id'
      : 'opened_at IS NULL, opened_at DESC, p.updated_at DESC, p.id';
    // The row's chips: the shown values a person scans a list by.
    const chips = `(SELECT json_group_array(json_array(e.dimension, e.value)) FROM (${EFFECTIVE_TAGS}) e WHERE e.owner=p.owner AND e.piece_id=p.id AND e.dimension IN ('tuning-name','capo','list'))`;
    const rows = (await this.statement(`SELECT p.*, ${shown('title')} AS title, ${shown('artist')} AS artist,
      (SELECT opened_at FROM piece_views v WHERE v.owner=p.owner AND v.piece_id=p.id) AS opened_at,
      EXISTS (SELECT 1 FROM tags t WHERE t.owner=p.owner AND t.piece_id=p.id AND t.dimension='favourite' AND t.value='yes') AS favourite,
      ${chips} AS chips
      FROM pieces p WHERE ${where} ORDER BY ${order} LIMIT ${PAGE + 1} OFFSET ?`, ...values, offset)
      .all<Piece & { title: string | null; artist: string | null; opened_at: string | null; favourite: number; chips: string }>()).results;
    const page = rows.slice(0, PAGE).map(r => ({ ...r, favourite: r.favourite === 1,
      chips: (JSON.parse(r.chips) as [string, string][]).map(([dimension, value]) => ({ dimension, value })).sort((a, b) => a.dimension.localeCompare(b.dimension) || a.value.localeCompare(b.value)) }));
    return { pieces: page, next: rows.length > PAGE ? String(offset + PAGE) : null };
  }

  /** Every shown dimension:value among the pieces matching the filters, with counts —
   *  the rail's lines, its opened lists, and the "n of m" summary. */
  async facets(owner: string, filters: string[]): Promise<{ total: number; facets: Facet[] }> {
    const { where, values } = this.filtered(owner, filters);
    const [count, rows] = await this.db.batch([
      this.statement(`SELECT count(*) AS n FROM pieces p WHERE ${where}`, ...values),
      this.statement(`SELECT e.dimension, e.value, count(DISTINCT e.piece_id) AS pieces FROM (${EFFECTIVE_TAGS}) e
        WHERE e.piece_id IN (SELECT p.id FROM pieces p WHERE ${where}) AND e.owner=?
        GROUP BY e.dimension, e.value ORDER BY e.dimension, pieces DESC, e.value COLLATE NOCASE`, ...values, owner)
    ]);
    return { total: Number((count.results[0] as { n: number }).n), facets: rows.results as Facet[] };
  }

  /** Completion for the search box and the Tags sheet: shown values, with counts,
   *  optionally within one dimension. substr equality treats SQL wildcards literally. */
  async completeTags(owner: string, prefix: string, dimension?: string): Promise<Facet[]> {
    return (await this.statement(`SELECT e.dimension, e.value, count(DISTINCT e.piece_id) AS pieces FROM (${EFFECTIVE_TAGS}) e WHERE e.owner=?
      ${dimension === undefined ? '' : 'AND e.dimension=? '}AND substr(e.dimension || ':' || e.value,1,length(?))=?
      GROUP BY e.dimension, e.value ORDER BY e.dimension, e.value COLLATE NOCASE LIMIT 50`, owner, ...(dimension === undefined ? [] : [dimension]), prefix, prefix).all<Facet>()).results;
  }

  /** A piece was opened by this owner, now. The piece must be theirs. */
  async recordView(owner: string, pieceId: string, now = new Date().toISOString()) {
    requireText(owner, 'owner'); requireText(pieceId, 'piece id');
    const piece = await this.statement('SELECT id FROM pieces WHERE owner=? AND id=?', owner, pieceId).first();
    if (!piece) throw new LibraryError('not_found', 'Piece not found');
    await this.statement(`INSERT INTO piece_views (owner,piece_id,opened_at) VALUES (?,?,?)
      ON CONFLICT(owner,piece_id) DO UPDATE SET opened_at=excluded.opened_at`, owner, pieceId, now).run();
  }

  async readRendition(owner: string, id: string) {
    requireText(owner, 'owner');
    const row = await this.statement('SELECT r.* FROM renditions r JOIN pieces p ON p.id=r.piece_id WHERE p.owner=? AND r.id=?', owner, id).first<Rendition>();
    if (!row) throw new LibraryError('not_found', 'Rendition not found');
    const object = await this.bucket.get(row.r2_key);
    if (!object || object.size !== row.bytes) throw new LibraryError('blob', 'Rendition blob missing or wrong size');
    return { rendition: row, object };
  }

  /** The canonical rendition's bytes, whatever their format. Conversion to
   *  MNX is the reader's job (the shells' importer worker), never the service's. */
  async readCanonical(owner: string, id: string) {
    const snapshot = await this.getPiece(owner, id);
    if (!snapshot) throw new LibraryError('not_found', 'Piece not found');
    if (!snapshot.piece.canonical_rendition_id) return null;
    const { rendition, object } = await this.readRendition(owner, snapshot.piece.canonical_rendition_id);
    return { rendition, object, revision: snapshot.piece.revision };
  }

  async listAliases(owner: string): Promise<AliasReport[]> {
    requireText(owner, 'owner');
    return (await this.statement(`SELECT a.*, (SELECT count(DISTINCT t.piece_id) FROM tags t WHERE t.owner=a.owner AND t.dimension=a.dimension AND t.value=a.raw_value) AS pieces
      FROM tag_aliases a WHERE a.owner=? ORDER BY a.dimension, a.raw_value`, owner).all<AliasReport>()).results;
  }

  async deleteAlias(owner: string, dimension: string, raw: string) {
    requireText(owner, 'owner'); requireText(dimension, 'dimension'); requireText(raw, 'raw value');
    await this.statement('DELETE FROM tag_aliases WHERE owner=? AND dimension=? AND raw_value=?', owner, dimension, raw).run();
  }

  /** Aliases applied in code, for a snapshot's tags: the stored value stays in
   *  `value`; `shown` is what a person sees. */
  static shown<T extends { dimension: string; value: string }>(tags: T[], aliases: Alias[]): (T & { shown: string })[] {
    const map = new Map(aliases.map(a => [`${a.dimension}\u0000${a.raw_value}`, a.canonical_value]));
    return tags.map(t => ({ ...t, shown: map.get(`${t.dimension}\u0000${t.value}`) ?? t.value }));
  }

  async setAlias(owner: string, dimension: string, raw: string, canonical: string) {
    requireText(owner, 'owner'); requireText(raw, 'raw value'); requireText(canonical, 'canonical value');
    if (!isDerivedDimension(dimension)) throw new LibraryError('invalid', 'Aliases correct derived dimensions');
    await this.statement(`INSERT INTO tag_aliases (owner,dimension,raw_value,canonical_value) VALUES (?,?,?,?)
      ON CONFLICT(owner,dimension,raw_value) DO UPDATE SET canonical_value=excluded.canonical_value
      WHERE canonical_value != excluded.canonical_value`, owner, dimension, raw, canonical).run();
  }

  async writePiece(owner: string, input: PieceWrite): Promise<Snapshot> {
    requireText(owner, 'owner'); requireText(input.id, 'piece id');
    if (input.expected_revision !== null && (!Number.isSafeInteger(input.expected_revision) || input.expected_revision < 0 || input.expected_revision >= Number.MAX_SAFE_INTEGER)) {
      throw new LibraryError('invalid', 'Expected revision must be nonnegative or null for creation');
    }
    const before = await this.getPiece(owner, input.id);
    if (input.expected_revision === null ? before !== null : before?.piece.revision !== input.expected_revision) {
      throw new LibraryError('conflict', 'Piece revision changed; read it again');
    }
    const now = new Date().toISOString();
    if (input.source) {
      requireText(input.source.kind, 'source kind'); requireText(input.source.id, 'source id');
      if (before && (before.piece.source_kind !== input.source.kind || before.piece.source_id !== input.source.id)) {
        throw new LibraryError('immutable', 'Piece source identity cannot change');
      }
    }
    const piece: Piece = before ? { ...before.piece } : {
      id: input.id, owner, canonical_rendition_id: null,
      source_kind: input.source?.kind ?? null, source_id: input.source?.id ?? null,
      source_url: input.source?.url ?? null, revision: 0, created_at: now, updated_at: now
    };
    if (input.source?.url !== undefined) piece.source_url = input.source.url;
    const renditions = new Map((before?.renditions ?? []).map(r => [r.id, r]));
    const recordings = new Map((before?.recordings ?? []).map(r => [r.id, r]));
    const blobs = new Map<string, PreparedBlob>();
    const newRenditions: Rendition[] = [];
    const renditionUpdates: Rendition[] = [];
    const recordingUpdates: { row: Recording; exists: boolean }[] = [];
    const seen = new Set<string>();
    for (const inputRow of input.renditions ?? []) {
      requireText(inputRow.id, 'rendition id'); requireText(inputRow.producer, 'producer');
      if (seen.has(inputRow.id)) throw new LibraryError('invalid', 'Duplicate rendition id');
      seen.add(inputRow.id);
      if (!['gp','gpx','gp5','gp4','gp3','musicxml','mnx'].includes(inputRow.format) ||
          !['original','export','derived'].includes(inputRow.role)) throw new LibraryError('invalid', 'Invalid rendition format or role');
      if (inputRow.producer_version !== null) requireText(inputRow.producer_version, 'producer version');
      const blob = await describeBlob('renditions', inputRow);
      blobs.set(blob.r2_key, blob);
      // Stored MNX (an edit, one day) must match the storage schema; nothing is derived from it.
      if (inputRow.format === 'mnx') parseMnx(blob.content);
      const old = renditions.get(inputRow.id);
      const row: Rendition = {
        id: inputRow.id, piece_id: piece.id, format: inputRow.format, role: inputRow.role,
        producer: inputRow.producer, producer_version: inputRow.producer_version,
        producer_options: inputRow.producer_options === null ? null : json(inputRow.producer_options),
        sha256: blob.sha256, r2_key: blob.r2_key, bytes: blob.bytes,
        derived_from: inputRow.derived_from ?? null, created_at: old?.created_at ?? now,
        filename: inputRow.filename === undefined ? old?.filename ?? null : inputRow.filename,
        fetched_at: inputRow.fetched_at === undefined ? old?.fetched_at ?? null : inputRow.fetched_at,
        provenance: inputRow.provenance === undefined ? old?.provenance ?? null : json(inputRow.provenance)
      };
      if (old) {
        for (const key of ['format','role','producer','producer_version','producer_options','sha256','r2_key','bytes','derived_from'] as const) {
          if (old[key] !== row[key]) throw new LibraryError('immutable', 'Rendition bytes and lineage cannot change');
        }
        if (!same(old, row)) renditionUpdates.push(row);
      } else newRenditions.push(row);
      renditions.set(row.id, row);
    }
    // Validate the whole proposed graph, then sort new rows parent-first for immediate FKs.
    const ordered: Rendition[] = [];
    const pending = [...newRenditions];
    const available = new Set(before?.renditions.map(r => r.id) ?? []);
    while (pending.length) {
      const i = pending.findIndex(r => r.derived_from === null || available.has(r.derived_from));
      if (i < 0) throw new LibraryError('invalid', 'Derived parent is outside this piece or forms a cycle');
      const [row] = pending.splice(i, 1); ordered.push(row); available.add(row.id);
    }
    seen.clear();
    for (const r of input.recordings ?? []) {
      requireText(r.id, 'recording id');
      if (!['audio','video','youtube'].includes(r.kind)) throw new LibraryError('invalid', 'Invalid recording kind');
      if (r.source_id != null) requireText(r.source_id, 'recording source id');
      const sourceMatch = r.source_id == null ? undefined : [...recordings.values()].find(old => old.source_id === r.source_id);
      const byId = recordings.get(r.id);
      if (byId && sourceMatch && byId.id !== sourceMatch.id) throw new LibraryError('invalid', 'Recording identities disagree');
      const old = sourceMatch ?? byId;
      const id = old?.id ?? r.id;
      if (seen.has(id)) throw new LibraryError('invalid', 'Duplicate recording identity');
      seen.add(id);
      if (old && r.source_id !== undefined && r.source_id !== old.source_id) throw new LibraryError('immutable', 'Recording source identity cannot change');
      const blob = r.blob ? await describeBlob('recordings', r.blob) : null;
      if (blob) blobs.set(blob.r2_key, blob);
      const row: Recording = {
        id, piece_id: piece.id, kind: r.kind, name: r.name === undefined ? old?.name ?? null : r.name,
        source_id: old?.source_id ?? r.source_id ?? null,
        r2_key: blob?.r2_key ?? old?.r2_key ?? null, sha256: blob?.sha256 ?? old?.sha256 ?? null,
        bytes: blob?.bytes ?? old?.bytes ?? null, mime: r.mime === undefined ? old?.mime ?? null : r.mime,
        external_id: r.external_id === undefined ? old?.external_id ?? null : r.external_id,
        duration_s: r.duration_s === undefined ? old?.duration_s ?? null : r.duration_s,
        syncpoints: r.syncpoints === undefined ? old?.syncpoints ?? null : json(r.syncpoints),
        created_at: old?.created_at ?? now, updated_at: old?.updated_at ?? now
      };
      if (row.duration_s !== null && (!Number.isFinite(row.duration_s) || row.duration_s < 0)) throw new LibraryError('invalid', 'Invalid recording duration');
      if (r.syncpoints !== undefined && r.syncpoints !== null && (!Array.isArray(r.syncpoints) || r.syncpoints.some(p =>
        !Array.isArray(p) || p.length < 2 || p.length > 4 || !Number.isInteger(p[0]) || Number(p[0]) < 0 ||
        typeof p[1] !== 'number' || p[1] < 0))) throw new LibraryError('invalid', 'Invalid performed-bar syncpoints');
      if (r.kind === 'youtube') {
        requireText(row.external_id, 'YouTube id');
        if (r.blob) throw new LibraryError('invalid', 'YouTube recordings do not store blobs');
        row.r2_key = null; row.sha256 = null; row.bytes = null; row.mime = null;
      } else if (!row.r2_key || row.external_id !== null) throw new LibraryError('invalid', 'Uploaded recordings need a blob and no external id');
      if (!old || !same(old, row)) {
        row.updated_at = now; recordingUpdates.push({ row, exists: !!old });
      }
      recordings.set(row.id, row);
    }
    if (input.canonical) {
      if (!['initialize','replace'].includes(input.canonical.mode) || !renditions.has(input.canonical.rendition_id)) {
        throw new LibraryError('invalid', 'Canonical rendition must belong to this piece');
      }
      if (input.canonical.mode === 'replace' || piece.canonical_rendition_id === null) piece.canonical_rendition_id = input.canonical.rendition_id;
    }
    const tags = new Map((before?.tags ?? []).filter(t => t.origin === 'asserted').map(t => [tagKey(t), t]));
    for (const rename of input.rename_tags ?? []) {
      asserted(rename.dimension, rename.value); asserted(rename.to_dimension, rename.to_value);
      const key = tagKey(rename); const old = tags.get(key);
      if (!old) throw new LibraryError('not_found', 'Asserted tag not found');
      const target = { ...old, dimension: rename.to_dimension, value: rename.to_value };
      if (tagKey(target) !== key && tags.has(tagKey(target))) throw new LibraryError('conflict', 'Tag rename collides with an existing tag');
      tags.delete(key); tags.set(tagKey(target), target);
    }
    for (const t of input.remove_tags ?? []) {
      asserted(t.dimension, t.value);
      tags.delete(tagKey(t));
    }
    for (const t of input.tags ?? []) {
      asserted(t.dimension, t.value);
      if (t.source_ref != null) requireText(t.source_ref, 'tag source reference');
      if (t.sort_key != null && !Number.isSafeInteger(t.sort_key)) throw new LibraryError('invalid', 'Invalid tag sort key');
      // An upstream list already represented by a renamed tag must stay renamed.
      if (t.source_ref && [...tags.values()].some(old => old.source_ref === t.source_ref)) continue;
      const old = tags.get(tagKey(t));
      if (old) {
        if (t.source_ref && old.source_ref !== t.source_ref) throw new LibraryError('conflict', 'Tag label has a different source reference');
        continue;
      }
      tags.set(tagKey(t), { owner, piece_id: piece.id, dimension: t.dimension, value: t.value,
        origin: 'asserted', sort_key: t.sort_key ?? null, source_ref: t.source_ref ?? null });
    }
    // The derived projection: replaced wholesale when supplied, retained when not.
    if (input.derived_tags) {
      for (const t of input.derived_tags) {
        requireText(t.dimension, 'derived dimension'); requireText(t.value, 'derived value'); requireText(t.source_ref, 'derived tag source reference');
        if (!isDerivedDimension(t.dimension)) throw new LibraryError('invalid', 'Only derived dimensions may be projected');
        tags.set(tagKey(t), { owner, piece_id: piece.id, dimension: t.dimension, value: t.value.trim(), origin: 'derived', sort_key: null, source_ref: t.source_ref });
      }
    } else {
      for (const t of before?.tags ?? []) if (t.origin === 'derived') tags.set(tagKey(t), t);
    }
    const orderedTags = [...tags.values()].sort((a,b) => a.dimension.localeCompare(b.dimension) || a.value.localeCompare(b.value));
    const oldTags = [...(before?.tags ?? [])].sort((a,b) => a.dimension.localeCompare(b.dimension) || a.value.localeCompare(b.value));
    const tagsChanged = !same(orderedTags, oldTags);
    const changed = !before || !same(piece, before.piece) || newRenditions.length || renditionUpdates.length || recordingUpdates.length || tagsChanged;
    // Blobs first. Losing a later SQL race can leave an unreferenced blob, never a dangling row.
    for (const blob of blobs.values()) await storeBlob(this.bucket, blob);
    if (!changed) return before!;
    piece.updated_at = now;
    piece.revision = before ? before.piece.revision + 1 : 0;
    const statements: D1PreparedStatement[] = before ? [
      // Trigger rejects any value other than OLD.revision + 1, rolling back the batch.
      this.statement('UPDATE pieces SET revision=CASE WHEN owner=? THEN ? ELSE revision END,updated_at=? WHERE id=?', owner, piece.revision, now, piece.id)
    ] : [this.insert('pieces', { ...piece, canonical_rendition_id: null })];
    for (const row of ordered) statements.push(this.insert('renditions', row));
    for (const row of renditionUpdates) statements.push(this.statement('UPDATE renditions SET filename=?,fetched_at=?,provenance=? WHERE id=? AND piece_id=?', row.filename, row.fetched_at, row.provenance, row.id, piece.id));
    for (const { row, exists } of recordingUpdates) {
      if (!exists) statements.push(this.insert('recordings', row));
      else statements.push(this.statement(`UPDATE recordings SET kind=?,name=?,r2_key=?,sha256=?,bytes=?,mime=?,external_id=?,duration_s=?,syncpoints=?,updated_at=? WHERE id=? AND piece_id=?`, row.kind, row.name, row.r2_key, row.sha256, row.bytes, row.mime, row.external_id, row.duration_s, row.syncpoints, now, row.id, piece.id));
    }
    statements.push(this.statement('UPDATE pieces SET canonical_rendition_id=?,source_url=? WHERE id=? AND owner=?', piece.canonical_rendition_id, piece.source_url, piece.id, owner));
    if (tagsChanged) {
      statements.push(this.statement('DELETE FROM tags WHERE owner=? AND piece_id=?', owner, piece.id));
      for (const row of orderedTags) statements.push(this.insert('tags', row));
    }
    try {
      const results = await this.db.batch(statements);
      if (results[0].meta.changes !== 1) throw new LibraryError('conflict', 'Piece disappeared; read it again');
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/library_revision_conflict|UNIQUE constraint failed/.test(message)) throw new LibraryError('conflict', 'Piece revision or identity changed; read it again');
      throw error;
    }
    return { piece, renditions: [...renditions.values()].sort((a,b) => a.id.localeCompare(b.id)), recordings: [...recordings.values()].sort((a,b) => a.id.localeCompare(b.id)), tags: orderedTags };
  }
}
