// The Keys sheet: what the keyboard can do right now, on this rung, in this
// pane. Studio's editor is keyboard-only for now (roadmap:
// core-editor-element-promotion, slice 1), and a keyboard nobody can see is a
// keyboard nobody uses. The rows are the keymap's own meaning table
// (src/edit/keymapDocs.ts), filtered by the editor's mount to the keys it
// really binds — so this never advertises a surface that is not mounted yet.
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { CheatGroup } from '../../../src/edit/keymapDocs.ts';

const cross = html`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>`;

@customElement('mnx-studio-keys')
export class KeysSheet extends LitElement {
  @property({ attribute: false }) groups: readonly CheatGroup[] = [];
  /** Where the cursor stands — the rung the meanings are for. */
  @property() level = '';
  @property({ type: Boolean }) readOnly = false;

  static styles = css`
    :host { box-sizing: border-box; display: flex; flex-direction: column; width: 380px; max-width: 100%; height: 100%; border-left: 1px solid var(--line); background: light-dark(oklch(0.975 0.003 60), oklch(0.2 0.004 60)); overflow-y: auto; }
    header { display: flex; align-items: center; gap: 10px; padding: 14px 18px 10px; }
    header b { font-weight: 600; font-size: 15px; flex: 1; }
    button.plain { font: inherit; color: var(--ink-dim); background: transparent; border: 0; padding: 4px; cursor: pointer; display: inline-flex; }
    button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    section { padding: 4px 18px 14px; display: grid; gap: 6px; }
    .label { color: var(--ink-dim); font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; margin-top: 4px; }
    p { margin: 0; color: var(--ink-dim); font-size: 13px; line-height: 1.5; }
    .row { display: grid; grid-template-columns: 8.5rem 1fr; gap: 10px; align-items: baseline; font-size: 13px; padding: 3px 0; }
    kbd { font: 500 12px/1.4 ui-monospace, 'SF Mono', Menlo, monospace; color: var(--ink); }
  `;

  render() {
    return html`
      <header><b>Keys</b><button class="plain" type="button" aria-label="Close keys" @click=${() => this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }))}>${cross}</button></header>
      <section>
        <p>Click the score, then type. ${this.readOnly ? 'This piece is read-only here, so the keys only move around.' : 'Your edits are saved for you.'}
          ${this.level ? html`These are the keys for where the cursor is now: <b>${this.level}</b>.` : nothing}</p>
      </section>
      ${this.groups.map(group => html`<section>
        <div class="label">${group.label}</div>
        ${group.rows.map(row => html`<div class="row"><kbd>${row.keys}</kbd><span>${row.meaning}</span></div>`)}
      </section>`)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'mnx-studio-keys': KeysSheet }
}
