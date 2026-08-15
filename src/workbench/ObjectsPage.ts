// The coverage map: every schema object, and the scenarios exercising it.
//
// The header has always shown a coverage fraction, but a fraction is a
// scoreboard — it says how far along we are and nothing about what to do
// next. This is the same data as a work queue, tiered by how exposed each
// object is:
//
//   never exercised — the backlog, and the only tier whose size the coverage
//                     fraction already told you
//   one example     — covered on paper. A single example is where a renderer
//                     bug hides best, because nothing disagrees with it
//   covered         — two or more, sorted by depth
//
// Alongside every count sits how many of those scenarios a human has actually
// approved, because an object exercised by three unverified scenarios is
// exercised but not evidenced — for a test bench that is much closer to
// uncovered than the raw count suggests.
//
// #/objects/<def> both renders one object here AND filters the rail to it
// (WorkbenchApp watches the route), so "show me this object's examples" is a
// single deep-linkable URL rather than a transient UI state.
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { coverage } from '../corpus/corpus.ts';
import { defEntry, defTiers, type DefEntry } from '../corpus/defIndex.ts';
import { classify } from './queue.ts';
import { designTokens, sharedChrome, scrollbars } from '../elements/tokens.ts';
import { scenarioHref, objectsHref } from './WorkbenchApp.ts';

@customElement('mnx-objects-page')
export class ObjectsPage extends LitElement {
  /** Empty on the index; a schema object slug on the detail view. */
  @property({ type: String }) def = '';

  static styles = [
    designTokens,
    sharedChrome,
    scrollbars,
    css`
      :host {
        display: block;
        height: 100%;
        overflow-y: auto;
        padding: 30px 38px;
        box-sizing: border-box;
      }

      h1 {
        font-family: var(--sans);
        font-weight: 500;
        font-size: 24px;
        margin: 0 0 6px;
        display: flex;
        align-items: baseline;
        gap: 12px;
        flex-wrap: wrap;
      }

      h1 .mono {
        font-family: var(--mono);
        font-size: 18px;
      }

      .subtitle {
        font-size: 13px;
        color: var(--ink-2);
        margin: 0 0 26px;
        max-width: 68ch;
        line-height: 1.55;
      }

      .subtitle a {
        color: var(--accent);
      }

      section {
        margin-bottom: 26px;
        max-width: 900px;
      }

      h2 {
        font-size: 12px;
        font-family: var(--mono);
        letter-spacing: 0.07em;
        text-transform: uppercase;
        color: var(--ink-2);
        margin: 0 0 8px;
        display: flex;
        gap: 8px;
        align-items: baseline;
      }

      h2 .n {
        color: var(--accent);
      }

      h2 .hint {
        text-transform: none;
        letter-spacing: 0;
        color: var(--ink-3);
        font-size: 11px;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
        gap: 1px;
        background: var(--line);
        border: 1px solid var(--line);
        border-radius: var(--radius-panel);
        overflow: hidden;
      }

      .cell {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
        padding: 8px 12px;
        background: var(--surface);
        text-decoration: none;
        color: var(--ink);
        font-family: var(--mono);
        font-size: 11.5px;
      }

      .cell:hover {
        background: var(--hover);
      }

      .cell .counts {
        flex-shrink: 0;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }

      /* Exercised, but nothing here has been signed off. */
      .cell .counts.unwitnessed {
        color: var(--st-gap);
      }

      .rows {
        border: 1px solid var(--line);
        border-radius: var(--radius-panel);
        overflow: hidden;
        background: var(--surface);
      }

      .row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        border-top: 1px solid var(--line);
        text-decoration: none;
        color: var(--ink);
        font-size: 13px;
      }

      .row:first-child {
        border-top: none;
      }

      .row:hover {
        background: var(--hover);
      }

      .row .id {
        margin-left: auto;
        font-family: var(--mono);
        font-size: 11px;
        color: var(--ink-3);
      }

      .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex-shrink: 0;
        box-sizing: border-box;
      }

      .dot.current {
        background: var(--st-verified);
      }

      .dot.stale {
        background: transparent;
        border: 2px solid var(--st-verified);
      }

      .dot.never-seen {
        background: var(--st-rendered);
      }

      .dot.blocked {
        background: var(--st-gap);
      }

      .back {
        font-size: 12px;
        color: var(--ink-2);
        text-decoration: none;
        display: inline-block;
        margin-bottom: 14px;
      }

      .empty {
        color: var(--ink-2);
        font-size: 13px;
      }
    `
  ];

