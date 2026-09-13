import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LibraryClient, LibraryRequestError, type LibrarySnapshot, type LibraryRecording, type RecordingChange } from '../../../src/storage/libraryClient.ts';
import { attachmentSync, recordingSyncChoices, MAX_SYNC_BYTES, type SyncImportChoice } from '../../../src/model/recordingAttachment.ts';
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
  @state() private editing: LibraryRecording | null = null;
  @state() private name = '';
  @state() private kind = 'youtube';
  @state() private video = '';
  @state() private file: File | null = null;
  @state() private rawText = '';
  @state() private selectedId = '';
  @state() private syncChanged = false;
  @state() private unsynchronised = false;
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
    :host { display: flex; flex-direction: column; width: min(440px,100vw); height: 100%; overflow: auto; background: light-dark(#faf9f7,#292826); border-left: 1px solid var(--line); color: var(--ink); }
    header, section { padding: 14px 18px; } header { display:flex; gap:12px; align-items:center; } header b { flex:1; }
    section { display:grid; gap:12px; border-top:1px solid var(--line); } label { display:grid; gap:5px; font-size:13px; }
    input, select, textarea, button { font:inherit; color:inherit; background:transparent; border:1px solid var(--line); border-radius:3px; padding:8px; min-width:0; }
    textarea { min-height:90px; resize:vertical; } button { cursor:pointer; } button:disabled { opacity:.5; cursor:default; }
    .row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; } .row strong { flex:1; overflow-wrap:anywhere; }
    .hint { color:var(--ink-dim); font-size:12px; margin:0; line-height:1.5; } .error { color:light-dark(#a12121,#ffb4ab); } .check { display:flex; align-items:flex-start; }
    .diagnostic { font-size:13px; padding:10px; background:light-dark(#efeeeb,#343330); line-height:1.5; }
    fieldset { border:0; margin:0; padding:0; display:grid; gap:12px; min-width:0; }
  `;
  protected updated(changed: Map<PropertyKey, unknown>) {
    if (changed.has('document')) { this.passes = linearizePasses(this.document.mnxJson); this.compiled = compilePerformance(this.document.mnxJson, this.passes); this.requestUpdate(); }
    if (changed.has('snapshot') && !this.editing && !this.name) this.expectedRevision = this.snapshot.piece.revision;
  }
  disconnectedCallback() { ++this.generation; this.controller?.abort(); if (this.busy && this.file) void this.client.cancelRecordingUpload(this.operationId).catch(() => {}); super.disconnectedCallback(); }
  private changed() { this.error = ''; this.conflict = false; this.operationId = `studio-${crypto.randomUUID()}`; }
  private reset(row: LibraryRecording | null = null) {
    this.changed(); this.editing = row; this.expectedRevision = this.snapshot.piece.revision; this.name = row?.name ?? ''; this.kind = row?.kind ?? 'youtube'; this.video = row?.external_id ?? ''; this.file = null; this.selectedId = ''; this.rawText = ''; this.syncChanged = false; this.unsynchronised = false; this.removing = '';
    if (row) { try { const p = row.provenance ? JSON.parse(row.provenance) : null; this.rawText = JSON.stringify(p?.raw ?? (row.syncpoints ? JSON.parse(row.syncpoints) : null), null, 2); this.selectedId = p?.selectedId ?? '';
      // Operator refreshes can replace the active tuples; historical raw provenance
      // remains evidence, but must not masquerade as the currently bound timings.
      if (p && JSON.stringify(attachmentSync(p.raw, p.selectedId).syncpoints) !== JSON.stringify(row.syncpoints ? JSON.parse(row.syncpoints) : null)) { this.rawText = row.syncpoints ?? ''; this.selectedId = ''; } } catch { this.rawText = row.syncpoints ?? ''; } }
  }
  private sync() {
    if (new TextEncoder().encode(this.rawText).length > MAX_SYNC_BYTES) throw new Error('Sync JSON must be at most 1 MiB.');
    const raw = this.rawText.trim() ? JSON.parse(this.rawText) : null;
    return attachmentSync(raw, this.selectedId || null);
  }
  private diagnostic() {
    try {
      const s = this.sync();
      const mapped = this.compiled?.ok && this.passes ? createRecordingSync(s.syncpoints, this.compiled, this.passes) : null;
      const usable = mapped?.ok === true;
      let message = s.syncpoints === null ? 'No timings attached.' : mapped?.ok ? `${mapped.value.coverage === 'full' ? 'Full' : 'Partial'} coverage: ${mapped.value.bounds.startSeconds}–${mapped.value.bounds.endSeconds} seconds, performed bars from 0. Intervals between anchors are interpolated.` : mapped && !mapped.ok ? mapped.diagnostic.message : 'Score timing is unavailable.';
      if (!usable) message += ' Saving without usable alignment disables score following and score seeking.';
      if (s.provenance.crop_start !== null || s.provenance.crop_end !== null) message += ` Crop boundaries preserved as absolute seconds (${s.provenance.crop_start ?? '?'}–${s.provenance.crop_end ?? '?'}). Crop controls are not applied; playback uses the original media clock.`;
      else if (s.provenance.cropped_duration !== null || (this.editing && !this.editing.provenance && this.editing.duration_s !== null)) message += ' Only cropped duration is known; crop boundaries cannot be reconstructed.';
      return { message, usable, invalid: false };
    } catch (error) { return { message: error instanceof Error ? error.message : 'Invalid sync JSON.', usable: false, invalid: true }; }
  }
  private choices(): SyncImportChoice[] { try { return this.rawText.trim() ? recordingSyncChoices(JSON.parse(this.rawText)) : []; } catch { return []; } }
  private async importSync(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
    if (file.size > MAX_SYNC_BYTES) { this.error = 'Sync JSON must be at most 1 MiB.'; return; }
    const generation = this.generation;
    const text = await file.text(); if (!this.isConnected || generation !== this.generation) return;
    this.changed(); this.rawText = text; this.selectedId = ''; this.syncChanged = true; this.unsynchronised = false;
  }
  private publish(snapshot: LibrarySnapshot) { this.dispatchEvent(new CustomEvent('recordings-changed', { detail: snapshot, bubbles: true, composed: true })); }
  private async save() {
    this.error = ''; this.stage = ''; const d = this.diagnostic(); if (d.invalid || (!d.usable && !this.unsynchronised)) { this.error = d.message; return; }
    const change: RecordingChange = { name: this.name };
    try {
      if (!this.editing && this.kind === 'youtube') change.video = youtubeVideoId(this.video);
      if (!this.editing || this.syncChanged) { change.rawSync = this.rawText.trim() ? JSON.parse(this.rawText) : null; change.selectedId = this.selectedId || null; }
      if (!this.editing && this.kind === 'audio' && !this.file) throw new Error('Choose an audio file.');
      this.busy = true; this.stage = 'Saving…'; const generation = ++this.generation;
      this.controller = new AbortController();
      const { snapshot } = !this.editing && this.kind === 'audio'
        ? await this.client.uploadRecording(this.snapshot.piece.id, this.operationId, this.expectedRevision, change, this.file!, this.controller.signal, s => { this.stage = s; })
        : await this.client.saveRecording(this.snapshot.piece.id, this.editing?.id ?? this.operationId, this.expectedRevision, change);
      if (generation !== this.generation || !this.isConnected) return;
      this.snapshot = snapshot; this.publish(snapshot); this.reset(); this.stage = 'Recording saved.';
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
    try { const { snapshot } = await this.client.piece(this.snapshot.piece.id); this.snapshot = snapshot; this.publish(snapshot); this.expectedRevision = snapshot.piece.revision; this.changed(); this.stage = 'Reloaded. Review the timings against the current score before saving.'; }
    catch (e) { this.error = String(e); } finally { this.busy = false; }
  }
  private async detach(row: LibraryRecording) {
    this.busy = true;
    try { const { snapshot } = await this.client.removeRecording(this.snapshot.piece.id, row.id, this.snapshot.piece.revision); this.snapshot = snapshot; this.publish(snapshot); this.reset(); this.stage = 'Recording removed from this piece.'; }
    catch (e) { this.error = e instanceof Error ? e.message : 'Could not remove.'; this.conflict = e instanceof LibraryRequestError && e.status === 409; } finally { this.busy = false; }
  }
  render() {
    if (!this.snapshot) return nothing;
    const d = this.diagnostic(), choices = this.choices();
    return html`<header><b>Recordings</b><button ?disabled=${this.busy} aria-label="Close recordings" @click=${() => this.dispatchEvent(new CustomEvent('close'))}>Close</button></header>
      <section>${this.snapshot.recordings.map(row => html`<div class="row"><strong>${row.name ?? 'Unnamed recording'}</strong><span class="hint">${row.kind}</span><button ?disabled=${this.busy} @click=${() => this.reset(row)}>Edit</button><button ?disabled=${this.busy} @click=${() => this.removing = row.id}>Remove</button></div>
        ${this.removing === row.id ? html`<p>Remove “${row.name ?? row.id}” from this piece?</p><div class="row"><button ?disabled=${this.busy} @click=${() => this.detach(row)}>Confirm removal</button><button @click=${() => this.removing = ''}>Keep recording</button></div>` : nothing}`)}
        ${!this.snapshot.recordings.length ? html`<p class="hint">No recordings attached yet.</p>` : nothing}
        <button ?disabled=${this.busy} @click=${() => this.reset()}>Add recording</button>
      </section><section><strong>${this.editing ? 'Edit recording' : 'New recording'}</strong>
        <fieldset ?disabled=${this.busy}>
          <label>Name<input aria-label="Recording name" maxlength="200" .value=${this.name} @input=${(e: Event) => { this.changed(); this.name = (e.target as HTMLInputElement).value; }}></label>
          ${!this.editing ? html`<label>Source<select aria-label="Recording type" .value=${this.kind} @change=${(e: Event) => { this.changed(); this.kind = (e.target as HTMLSelectElement).value; }}><option value="youtube">YouTube link</option><option value="audio">Audio file</option></select></label>
            ${this.kind === 'youtube' ? html`<label>YouTube URL<input aria-label="YouTube URL" .value=${this.video} @input=${(e: Event) => { this.changed(); this.video = (e.target as HTMLInputElement).value; }}></label>` : html`<p class="hint">MP3, M4A, WAV, Ogg or FLAC, up to 64 MiB. Playback depends on your browser's codec support. Retry restarts the transfer; no partial recording is attached.</p><label>Audio file<input aria-label="Audio file" type="file" accept=".mp3,.m4a,.wav,.ogg,.flac" @change=${(e: Event) => { this.changed(); this.file = (e.target as HTMLInputElement).files?.[0] ?? null; }}></label>`}` : html`<p class="hint">Media identity is retained. Attach a new recording to use a different file or video.</p>`}
          <label>Import timings (JSON, up to 1 MiB)<input type="file" accept=".json" aria-label="Import sync JSON" @change=${this.importSync}></label>
          <label>Soundslice sync JSON<textarea aria-label="Sync JSON" .value=${this.rawText} @input=${(e: Event) => { this.changed(); this.rawText = (e.target as HTMLTextAreaElement).value; this.selectedId = ''; this.syncChanged = true; this.unsynchronised = false; }}></textarea></label>
          ${choices.length && !this.rawText.trim().startsWith('[') ? html`<label>Timings belong to<select aria-label="Sync recording" .value=${this.selectedId} @change=${(e: Event) => { this.changed(); this.selectedId = (e.target as HTMLSelectElement).value; this.syncChanged = true; }}><option value="">Choose recording by ID…</option>${choices.map(c => html`<option value=${c.id}>${c.label}</option>`)}</select></label>` : nothing}
          <div class="diagnostic" role="status">${d.message}</div>
          ${!d.usable && !d.invalid ? html`<label class="check"><input type="checkbox" aria-label="Save without score sync" .checked=${this.unsynchronised} @change=${(e: Event) => this.unsynchronised = (e.target as HTMLInputElement).checked}>Save without usable score alignment</label>` : nothing}
          <button ?disabled=${d.invalid || (!d.usable && !this.unsynchronised) || !this.name.trim()} @click=${this.save}>${this.editing ? 'Save changes' : 'Attach recording'}</button>
        </fieldset>
        ${this.busy && this.file ? html`<button @click=${this.cancel}>Cancel upload</button>` : nothing}
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
        ${this.conflict ? html`<button ?disabled=${this.busy} @click=${this.reload}>Reload and review</button>` : nothing}
        ${this.stage ? html`<p class="hint" role="status">${this.stage}</p>` : nothing}
      </section>`;
  }
}
