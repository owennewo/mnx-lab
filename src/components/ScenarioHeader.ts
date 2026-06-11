import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ScenarioEntry } from '../library/corpus.ts';
import { isPlumbingDef } from '../library/plumbingDefs.ts';
import { sharedChrome } from '../styles/tokens.ts';

const LIFECYCLE = ['draft', 'valid', 'rendered', 'verified'] as const;

/** notes.md is rendered as plain prose: headings dropped, md markers stripped. */
function notesToParagraphs(md: string): string[] {
  return md
    .split(/\n\s*\n/)
    .map(block =>
      block
        .split('\n')
        .filter(l => !/^#{1,6}\s/.test(l))
        .join(' ')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .trim()
    )
    .filter(Boolean);
}

/**
 * The scenario page header: id path, serif title, dual verdict chips,
 * lifecycle pips, source/id-refs/$defs chips, description, and links
 * (spec reference, issue, notes.md).
 */
@customElement('mnx-scenario-header')
export class ScenarioHeader extends LitElement {
  @property({ attribute: false }) entry: ScenarioEntry | null = null;
  @property({ attribute: false }) notes: string | null = null;
  @property({ type: Boolean }) isSketch = false;
  /** Embed-gallery trim: hides description, links, and notes. */
  @property({ type: Boolean }) compact = false;

  @state() private notesOpen = false;
  @state() private defsOpen = false;

  static styles = [
    sharedChrome,
    css`
      :host {
        display: block;
        padding: 18px 24px 0;
      }

      .scen-id-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .scen-id {
        font-family: var(--mono);
        font-size: 11px;
        color: var(--ink-3);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }

      .scen-title {
        font-family: var(--serif);
        font-size: 23px;
        font-weight: 500;
        letter-spacing: -0.01em;
        margin: 4px 0 8px;
      }

      :host([compact]) .scen-title {
        font-size: 19px;
        margin: 3px 0 6px;
      }

      .badge-row {
        display: flex;
        align-items: center;
        gap: 7px;
        flex-wrap: wrap;
      }

      .lifecycle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
      }

      .lifecycle .steps {
        display: inline-flex;
        gap: 2.5px;
      }

      .lifecycle .steps i {
        width: 8px;
        height: 4px;
        border-radius: 1.5px;
        background: var(--line-strong);
      }

      .lifecycle .steps i.f {
        background: var(--st-rendered);
      }

      .lifecycle .steps i.f.v {
        background: var(--st-verified);
      }

      .lifecycle .lc-t {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-2);
      }

      .defs-row {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        align-items: center;
        margin-top: 10px;
        max-width: 86ch;
      }

      .dchip {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-3);
        border: 1px dashed var(--line-strong);
        border-radius: 4px;
        padding: 2px 7px;
        white-space: nowrap;
      }

      .dchip.live {
        color: var(--accent-fg);
        border: 1px solid color-mix(in oklab, var(--accent-fg), transparent 55%);
        cursor: pointer;
      }

      .dchip.live:hover {
        background: color-mix(in oklab, var(--accent), transparent 90%);
      }

      .defs-hint {
        font-size: 10.5px;
        color: var(--ink-3);
        font-style: italic;
        margin-left: 4px;
      }

      .scen-desc {
        color: var(--ink-2);
        font-size: 13px;
        line-height: 1.55;
        max-width: 76ch;
        margin: 10px 0 0;
        text-wrap: pretty;
      }

      .scen-links {
        display: flex;
        gap: 14px;
        margin-top: 7px;
        flex-wrap: wrap;
      }

      .scen-links a,
      .scen-links button.linky {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--accent-fg);
        white-space: nowrap;
      }

      .scen-links button.linky:hover {
        text-decoration: underline;
      }

      .vchip .linky {
        color: inherit;
        text-decoration: underline;
        margin-left: 4px;
      }

      .notes-block {
        margin: 12px 0 0;
        padding: 12px 16px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--surface);
        max-width: 86ch;
      }

      .notes-block p {
        margin: 0 0 9px;
        font-size: 12.5px;
        line-height: 1.6;
        color: var(--ink-2);
      }

      .notes-block p:last-child {
        margin-bottom: 0;
      }
    `
  ];

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has('entry')) {
      this.notesOpen = false;
      this.defsOpen = false;
    }
  }

  render() {
    const e = this.entry;
    if (!e) return nothing;
    const meta = e.meta;
    const stage = LIFECYCLE.indexOf(this.isSketch ? 'draft' : meta.status) + 1;
    const status = this.isSketch ? 'draft' : meta.status;
    const coversDefs = meta.coversDefs ?? [];

    return html`
      <div class="scen-id-row">
        <span class="scen-id">scenarios/${e.id}</span>
        ${this.isSketch
          ? html`
              <span class="vchip sketch">
                sketch — editable copy
                <button class="linky" @click=${this.emitDiscard}>discard</button>
              </span>
            `
          : nothing}
      </div>
      <h1 class="scen-title">${meta.title}${this.isSketch ? ' — sketch' : ''}</h1>
      <div class="badge-row">
        ${meta.expect.standard === 'invalid'
          ? html`
              <span class="vchip gap">
                <span class="vdot" style="background: var(--st-gap)"></span>MNX invalid · by design
              </span>
            `
          : html`
              <span class="vchip ok">
                <span class="vdot" style="background: var(--st-rendered)"></span>MNX valid
              </span>
            `}
        ${meta.expect.extension !== 'n/a'
          ? html`
              <span class="vchip ${meta.expect.extension === 'valid' ? 'ok' : 'gap'}">
                <span
                  class="vdot"
                  style="background: ${meta.expect.extension === 'valid'
                    ? 'var(--st-rendered)'
                    : 'var(--st-gap)'}"
                ></span>
                _x.tab ${meta.expect.extension}
              </span>
            `
          : nothing}
        <span
          class="lifecycle"
          title="Lifecycle: draft → valid → rendered → verified. Only “verified” is a human assertion; the rest are recomputed by check-scenarios."
        >
          <span class="steps">
            ${LIFECYCLE.map(
              (_st, i) =>
                html`<i class="${i < stage ? 'f' : ''}${status === 'verified' && i < stage ? ' v' : ''}"></i>`
            )}
          </span>
          <span class="lc-t">${status}</span>
        </span>
        <span class="vchip">${this.isSketch ? 'sketch' : meta.source}</span>
        ${meta.idRefs
          ? html`
              <span
                class="vchip"
                title="Exercises cross-referencing (note/event ids) — the scenarios most likely to break a renderer."
                >id-refs</span
              >
            `
          : nothing}
        ${coversDefs.length
          ? html`
              <button
                class="vchip clicky ${this.defsOpen ? 'on' : ''}"
                title="Schema $defs exercised by this document — the coverage axis"
                @click=${() => (this.defsOpen = !this.defsOpen)}
              >
                ${coversDefs.length} $defs ${this.defsOpen ? '▴' : '▾'}
              </button>
            `
          : nothing}
      </div>
      ${this.defsOpen
        ? html`
            <div class="defs-row">
              ${coversDefs.map(d =>
                isPlumbingDef(d)
                  ? html`
                      <span class="dchip" title="plumbing def — excluded from the coverage denominator"
                        >${d}</span
                      >
                    `
                  : html`
                      <button
                        class="dchip live"
                        title="Shelve the library by $def and jump to “${d}”"
                        @click=${() => this.emitDef(d)}
                      >
                        ${d}
                      </button>
                    `
              )}
              <span class="defs-hint"
                >accented defs are feature defs — click one to shelve the library by it</span
              >
            </div>
          `
        : nothing}
      ${this.compact
        ? nothing
        : html`
            <p class="scen-desc">${this.isSketch
              ? 'Transient editable copy — never persisted to the corpus. Saved scores and scenarios are untouched.'
              : meta.description}</p>
            <div class="scen-links">
              ${e.specRef && !this.isSketch
                ? html`<a href=${e.specRef} target="_blank" rel="noopener noreferrer">spec reference ↗</a>`
                : nothing}
              ${e.issueRef && !this.isSketch
                ? html`<a href=${e.issueRef} target="_blank" rel="noopener noreferrer">w3c-cg/mnx#63 ↗</a>`
                : nothing}
              ${this.notes && !this.isSketch
                ? html`
                    <button class="linky" @click=${() => (this.notesOpen = !this.notesOpen)}>
                      ${this.notesOpen ? 'hide notes.md' : 'notes.md →'}
                    </button>
                  `
                : nothing}
            </div>
            ${this.notesOpen && this.notes
              ? html`
                  <div class="notes-block">
                    ${notesToParagraphs(this.notes).map(p => html`<p>${p}</p>`)}
                  </div>
                `
              : nothing}
          `}
    `;
  }

  private emitDef(def: string) {
    this.dispatchEvent(
      new CustomEvent('def-facet-requested', { detail: { def }, bubbles: true, composed: true })
    );
  }

  private emitDiscard() {
    this.dispatchEvent(new CustomEvent('sketch-discarded', { bubbles: true, composed: true }));
  }
}

export default ScenarioHeader;
