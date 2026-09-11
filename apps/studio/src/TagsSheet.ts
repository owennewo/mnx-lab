// The Tags sheet on a piece: one input to add, your own tags above with removes,
// the tags read from the music below — read-only, where the pencil on a value
// creates an alias that applies library-wide (roadmap: studio-library-navigation).
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LibraryClient, LibraryRequestError, type LibraryFacet, type ShownTag } from '../../../src/storage/libraryClient.ts';
import { RAIL_HIDDEN, chipText, dimensionLabel, parseTag } from './labels.ts';

export interface TagsSnapshot { piece: { id: string; revision: number }; tags: ShownTag[] }
const cross = html`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>`;
const pencil = html`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10-10-4-4L4 16v4z"></path><path d="M13 7l4 4"></path></svg>`;

@customElement('mnx-studio-tags')
export class TagsSheet extends LitElement {
  @property({ attribute: false }) client!: LibraryClient;
  @property({ attribute: false }) snapshot: TagsSnapshot | null = null;
  @state() private query = '';
  @state() private suggestions: LibraryFacet[] = [];
  @state() private quick: LibraryFacet[] = [];
  @state() private editing: string | null = null;
  @state() private draft = '';
  @state() private busy = false;
  @state() private error = '';

  static styles = css`
    :host { display: flex; flex-direction: column; width: 380px; max-width: 100%; height: 100%; border-left: 1px solid var(--line); background: light-dark(oklch(0.975 0.003 60), oklch(0.205 0.004 60)); overflow: auto; }
    header { display: flex; align-items: center; gap: 10px; padding: 14px 18px 10px; }
    header b { font-weight: 600; font-size: 15px; flex: 1; }
    button { font: inherit; color: inherit; background: transparent; border: 1px solid var(--line); border-radius: 3px; padding: 4px 9px; cursor: pointer; }
    button.plain { border: 0; padding: 4px; color: var(--ink-dim); display: inline-flex; }
    button:disabled { opacity: 0.5; cursor: default; }
    section { padding: 4px 18px 14px; display: flex; flex-direction: column; gap: 8px; }
    .label { display: flex; align-items: baseline; gap: 8px; color: var(--ink-dim); font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .label small { font-weight: 400; text-transform: none; letter-spacing: 0; }
    form { display: flex; align-items: center; gap: 8px; border: 1px solid var(--line); border-radius: 3px; padding: 0 10px; }
    form:focus-within { border-color: var(--accent); }
    input { flex: 1; min-width: 0; font: inherit; color: inherit; background: transparent; border: 0; padding: 7px 0; outline: none; }
    .hint { color: var(--ink-dim); font-size: 12px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 6px 4px 10px; border: 1px solid var(--line); border-radius: 3px; font-size: 13px; }
    .chip .dim { color: var(--ink-dim); }
    .quick { border-style: dashed; color: var(--ink-dim); font-size: 12px; padding: 2px 8px; }
    .rule { height: 1px; background: var(--line); margin: 0 18px; }
    .row { display: grid; grid-template-columns: 76px 1fr 24px; gap: 10px; align-items: center; padding: 7px 0; border-bottom: 1px solid light-dark(oklch(0.9 0.003 60), oklch(0.27 0.004 60)); }
    .row .dim { color: var(--ink-dim); font-size: 13px; }
    .row .raw { color: var(--ink-dim); font-size: 12px; text-decoration: line-through; }
    .editor { display: flex; flex-direction: column; gap: 6px; padding: 6px 0; }
    .editor form { background: light-dark(white, oklch(0.185 0.004 60)); }
    .actions { display: flex; gap: 6px; align-items: center; }
    .error { color: #b91c1c; font-size: 13px; }
    .muted { color: var(--ink-dim); font-size: 12px; }
  `;

  protected updated(changed: Map<PropertyKey, unknown>) {
    if (changed.has('snapshot') && this.snapshot) void this.loadQuick();
  }

  private get asserted() { return (this.snapshot?.tags ?? []).filter(t => t.origin === 'asserted'); }
  private get derived() { return (this.snapshot?.tags ?? []).filter(t => t.origin === 'derived' && t.dimension !== 'tuning'); }

