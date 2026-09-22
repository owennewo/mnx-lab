// The Edit piece sheet: everything a piece IS, in one panel, ordered by what a
// person can DO about each part of it.
//
//  1. FROM THE MUSIC — the score's own `_x.mnxLab.work` header, as fields. These
//     are the only values here that can be typed, and typing one is an ordinary
//     edit: a `work-change` carrying a `setWork` merge, applied through the
//     page's history, so it undoes, recovers and saves like any other. The
//     library's own title, artist and the rest are READ OFF these at each save.
//  2. READ FROM THE NOTES — the derived values that are not in the header:
//     parts, capo, tuning. Nothing to type, so the only correction is an alias,
//     which renames the value library-wide and never touches the file.
//  3. YOUR OWN — asserted tags: dimensions nobody reads from the music.
//
// This replaces the Details and Tags sheets, which split one subject across two
// panels and two buttons: Details owned the header fields while Tags showed the
// same values again, read-only, under "From the music", with a pencil that could
// only rename the echo. The word "tag" does not appear — a section says where a
// value came from, which is the distinction that decides what you can do to it.
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LibraryClient, LibraryRequestError, type LibraryFacet, type ShownTag } from '../../../src/storage/libraryClient.ts';
import { fromWorkHeader } from '../../../src/model/libraryTags.ts';
import type { MnxLabWork } from '../../../src/model/mnx.ts';
import type { WorkChange } from '../../../src/edit/ops.ts';
import { RAIL_HIDDEN, chipText, dimensionLabel, parseTag } from './labels.ts';

export interface EditPieceSnapshot { piece: { id: string; revision: number }; tags: ShownTag[] }

const cross = html`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>`;
const pencil = html`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10-10-4-4L4 16v4z"></path><path d="M13 7l4 4"></path></svg>`;
const plus = html`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="color: var(--ink-2)"><path d="M12 5v14M5 12h14"></path></svg>`;

/** The headline pair sits alone and full width — they are what the frame's own
 *  h1 and sub-line show. The rest pair off two to a row: nine fields in a
 *  column makes the sections below it a scroll away. */
const WIDE = [['title', 'Title'], ['artist', 'Artist']] as const;
const PAIRED = [['subtitle', 'Subtitle'], ['album', 'Album']] as const;
const ROLES = [['composer', 'Music by'], ['lyricist', 'Words by']] as const;

@customElement('mnx-studio-edit-piece')
export class EditPieceSheet extends LitElement {
  @property({ attribute: false }) client!: LibraryClient;
  @property({ attribute: false }) snapshot: EditPieceSnapshot | null = null;
  @property({ attribute: false }) work: MnxLabWork | undefined;
  /** Another tab holds this piece: look, do not touch. */
  @property({ type: Boolean }) readOnly = false;
  /** Why, when it is not another tab holding the lock. */
  @property() readOnlyReason = '';
  @property({ type: Boolean }) canUndo = false;
  @property({ type: Boolean }) canRedo = false;
  /** Whether this piece can be deleted from here (a stored piece, in the tab that holds its lock). */
  @property({ type: Boolean }) canDelete = false;
  @state() private query = '';
  @state() private suggestions: LibraryFacet[] = [];
  @state() private quick: LibraryFacet[] = [];
  @state() private editing: string | null = null;
  @state() private draft = '';
  @state() private busy = false;
  @state() private error = '';
  @state() private confirming = false;

