// The Save sheet: what the chip summarises, in full. Nobody is asked to save —
// checkpoints happen on their own — so this is where the owner goes to see what
// a save COST (the round trip through Guitar Pro is measured every time), to
// name a version, to settle a conflict with another device, and to read what
// the converter said when the piece was opened. It owns nothing.
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { SaveState } from '../../../src/storage/saveSession.ts';
import { saveChip, savedAge, unkept } from '../../../src/storage/saveChip.ts';
import type { StorageLoss } from '../../../src/importers/storageCheck.ts';

const cross = html`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>`;

@customElement('mnx-studio-save')
export class SaveSheet extends LitElement {
  @property({ attribute: false }) save: SaveState | null = null;
  /** The last checkpoint's losses in full; the state carries only their shapes. */
  @property({ attribute: false }) losses: readonly StorageLoss[] = [];
  /** What the importer said when this piece was opened. Shown, never stored. */
  @property({ attribute: false }) conversionNotes: readonly string[] = [];
  @property({ type: Number }) now = Date.now();
  @property({ type: Boolean }) readOnly = false;
  @state() private naming = '';

  static styles = css`
    :host { box-sizing: border-box; display: flex; flex-direction: column; width: 380px; max-width: 100%; height: 100%; border-left: 1px solid var(--line); background: light-dark(oklch(0.975 0.003 60), oklch(0.2 0.004 60)); overflow-y: auto; }
    header { display: flex; align-items: center; gap: 10px; padding: 14px 18px 10px; }
    header b { font-weight: 600; font-size: 15px; flex: 1; }
    button { font: inherit; color: inherit; background: transparent; border: 1px solid var(--line); border-radius: 3px; cursor: pointer; padding: 6px 12px; font-size: 13px; }
    button.plain { border: 0; padding: 4px; color: var(--ink-dim); display: inline-flex; }
    button:disabled { opacity: 0.4; cursor: default; }
    button:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    section { padding: 4px 18px 16px; display: grid; gap: 10px; }
    .label { color: var(--ink-dim); font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .status { font-size: 15px; font-weight: 500; }
    .status.warn { color: light-dark(#a12121, #ffb4ab); }
    p { margin: 0; color: var(--ink-dim); font-size: 13px; line-height: 1.5; }
    .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    input { flex: 1; min-width: 0; font: inherit; color: var(--ink); background: transparent; border: 1px solid var(--line); border-radius: 3px; padding: 6px 9px; }
    ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; font-size: 13px; }
    li { padding: 8px 10px; background: light-dark(#efeeeb, #343330); line-height: 1.45; overflow-wrap: anywhere; }
    li code { font: 500 12px/1.4 ui-monospace, 'SF Mono', Menlo, monospace; }
    li .was { display: block; color: var(--ink-dim); font-size: 12px; }
  `;

  private emit(type: string, detail?: unknown) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  render() {
    const save = this.save;
    if (!save) return nothing;
    const chip = saveChip(save, this.now);
    const lost = unkept(save);
    const busy = save.status === 'saving';
    return html`
      <header><b>Saving</b><button class="plain" type="button" aria-label="Close saving" @click=${() => this.emit('close')}>${cross}</button></header>
      <section>
        <div class=${chip.tone === 'warn' ? 'status warn' : 'status'} role="status">${chip.text}</div>
        ${save.error && save.status !== 'conflict' ? html`<p>${save.error}</p>` : nothing}
        ${this.readOnly
          ? html`<p>This piece is open for editing in another tab, so this one only reads it.</p>`
          : save.status === 'conflict'
            ? html`<p>This piece was saved from another device while you were editing here, so your ${save.edits === 1 ? 'edit has' : 'edits have'} not been saved over it. Keep yours as a new piece, or open what was saved and let yours go.</p>
                <div class="row">
                  <button type="button" @click=${() => this.emit('save-copy')}>Keep mine as a copy</button>
                  <button type="button" @click=${() => this.emit('discard-mine')}>Open the saved one</button>
                </div>`
            : html`<p>Your edits are saved for you — after a pause, every few minutes while you work, and when you leave. ${save.savedAt !== null ? `Last saved ${savedAge(save.savedAt, this.now)}.` : ''}
                ${save.status === 'dirty' || save.status === 'failed' ? 'Until then they are kept on this device.' : ''}</p>
                ${save.recovered !== null ? html`<p><strong>These edits were recovered from this device</strong> — they had not been saved when the piece was last closed.</p>` : nothing}
                <div class="row">
                  <button type="button" ?disabled=${busy || save.status === 'clean'} @click=${() => this.emit('save-now')}>Save now</button>
                  ${save.recovered !== null ? html`<button type="button" ?disabled=${busy} @click=${() => this.emit('discard-mine')}>Discard them</button>` : nothing}
                </div>`}
      </section>
      ${!this.readOnly && save.status !== 'conflict' ? html`<section>
        <div class="label">Save a version</div>
        <p>Every save is kept. A name makes this one easy to find again.</p>
        <form class="row" @submit=${(e: Event) => { e.preventDefault(); const name = this.naming.trim(); if (!name) return; this.emit('save-version', { name }); this.naming = ''; }}>
          <input aria-label="Version name" maxlength="120" placeholder="Before the bridge" .value=${this.naming} @input=${(e: Event) => (this.naming = (e.target as HTMLInputElement).value)} />
          <button ?disabled=${busy || !this.naming.trim()}>Save version</button>
        </form>
      </section>` : nothing}
      ${lost ? html`<section>
        <div class="label">Won’t persist · ${lost}</div>
        <p>The score is stored as Guitar Pro. These were in what you saved and not in what came back; they stay on screen until you close the piece.</p>
        <ul>${this.losses.map(l => html`<li><code>${l.path}</code> ${l.kind}<span class="was">${l.was}</span></li>`)}</ul>
        ${save.check?.warnings.length ? html`<div class="label">What the writer said</div><ul>${save.check.warnings.map(w => html`<li>${w}</li>`)}</ul>` : nothing}
      </section>` : nothing}
      ${this.conversionNotes.length ? html`<section>
        <div class="label">Conversion notes · ${this.conversionNotes.length}</div>
        <p>What the reader said when it opened the stored file.</p>
        <ul>${this.conversionNotes.map(note => html`<li>${note}</li>`)}</ul>
      </section>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'mnx-studio-save': SaveSheet }
}
