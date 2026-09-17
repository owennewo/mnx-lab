// The Details sheet on a piece: what the piece IS — the document's own
// `_x.mnxLab.work`, not the library's tags (those are read OFF this, and follow
// it at the next save). Studio's first editor, and deliberately the smallest:
// it proves the whole save pipeline on nine text fields.
//
// The fields are the ones a Guitar Pro score header can hold, because `.gp` is
// what studio stores (harness/fixtures/roundtrip-register.json: `source` and any
// creator role beyond these three do not survive a save). It owns nothing: a
// committed field leaves as a `work-change` carrying a `setWork` merge, and the
// page applies it through its history — so it can be undone, recovered and saved
// like any other edit.
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { MnxLabWork } from '../../../src/model/mnx.ts';
import type { WorkChange } from '../../../src/edit/ops.ts';

const cross = html`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>`;
const TEXT = [['title', 'Title'], ['subtitle', 'Subtitle'], ['artist', 'Artist'], ['album', 'Album']] as const;
const ROLES = [['composer', 'Music by'], ['lyricist', 'Words by'], ['transcriber', 'Transcribed by']] as const;

@customElement('mnx-studio-details')
export class DetailsSheet extends LitElement {
  @property({ attribute: false }) work: MnxLabWork | undefined;
  /** Another tab holds this piece: look, do not touch. */
  @property({ type: Boolean }) readOnly = false;
  @property({ type: Boolean }) canUndo = false;
  @property({ type: Boolean }) canRedo = false;

  static styles = css`
    :host { box-sizing: border-box; display: flex; flex-direction: column; width: 380px; max-width: 100%; height: 100%; border-left: 1px solid var(--line); background: light-dark(oklch(0.975 0.003 60), oklch(0.2 0.004 60)); overflow-y: auto; }
    header { display: flex; align-items: center; gap: 8px; padding: 14px 18px 10px; }
    header b { font-weight: 600; font-size: 15px; flex: 1; }
    button { font: inherit; color: inherit; background: transparent; border: 1px solid var(--line); border-radius: 3px; cursor: pointer; padding: 4px 10px; font-size: 13px; }
    button.plain { border: 0; padding: 4px; color: var(--ink-dim); display: inline-flex; }
    button:disabled { opacity: 0.4; cursor: default; }
    button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    section { padding: 4px 18px 18px; display: grid; gap: 12px; }
    label { display: grid; gap: 4px; color: var(--ink-dim); font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    input, textarea { font: inherit; font-size: 14px; font-weight: 400; letter-spacing: 0; text-transform: none; color: var(--ink); background: transparent; border: 1px solid var(--line); border-radius: 3px; padding: 7px 9px; min-width: 0; resize: vertical; }
    input:read-only, textarea:read-only { color: var(--ink-dim); }
    p { margin: 0; color: var(--ink-dim); font-size: 12px; line-height: 1.5; }
  `;

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

  render() {
    const work = this.work ?? {};
    const value = (event: Event) => (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    return html`
      <header>
        <b>Details</b>
        <button type="button" ?disabled=${!this.canUndo || this.readOnly} @click=${() => this.emit('undo')}>Undo</button>
        <button type="button" ?disabled=${!this.canRedo || this.readOnly} @click=${() => this.emit('redo')}>Redo</button>
        <button class="plain" type="button" aria-label="Close details" @click=${() => this.emit('close')}>${cross}</button>
      </header>
      <section>
        ${this.readOnly ? html`<p role="status">This piece is open for editing in another tab. Close that tab to edit it here.</p>` : nothing}
        ${TEXT.map(([field, label]) => html`<label>${label}
          <input maxlength="300" ?readonly=${this.readOnly} .value=${work[field] ?? ''} @change=${(e: Event) => this.commit({ [field]: value(e) }, work[field] ?? '', value(e))} /></label>`)}
        ${ROLES.map(([role, label]) => html`<label>${label}
          <input maxlength="300" ?readonly=${this.readOnly} .value=${this.named(role)} @change=${(e: Event) => this.commitRole(role, value(e))} /></label>`)}
        <label>Copyright
          <input maxlength="300" ?readonly=${this.readOnly} .value=${work.copyright ?? ''} @change=${(e: Event) => this.commit({ copyright: value(e) }, work.copyright ?? '', value(e))} /></label>
        <label>Notes
          <textarea rows="4" maxlength="4000" ?readonly=${this.readOnly} .value=${work.notes ?? ''} @change=${(e: Event) => this.commit({ notes: value(e) }, work.notes ?? '', value(e))}></textarea></label>
        <p>These belong to the score itself and are saved with it. The library's title, artist and other tags are read from them at each save.</p>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'mnx-studio-details': DetailsSheet }
}