  static styles = css`
    :host { box-sizing: border-box; display: flex; flex-direction: column; width: 380px; max-width: 100%; height: 100%; border-left: 1px solid var(--line); background: light-dark(oklch(0.975 0.003 60), oklch(0.2 0.004 60)); overflow-y: auto; }
    header { display: flex; align-items: center; gap: 8px; padding: 14px 18px 10px; }
    header b { font-weight: 600; font-size: 15px; flex: 1; }
    button { font: inherit; font-size: 13px; color: inherit; background: transparent; border: 1px solid var(--line); border-radius: 3px; padding: 4px 10px; cursor: pointer; }
    button.plain { border: 0; padding: 4px; color: var(--ink-2); display: inline-flex; }
    button:disabled { opacity: 0.4; cursor: default; }
    button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    section { padding: 4px 18px 16px; display: grid; gap: 11px; }
    label { display: grid; gap: 4px; color: var(--ink-2); font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    input, textarea { font: inherit; font-size: 14px; font-weight: 400; letter-spacing: 0; text-transform: none; color: var(--ink); background: light-dark(white, oklch(0.185 0.004 60)); border: 1px solid var(--line); border-radius: 3px; padding: 7px 9px; min-width: 0; resize: vertical; }
    input:read-only, textarea:read-only { color: var(--ink-2); background: transparent; }
    .two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .band { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; color: var(--ink-2); font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .band small { font-weight: 400; text-transform: none; letter-spacing: 0; }
    .rule { height: 1px; background: var(--line); margin: 0 18px; }
    p { margin: 0; color: var(--ink-2); font-size: 12px; line-height: 1.5; }
    form { display: flex; align-items: center; gap: 8px; border: 1px solid var(--line); border-radius: 3px; padding: 0 10px; background: light-dark(white, oklch(0.185 0.004 60)); }
    form:focus-within { border-color: var(--accent); }
    form input { border: 0; padding: 7px 0; outline: none; background: transparent; flex: 1; }
    .hint { color: var(--ink-2); font-size: 12px; white-space: nowrap; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 4px 4px 10px; border: 1px solid var(--line); border-radius: 3px; font-size: 13px; background: light-dark(white, oklch(0.185 0.004 60)); }
    .chip .dim { color: var(--ink-2); }
    .quick { border-style: dashed; color: var(--ink-2); font-size: 12px; padding: 3px 8px; }
    .row { display: grid; grid-template-columns: 92px 1fr 26px; gap: 10px; align-items: center; padding: 8px 0; border-bottom: 1px solid light-dark(oklch(0.9 0.003 60), oklch(0.27 0.004 60)); }
    .row .dim { color: var(--ink-2); font-size: 13px; }
    .row .raw { color: var(--ink-2); font-size: 12px; text-decoration: line-through; }
    .editor { display: flex; flex-direction: column; gap: 6px; padding: 6px 0; }
    .actions { display: flex; gap: 6px; align-items: center; }
    .error { color: light-dark(#b91c1c, #ffb4ab); font-size: 13px; margin: 0; }
    .muted { color: var(--ink-2); font-size: 12px; }
    .danger { margin-top: 2px; padding-top: 14px; border-top: 1px solid var(--line); display: grid; gap: 8px; }
    .danger .actions { flex-wrap: wrap; }
    button.delete { color: light-dark(#a12121, #ffb4ab); border-color: currentColor; }
  `;

  protected updated(changed: Map<PropertyKey, unknown>) {
    if (changed.has('snapshot') && this.snapshot) void this.loadQuick();
  }

  private get asserted() { return (this.snapshot?.tags ?? []).filter(t => t.origin === 'asserted'); }
  /** Derived, minus the pitch list (the tuning name says it) and minus everything
   *  the header owns — those are the fields above, not a read-only echo of them. */
  private get derived() {
    return (this.snapshot?.tags ?? []).filter(t => t.origin === 'derived' && t.dimension !== 'tuning' && !fromWorkHeader(t.dimension));
  }

  /**
   * What the LIBRARY holds for a header field the document does not fill.
   *
   * A piece ingested from elsewhere can carry an artist the score itself never
   * stated — read from a sidecar rather than from `_x.mnxLab.work`. Hiding
   * header dimensions from §2 would lose exactly those, so the field shows the
   * value as its placeholder: the library's answer, visible, and replaced the
   * moment you type one of your own. Renaming it library-wide instead is the
   * Aliases page's job, since there is nothing in this file to correct.
   */
  private inherited(name: string): string {
    if ((this.work as Record<string, unknown> | undefined)?.[name]) return '';
    return (this.snapshot?.tags ?? []).find(t => t.origin === 'derived' && t.dimension === name)?.shown ?? '';
  }

