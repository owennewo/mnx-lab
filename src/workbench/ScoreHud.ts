// The score HUD — roadmap/inprogress/core-score-hud.md.
//
// A vertical readout of the containment chain at the cursor: one row per
// level (rows are the ADDRESS, the highlight is the RUNG), plus the ensemble
// table on the part row — every part's name, strings and capo, which is
// where the per-part instrument override lives.
//
// The component is deliberately dumb: it renders row DATA and emits generic
// events; mapping session state to rows (hudRows.ts) and row keys back to
// selection levels (the page) happens outside. That is the promotion
// posture — `elements/` never imports `edit/`, so a HUD that one day moves
// there must already speak a neutral contract. Incubating in workbench/,
// where churn is free (core-editor-element-promotion.md's gate applies to
// the selection half; the ensemble half is viewer-tier).
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { designTokens, scrollbars } from '../elements/tokens.ts';

/** One containment level at the cursor. Rows carry no editor types — `key`
 *  is an opaque handle the host maps to a selection level. */
export interface HudRow {
  key: string;
  label: string;
  value: string;
  /** The selection ladder's current rung sits on this row. */
  active?: boolean;
  /** Clicking asks the host to move the selection to this level. */
  activatable?: boolean;
}

/** One cheatsheet line — keys and what they do at the CURRENT level. The
 *  shapes mirror keymapDocs' CheatRow/CheatGroup structurally, restated here
 *  so the component keeps its neutral contract (no `edit/` imports). */
export interface HudCheatRow {
  keys: string;
  meaning: string;
}

export interface HudCheatGroup {
  label: string;
  rows: HudCheatRow[];
}

/** One line of the ensemble table (the part row's value). */
export interface HudPart {
  index: number;
  name: string;
  /** The document's own declaration, display-formatted; null = none. */
  declared: string | null;
  /** Override state: a tuning preset name, or 'document' = no override. */
  instrument: string;
  capo: number | null;
  /** The editor cursor's part (only marked on multi-part scores). */
  cursor?: boolean;
}

@customElement('mnx-score-hud')
export class ScoreHud extends LitElement {
  @property({ attribute: false }) rows: HudRow[] = [];
  @property({ attribute: false }) parts: HudPart[] = [];
  @property({ attribute: false }) presets: string[] = [];
  @property({ attribute: false }) cheats: HudCheatGroup[] = [];

  static styles = [
    designTokens,
    scrollbars,
    css`
      /* The host (the panel) owns width and scrolling; this component only
       * paints rows. */
      :host {
        display: block;
        font-family: var(--mono);
        font-size: 11px;
        color: var(--ink-2);
      }

      .cap {
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-3);
        padding: 12px 14px 6px;
      }

      .row {
        display: grid;
        grid-template-columns: 58px 1fr;
        gap: 8px;
        align-items: baseline;
        padding: 6px 14px 6px 11px;
        border-left: 3px solid transparent;
      }

      .row.active {
        border-left-color: var(--accent);
        background: color-mix(in oklab, var(--accent) 7%, transparent);
        color: var(--ink);
      }

      .row.activatable {
        cursor: pointer;
      }

      .row.activatable:hover:not(.active) {
        border-left-color: var(--line-strong);
        color: var(--ink);
      }

      .row .label {
        color: var(--ink-3);
        font-size: 10px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      .row.active .label {
        color: var(--accent);
      }

      .row .value {
        overflow-wrap: anywhere;
      }

      /* The ensemble table — the part row's value. Controls are the per-part
         instrument override: presentation, the document is untouched. */
      .parts {
        display: flex;
        flex-direction: column;
        gap: 7px;
      }

      .part {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .part .part-head {
        display: flex;
        align-items: baseline;
        gap: 6px;
      }

      .part .part-name {
        color: var(--ink);
      }

      .part.cursor .part-name::after {
        content: ' ◂ cursor';
        color: var(--ink-3);
        font-size: 9.5px;
      }

      .part .controls {
        display: flex;
        gap: 5px;
        align-items: center;
      }

      .part select,
      .part input {
        font: inherit;
        font-size: 10.5px;
        color: var(--ink-2);
        background: var(--bg);
        border: 1px solid var(--line-strong);
        border-radius: 5px;
        padding: 1px 5px;
        min-width: 0;
      }

      .part select {
        flex: 1;
      }

      .part input.capo {
        width: 48px;
      }

      .part .declared {
        font-size: 10px;
        color: var(--ink-3);
      }

      .part .declared.override {
        color: var(--accent);
      }

      /* The cheatsheet: the verbs at the current rung, under the noun rows. */
      .cheats {
        margin-top: 10px;
        border-top: 1px solid var(--line);
        padding: 2px 0 12px;
      }

      .cheat-group {
        font-size: 10px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--ink-3);
        padding: 10px 14px 3px;
      }

      .cheat {
        display: grid;
        grid-template-columns: 86px 1fr;
        gap: 8px;
        align-items: baseline;
        padding: 2px 14px;
      }

      .cheat .cheat-keys {
        color: var(--ink);
        font-size: 10.5px;
        white-space: nowrap;
      }

      .cheat .cheat-meaning {
        font-size: 10.5px;
        color: var(--ink-2);
      }
    `
  ];