  /** Quick-add: values used across the library in dimensions a person asserts, not yet on this piece. */
  private async loadQuick() {
    try {
      const { tags } = await this.client.tags('');
      const derived = new Set(this.derived.map(t => t.dimension)); const mine = new Set(this.asserted.map(t => `${t.dimension}:${t.value}`));
      this.quick = tags.filter(t => !derived.has(t.dimension) && !RAIL_HIDDEN.has(t.dimension) && t.dimension !== 'favourite' && !mine.has(`${t.dimension}:${t.value}`))
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
      this.dispatchEvent(new CustomEvent<TagsSnapshot>('tags-changed', { detail: snapshot, bubbles: true, composed: true }));
    } catch (error) {
      this.error = error instanceof LibraryRequestError && error.status === 409 ? 'This piece changed elsewhere — reload to edit its tags.'
        : error instanceof LibraryRequestError && error.status === 400 ? 'That dimension is read from the music; correct it with an alias instead.'
        : error instanceof Error ? error.message : 'Could not change the tags.';
    } finally { this.busy = false; }
  }
  private onSubmit(event: Event) {
    event.preventDefault();
    const tag = parseTag(this.query);
    if (!tag) { this.error = 'A tag is dimension: value — genre: folk, status: learning.'; return; }
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
    } catch (error) { this.error = error instanceof Error ? error.message : 'Could not save the alias.'; }
    finally { this.busy = false; }
  }

  render() {
    if (!this.snapshot) return html`<header><b>Tags</b></header><section><p class="muted">Loading…</p></section>`;
    const asserted = this.asserted; const derived = this.derived;
    return html`
      <header><b>Tags</b><button class="plain" aria-label="Close tags" @click=${() => this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }))}>${cross}</button></header>
      <section>
        <form @submit=${this.onSubmit}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="color: var(--ink-dim)"><path d="M12 5v14M5 12h14"></path></svg>
          <input aria-label="Add a tag" placeholder="Add a tag — genre: folk" list="tag-suggest" maxlength="512" .value=${this.query} @input=${this.onInput} ?disabled=${this.busy} />
          <datalist id="tag-suggest">${this.suggestions.map(f => html`<option value=${`${f.dimension}:${f.value}`}>${f.pieces} piece${f.pieces === 1 ? '' : 's'}</option>`)}</datalist>
          <span class="hint">↵ to add</span>
        </form>
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
        <div class="label">Yours</div>
        <div class="chips">
          ${asserted.map(t => html`<span class="chip"><span class="dim">${dimensionLabel(t.dimension).toLowerCase()}</span><span>${chipText(t.dimension, t.shown)}</span>
            <button class="plain" aria-label=${`Remove ${t.dimension}: ${t.value}`} ?disabled=${this.busy} @click=${() => this.change({ remove: [{ dimension: t.dimension, value: t.value }] })}>${cross}</button></span>`)}
          ${!asserted.length ? html`<span class="muted">Nothing yet.</span>` : nothing}
        </div>
        ${this.quick.length ? html`<div class="chips"><span class="muted">Quick add</span>
          ${this.quick.map(f => html`<button class="quick" ?disabled=${this.busy} @click=${() => this.change({ add: [{ dimension: f.dimension, value: f.value }] })}>+ ${dimensionLabel(f.dimension).toLowerCase()}: ${f.value}</button>`)}
        </div>` : nothing}
      </section>
      <div class="rule"></div>
      <section>
        <div class="label"><span>From the music</span><small>read from the file — correct how a value shows, not the value</small></div>
        <div>
          ${derived.map(t => {
            const key = `${t.dimension}:${t.value}`; const aliased = t.shown !== t.value;
            if (this.editing === key) return html`<div class="row" style="align-items: start;">
              <span class="dim" style="padding-top: 8px;">${dimensionLabel(t.dimension).toLowerCase()}</span>
              <div class="editor">
                ${aliased ? html`<span class="raw">${t.value}</span>` : nothing}
                <form @submit=${(e: Event) => { e.preventDefault(); void this.alias(t, this.draft.trim() || null); }}>
                  <span class="muted" style="white-space: nowrap;">Show as</span>
                  <input aria-label="Shown as" .value=${this.draft} @input=${(e: Event) => (this.draft = (e.target as HTMLInputElement).value)} ?disabled=${this.busy} />
                </form>
                <span class="muted">An alias: applies wherever this ${dimensionLabel(t.dimension).toLowerCase()} appears.</span>
                <div class="actions">
                  <button ?disabled=${this.busy} @click=${() => this.alias(t, this.draft.trim() || null)}>Save alias</button>
                  ${aliased ? html`<button ?disabled=${this.busy} @click=${() => this.alias(t, null)}>Remove alias</button>` : nothing}
                  <button class="plain" @click=${() => (this.editing = null)}>Cancel</button>
                </div>
              </div><span></span></div>`;
            return html`<div class="row">
              <span class="dim">${dimensionLabel(t.dimension).toLowerCase()}</span>
              <span>${chipText(t.dimension, t.shown)}${aliased ? html` <span class="raw">${t.value}</span>` : nothing}</span>
              <button class="plain" aria-label=${`Correct how ${t.dimension} shows`} @click=${() => { this.editing = key; this.draft = t.shown; }}>${pencil}</button>
            </div>`;
          })}
          ${!derived.length ? html`<p class="muted">Nothing was read from this file.</p>` : nothing}
        </div>
        ${derived.some(t => t.source_ref && t.source_ref !== 'sidecar') ? html`<span class="muted">Read by ${[...new Set(derived.map(t => t.source_ref).filter(r => r && r !== 'sidecar'))].join(', ')}.</span>` : nothing}
      </section>
    `;
  }
}