  private emit(type: string, detail?: unknown) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }
  private named(role: string): string {
    return [...new Set((this.work?.creators ?? []).filter(c => c.role === role).map(c => c.name))].join(', ');
  }
  /** A committed field — on change, so one edit is one history step, not one per keystroke. */
  private commit(change: WorkChange, was: string, now: string) {
    if (now.trim() !== was.trim()) this.emit('work-change', change);
  }
  private commitRole(role: string, value: string) {
    const others = (this.work?.creators ?? []).filter(c => c.role !== role);
    this.commit({ creators: [...others, ...(value.trim() ? [{ role, name: value.trim() }] : [])] }, this.named(role), value);
  }

  /** Quick-add: values used across the library in dimensions a person asserts, not yet on this piece. */
  private async loadQuick() {
    try {
      const { tags } = await this.client.tags('');
      const derived = new Set(this.derived.map(t => t.dimension)); const mine = new Set(this.asserted.map(t => `${t.dimension}:${t.value}`));
      this.quick = tags.filter(t => !derived.has(t.dimension) && !RAIL_HIDDEN.has(t.dimension) && !fromWorkHeader(t.dimension) && t.dimension !== 'favourite' && !mine.has(`${t.dimension}:${t.value}`))
        .sort((a, b) => b.pieces - a.pieces).slice(0, 4);
    } catch { this.quick = []; }
  }

  private async onInput(event: Event) {
    this.query = (event.target as HTMLInputElement).value;
    const colon = this.query.indexOf(':');
    if (colon <= 0) { this.suggestions = []; return; }
    const query = this.query;
    try { const { tags } = await this.client.tags(query.trim()); if (query === this.query) this.suggestions = tags; }
    catch { /* completion is a convenience */ }
  }

  private async change(change: Parameters<LibraryClient['changeTags']>[2]) {
    if (!this.snapshot) return;
    this.busy = true; this.error = '';
    try {
      const { snapshot } = await this.client.changeTags(this.snapshot.piece.id, this.snapshot.piece.revision, change);
      this.dispatchEvent(new CustomEvent<EditPieceSnapshot>('tags-changed', { detail: snapshot, bubbles: true, composed: true }));
    } catch (error) {
      this.error = error instanceof LibraryRequestError && error.status === 409 ? 'This piece changed elsewhere — reload to edit it.'
        : error instanceof LibraryRequestError && error.status === 400 ? 'That one is read from the music; correct it under “Read from the notes”.'
        : error instanceof Error ? error.message : 'Could not save that.';
    } finally { this.busy = false; }
  }
  private onSubmit(event: Event) {
    event.preventDefault();
    if (this.locked) return;
    const tag = parseTag(this.query);
    if (!tag) { this.error = 'Give it a kind and a value — genre: folk, status: learning.'; return; }
    this.query = ''; this.suggestions = [];
    void this.change({ add: [tag] });
  }

  private async alias(tag: ShownTag, canonical: string | null) {
    this.busy = true; this.error = '';
    try {
      if (canonical === null || canonical === tag.value) await this.client.deleteAlias(tag.dimension, tag.value);
      else await this.client.setAlias(tag.dimension, tag.value, canonical);
      this.editing = null;
      this.dispatchEvent(new CustomEvent('aliases-changed', { bubbles: true, composed: true }));
    } catch (error) { this.error = error instanceof Error ? error.message : 'Could not save that correction.'; }
    finally { this.busy = false; }
  }

  /** §1 — the header, as fields. Present whether or not the piece is stored:
   *  the document is the authority, and a piece with no library row still has one. */
  private fromTheMusic() {
    const work = this.work ?? {};
    const value = (event: Event) => (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    const field = (name: 'title' | 'artist' | 'subtitle' | 'album' | 'copyright', label: string) => html`<label>${label}
      <input maxlength="300" ?readonly=${this.readOnly} .value=${work[name] ?? ''} placeholder=${this.inherited(name) || '—'}
        @change=${(e: Event) => this.commit({ [name]: value(e) }, work[name] ?? '', value(e))} /></label>`;
    const borrowed = (['title', 'artist', 'subtitle', 'album', 'copyright'] as const).some(name => this.inherited(name));
    return html`
      <section>
        <div class="band"><span>From the music</span><small>the score’s own header</small></div>
        ${WIDE.map(([name, label]) => field(name, label))}
        <div class="two">${PAIRED.map(([name, label]) => field(name, label))}</div>
        <div class="two">
          ${ROLES.map(([role, label]) => html`<label>${label}
            <input maxlength="300" ?readonly=${this.readOnly} .value=${this.named(role)}
              @change=${(e: Event) => this.commitRole(role, value(e))} /></label>`)}
        </div>
        <div class="two">
          <label>Transcribed by
            <input maxlength="300" ?readonly=${this.readOnly} .value=${this.named('transcriber')}
              @change=${(e: Event) => this.commitRole('transcriber', value(e))} /></label>
          ${field('copyright', 'Copyright')}
        </div>
        <label>Notes
          <textarea rows="3" maxlength="4000" ?readonly=${this.readOnly} .value=${work.notes ?? ''}
            @change=${(e: Event) => this.commit({ notes: value(e) }, work.notes ?? '', value(e))}></textarea></label>
        ${borrowed ? html`<p>A greyed value is what the library already knows, from wherever this piece came from — the score itself does not say it. Type to make it the score's own.</p>` : nothing}
      </section>`;
  }

  /** ONE PANEL, ONE STATE. Read-only is the piece's condition, not the
   *  document's alone: looking at an older version, or holding it in a second
   *  tab, must not leave a live "Add a value" box and live pencils sitting under
   *  fields that have gone grey. The tags are piece-level and technically still
   *  writable, so this is a deliberate choice — a panel in two minds about
   *  whether it can be used is worse than one that says it cannot. */
  private get locked() { return this.readOnly || this.busy; }

  /** §2 — what the engine read off the notation. An alias is the only correction. */
  private fromTheNotes() {
    const derived = this.derived;
    return html`
      <section>
        <div class="band"><span>Read from the notes</span><small>correct how a value shows, not the value</small></div>
        <div>
          ${derived.map(t => {
            const key = `${t.dimension}:${t.value}`; const aliased = t.shown !== t.value;
            if (this.editing === key) return html`<div class="row" style="align-items: start;">
              <span class="dim" style="padding-top: 8px;">${dimensionLabel(t.dimension).toLowerCase()}</span>
              <div class="editor">
                ${aliased ? html`<span class="raw">${t.value}</span>` : nothing}
                <form @submit=${(e: Event) => { e.preventDefault(); void this.alias(t, this.draft.trim() || null); }}>
                  <span class="hint">Show as</span>
                  <input aria-label="Shown as" .value=${this.draft} @input=${(e: Event) => (this.draft = (e.target as HTMLInputElement).value)} ?readonly=${this.readOnly} ?disabled=${this.busy} />
                </form>
                <span class="muted">Changes how this ${dimensionLabel(t.dimension).toLowerCase()} reads everywhere in your library. The file is not touched.</span>
                <div class="actions">
                  <button ?disabled=${this.locked} @click=${() => this.alias(t, this.draft.trim() || null)}>Save</button>
                  ${aliased ? html`<button ?disabled=${this.locked} @click=${() => this.alias(t, null)}>Remove</button>` : nothing}
                  <button class="plain" @click=${() => (this.editing = null)}>Cancel</button>
                </div>
              </div><span></span></div>`;
            return html`<div class="row">
              <span class="dim">${dimensionLabel(t.dimension).toLowerCase()}</span>
              <span>${chipText(t.dimension, t.shown)}${aliased ? html` <span class="raw">${t.value}</span>` : nothing}</span>
              ${this.readOnly ? nothing : html`<button class="plain" aria-label=${`Correct how ${t.dimension} shows`} @click=${() => { this.editing = key; this.draft = t.shown; }}>${pencil}</button>`}
            </div>`;
          })}
          ${!derived.length ? html`<p>Nothing beyond the header was read from this file.</p>` : nothing}
        </div>
        ${derived.some(t => t.source_ref === 'library-title') ? html`<span class="muted">The library title was supplied when this version was made current; the score has no title.</span>` : nothing}
        ${derived.some(t => t.source_ref && !['sidecar', 'library-title'].includes(t.source_ref))
          ? html`<span class="muted">Read by ${[...new Set(derived.map(t => t.source_ref).filter(r => r && !['sidecar', 'library-title'].includes(r)))].join(', ')}.</span>`
          : nothing}
      </section>`;
  }

  /** §3 — dimensions nobody reads from the music: yours to assert. */
  private yourOwn() {
    const asserted = this.asserted;
    return html`
      <section>
        <div class="band"><span>Your own</span><small>yours alone, and library-wide</small></div>
        <form @submit=${this.onSubmit}>
          ${plus}
          <input aria-label="Add a value" placeholder="genre: folk" list="own-suggest" maxlength="512" .value=${this.query} @input=${this.onInput} ?readonly=${this.readOnly} ?disabled=${this.busy} />
          <datalist id="own-suggest">${this.suggestions.map(f => html`<option value=${`${f.dimension}:${f.value}`}>${f.pieces} piece${f.pieces === 1 ? '' : 's'}</option>`)}</datalist>
          <span class="hint">↵ to add</span>
        </form>
        <div class="chips">
          ${asserted.map(t => html`<span class="chip"><span class="dim">${dimensionLabel(t.dimension).toLowerCase()}</span><span>${chipText(t.dimension, t.shown)}</span>
            <button class="plain" aria-label=${`Remove ${t.dimension}: ${t.value}`} ?disabled=${this.locked} @click=${() => this.change({ remove: [{ dimension: t.dimension, value: t.value }] })}>${cross}</button></span>`)}
          ${!asserted.length ? html`<span class="muted">Nothing yet.</span>` : nothing}
        </div>
        ${this.quick.length && !this.readOnly ? html`<div class="chips"><span class="muted">Quick add</span>
          ${this.quick.map(f => html`<button class="quick" ?disabled=${this.locked} @click=${() => this.change({ add: [{ dimension: f.dimension, value: f.value }] })}>+ ${dimensionLabel(f.dimension).toLowerCase()}: ${f.value}</button>`)}
        </div>` : nothing}
      </section>`;
  }

  render() {
    const work = this.work ?? {};
    return html`
      <header>
        <b>Edit piece</b>
        <button type="button" ?disabled=${!this.canUndo || this.readOnly} @click=${() => this.emit('undo')}>Undo</button>
        <button type="button" ?disabled=${!this.canRedo || this.readOnly} @click=${() => this.emit('redo')}>Redo</button>
        <button class="plain" type="button" aria-label="Close" @click=${() => this.emit('close')}>${cross}</button>
      </header>
      ${this.readOnly ? html`<section><p role="status">${this.readOnlyReason || 'This piece is open for editing in another tab. Close that tab and reload to edit it here.'}</p></section>` : nothing}
      ${this.error ? html`<section><p class="error" role="alert">${this.error}</p></section>` : nothing}
      ${this.fromTheMusic()}
      ${this.snapshot ? html`<div class="rule"></div>${this.fromTheNotes()}<div class="rule"></div>${this.yourOwn()}` : nothing}
      <section>
        <p>The header belongs to the score and is saved with it. The library reads its own title, artist and the rest from it at each save.</p>
        ${this.canDelete && !this.readOnly ? html`<div class="danger">
          ${this.confirming
            ? html`<p role="alert">Delete “${work.title ?? 'this piece'}”? It leaves your library. Nothing is destroyed — its score, versions and recordings are kept, and you can restore it from <em>Deleted pieces</em>.</p>
                <div class="actions"><button class="delete" type="button" @click=${() => this.emit('piece-delete')}>Delete the piece</button><button type="button" @click=${() => (this.confirming = false)}>Keep it</button></div>`
            : html`<div class="actions"><button type="button" @click=${() => (this.confirming = true)}>Delete this piece…</button></div>`}
        </div>` : nothing}
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'mnx-studio-edit-piece': EditPieceSheet }
}