  private activate(row: HudRow) {
    if (!row.activatable) return;
    this.dispatchEvent(
      new CustomEvent('hud-row-activated', {
        detail: { key: row.key },
        bubbles: true,
        composed: true
      })
    );
  }

  private emitSetup(part: HudPart, patch: Partial<Pick<HudPart, 'instrument' | 'capo'>>) {
    this.dispatchEvent(
      new CustomEvent('hud-part-setup-changed', {
        detail: { index: part.index, instrument: part.instrument, capo: part.capo, ...patch },
        bubbles: true,
        composed: true
      })
    );
  }

  private partLine(part: HudPart) {
    const overridden = part.instrument !== 'document' || part.capo !== null;
    return html`
      <div class="part ${part.cursor ? 'cursor' : ''}">
        <div class="part-head"><span class="part-name">${part.name}</span></div>
        <div class="controls">
          <select
            title="view this part on an instrument — a rendering override, the document is untouched"
            .value=${part.instrument}
            @change=${(e: Event) =>
              this.emitSetup(part, { instrument: (e.target as HTMLSelectElement).value })}
          >
            <option value="document">document</option>
            ${this.presets.map(
              n => html`<option value=${n} ?selected=${part.instrument === n}>${n}</option>`
            )}
          </select>
          <input
            class="capo"
            type="number"
            min="0"
            max="24"
            placeholder="capo"
            .value=${part.capo === null ? '' : String(part.capo)}
            @change=${(e: Event) => {
              const raw = (e.target as HTMLInputElement).value.trim();
              const n = raw === '' ? NaN : Number(raw);
              this.emitSetup(part, { capo: Number.isInteger(n) && n >= 0 && n <= 24 ? n : null });
            }}
          />
        </div>
        ${overridden
          ? html`<span class="declared override">override — document untouched</span>`
          : html`<span class="declared"
              >${part.declared ?? 'no strings declared — no fingerboard'}</span
            >`}
      </div>
    `;
  }

  render() {
    if (this.rows.length === 0) return nothing;
    return html`
      <div class="cap" title="the containment chain at the cursor — the highlighted row is the selection level (Esc widens, Enter narrows, click selects)">
        selection
      </div>
      ${this.rows.map(
        row => html`
          <div
            class="row ${row.active ? 'active' : ''} ${row.activatable ? 'activatable' : ''}"
            title=${row.activatable ? 'click to select this level' : nothing}
            @click=${() => this.activate(row)}
          >
            <span class="label">${row.label}</span>
            ${row.key === 'part' && this.parts.length > 0
              ? html`<div class="parts" @click=${(e: Event) => e.stopPropagation()}>
                  ${this.parts.map(p => this.partLine(p))}
                </div>`
              : html`<span class="value">${row.value}</span>`}
          </div>
        `
      )}
      ${this.cheats.length > 0
        ? html`
            <div class="cheats">
              <div
                class="cap"
                title="what the keyboard does at the CURRENT selection level — the list changes as you widen and narrow"
              >
                keys · at this level
              </div>
              ${this.cheats.map(
                group => html`
                  <div class="cheat-group">${group.label}</div>
                  ${group.rows.map(
                    row => html`
                      <div class="cheat">
                        <span class="cheat-keys">${row.keys}</span>
                        <span class="cheat-meaning">${row.meaning}</span>
                      </div>
                    `
                  )}
                `
              )}
            </div>
          `
        : nothing}
    `;
  }
}
