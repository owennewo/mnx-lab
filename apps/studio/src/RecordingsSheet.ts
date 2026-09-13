import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LibraryClient, LibraryRequestError, type LibrarySnapshot, type LibraryRecording, type RecordingChange } from '../../../src/storage/libraryClient.ts';
import { decodeRecordingSync, type RecordingSyncpoint } from '../../../src/model/recordingSync.ts';
import { youtubeVideoId } from '../../../src/model/youtubeUrl.ts';
import type { MnxDocument } from '../../../src/model/mnx.ts';
import { linearizePasses } from '../../../src/model/passes.ts';
import { compilePerformance } from '../../../src/audio/performance.ts';
import { createRecordingSync } from '../../../src/audio/recordingSync.ts';

@customElement('mnx-studio-recordings')
export class RecordingsSheet extends LitElement {
  @property({ attribute: false }) client!: LibraryClient;
  @property({ attribute: false }) snapshot!: LibrarySnapshot;
  @property({ attribute: false }) document!: MnxDocument;
  @property({ attribute: false }) recordingId: string | null = null;
  @state() private editing: LibraryRecording | null = null;
  @state() private name = '';
  @state() private kind = 'youtube';
  @state() private video = '';
  @state() private file: File | null = null;
  @state() private busy = false;
  @state() private stage = '';
  @state() private error = '';
  @state() private conflict = false;
  @state() private removing = '';
  private operationId = `studio-${crypto.randomUUID()}`;
  private controller?: AbortController;
  private generation = 0;
  private cancelling = false;
  private expectedRevision = 0;
  private compiled?: ReturnType<typeof compilePerformance>;
  private passes?: ReturnType<typeof linearizePasses>;
  static styles = css`
    :host { box-sizing: border-box; display: flex; flex-direction: column; width: min(440px,100vw); height: 100%; overflow: auto; background: light-dark(#faf9f7,#292826); border-left: 1px solid var(--line); color: var(--ink); }
    header, section { padding: 14px 18px; } header { display:flex; gap:12px; align-items:center; } header b { flex:1; }
    section { display:grid; gap:12px; border-top:1px solid var(--line); } label { display:grid; gap:5px; font-size:13px; }
    input, select, button { font:inherit; color:inherit; background:transparent; border:1px solid var(--line); border-radius:3px; padding:8px; min-width:0; }
    select option { color:var(--ink); background:light-dark(#faf9f7,#292826); }
    dl { display:grid; grid-template-columns:auto 1fr; gap:8px 16px; margin:0; font-size:13px; } dd { margin:0; overflow-wrap:anywhere; } button { cursor:pointer; } button:disabled { opacity:.5; cursor:default; }
    .row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .source-link { font-size:13px; color:inherit; overflow-wrap:anywhere; }
    .hint { color:var(--ink-dim); font-size:12px; margin:0; line-height:1.5; } .error { color:light-dark(#a12121,#ffb4ab); }
    .diagnostic { font-size:13px; padding:10px; background:light-dark(#efeeeb,#343330); line-height:1.5; }
    fieldset { border:0; margin:0; padding:0; display:grid; gap:12px; min-width:0; }
  `;
  protected updated(changed: Map<PropertyKey, unknown>) {
    if (changed.has('document')) { this.passes = linearizePasses(this.document.mnxJson); this.compiled = compilePerformance(this.document.mnxJson, this.passes); this.requestUpdate(); }
    if (changed.has('recordingId') || (changed.has('snapshot') && !this.editing && !this.name)) this.reset(this.snapshot.recordings.find(r => r.id === this.recordingId) ?? null);
  }
  disconnectedCallback() { ++this.generation; this.controller?.abort(); if (this.busy && this.file) void this.client.cancelRecordingUpload(this.operationId).catch(() => {}); super.disconnectedCallback(); }
  private changed() { this.error = ''; this.conflict = false; this.operationId = `studio-${crypto.randomUUID()}`; }
  private reset(row: LibraryRecording | null = null) {
    this.changed(); this.editing = row; this.expectedRevision = this.snapshot.piece.revision;
    this.name = row?.name ?? ''; this.kind = row?.kind ?? 'youtube'; this.video = row?.external_id ?? ''; this.file = null; this.removing = '';
  }
  private syncDetails() {
    if (!this.editing?.syncpoints) return { points: [], message: 'No sync points. Playback is available without score following or score seeking.' };
    try {
      const raw: unknown = JSON.parse(this.editing.syncpoints);
      const decoded = decodeRecordingSync(raw);
      if (!decoded.ok) return { points: [], message: decoded.diagnostic.message };
      const mapped = this.compiled?.ok && this.passes ? createRecordingSync(raw, this.compiled, this.passes) : null;
      return { points: decoded.value.points, message: mapped?.ok
        ? `${mapped.value.coverage === 'full' ? 'Full' : 'Partial'} score coverage.`
        : mapped ? mapped.diagnostic.message : 'Score timing is unavailable.' };
    } catch { return { points: [], message: 'Stored sync points could not be read.' }; }
  }
  private location(point: RecordingSyncpoint | undefined) {
    if (!point) return '—';
    return `Performed bar ${point.bar + 1}${point.offset ? ` + ${Number((point.offset / 480 * 100).toFixed(1))}%` : ''} · ${Number(point.seconds.toFixed(3))} s`;
  }
  private publish(snapshot: LibrarySnapshot) { this.dispatchEvent(new CustomEvent('recordings-changed', { detail: snapshot, bubbles: true, composed: true })); }
  private async save() {
    this.error = ''; this.stage = '';
    const change: RecordingChange = { name: this.name };
    try {
      if (!this.editing && this.kind === 'youtube') change.video = youtubeVideoId(this.video);
      if (!this.editing) change.rawSync = null;
      if (!this.editing && this.kind === 'audio' && !this.file) throw new Error('Choose an audio file.');
      this.busy = true; this.stage = 'Saving…'; const generation = ++this.generation;
      this.controller = new AbortController();
      const { snapshot } = !this.editing && this.kind === 'audio'
        ? await this.client.uploadRecording(this.snapshot.piece.id, this.operationId, this.expectedRevision, change, this.file!, this.controller.signal, s => { this.stage = s; })
        : await this.client.saveRecording(this.snapshot.piece.id, this.editing?.id ?? this.operationId, this.expectedRevision, change);
      if (generation !== this.generation || !this.isConnected) return;
      const id = this.editing?.id ?? this.operationId;
      this.snapshot = snapshot; this.publish(snapshot); this.reset(snapshot.recordings.find(r => r.id === id) ?? null); this.stage = 'Recording saved.';
      this.dispatchEvent(new CustomEvent('recording-saved', { detail: { id } }));
    } catch (e) { this.stage = ''; this.error = e instanceof Error ? e.message : 'Could not save.'; this.conflict = e instanceof LibraryRequestError && e.status === 409; }
    finally { if (!this.cancelling) this.busy = false; }
  }
  private async cancel() {
    this.cancelling = true; ++this.generation; this.busy = true; this.controller?.abort();
    try { const result = await this.client.cancelRecordingUpload(this.operationId); this.stage = result.state === 'complete' ? 'Upload already finished. Reload to see the saved recording.' : 'Upload cancelled. The recording was not attached.'; }
    catch (e) { this.stage = e instanceof LibraryRequestError && e.status === 404 ? 'Upload cancelled before it started.' : 'Cancellation could not be confirmed. Reload to check before retrying.'; }
    this.operationId = `studio-${crypto.randomUUID()}`;
    this.error = ''; this.conflict = true; this.cancelling = false; this.busy = false;
  }
  private async reload() {
    this.busy = true;
    try { const { snapshot } = await this.client.piece(this.snapshot.piece.id); this.snapshot = snapshot; this.publish(snapshot); if (this.recordingId && !snapshot.recordings.some(r => r.id === this.recordingId)) { this.dispatchEvent(new CustomEvent('recording-deleted')); return; } this.reset(snapshot.recordings.find(r => r.id === this.recordingId) ?? null); this.stage = 'Reloaded. Review the recording before saving.'; }
    catch (e) { this.error = String(e); } finally { this.busy = false; }
  }
  private async detach(row: LibraryRecording) {
    this.busy = true;
    try { const { snapshot } = await this.client.removeRecording(this.snapshot.piece.id, row.id, this.snapshot.piece.revision); this.snapshot = snapshot; this.publish(snapshot); this.dispatchEvent(new CustomEvent('recording-deleted')); this.stage = 'Recording removed from this piece.'; }
    catch (e) { this.error = e instanceof Error ? e.message : 'Could not remove.'; this.conflict = e instanceof LibraryRequestError && e.status === 409; } finally { this.busy = false; }
  }
  private sourceLink(row: LibraryRecording) {
    if (row.kind !== 'youtube') return nothing;
    let url: string;
    try { url = `https://www.youtube.com/watch?v=${youtubeVideoId(row.external_id ?? '')}`; }
    catch { return html`<p class="hint">This recording has no valid YouTube link.</p>`; }
    return html`<a class="source-link" href=${url} target="_blank" rel="noopener noreferrer" aria-label=${`Open ${row.name ?? 'recording'} on YouTube`}>${url}</a>`;
  }
  render() {
    if (!this.snapshot) return nothing;
    const sync = this.syncDetails();
    return html`<header><b>${this.editing ? 'Recording details' : 'Add recording'}</b><button ?disabled=${this.busy} aria-label="Close recordings" @click=${() => this.dispatchEvent(new CustomEvent('close'))}>Close</button></header>
      <section>
        <fieldset ?disabled=${this.busy}>
          <label>Name<input aria-label="Recording name" maxlength="200" .value=${this.name} @input=${(e: Event) => { this.changed(); this.name = (e.target as HTMLInputElement).value; }}></label>
          ${!this.editing ? html`<label>Source<select aria-label="Recording type" .value=${this.kind} @change=${(e: Event) => { this.changed(); this.kind = (e.target as HTMLSelectElement).value; }}><option value="youtube">YouTube link</option><option value="audio">Audio file</option></select></label>
            ${this.kind === 'youtube' ? html`<label>YouTube URL<input aria-label="YouTube URL" .value=${this.video} @input=${(e: Event) => { this.changed(); this.video = (e.target as HTMLInputElement).value; }}></label>` : html`<p class="hint">MP3, M4A, WAV, Ogg or FLAC, up to 64 MiB. Playback depends on your browser's codec support. Retry restarts the transfer; no partial recording is attached.</p><label>Audio file<input aria-label="Audio file" type="file" accept=".mp3,.m4a,.wav,.ogg,.flac" @change=${(e: Event) => { this.changed(); this.file = (e.target as HTMLInputElement).files?.[0] ?? null; }}></label>`}` : html`${this.sourceLink(this.editing)}<p class="hint">${this.editing.kind === 'youtube' ? 'YouTube recording' : 'Audio recording'}</p>`}
          <strong>Sync points</strong>
          <dl aria-label="Sync point statistics"><dt>Count</dt><dd>${sync.points.length}</dd><dt>Start location</dt><dd>${this.location(sync.points[0])}</dd><dt>End location</dt><dd>${this.location(sync.points.at(-1))}</dd></dl>
          <p class="hint">Locations count performed bars, including repeats, starting at 1. Times are measured from the start of the recording.</p>
          <div class="diagnostic" role="status">${sync.message}</div>
          <button ?disabled=${!this.name.trim()} @click=${this.save}>${this.editing ? 'Save changes' : 'Attach recording'}</button>
          ${this.editing ? html`<button @click=${() => this.removing = this.editing!.id}>Delete recording</button>
            ${this.removing === this.editing.id ? html`<p>Delete “${this.editing.name ?? 'Unnamed recording'}” from this piece?</p><div class="row"><button @click=${() => this.detach(this.editing!)}>Confirm deletion</button><button @click=${() => this.removing = ''}>Keep recording</button></div>` : nothing}` : nothing}
        </fieldset>
        ${this.busy && this.file ? html`<button @click=${this.cancel}>Cancel upload</button>` : nothing}
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
        ${this.conflict ? html`<button ?disabled=${this.busy} @click=${this.reload}>Reload and review</button>` : nothing}
        ${this.stage ? html`<p class="hint" role="status">${this.stage}</p>` : nothing}
      </section>`;
  }
}