  private cell(entry: DefEntry) {
    const n = entry.scenarios.length;
    // Highlight "exercised but unwitnessed" — the count that flatters.
    const unwitnessed = n > 0 && entry.verifiedCount === 0;
    return html`
      <a class="cell" href=${objectsHref(entry.def)} title=${`${n} example(s), ${entry.verifiedCount} verified`}>
        <span>${entry.def}</span>
        <span class="counts ${unwitnessed ? 'unwitnessed' : ''}">
          ${n === 0 ? '—' : `${entry.verifiedCount}/${n}`}
        </span>
      </a>
    `;
  }

  private renderDetail(entry: DefEntry) {
    const n = entry.scenarios.length;
    return html`
      <a class="back" href=${objectsHref()}>← all objects</a>
      <h1><span class="mono">${entry.def}</span></h1>
      <p class="subtitle">
        ${n === 0
          ? html`No scenario in the corpus exercises this object yet.`
          : html`${n} scenario${n === 1 ? '' : 's'} exercise${n === 1 ? 's' : ''} this object,
            ${entry.verifiedCount} of them verified. The rail is filtered to match.`}
        <a href=${entry.specUrl} target="_blank">spec reference ↗</a>
      </p>
      ${n === 0
        ? html`<p class="empty">
            Nothing to show. This object is part of the coverage backlog — a new scenario naming it
            in <code>coversDefs</code> would appear here.
          </p>`
        : html`<div class="rows">
            ${entry.scenarios.map(s => {
              const item = classify(s);
              return html`
                <a class="row" href=${scenarioHref(s.id)}>
                  <span class="dot ${item.state}" title=${item.detail}></span>
                  <span>${s.meta.title}</span>
                  <span class="id">${s.id}</span>
                </a>
              `;
            })}
          </div>`}
    `;
  }

  private renderIndex() {
    const tiers = defTiers();
    return html`
      <h1>Schema objects</h1>
      <p class="subtitle">
        Every non-plumbing <code>$def</code> in the pinned schema, against the scenarios that
        exercise it. Counts read <em>verified / total</em>, so an object covered only by
        unapproved scenarios shows a zero on the left — exercised, but not yet evidence.
        <code>coversDefs</code> is the spec's own join, not ours. Currently
        ${coverage.covered}/${coverage.total} covered.
      </p>
      <section>
        <h2>
          Never exercised <span class="n">${tiers.none.length}</span>
          <span class="hint">the coverage backlog</span>
        </h2>
        <div class="grid">${tiers.none.map(e => this.cell(e))}</div>
      </section>
      <section>
        <h2>
          One example only <span class="n">${tiers.thin.length}</span>
          <span class="hint">thinnest cover — nothing disagrees with a single example</span>
        </h2>
        <div class="grid">${tiers.thin.map(e => this.cell(e))}</div>
      </section>
      <section>
        <h2>
          Covered <span class="n">${tiers.covered.length}</span>
          <span class="hint">two or more, deepest first</span>
        </h2>
        <div class="grid">${tiers.covered.map(e => this.cell(e))}</div>
      </section>
    `;
  }

  render() {
    if (!this.def) return this.renderIndex();
    const entry = defEntry(this.def);
    if (!entry) {
      return html`
        <a class="back" href=${objectsHref()}>← all objects</a>
        <h1><span class="mono">${this.def}</span></h1>
        <p class="subtitle">
          The pinned schema has no such object — it may be plumbing (excluded from the coverage
          axis) or it may have been renamed since this link was made.
        </p>
      `;
    }
    return this.renderDetail(entry);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mnx-objects-page': ObjectsPage;
  }
}
