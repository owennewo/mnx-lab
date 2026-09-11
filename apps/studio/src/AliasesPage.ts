// #/aliases — every alias in the library: what it corrects, how it shows, how
// many pieces it touches; edit, delete, add.
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LibraryClient, type LibraryAlias } from '../../../src/storage/libraryClient.ts';
import { dimensionLabel } from './labels.ts';

const DERIVED = ['artist', 'title', 'tuning-name', 'tuning', 'capo', 'subtitle', 'album', 'copyright'];
const pencil = html`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10-10-4-4L4 16v4z"></path><path d="M13 7l4 4"></path></svg>`;
const cross = html`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>`;

@customElement('mnx-studio-aliases')
export class AliasesPage extends LitElement {
  @property({ attribute: false }) client!: LibraryClient;
  @state() private aliases: LibraryAlias[] = [];
  @state() private editing: string | null = null;
  @state() private draft = '';
  @state() private adding = { dimension: 'artist', raw: '', canonical: '' };
  @state() private busy = false;
  @state() private error = '';

  static styles = css`
    :host { display: block; max-width: 56rem; margin: 0 auto; padding: 64px 24px 48px; }
    h1 { font-size: 1.4rem; font-weight: 600; margin: 0; }
    .head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px; }
    .muted { color: var(--ink-dim); }
    .grid { display: grid; grid-template-columns: 110px 1fr 1fr 70px 56px; gap: 16px; align-items: center; padding: 10px 4px; border-bottom: 1px solid var(--line); }
    .grid.th { color: var(--ink-dim); font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; border-top: 1px solid var(--line); }
    input, select { font: inherit; color: inherit; background: transparent; border: 1px solid var(--line); border-radius: 3px; padding: 5px 8px; min-width: 0; }
    button { font: inherit; color: inherit; background: transparent; border: 1px solid var(--line); border-radius: 3px; padding: 4px 9px; cursor: pointer; }
    button.plain { border: 0; padding: 4px; color: var(--ink-dim); display: inline-flex; }
    button:disabled { opacity: 0.5; cursor: default; }
    .actions { display: flex; gap: 4px; }
    .add { border: 1px dashed var(--line); border-radius: 3px; padding: 10px 12px; margin-top: 12px; display: grid; grid-template-columns: 110px 1fr 1fr auto; gap: 10px; align-items: center; }
    .error { color: #b91c1c; }
    p.note { color: var(--ink-dim); font-size: 12px; }
    @media (max-width: 720px) { .grid, .add { grid-template-columns: 1fr; } }
  `;

  connectedCallback() { super.connectedCallback(); void this.load(); }

  private async load() {
    this.busy = true; this.error = '';
    try { this.aliases = (await this.client.aliases()).aliases; }
    catch (error) { this.error = error instanceof Error ? error.message : 'The library is unavailable.'; }
    finally { this.busy = false; }
  }
  private async save(dimension: string, raw: string, canonical: string) {
    if (!raw.trim() || !canonical.trim()) { this.error = 'Both values are needed.'; return; }
    this.busy = true; this.error = '';
    try { this.aliases = (await this.client.setAlias(dimension, raw.trim(), canonical.trim())).aliases; this.editing = null; this.adding = { dimension: 'artist', raw: '', canonical: '' }; }
    catch (error) { this.error = error instanceof Error ? error.message : 'Could not save the alias.'; }
    finally { this.busy = false; }
  }
  private async removeAlias(a: LibraryAlias) {
    this.busy = true; this.error = '';
    try { this.aliases = (await this.client.deleteAlias(a.dimension, a.raw_value)).aliases; }
    catch (error) { this.error = error instanceof Error ? error.message : 'Could not remove the alias.'; }
    finally { this.busy = false; }
  }

  render() {
    return html`
      <div class="head"><h1>Tag aliases</h1><span class="muted">how a value read from the music is shown, everywhere it appears</span></div>
      ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
      <div class="grid th"><span>Dimension</span><span>Read from the file</span><span>Shown as</span><span>Pieces</span><span></span></div>
      ${this.aliases.map(a => { const key = `${a.dimension}:${a.raw_value}`;
        return html`<div class="grid">
          <span class="muted">${dimensionLabel(a.dimension).toLowerCase()}</span>
          <span class="muted">${a.raw_value}</span>
          ${this.editing === key
            ? html`<form style="display: contents" @submit=${(e: Event) => { e.preventDefault(); void this.save(a.dimension, a.raw_value, this.draft); }}><input aria-label="Shown as" .value=${this.draft} @input=${(e: Event) => (this.draft = (e.target as HTMLInputElement).value)} /></form>`
            : html`<span>${a.canonical_value}</span>`}
          <span class="muted">${a.pieces}</span>
          <span class="actions">
            ${this.editing === key
              ? html`<button ?disabled=${this.busy} @click=${() => this.save(a.dimension, a.raw_value, this.draft)}>Save</button>`
              : html`<button class="plain" aria-label="Edit alias" @click=${() => { this.editing = key; this.draft = a.canonical_value; }}>${pencil}</button>
                     <button class="plain" aria-label="Remove alias" ?disabled=${this.busy} @click=${() => this.removeAlias(a)}>${cross}</button>`}
          </span>
        </div>`; })}
      ${!this.busy && !this.aliases.length ? html`<p class="muted">No aliases yet. Correct a value from a piece's Tags sheet, or add one here.</p>` : nothing}
      <form class="add" @submit=${(e: Event) => { e.preventDefault(); void this.save(this.adding.dimension, this.adding.raw, this.adding.canonical); }}>
        <select aria-label="Dimension" .value=${this.adding.dimension} @change=${(e: Event) => (this.adding = { ...this.adding, dimension: (e.target as HTMLSelectElement).value })}>
          ${DERIVED.map(d => html`<option value=${d} ?selected=${d === this.adding.dimension}>${dimensionLabel(d).toLowerCase()}</option>`)}
        </select>
        <input aria-label="Read from the file" placeholder="as read from the file" .value=${this.adding.raw} @input=${(e: Event) => (this.adding = { ...this.adding, raw: (e.target as HTMLInputElement).value })} />
        <input aria-label="Shown as" placeholder="shown as" .value=${this.adding.canonical} @input=${(e: Event) => (this.adding = { ...this.adding, canonical: (e.target as HTMLInputElement).value })} />
        <button ?disabled=${this.busy}>Add alias</button>
      </form>
      <p class="note">Aliases never change what is stored. Re-reading a file after a converter fix keeps your corrections.</p>
    `;
  }
}
